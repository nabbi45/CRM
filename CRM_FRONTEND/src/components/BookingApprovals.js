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
import { enqueueSnackbar } from "notistack";
import { apiUrl } from "./LoginSignup";

const adminRoles = ["admin", "senior admin", "super admin", "director", "dev", "srdev", "sr dev"];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

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
    minHeight: { xs: 42, sm: 44 },
    borderRadius: "8px",
    px: { xs: 1.2, sm: 1.5 },
    fontWeight: 800,
    fontSize: { xs: "0.8rem", sm: "0.9rem" },
    bgcolor: bg,
    color: "#fff",
    boxShadow: "none",
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
      const res = await fetch(`${apiUrl}/booking/${selectedBooking._id}/refunds`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(refund),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Refund failed");
      enqueueSnackbar("Refund adjustment added.", { variant: "success" });
      setRefund({ amount: "", refund_date: new Date().toISOString().split("T")[0], note: "" });
      setSelectedBooking(null);
      await fetchBookings();
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

  return (
    <Box sx={{ p: { xs: 1, sm: 1.5, md: 2 }, width: "100%", maxWidth: 1560, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <ApprovalOutlinedIcon sx={{ color: "#ff5a36" }} />
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Booking Approvals
        </Typography>
      </Box>

      <Stack spacing={2}>
        {approvals.length === 0 && <Alert severity="info">No booking approval requests found.</Alert>}
        {approvals.map((approval) => {
          const proofs = getApprovalProofs(approval);
          const receivedAmount = approval.payload?.term_1 || approval.payload?.term_2 || approval.payload?.term_3 || 0;

          return (
            <Paper
              key={approval._id}
              variant="outlined"
              sx={{
                ...surfaceSx,
                p: { xs: 1.2, sm: 1.6, md: 1.9 },
                background: theme.palette.mode === "dark"
                  ? "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.94) 100%)"
                  : "linear-gradient(180deg, rgba(255,250,246,0.98) 0%, #ffffff 100%)",
              }}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} lg={8}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.2, flexWrap: "wrap" }}>
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: "1rem", sm: "1.2rem" } }}>
                      {approval.payload?.company_name || approval.payload?.contact_person || "BOOKING"}
                    </Typography>
                    <Chip size="small" label={approval.status.replace("_", " ").toUpperCase()} sx={{ borderRadius: "999px", fontWeight: 800 }} />
                    {approval.payload?.is_refundable && (
                      <Chip
                        size="small"
                        label={`Refundable ${approval.payload?.refundable_percentage || 0}%`}
                        sx={{ borderRadius: "999px", fontWeight: 800, bgcolor: "rgba(245,158,11,0.12)", color: "#d97706" }}
                      />
                    )}
                  </Stack>

                  <Grid container spacing={1.2} sx={{ mb: 1.25 }}>
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
                        <Typography sx={{ mt: 0.35, fontWeight: 800 }} noWrap>{(approval.payload?.services || []).join(", ") || "N/A"}</Typography>
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
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{
                          mt: 1.1,
                          "& > *": {
                            flex: { xs: "1 1 calc(50% - 4px)", sm: "1 1 calc(33.333% - 6px)", lg: "1 1 100%" },
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

      {isAdmin && (
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
                getOptionLabel={(booking) => `${booking.company_name || booking.contact_person || "BOOKING"} - ${booking.bdm || ""}`}
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
                Add Refund Adjustment
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
