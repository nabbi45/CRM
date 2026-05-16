import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import { apiUrl } from "./LoginSignup";

const adminRoles = ["admin", "senior admin", "super admin", "director", "dev", "srdev", "sr dev"];

const BookingApprovals = () => {
  const userSession = JSON.parse(localStorage.getItem("userSession")) || {};
  const isAdmin = adminRoles.includes((userSession.user_role || "").toLowerCase());
  const [approvals, setApprovals] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [refund, setRefund] = useState({ amount: "", refund_date: new Date().toISOString().split("T")[0], note: "" });
  const [commentById, setCommentById] = useState({});
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(() => ({
    authorization: userSession.token || "",
    "user-role": userSession.user_role || "",
    "user-name": userSession.name || "",
  }), [userSession.token, userSession.user_role, userSession.name]);

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

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
        Booking Approvals
      </Typography>

      <Stack spacing={2}>
        {approvals.length === 0 && <Alert severity="info">No booking approval requests found.</Alert>}
        {approvals.map((approval) => (
          <Paper key={approval._id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontWeight: 800 }}>
                    {approval.payload?.company_name || approval.payload?.contact_person || "BOOKING"}
                  </Typography>
                  <Chip size="small" label={approval.status.replace("_", " ").toUpperCase()} />
                  {approval.payload?.is_refundable && (
                    <Chip size="small" color="warning" label={`Refundable: ${approval.payload?.refundable_percentage}%`} />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  BDM: {approval.payload?.bdm || approval.submitted_by_name} | Amount: Rs {Number(approval.payload?.total_amount || 0).toLocaleString()} | Received: Rs {Number(approval.payload?.term_1 || 0).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Services: {(approval.payload?.services || []).join(", ") || "N/A"}
                </Typography>
                {approval.admin_comment && (
                  <Alert severity={approval.status === "rejected" ? "error" : "warning"} sx={{ mt: 1 }}>
                    {approval.admin_comment}
                  </Alert>
                )}
                {approval.payment_proof_url && (
                  <Button href={approval.payment_proof_url} target="_blank" size="small" sx={{ mt: 1 }}>
                    View payment proof
                  </Button>
                )}
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Comment"
                  value={commentById[approval._id] || ""}
                  onChange={(e) => setCommentById((prev) => ({ ...prev, [approval._id]: e.target.value }))}
                  sx={{ mb: 1 }}
                />
                {isAdmin && approval.status === "pending" && (
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button disabled={loading} variant="contained" onClick={() => actOnApproval(approval._id, "approve")}>Approve</Button>
                    <Button disabled={loading} variant="outlined" color="warning" onClick={() => actOnApproval(approval._id, "send-back")}>Send Back</Button>
                    <Button disabled={loading} variant="outlined" color="error" onClick={() => actOnApproval(approval._id, "reject")}>Reject</Button>
                  </Stack>
                )}
                {!isAdmin && approval.status === "sent_back" && (
                  <Button disabled={loading} variant="contained" onClick={() => resubmit(approval)}>
                    Resubmit
                  </Button>
                )}
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>

      {isAdmin && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mt: 3 }}>
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
                renderInput={(params) => <TextField {...params} label="Select Booking" />}
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
              <Button disabled={loading} variant="contained" onClick={submitRefund}>Add Refund Adjustment</Button>
            </Grid>
            {selectedBooking?.refund_adjustments?.length > 0 && (
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Previous Refund Adjustments</Typography>
                <Paper variant="outlined" sx={{ p: 0, borderRadius: 1, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}>
                      <tr>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>Date</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>Amount</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>Note</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBooking.refund_adjustments.map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: '8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            {new Date(r.refund_date).toLocaleDateString("en-GB")}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            ₹{Number(r.amount || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            {r.note || "-"}
                          </td>
                          <td style={{ padding: '8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
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
    </Box>
  );
};

export default BookingApprovals;
