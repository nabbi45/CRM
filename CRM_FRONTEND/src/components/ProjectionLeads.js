import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Tooltip,
  IconButton,
} from "@mui/material";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PublishedWithChangesOutlinedIcon from "@mui/icons-material/PublishedWithChangesOutlined";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import { enqueueSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "./LoginSignup";

const normalizeRole = (role = "") => role.toString().trim().toLowerCase();
const ROLES_WITH_ALL_ACCESS = ["admin", "super admin", "dev", "srdev", "senior admin"];
const ROLES_WITH_EDIT_ALL = ["bdm", ...ROLES_WITH_ALL_ACCESS];

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  name: "",
  phone_number: "",
  company_name: "",
  state: "",
  turnover: "",
  requirement: "",
  pitched: "",
  given_lead_to: "",
  notes_update: "",
};

const ProjectionLeads = () => {
  const session = JSON.parse(localStorage.getItem("userSession")) || {};
  const token = session?.token || "";
  const userId = session?.user_id || "";
  const userRole = normalizeRole(session?.user_role);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [transferredLeads, setTransferredLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [companyBranches, setCompanyBranches] = useState([]);

  const canViewAll = useMemo(() => ROLES_WITH_ALL_ACCESS.includes(userRole), [userRole]);

  const canEditLead = (lead) => {
    if (!lead) return false;
    if (ROLES_WITH_EDIT_ALL.includes(userRole)) return true;
    return lead.created_by === userId;
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: token,
  };

  const fetchLeads = async (includeTransferred = false) => {
    try {
      const url = includeTransferred
        ? `${apiUrl}/projection-leads?include_transferred=true`
        : `${apiUrl}/projection-leads`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch projection leads");
      if (includeTransferred) {
        setTransferredLeads(Array.isArray(data) ? data : []);
      } else {
        setLeads(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      enqueueSnackbar(error.message || "Failed to load projection leads", { variant: "error" });
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${apiUrl}/user/options`, { headers: { Authorization: token } });
      const data = await res.json();
      if (res.ok) {
        setUsers(Array.isArray(data?.users) ? data.users : []);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${apiUrl}/company/public`);
      const data = await res.json();
      if (res.ok && data.branches) {
        const branchesArray = data.branches.split(',').map(b => b.trim()).filter(Boolean);
        setCompanyBranches(branchesArray);
      }
    } catch (error) {
      console.error("Failed to fetch branches:", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchLeads(false);
      if (canViewAll) {
        await fetchLeads(true);
      }
      await fetchUsers();
      await fetchBranches();
      setLoading(false);
    };

    init();
  }, [canViewAll]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm({ ...emptyForm, date: new Date().toISOString().split("T")[0] });
    setEditingLeadId(null);
  };

  const validateForm = () => {
    if (!form.date || !form.name.trim() || !form.phone_number.trim()) {
      enqueueSnackbar("Date, Name and Phone Number are required.", { variant: "warning" });
      return false;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(form.phone_number.trim())) {
      enqueueSnackbar("Phone Number must be 10 digits.", { variant: "warning" });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const endpoint = editingLeadId
        ? `${apiUrl}/projection-leads/${editingLeadId}`
        : `${apiUrl}/projection-leads`;
      const method = editingLeadId ? "PATCH" : "POST";

      const payload = {
        ...form,
        phone_number: form.phone_number.trim(),
      };

      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Unable to save projection lead");

      enqueueSnackbar(
        editingLeadId ? "Projection lead updated." : "Projection lead created.",
        { variant: "success" }
      );

      resetForm();
      fetchLeads(false);
      if (canViewAll) {
        fetchLeads(true);
      }
    } catch (error) {
      enqueueSnackbar(error.message || "Unable to save projection lead", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (lead) => {
    setEditingLeadId(lead._id);
    setForm({
      date: new Date(lead.date).toISOString().split("T")[0],
      name: lead.name || "",
      phone_number: lead.phone_number || "",
      company_name: lead.company_name || "",
      state: lead.state || "",
      turnover: lead.turnover || "",
      requirement: lead.requirement || "",
      pitched: lead.pitched || "",
      given_lead_to: lead.given_lead_to || "",
      notes_update: lead.notes_update || "",
    });
  };

  const togglePaymentReceived = async (lead) => {
    try {
      const res = await fetch(`${apiUrl}/projection-leads/${lead._id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ payment_received: !lead.payment_received }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Unable to update payment status");

      enqueueSnackbar(
        !lead.payment_received ? "Payment marked as received." : "Payment marked as not received.",
        { variant: "success" }
      );
      fetchLeads(false);
      if (canViewAll) {
        fetchLeads(true);
      }
    } catch (error) {
      enqueueSnackbar(error.message || "Unable to update payment status", { variant: "error" });
    }
  };

  const transferToBooking = (lead) => {
    navigate("/dashboard/new-booking", {
      state: {
        projectionLeadId: lead._id,
        prefill: {
          branch: companyBranches[0] || "",
          companyName: lead.company_name || "",
          contactPerson: lead.name || "",
          contactNumber: lead.phone_number || "",
          state: lead.state || "",
          notes: [
            lead.requirement ? `Requirement: ${lead.requirement}` : "",
            lead.pitched ? `Pitched: ${lead.pitched}` : "",
            lead.notes_update ? `Update: ${lead.notes_update}` : "",
          ]
            .filter(Boolean)
            .join(" | "),
        },
      },
    });
  };

  const renderActions = (lead) => {
    const editable = canEditLead(lead);

    return (
      <Stack direction="row" spacing={0.5} justifyContent="flex-start">
        {editable && (
          <Tooltip title="Edit Lead">
            <IconButton
              size="small"
              color="primary"
              onClick={() => startEdit(lead)}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {editable && (
          <Tooltip title={lead.payment_received ? "Payment Received" : "Mark Payment Received"}>
            <IconButton
              size="small"
              color={lead.payment_received ? "success" : "warning"}
              onClick={() => togglePaymentReceived(lead)}
            >
              <CurrencyRupeeOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {lead.payment_received && (
          <Tooltip title="Transfer to Booking">
            <IconButton
              size="small"
              color="secondary"
              onClick={() => transferToBooking(lead)}
            >
              <PublishedWithChangesOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    );
  };

  const paymentChip = (lead) => (
    <Chip
      label={lead.payment_received ? "Received" : "Pending"}
      size="small"
      sx={{
        fontWeight: 700,
        bgcolor: lead.payment_received ? "rgba(16,185,129,0.16)" : "rgba(245,158,11,0.16)",
        color: lead.payment_received ? "#10b981" : "#f59e0b",
      }}
    />
  );

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <TrendingUpOutlinedIcon sx={{ color: "#3b82f6" }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Projection Lead Details
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {canViewAll
          ? "You can view and edit projection leads across the team."
          : "You can view your projection leads. BDM/Admin roles can edit before payment confirmation."}
      </Typography>

      {canViewAll && (
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
        >
          <Tab label={`Active Leads (${leads.length})`} />
          <Tab label={`Transferred History (${transferredLeads.length})`} />
        </Tabs>
      )}

      {tab === 0 && (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
            {editingLeadId ? "Edit Projection Lead" : "Add Projection Lead"}
          </Typography>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  name="date"
                  label="Date"
                  type="date"
                  value={form.date}
                  onChange={handleInputChange}
                  InputLabelProps={{ shrink: true }}
                  required
                  sx={{
                    '& input::-webkit-calendar-picker-indicator': {
                      filter: theme.palette.mode === 'dark' ? 'invert(1)' : 'none',
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  name="name"
                  label="Name"
                  value={form.name}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  name="phone_number"
                  label="Phone Number"
                  value={form.phone_number}
                  onChange={handleInputChange}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="company_name"
                  label="Company Name"
                  value={form.company_name}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="state"
                  label="State"
                  value={form.state}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="turnover"
                  label="Turnover"
                  value={form.turnover}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Given the Lead To</InputLabel>
                  <Select
                    name="given_lead_to"
                    label="Given the Lead To"
                    value={form.given_lead_to}
                    onChange={handleInputChange}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {users.map((user) => (
                      <MenuItem key={user._id} value={user.name}>
                        {user.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="requirement"
                  label="Requirement"
                  value={form.requirement}
                  onChange={handleInputChange}
                  multiline
                  minRows={2}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="pitched"
                  label="What I Have Pitched"
                  value={form.pitched}
                  onChange={handleInputChange}
                  multiline
                  minRows={2}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="notes_update"
                  label="Notes / Update"
                  value={form.notes_update}
                  onChange={handleInputChange}
                  multiline
                  minRows={2}
                />
              </Grid>

              <Grid item xs={12}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={saving}
                    sx={{ minWidth: 180 }}
                  >
                    {saving ? "Saving..." : editingLeadId ? "Update Lead" : "Add Lead"}
                  </Button>
                  {editingLeadId && (
                    <Button variant="outlined" onClick={resetForm}>
                      Cancel Edit
                    </Button>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {(tab === 0 ? leads : transferredLeads).length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {tab === 0 ? "No active projection leads found." : "No transferred leads found."}
                </Typography>
              </Paper>
            </Grid>
          )}

          {(tab === 0 ? leads : transferredLeads).map((lead) => (
            <Grid item xs={12} md={6} lg={4} xl={3} key={lead._id}>
              <Card sx={{ height: "100%", display: "flex", flexDirection: "column", borderRadius: 2, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {lead.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {lead.company_name || "No company"}
                      </Typography>
                    </Box>
                    {paymentChip(lead)}
                  </Box>

                  <Typography variant="body2" sx={{ mb: 2, fontWeight: 600, color: "primary.main" }}>
                    {lead.phone_number}
                  </Typography>

                  <Stack spacing={1} sx={{ mb: 2, p: 1.5, bgcolor: "rgba(0,0,0,0.02)", borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Date:</span> <b>{new Date(lead.date).toLocaleDateString("en-IN")}</b>
                    </Typography>
                    <Typography variant="caption" sx={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>State:</span> <b>{lead.state || "-"}</b>
                    </Typography>
                    <Typography variant="caption" sx={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Turnover:</span> <b>{lead.turnover || "-"}</b>
                    </Typography>
                    <Typography variant="caption" sx={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Requirement:</span> <b style={{ textAlign: "right", maxWidth: "60%" }}>{lead.requirement || "-"}</b>
                    </Typography>
                    <Typography variant="caption" sx={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Pitched:</span> <b style={{ textAlign: "right", maxWidth: "60%" }}>{lead.pitched || "-"}</b>
                    </Typography>
                    <Typography variant="caption" sx={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Given Lead To:</span> <b>{lead.given_lead_to || "-"}</b>
                    </Typography>
                    <Typography variant="caption" sx={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Notes:</span> <b style={{ textAlign: "right", maxWidth: "60%" }}>{lead.notes_update || "-"}</b>
                    </Typography>
                    <Typography variant="caption" sx={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Owner:</span> <b>{lead.created_by_name || "-"}</b>
                    </Typography>
                  </Stack>

                  <Box sx={{ mt: "auto", pt: 1, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                    {tab === 0 ? renderActions(lead) : (
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          Booking ID: {lead.transferred_booking_id || "-"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Transferred: {lead.transferred_at ? new Date(lead.transferred_at).toLocaleDateString("en-IN") : "-"}
                        </Typography>
                      </Stack>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default ProjectionLeads;
