import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ApprovalOutlinedIcon from "@mui/icons-material/ApprovalOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { enqueueSnackbar } from "notistack";
import { apiUrl } from "./LoginSignup";
import { getBookingRefundableLabel } from "../utils/bookingRevenue";

const adminRoles = ["admin", "senior admin", "super admin", "director", "dev", "srdev", "sr dev"];
const refundControlRoles = ["director", "dev", "developer", "srdev", "sr dev", "sr developer"];
const TERM_KEYS = Array.from({ length: 10 }, (_, index) => `term_${index + 1}`);

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatBookingShareLabel = (booking = {}) => {
  const participants = new Map();

  TERM_KEYS.forEach((termKey) => {
    const termShare = booking?.term_shares?.[termKey];
    if (!termShare?.creator?.user_id && Number(booking?.[termKey] || 0) <= 0) return;

    const creatorName = termShare?.creator?.user_name || booking.bdm || "N/A";
    const creatorId = termShare?.creator?.user_id || booking.user_id || creatorName;
    if (!participants.has(String(creatorId))) {
      participants.set(String(creatorId), {
        name: creatorName,
        parts: new Set(),
      });
    }

    (Array.isArray(termShare?.shared_with) ? termShare.shared_with : []).forEach((sw) => {
      const key = String(sw.user_id || sw.user_name || Math.random());
      if (!participants.has(key)) {
        participants.set(key, {
          name: sw.user_name || "Coworker",
          parts: new Set(),
        });
      }
      participants.get(key).parts.add(`${termKey.replace("_", " ").toUpperCase()}: ${sw.percentage}%`);
    });
  });

  if (participants.size <= 1) return booking.bdm || "N/A";

  const creatorName = booking.bdm || [...participants.values()][0]?.name || "N/A";
  const sharedSummary = [...participants.values()]
    .filter((person) => person.name !== creatorName && person.parts.size > 0)
    .map((person) => `${person.name} (${[...person.parts].join(", ")})`)
    .join(", ");

  return sharedSummary ? `${creatorName} | Shared: ${sharedSummary}` : creatorName;
};

const BookingApprovals = () => {
  const userSession = JSON.parse(localStorage.getItem("userSession")) || {};
  const isAdmin = adminRoles.includes((userSession.user_role || "").toLowerCase());
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [approvals, setApprovals] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [refund, setRefund] = useState({ amount: "", refund_date: new Date().toISOString().split("T")[0], note: "" });
  const [commentById, setCommentById] = useState({});
  const [loading, setLoading] = useState(false);
  const [proofPreview, setProofPreview] = useState({ open: false, url: "", objectUrl: "", fileName: "", mimeType: "", isImage: false });
  const [approvalSearch, setApprovalSearch] = useState("");
  const [editingRefundId, setEditingRefundId] = useState("");
  const canControlRefunds = refundControlRoles.includes((userSession.user_role || "").toLowerCase());

  const authHeaders = useMemo(() => ({
    authorization: userSession.token || "",
    "user-role": userSession.user_role || "",
    "user-name": userSession.name || "",
  }), [userSession.token, userSession.user_role, userSession.name]);

  const surfaceSx = {
    borderRadius: "8px",
    border: "1px solid",
    borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.2)",
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.palette.mode === "dark" ? "0 16px 30px rgba(2,6,23,0.28)" : "0 16px 36px rgba(15,23,42,0.06)",
  };

  const metricCardSx = (tint, color) => ({
    p: 1.25,
    borderRadius: "8px",
    background: theme.palette.mode === "dark"
      ? "rgba(15,23,42,0.8)"
      : `linear-gradient(180deg, ${tint} 0%, rgba(255,255,255,0.96) 100%)`,
    border: "1px solid",
    borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.1)",
    minHeight: 88,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    color,
  });

  const actionButtonSx = (bg, hover) => ({
    minHeight: { xs: 40, sm: 44 },
    borderRadius: "8px",
    px: { xs: 1.2, sm: 1.5 },
    fontWeight: 800,
    fontSize: { xs: "0.8rem", sm: "0.9rem" },
    bgcolor: bg,
    color: "#fff",
    boxShadow: "none",
    width: "100%",
    "&:hover": { bgcolor: hover, boxShadow: "none" },
  });

  const fetchApprovals = async () => {
    const res = await fetch(`${apiUrl}/booking-approvals`, { headers: authHeaders });
    const data = await res.json().catch(() => []);
    if (res.ok) setApprovals(Array.isArray(data) ? data : []);
  };

  const fetchBookings = async () => {
    if (!isAdmin) return;
    const res = await fetch(`${apiUrl}/booking/all`, { headers: authHeaders });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setBookings(data.Allbookings || []);
  };

  useEffect(() => {
    fetchApprovals();
    fetchBookings();
  }, []);

  const actOnApproval = async (approvalId, action) => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/booking-approvals/${approvalId}/${action}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: commentById[approvalId] || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Action failed");
      enqueueSnackbar(data.message || "Updated", { variant: "success" });
      setCommentById((prev) => ({ ...prev, [approvalId]: "" }));
      await fetchApprovals();
      await fetchBookings();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const resubmit = async (approval) => {
    try {
      setLoading(true);
      const form = new FormData();
      form.append("payload", JSON.stringify(approval.payload || {}));
      form.append("comment", commentById[approval._id] || "");
      const res = await fetch(`${apiUrl}/booking-approvals/${approval._id}/resubmit`, {
        method: "PATCH",
        headers: { authorization: userSession.token || "" },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Resubmit failed");
      enqueueSnackbar("Booking resubmitted for approval.", { variant: "success" });
      await fetchApprovals();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const submitRefund = async () => {
    if (!selectedBooking?._id) return enqueueSnackbar("Select a booking first.", { variant: "warning" });
    if (!Number(refund.amount || 0)) return enqueueSnackbar("Enter refund amount.", { variant: "warning" });

    try {
      setLoading(true);
      const isEditing = Boolean(editingRefundId);
      const res = await fetch(`${apiUrl}/booking/${selectedBooking._id}/refunds${isEditing ? `/${editingRefundId}` : ""}`, {
        method: isEditing ? "PATCH" : "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(refund),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Refund failed");
      enqueueSnackbar(isEditing ? "Refund adjustment updated." : "Refund adjustment added.", { variant: "success" });
      setRefund({ amount: "", refund_date: new Date().toISOString().split("T")[0], note: "" });
      setEditingRefundId("");
      if (data.booking) setSelectedBooking(data.booking);
      await fetchBookings();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const beginEditRefund = (booking, refundEntry) => {
    setSelectedBooking(booking);
    setEditingRefundId(refundEntry?._id || "");
    setRefund({
      amount: refundEntry?.amount || "",
      refund_date: refundEntry?.refund_date ? new Date(refundEntry.refund_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      note: refundEntry?.note || "",
    });
  };

  const handleDeleteRefund = async (bookingId, refundId) => {
    if (!window.confirm("Delete this refund adjustment?")) return;
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/booking/${bookingId}/refunds/${refundId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Delete failed");
      enqueueSnackbar("Refund adjustment deleted.", { variant: "success" });
      await fetchBookings();
      if (selectedBooking?._id === bookingId) {
        const refreshed = (bookings || []).find((item) => item._id === bookingId);
        if (refreshed) setSelectedBooking(refreshed);
      }
    } catch (err) {
      enqueueSnackbar(err.message, { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const isImageProof = (approval, mimeType = "") => {
    const name = approval?.payment_proof_file_name || "";
    return String(mimeType || approval?.payment_proof_mime_type || "").startsWith("image/") ||
      /\.(png|jpe?g|webp|gif|bmp)$/i.test(name);
  };

  const getApprovalProofs = (approval) => {
    const proofList = Array.isArray(approval?.payment_proofs) ? approval.payment_proofs : [];
    if (proofList.length > 0) return proofList;
    if (approval?.payment_proof_url) {
      return [{
        url: approval.payment_proof_url,
        file_name: approval.payment_proof_file_name || "payment-proof",
        mime_type: approval.payment_proof_mime_type || "",
      }];
    }
    return [];
  };

  const fetchProofBlob = async (proof) => {
    const response = await fetch(proof.url);
    if (!response.ok) throw new Error("Unable to fetch payment proof.");
    return response.blob();
  };

  const handleViewProof = async (proof) => {
    try {
      const blob = await fetchProofBlob(proof);
      const objectUrl = URL.createObjectURL(blob);
      setProofPreview({
        open: true,
        url: proof.url,
        objectUrl,
        fileName: proof.file_name || "payment-proof",
        mimeType: blob.type || proof.mime_type || "",
        isImage: isImageProof({
          payment_proof_file_name: proof.file_name,
          payment_proof_mime_type: proof.mime_type,
        }, blob.type),
      });
    } catch (err) {
      window.open(proof.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownloadProof = async (proof) => {
    try {
      const blob = await fetchProofBlob(proof);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = proof.file_name || "payment-proof";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      window.open(proof.url, "_blank", "noopener,noreferrer");
    }
  };

  const closeProofPreview = () => {
    if (proofPreview.objectUrl) URL.revokeObjectURL(proofPreview.objectUrl);
    setProofPreview({ open: false, url: "", objectUrl: "", fileName: "", mimeType: "", isImage: false });
  };

  const getApprovalTermLabel = (approval) => {
    if (approval?.payload?.continuation_term_label) return approval.payload.continuation_term_label;
    const termKey = TERM_KEYS.find((key) => Number(approval?.payload?.[key] || 0) > 0);
    return termKey ? `Term ${TERM_KEYS.indexOf(termKey) + 1}` : "Term 1";
  };

  const filteredApprovals = useMemo(() => {
    const needle = String(approvalSearch || "").trim().toLowerCase();
    if (!needle) return approvals;
    return approvals.filter((approval) => {
      const haystack = [
        approval?.payload?.company_name,
        approval?.payload?.contact_person,
        approval?.payload?.bdm,
        Array.isArray(approval?.payload?.services) ? approval.payload.services.join(" ") : approval?.payload?.services,
        approval?.status,
        getApprovalTermLabel(approval),
        approval?.submitted_by_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [approvals, approvalSearch]);

  const selectedRefundRows = Array.isArray(selectedBooking?.refund_adjustments)
    ? selectedBooking.refund_adjustments
    : [];

  const refundPanel = isAdmin ? (
    <Paper variant="outlined" sx={{ ...surfaceSx, p: { xs: 1.4, sm: 1.8, md: 2 }, mb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        Refund Adjustment
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter the actual customer refund including GST. Example: for 10000 + GST, enter 11800; non-cash GST is removed internally.
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Autocomplete
            options={bookings}
            value={selectedBooking}
            onChange={(_, value) => {
              setSelectedBooking(value);
              setEditingRefundId("");
              setRefund({ amount: "", refund_date: new Date().toISOString().split("T")[0], note: "" });
            }}
            getOptionLabel={(booking) => `${booking.company_name || booking.contact_person || "BOOKING"} - ${formatBookingShareLabel(booking)}`}
            isOptionEqualToValue={(option, value) => option?._id === value?._id}
            renderInput={(params) => <TextField {...params} label={isMobile ? "Booking" : "Select Booking"} />}
          />
        </Grid>
        <Grid item xs={12} md={2}>
          <TextField fullWidth label="Refund Amount" type="number" value={refund.amount} onChange={(e) => setRefund((prev) => ({ ...prev, amount: e.target.value }))} />
        </Grid>
        <Grid item xs={12} md={2}>
          <TextField fullWidth label="Refund Date" type="date" value={refund.refund_date} onChange={(e) => setRefund((prev) => ({ ...prev, refund_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField fullWidth label="Note" value={refund.note} onChange={(e) => setRefund((prev) => ({ ...prev, note: e.target.value }))} />
        </Grid>
        <Grid item xs={12}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button disabled={loading} variant="contained" onClick={submitRefund} sx={{ borderRadius: "8px" }}>
              {editingRefundId ? "Update Refund Adjustment" : "Add Refund Adjustment"}
            </Button>
            {editingRefundId && (
              <Button
                variant="outlined"
                onClick={() => {
                  setEditingRefundId("");
                  setRefund({ amount: "", refund_date: new Date().toISOString().split("T")[0], note: "" });
                }}
                sx={{ borderRadius: "8px" }}
              >
                Cancel Edit
              </Button>
            )}
          </Stack>
        </Grid>
        {selectedRefundRows.length > 0 && (
          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Previous Refund Adjustments</Typography>
            <Paper variant="outlined" sx={{ p: 0, borderRadius: "8px", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", minWidth: 680 }}>
                <thead style={{ backgroundColor: "rgba(0,0,0,0.04)" }}>
                  <tr>
                    <th style={{ padding: 8, textAlign: "left" }}>Date</th>
                    <th style={{ padding: 8, textAlign: "right" }}>Amount</th>
                    <th style={{ padding: 8, textAlign: "left" }}>Note</th>
                    <th style={{ padding: 8, textAlign: "left" }}>By</th>
                    {canControlRefunds && <th style={{ padding: 8, textAlign: "right" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {selectedRefundRows.map((row, index) => (
                    <tr key={row._id || index}>
                      <td style={{ padding: 8, borderTop: "1px solid rgba(0,0,0,0.06)" }}>{row.refund_date ? new Date(row.refund_date).toLocaleDateString("en-GB") : "-"}</td>
                      <td style={{ padding: 8, textAlign: "right", borderTop: "1px solid rgba(0,0,0,0.06)" }}>{formatCurrency(row.amount || 0)}</td>
                      <td style={{ padding: 8, borderTop: "1px solid rgba(0,0,0,0.06)" }}>{row.note || "-"}</td>
                      <td style={{ padding: 8, borderTop: "1px solid rgba(0,0,0,0.06)" }}>{row.created_by_name || "Unknown"}</td>
                      {canControlRefunds && (
                        <td style={{ padding: 8, borderTop: "1px solid rgba(0,0,0,0.06)", textAlign: "right" }}>
                          <Button size="small" startIcon={<EditOutlinedIcon fontSize="small" />} onClick={() => beginEditRefund(selectedBooking, row)}>
                            Edit
                          </Button>
                          <Button size="small" color="error" startIcon={<DeleteOutlineIcon fontSize="small" />} onClick={() => handleDeleteRefund(selectedBooking._id, row._id)}>
                            Delete
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Paper>
  ) : null;

  return (
    <Box sx={{ p: { xs: 0.5, sm: 1.5, md: 2 }, width: "100%", maxWidth: 1560, mx: "auto", overflowX: "hidden" }}>
      <Box sx={{ display: isMobile ? "none" : "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <ApprovalOutlinedIcon sx={{ color: "#ff5a36" }} />
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Booking Approvals
        </Typography>
      </Box>

      {refundPanel}

      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ ...surfaceSx, p: { xs: 1, sm: 1.25 } }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search company, BDM, service, status, or term..."
            value={approvalSearch}
            onChange={(e) => setApprovalSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchOutlinedIcon fontSize="small" style={{ marginRight: 8, opacity: 0.7 }} />,
            }}
          />
        </Paper>
        {filteredApprovals.length === 0 && <Alert severity="info">No booking approval requests found.</Alert>}
        {filteredApprovals.map((approval) => {
          const proofs = getApprovalProofs(approval);
          const receivedAmount = TERM_KEYS.reduce((sum, key) => sum + Number(approval.payload?.[key] || 0), 0);

          return (
            <Paper
              key={approval._id}
              variant="outlined"
              sx={{
                ...surfaceSx,
                p: { xs: 1, sm: 1.6, md: 1.9 },
                background: theme.palette.mode === "dark"
                  ? "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.94) 100%)"
                  : "linear-gradient(180deg, rgba(255,250,246,0.98) 0%, #ffffff 100%)",
              }}
            >
              <Grid container spacing={{ xs: 1.25, sm: 2 }}>
                <Grid item xs={12} lg={8}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.2, flexWrap: "wrap" }}>
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: "1rem", sm: "1.2rem" } }}>
                      {approval.payload?.company_name || approval.payload?.contact_person || "BOOKING"}
                    </Typography>
                    <Chip size="small" label={approval.status.replace("_", " ").toUpperCase()} sx={{ borderRadius: "999px", fontWeight: 800 }} />
                    <Chip size="small" label={getApprovalTermLabel(approval).toUpperCase()} sx={{ borderRadius: "999px", fontWeight: 800, bgcolor: "rgba(59,130,246,0.12)", color: "#2563eb" }} />
                    {getBookingRefundableLabel(approval.payload) && (
                      <Chip
                        size="small"
                        label={getBookingRefundableLabel(approval.payload)}
                        sx={{ borderRadius: "999px", fontWeight: 800, bgcolor: "rgba(245,158,11,0.12)", color: "#d97706" }}
                      />
                    )}
                  </Stack>

                  <Grid container spacing={1} sx={{ mb: 1.25 }}>
                    <Grid item xs={6} sm={3}>
                      <Box sx={metricCardSx("rgba(59,130,246,0.08)", theme.palette.text.primary)}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: "uppercase" }}>BDM</Typography>
                        <Typography sx={{ mt: 0.35, fontWeight: 800 }}>{approval.payload?.bdm || approval.submitted_by_name || "N/A"}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box sx={metricCardSx("rgba(249,115,22,0.1)", "#f97316")}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: "uppercase" }}>Amount</Typography>
                        <Typography sx={{ mt: 0.35, fontWeight: 900, color: "#f97316" }}>{formatCurrency(approval.payload?.total_amount || 0)}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box sx={metricCardSx("rgba(16,185,129,0.1)", "#059669")}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: "uppercase" }}>Received</Typography>
                        <Typography sx={{ mt: 0.35, fontWeight: 900, color: "#059669" }}>{formatCurrency(receivedAmount)}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box sx={metricCardSx("rgba(139,92,246,0.08)", theme.palette.text.primary)}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: "uppercase" }}>Services</Typography>
                        <Typography sx={{ mt: 0.35, fontWeight: 800, whiteSpace: "normal", wordBreak: "break-word" }}>{(approval.payload?.services || []).join(", ") || "N/A"}</Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {approval.admin_comment && (
                    <Alert severity={approval.status === "rejected" ? "error" : "warning"} sx={{ mt: 1 }}>
                      {approval.admin_comment}
                    </Alert>
                  )}

                  {proofs.length > 0 && (
                    <Stack spacing={1} sx={{ mt: 1.25 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Payment proof(s): {proofs.length}
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                          gap: 1,
                        }}
                      >
                        {proofs.map((proof, proofIndex) => (
                          <Paper
                            key={`${approval._id}-proof-${proofIndex}`}
                            variant="outlined"
                            sx={{
                              borderRadius: "8px",
                              p: 1.1,
                              borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.16)" : "rgba(148,163,184,0.18)",
                            }}
                          >
                            <Typography variant="caption" sx={{ display: "block", mb: 1, fontWeight: 800 }}>
                              Proof {proofIndex + 1}
                            </Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<VisibilityOutlinedIcon fontSize="small" />}
                                onClick={() => handleViewProof(proof)}
                                sx={{ borderRadius: "8px", flex: 1 }}
                              >
                                View
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<DownloadOutlinedIcon fontSize="small" />}
                                onClick={() => handleDownloadProof(proof)}
                                sx={{ borderRadius: "8px", flex: 1 }}
                              >
                                Download
                              </Button>
                            </Stack>
                          </Paper>
                        ))}
                      </Box>
                    </Stack>
                  )}
                </Grid>

                <Grid item xs={12} lg={4}>
                  <Paper
                    variant="outlined"
                    sx={{
                      borderRadius: "8px",
                      borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.16)" : "rgba(148,163,184,0.18)",
                      p: 1.1,
                      height: "100%",
                      minHeight: 0,
                    }}
                  >
                    <TextField
                      fullWidth
                      size="small"
                      label="Review Comment"
                      value={commentById[approval._id] || ""}
                      onChange={(e) => setCommentById((prev) => ({ ...prev, [approval._id]: e.target.value }))}
                      multiline
                      minRows={isMobile ? 3 : 4}
                    />
                    {isAdmin && approval.status === "pending" && (
                      <Stack
                        direction={isMobile ? "column" : "row"}
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{
                          mt: 1.1,
                          "& > *": {
                            flex: isMobile ? "1 1 100%" : { sm: "1 1 calc(33.333% - 6px)", lg: "1 1 100%" },
                            width: isMobile ? "100%" : "auto",
                          },
                        }}
                      >
                        <Button
                          disabled={loading}
                          variant="contained"
                          startIcon={<CheckOutlinedIcon fontSize="small" />}
                          onClick={() => actOnApproval(approval._id, "approve")}
                          sx={actionButtonSx("#10b981", "#059669")}
                        >
                          Approve
                        </Button>
                        <Button
                          disabled={loading}
                          variant="contained"
                          startIcon={<SendOutlinedIcon fontSize="small" />}
                          onClick={() => actOnApproval(approval._id, "send-back")}
                          sx={actionButtonSx("#f59e0b", "#d97706")}
                        >
                          Send Back
                        </Button>
                        <Button
                          disabled={loading}
                          variant="contained"
                          startIcon={<CloseOutlinedIcon fontSize="small" />}
                          onClick={() => actOnApproval(approval._id, "reject")}
                          sx={actionButtonSx("#f43f5e", "#e11d48")}
                        >
                          Reject
                        </Button>
                      </Stack>
                    )}
                    {!isAdmin && approval.status === "sent_back" && (
                      <Button
                        disabled={loading}
                        variant="contained"
                        onClick={() => resubmit(approval)}
                        fullWidth={isMobile}
                        sx={{ mt: 1.1, borderRadius: "8px" }}
                      >
                        Resubmit
                      </Button>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </Paper>
          );
        })}
      </Stack>

      {false && isAdmin && (
        <Paper variant="outlined" sx={{ ...surfaceSx, p: { xs: 1.4, sm: 1.8, md: 2 }, mt: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            Refund Adjustment
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={5}>
              <Autocomplete
                options={bookings}
                value={selectedBooking}
                onChange={(_, value) => setSelectedBooking(value)}
                getOptionLabel={(booking) => `${booking.company_name || booking.contact_person || "BOOKING"} - ${formatBookingShareLabel(booking)}`}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                renderInput={(params) => <TextField {...params} label={isMobile ? "Booking" : "Select Booking"} />}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth label="Refund Amount" type="number" value={refund.amount} onChange={(e) => setRefund((prev) => ({ ...prev, amount: e.target.value }))} />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth label="Refund Date" type="date" value={refund.refund_date} onChange={(e) => setRefund((prev) => ({ ...prev, refund_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth label="Note" value={refund.note} onChange={(e) => setRefund((prev) => ({ ...prev, note: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <Button disabled={loading} variant="contained" onClick={submitRefund} sx={{ borderRadius: "8px" }}>
                {editingRefundId ? "Update Refund Adjustment" : "Add Refund Adjustment"}
              </Button>
            </Grid>
            {selectedBooking?.refund_adjustments?.length > 0 && (
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Previous Refund Adjustments</Typography>
                <Paper variant="outlined" sx={{ p: 0, borderRadius: "8px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                    <thead style={{ backgroundColor: "rgba(0,0,0,0.04)" }}>
                      <tr>
                        <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Date</th>
                        <th style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Amount</th>
                        <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Note</th>
                        <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid rgba(0,0,0,0.12)" }}>By</th>
                        {refundControlRoles.includes((userSession.user_role || "").toLowerCase()) && (
                          <th style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid rgba(0,0,0,0.12)" }}>Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBooking.refund_adjustments.map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                            {new Date(r.refund_date).toLocaleDateString("en-GB")}
                          </td>
                          <td style={{ padding: "8px", textAlign: "right", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                            {formatCurrency(r.amount || 0)}
                          </td>
                          <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                            {r.note || "-"}
                          </td>
                          <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                            {r.created_by_name || "Unknown"}
                          </td>
                          {refundControlRoles.includes((userSession.user_role || "").toLowerCase()) && (
                            <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.06)", textAlign: "right" }}>
                              <Button size="small" startIcon={<EditOutlinedIcon fontSize="small" />} onClick={() => beginEditRefund(selectedBooking, r)}>
                                Edit
                              </Button>
                              <Button size="small" color="error" startIcon={<DeleteOutlineIcon fontSize="small" />} onClick={() => handleDeleteRefund(selectedBooking._id, r._id)}>
                                Delete
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      <Dialog open={proofPreview.open} onClose={closeProofPreview} maxWidth="md" fullWidth>
        <DialogTitle>{proofPreview.fileName || "Payment Proof"}</DialogTitle>
        <DialogContent dividers>
          {proofPreview.isImage ? (
            <Box
              component="img"
              src={proofPreview.objectUrl || proofPreview.url}
              alt="Payment proof"
              sx={{ width: "100%", maxHeight: "70vh", objectFit: "contain", bgcolor: "background.default" }}
            />
          ) : (
            <Box sx={{ height: "70vh" }}>
              <iframe
                title="Payment proof"
                src={proofPreview.objectUrl || proofPreview.url}
                style={{ width: "100%", height: "100%", border: 0 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeProofPreview}>Close</Button>
          <Button
            variant="contained"
            onClick={() => handleDownloadProof({
              url: proofPreview.url,
              file_name: proofPreview.fileName,
              mime_type: proofPreview.mimeType,
            })}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BookingApprovals;
