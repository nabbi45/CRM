import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
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
  CircularProgress,
  Tooltip,
  IconButton,
} from "@mui/material";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PublishedWithChangesOutlinedIcon from "@mui/icons-material/PublishedWithChangesOutlined";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import PhoneIphoneOutlinedIcon from "@mui/icons-material/PhoneIphoneOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import { enqueueSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "./LoginSignup";

const normalizeRole = (role = "") => role.toString().trim().toLowerCase();
const ROLES_WITH_ALL_ACCESS = ["admin", "super admin", "director", "dev", "srdev", "sr dev"];
const ROLES_WITH_EDIT_ALL = [...ROLES_WITH_ALL_ACCESS];

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
  const featurePermissions = useMemo(
    () => (Array.isArray(session?.feature_permissions) ? session.feature_permissions : []),
    [session?.feature_permissions]
  );

  const theme = useTheme();
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

  const canViewAll = useMemo(
    () => ROLES_WITH_ALL_ACCESS.includes(userRole) || featurePermissions.includes("projection_leads_all"),
    [userRole, featurePermissions]
  );

  const canEditLead = (lead) => {
    if (!lead) return false;
    if (ROLES_WITH_EDIT_ALL.includes(userRole)) return true;
    if (featurePermissions.includes("projection_leads_all")) return true;
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

  const handleDeleteLead = async (lead) => {
    if (!window.confirm(`Delete projection lead for ${lead?.name || "this employee"}?`)) return;
    try {
      const res = await fetch(`${apiUrl}/projection-leads/${lead._id}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Unable to delete projection lead");
      enqueueSnackbar("Projection lead deleted.", { variant: "success" });
      fetchLeads(false);
      if (canViewAll) {
        fetchLeads(true);
      }
      if (editingLeadId === lead._id) resetForm();
    } catch (error) {
      enqueueSnackbar(error.message || "Unable to delete projection lead", { variant: "error" });
    }
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
          <Tooltip title="Delete Lead">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteLead(lead)}
            >
              <DeleteOutlineOutlinedIcon fontSize="small" />
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

  const pageShellSx = {
    width: "100%",
    maxWidth: { xl: 1580 },
    mx: "auto",
  };

  const glassCardSx = {
    borderRadius: "8px",
    border: "1px solid",
    borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.22)",
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.palette.mode === "dark" ? "0 12px 28px rgba(2,6,23,0.28)" : "0 14px 34px rgba(15,23,42,0.06)",
  };

  const formSectionSx = (tint, accent) => ({
    ...glassCardSx,
    background: theme.palette.mode === "dark"
      ? "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(15,23,42,0.92) 100%)"
      : `linear-gradient(180deg, ${tint} 0%, #ffffff 100%)`,
    "& .MuiOutlinedInput-root": {
      borderRadius: "8px",
      backgroundColor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.72)" : "rgba(255,255,255,0.88)",
      "& fieldset": {
        borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.32)",
      },
      "&:hover fieldset": {
        borderColor: accent,
      },
      "&.Mui-focused fieldset": {
        borderColor: accent,
        boxShadow: `0 0 0 3px ${accent}22`,
      },
    },
  });

  const summaryTint = [
    { bg: "linear-gradient(180deg, #f7fbff 0%, #ffffff 100%)", iconBg: "rgba(59,130,246,0.14)", iconColor: "#2563eb" },
    { bg: "linear-gradient(180deg, #fff9f3 0%, #ffffff 100%)", iconBg: "rgba(249,115,22,0.14)", iconColor: "#ea580c" },
    { bg: "linear-gradient(180deg, #f7fcf8 0%, #ffffff 100%)", iconBg: "rgba(16,185,129,0.14)", iconColor: "#059669" },
  ];

  const leadSummary = [
    { label: "Active Leads", value: leads.length, sub: "Current pipeline", icon: <TrendingUpOutlinedIcon fontSize="small" /> },
    { label: "Transferred", value: transferredLeads.length, sub: "Converted to booking", icon: <PublishedWithChangesOutlinedIcon fontSize="small" /> },
    { label: "Payment Received", value: leads.filter((lead) => lead.payment_received).length, sub: "Ready for booking", icon: <CurrencyRupeeOutlinedIcon fontSize="small" /> },
  ];

  const detailRows = [
    { label: "Date", value: (lead) => new Date(lead.date).toLocaleDateString("en-IN"), icon: <CalendarMonthOutlinedIcon fontSize="inherit" /> },
    { label: "State", value: (lead) => lead.state || "-", icon: <ApartmentOutlinedIcon fontSize="inherit" /> },
    { label: "Turnover", value: (lead) => lead.turnover || "-", icon: <TrendingUpOutlinedIcon fontSize="inherit" /> },
    { label: "Requirement", value: (lead) => lead.requirement || "-", icon: <AssignmentOutlinedIcon fontSize="inherit" /> },
    { label: "Pitched", value: (lead) => lead.pitched || "-", icon: <CampaignOutlinedIcon fontSize="inherit" /> },
    { label: "Owner", value: (lead) => lead.created_by_name || "-", icon: <PersonOutlineOutlinedIcon fontSize="inherit" /> },
  ];

  return (
    <Box sx={{ p: { xs: 1, sm: 1.5, md: 2 } }}>
      <Box sx={pageShellSx}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
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

      <Grid container spacing={{ xs: 1, sm: 1.25, md: 1.5 }} sx={{ mb: 2.2 }}>
        {leadSummary.map((item, index) => {
          const palette = summaryTint[index % summaryTint.length];
          return (
            <Grid item xs={12} sm={4} key={item.label}>
              <Card sx={{ ...glassCardSx, background: palette.bg, minHeight: 118 }}>
                <CardContent sx={{ p: { xs: 1.3, sm: 1.5 }, "&:last-child": { pb: { xs: 1.3, sm: 1.5 } } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                        {item.label}
                      </Typography>
                      <Typography sx={{ mt: 0.5, fontWeight: 800, fontSize: { xs: "1.35rem", sm: "1.6rem" }, color: "#0f172a" }}>
                        {item.value}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                        {item.sub}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: "8px",
                        display: "grid",
                        placeItems: "center",
                        bgcolor: palette.iconBg,
                        color: palette.iconColor,
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {canViewAll && (
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{
            mb: 2,
            minHeight: 0,
            p: 0.5,
            borderRadius: "8px",
            bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)",
            "& .MuiTab-root": { textTransform: "none", fontWeight: 700, minHeight: 40, borderRadius: "8px" }
          }}
        >
          <Tab label={`Active Leads (${leads.length})`} />
          <Tab label={`Transferred History (${transferredLeads.length})`} />
        </Tabs>
      )}

      {tab === 0 && (
      <Card sx={{ ...formSectionSx("#f8fbff", "#3b82f6"), mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 700 }}>
            {editingLeadId ? "Edit Projection Lead" : "Add Projection Lead"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Keep the lead neatly structured so the handoff into booking is fast and clean.
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
                  InputProps={{
                    startAdornment: <PersonOutlineOutlinedIcon sx={{ color: "#8b5cf6", mr: 1, fontSize: 18 }} />,
                  }}
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
                  InputProps={{
                    startAdornment: <PhoneIphoneOutlinedIcon sx={{ color: "#ea580c", mr: 1, fontSize: 18 }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="company_name"
                  label="Company Name"
                  value={form.company_name}
                  onChange={handleInputChange}
                  InputProps={{
                    startAdornment: <ApartmentOutlinedIcon sx={{ color: "#2563eb", mr: 1, fontSize: 18 }} />,
                  }}
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
                  InputProps={{
                    startAdornment: <NotesOutlinedIcon sx={{ color: "#f97316", mr: 1, mt: 1, alignSelf: "flex-start", fontSize: 18 }} />,
                  }}
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
        <Grid container spacing={{ xs: 1.25, sm: 1.5, md: 1.75 }}>
          {(tab === 0 ? leads : transferredLeads).length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ ...glassCardSx, p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {tab === 0 ? "No active projection leads found." : "No transferred leads found."}
                </Typography>
              </Paper>
            </Grid>
          )}

          {(tab === 0 ? leads : transferredLeads).map((lead) => (
            <Grid item xs={12} sm={6} xl={4} key={lead._id}>
              <Card
                sx={{
                  ...glassCardSx,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  background: theme.palette.mode === "dark"
                    ? "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.94) 100%)"
                    : "linear-gradient(180deg, rgba(248,250,252,0.92) 0%, #ffffff 100%)",
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, fontSize: { xs: "1rem", sm: "1.1rem" } }}>
                        {lead.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {lead.company_name || "No company"}
                      </Typography>
                    </Box>
                    {paymentChip(lead)}
                  </Box>

                  <Typography variant="body2" sx={{ mb: 2, fontWeight: 700, color: "primary.main", display: "flex", alignItems: "center", gap: 0.8 }}>
                    <PhoneIphoneOutlinedIcon sx={{ fontSize: 18 }} />
                    {lead.phone_number}
                  </Typography>

                  <Box
                    sx={{
                      mb: 2,
                      p: 1.5,
                      borderRadius: "8px",
                      bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(248,250,252,0.92)",
                      border: "1px solid",
                      borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.14)",
                    }}
                  >
                    <Grid container spacing={1}>
                      {detailRows.map((row) => (
                        <Grid item xs={12} sm={6} key={row.label}>
                          <Box sx={{ p: 1, borderRadius: "8px", bgcolor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.66)" : "#ffffff" }}>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.6, mb: 0.45 }}>
                              {row.icon}
                              {row.label}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.4, wordBreak: "break-word" }}>
                              {row.value(lead)}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                      <Grid item xs={12}>
                        <Box sx={{ p: 1, borderRadius: "8px", bgcolor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.66)" : "#ffffff" }}>
                          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, mb: 0.45, display: "block" }}>
                            Given Lead To
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {lead.given_lead_to || "-"}
                          </Typography>
                        </Box>
                      </Grid>
                      {lead.notes_update && (
                        <Grid item xs={12}>
                          <Box sx={{ p: 1, borderRadius: "8px", bgcolor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.66)" : "#ffffff" }}>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, mb: 0.45, display: "block" }}>
                              Notes
                            </Typography>
                            <Typography variant="body2" sx={{ lineHeight: 1.45 }}>
                              {lead.notes_update}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </Box>

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
    </Box>
  );
};

export default ProjectionLeads;
