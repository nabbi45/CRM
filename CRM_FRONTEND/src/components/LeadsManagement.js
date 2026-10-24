import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import BorderColorOutlinedIcon from "@mui/icons-material/BorderColorOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { enqueueSnackbar } from "notistack";
import { apiUrl } from "./LoginSignup";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { requestJson } from "../utils/requestJson";

const STATUS_OPTIONS = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["qualified", "Qualified"],
  ["prospect", "Prospect"],
  ["unqualified", "Unqualified"],
  ["junk", "Junk"],
];

const STATUS_STYLE = {
  new: { bg: "rgba(14,165,233,.12)", color: "#0369a1" },
  contacted: { bg: "rgba(139,92,246,.12)", color: "#6d28d9" },
  qualified: { bg: "rgba(16,185,129,.13)", color: "#047857" },
  prospect: { bg: "rgba(245,158,11,.14)", color: "#b45309" },
  unqualified: { bg: "rgba(100,116,139,.13)", color: "#475569" },
  junk: { bg: "rgba(239,68,68,.12)", color: "#b91c1c" },
};
const LEADS_PER_PAGE = 100;

const emptyLead = {
  name: "",
  mobileNumber: "",
  email: "",
  serviceRequirement: "",
  companyName: "",
  customFields: {},
};
const labelForStatus = (value) =>
  STATUS_OPTIONS.find(([key]) => key === value)?.[1] || "New";
const customObject = (value) =>
  value && typeof value === "object" ? { ...value } : {};

const LeadsManagement = () => {
  const session = JSON.parse(localStorage.getItem("userSession")) || {};
  const token = session.token || "";
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("md"));
  const [leads, setLeads] = useState([]);
  const [columns, setColumns] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignUsersLoaded, setAssignUsersLoaded] = useState(false);
  const [assignUsersLoading, setAssignUsersLoading] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: LEADS_PER_PAGE,
    total: 0,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false,
  });
  const [loading, setLoading] = useState(true);
  const latestLoad = useRef(0);
  const [loadError, setLoadError] = useState("");
  const [working, setWorking] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [leadEditor, setLeadEditor] = useState(null);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notesLead, setNotesLead] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [newColumn, setNewColumn] = useState("");
  const [editingColumn, setEditingColumn] = useState(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState("");

  const headers = useMemo(
    () => ({ Authorization: token, "Content-Type": "application/json" }),
    [token],
  );
  const request = useCallback(
    async (path, options = {}) => {
      if (!options.method || options.method === "GET")
        return requestJson(`/leads-management${path}`, token);
      const response = await fetchWithTimeout(`${apiUrl}/leads-management${path}`, {
        ...options,
        headers:
          options.body instanceof FormData
            ? { Authorization: token }
            : { ...headers, ...(options.headers || {}) },
      }, options.method && options.method !== "GET" ? 30000 : 15000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message || "Unable to complete the lead request.");
      return data;
    },
    [headers, token],
  );

  const load = useCallback(
    async (requestedPage = page, quiet = false) => {
      const loadId = ++latestLoad.current;
      if (!quiet) setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({
          limit: String(LEADS_PER_PAGE),
          page: String(requestedPage),
        });
        if (status !== "all") params.set("status", status);
        if (appliedSearch) params.set("search", appliedSearch);
        // One compact request instead of three authenticated round trips.
        const data = await request(`/bootstrap?${params}`);
        if (loadId !== latestLoad.current) return;
        setLeads(data.leads || []);
        setCanManage(Boolean(data.canManage));
        setCanDelete(Boolean(data.canDelete));
        setPagination(data.pagination || {});
        setColumns(data.columns || []);
        // New API responses deliberately omit the assignment directory. Keep
        // an already loaded selector rather than making every page reload it.
        if (Array.isArray(data.users)) {
          setUsers(data.users);
          setAssignUsersLoaded(true);
        }
        setSelected(new Set());
        if (data.pagination?.page && data.pagination.page !== requestedPage)
          setPage(data.pagination.page);
      } catch (error) {
        if (loadId !== latestLoad.current) return;
        setLoadError(error.message);
        enqueueSnackbar(error.message, { variant: "error" });
      } finally {
        if (loadId === latestLoad.current) setLoading(false);
      }
    },
    [request, page, status, appliedSearch],
  );

  useEffect(() => {
    load(page);
    // `load` captures the current server-side status/search filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setAppliedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const refreshInBackground = () => {
    void load(page, true);
  };

  const customColumns = useMemo(
    () => columns.filter((column) => column.active),
    [columns],
  );
  // `leads` is exactly the current server-filtered page.
  const selectedVisible = leads.filter((lead) => selected.has(lead._id));
  const statusCounts = useMemo(
    () =>
      Object.fromEntries(
        STATUS_OPTIONS.map(([key]) => [
          key,
          leads.filter((lead) => lead.status === key).length,
        ]),
      ),
    [leads],
  );

  const replaceLead = (lead) =>
    setLeads((previous) =>
      previous.map((item) => (item._id === lead._id ? lead : item)),
    );
  const changeForm = (key, value) =>
    setLeadForm((previous) => ({ ...previous, [key]: value }));
  const changeCustomField = (key, value) =>
    setLeadForm((previous) => ({
      ...previous,
      customFields: { ...previous.customFields, [key]: value },
    }));

  const openCreate = () => {
    setLeadEditor("create");
    setLeadForm(emptyLead);
  };
  const openEdit = (lead) => {
    setLeadEditor(lead);
    setLeadForm({
      name: lead.name || "",
      mobileNumber: lead.mobileNumber || "",
      email: lead.email || "",
      serviceRequirement: lead.serviceRequirement || "",
      companyName: lead.companyName || "",
      customFields: customObject(lead.customFields),
    });
  };

  const saveLead = async () => {
    setWorking(true);
    try {
      const body = {
        ...leadForm,
        customFields: Object.fromEntries(
          Object.entries(leadForm.customFields || {}).filter(([, value]) =>
            String(value || "").trim(),
          ),
        ),
      };
      const result =
        leadEditor === "create"
          ? await request("/", { method: "POST", body: JSON.stringify(body) })
          : await request(`/${leadEditor._id}`, {
              method: "PATCH",
              body: JSON.stringify(body),
            });
      if (leadEditor === "create")
        setLeads((previous) => [result.lead, ...previous]);
      else replaceLead(result.lead);
      setLeadEditor(null);
      enqueueSnackbar(result.message, { variant: "success" });
      refreshInBackground();
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    } finally {
      setWorking(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch(`${apiUrl}/leads-management/template`, {
        headers: { Authorization: token },
      });
      if (!response.ok)
        throw new Error("Unable to download the column template.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "leads-import-template.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    }
  };

  const importFile = async () => {
    if (!file)
      return enqueueSnackbar("Choose a CSV, XLS or XLSX file first.", {
        variant: "warning",
      });
    setWorking(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await request("/import", { method: "POST", body: form });
      setImportOpen(false);
      setFile(null);
      enqueueSnackbar(result.message, { variant: "success" });
      if (result.rejected?.length)
        enqueueSnackbar(
          `${result.rejected.length} row(s) were skipped. Check the file format and retry those rows.`,
          { variant: "warning" },
        );
      refreshInBackground();
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    } finally {
      setWorking(false);
    }
  };

  const updateStatus = async (lead, value) => {
    try {
      const result = await request(`/${lead._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: value }),
      });
      replaceLead(result.lead);
      enqueueSnackbar(
        `${lead.name}'s status is now ${labelForStatus(value)}.`,
        { variant: "success" },
      );
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    }
  };

  const toggleLead = (id) =>
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const selectFirst = (count) =>
    setSelected(new Set(leads.slice(0, count).map((lead) => lead._id)));
  const toggleVisible = () =>
    setSelected((previous) => {
      const allSelected =
        leads.length && leads.every((lead) => previous.has(lead._id));
      return allSelected ? new Set() : new Set(leads.map((lead) => lead._id));
    });

  const openAssign = async () => {
    setAssignOpen(true);
    setAssignee("");
    if (assignUsersLoaded || assignUsersLoading) return;
    setAssignUsersLoading(true);
    try {
      const data = await request("/users");
      setUsers(data.users || []);
      setAssignUsersLoaded(true);
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    } finally {
      setAssignUsersLoading(false);
    }
  };

  const assignLeads = async () => {
    if (!assignee)
      return enqueueSnackbar(
        "Choose the CRM user who will receive these leads.",
        { variant: "warning" },
      );
    setWorking(true);
    try {
      const assignedLeadIds = new Set(selected);
      const recipient = users.find((user) => user.userId === assignee);
      const result = await request("/assign", {
        method: "POST",
        body: JSON.stringify({ leadIds: [...selected], userId: assignee }),
      });
      const assignedAt = new Date().toISOString();
      setLeads((previous) =>
        previous.map((lead) =>
          assignedLeadIds.has(lead._id)
            ? {
                ...lead,
                assignedTo: assignee,
                assignedToName: recipient?.name || lead.assignedToName,
                assignedAt,
              }
            : lead,
        ),
      );
      setAssignOpen(false);
      setAssignee("");
      setSelected(new Set());
      enqueueSnackbar(result.message, { variant: "success" });
      refreshInBackground();
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    } finally {
      setWorking(false);
    }
  };

  const deleteSelectedLeads = async () => {
    setWorking(true);
    try {
      const deletedLeadIds = [...selected];
      const result = await request("/selected", {
        method: "DELETE",
        body: JSON.stringify({ leadIds: deletedLeadIds }),
      });
      const removed = new Set(result.deletedIds || deletedLeadIds);
      setLeads((previous) => previous.filter((lead) => !removed.has(lead._id)));
      setSelected(new Set());
      setDeleteOpen(false);
      enqueueSnackbar(result.message, { variant: "success" });
      if (leads.length === removed.size && page > 1) setPage(page - 1);
      else refreshInBackground();
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    } finally {
      setWorking(false);
    }
  };

  const openNotes = (lead) => {
    setNotesLead(lead);
    setNoteDrafts(
      Object.fromEntries(
        (lead.noteEntries || []).map((note) => [note.number, note.content]),
      ),
    );
  };
  const saveNote = async (number) => {
    if (!String(noteDrafts[number] || "").trim())
      return enqueueSnackbar(`Write note ${number} before saving.`, {
        variant: "warning",
      });
    setWorking(true);
    try {
      const result = await request(`/${notesLead._id}/notes`, {
        method: "POST",
        body: JSON.stringify({ number, content: noteDrafts[number] }),
      });
      replaceLead(result.lead);
      setNotesLead(result.lead);
      enqueueSnackbar(result.message, { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    } finally {
      setWorking(false);
    }
  };

  const addColumn = async () => {
    if (!newColumn.trim()) return;
    setWorking(true);
    try {
      const result = await request("/columns", {
        method: "POST",
        body: JSON.stringify({ label: newColumn }),
      });
      setColumns((previous) => [...previous, result.column]);
      setNewColumn("");
      enqueueSnackbar("Custom column added.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    } finally {
      setWorking(false);
    }
  };
  const updateColumn = async (column, patch) => {
    try {
      const result = await request(`/columns/${column._id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setColumns((previous) =>
        previous.map((item) =>
          item._id === column._id ? result.column : item,
        ),
      );
      setEditingColumn(null);
      enqueueSnackbar("Column updated.", { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    }
  };

  const statusChip = (lead) => {
    const style = STATUS_STYLE[lead.status] || STATUS_STYLE.new;
    return (
      <Chip
        size="small"
        label={labelForStatus(lead.status)}
        sx={{
          bgcolor: style.bg,
          color: style.color,
          fontWeight: 800,
          borderRadius: 1.5,
        }}
      />
    );
  };
  const detailText = (lead) =>
    [lead.companyName, lead.serviceRequirement].filter(Boolean).join(" · ") ||
    "No company or service requirement yet";
  const leadNoteCount = (lead) =>
    (lead.noteEntries || []).filter((note) => note.content).length;

  if (loading && !leads.length)
    return (
      <Box sx={{ minHeight: 360, display: "grid", placeItems: "center" }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading leads…</Typography>
        </Stack>
      </Box>
    );

  return (
    <Box sx={{ width: "100%", maxWidth: 1640, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 2.5 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ md: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ letterSpacing: 1.2, fontWeight: 800 }}
            >
              CRM PIPELINE
            </Typography>
            <Typography
              variant="h4"
              sx={{ mt: 0.25, fontWeight: 800, letterSpacing: -0.5 }}
            >
              Leads Management
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.6, maxWidth: 640 }}>
              Assign leads, keep five call notes, and see exactly where every
              conversation stands.
            </Typography>
          </Box>
          {canManage && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                startIcon={<ManageAccountsOutlinedIcon />}
                onClick={() => setColumnsOpen(true)}
              >
                Columns
              </Button>
              <Button
                variant="contained"
                startIcon={<UploadFileOutlinedIcon />}
                onClick={() => setImportOpen(true)}
              >
                Import leads
              </Button>
              <Button
                variant="contained"
                startIcon={<AddOutlinedIcon />}
                onClick={openCreate}
              >
                Add lead
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => load(page)}>Retry</Button>}>
          {loadError}
        </Alert>
      )}

      <Grid container spacing={1.4} sx={{ mb: 2.5 }}>
        <Grid item xs={6} sm={4} md={2.4}>
          <Metric
            label="Total matching"
            value={pagination.total || 0}
            icon={<PeopleAltOutlinedIcon />}
            color="#0f766e"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Metric
            label="New on page"
            value={statusCounts.new || 0}
            icon={<PhoneOutlinedIcon />}
            color="#0369a1"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Metric
            label="Contacted on page"
            value={statusCounts.contacted || 0}
            icon={<CheckCircleOutlineOutlinedIcon />}
            color="#6d28d9"
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Metric
            label="Qualified on page"
            value={statusCounts.qualified || 0}
            icon={<CheckCircleOutlineOutlinedIcon />}
            color="#047857"
          />
        </Grid>
        <Grid item xs={12} sm={4} md={2.4}>
          <Metric
            label="Prospects on page"
            value={statusCounts.prospect || 0}
            icon={<AssignmentIndOutlinedIcon />}
            color="#b45309"
          />
        </Grid>
      </Grid>

      {!canManage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This is your assigned work queue. Update the status and call notes
          after every conversation.
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.25, sm: 2 },
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          mb: 2,
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.25}
          alignItems={{ lg: "center" }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder="Search name, mobile, company, service or custom fields"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
              setSelected(new Set());
            }}
            sx={{ minWidth: { lg: 180 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FilterAltOutlinedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          >
            <MenuItem value="all">All statuses</MenuItem>
            {STATUS_OPTIONS.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          {canManage && (
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
              <Button size="small" onClick={toggleVisible}>
                {leads.length && leads.every((lead) => selected.has(lead._id))
                  ? "Clear selection"
                  : `Select page (${leads.length})`}
              </Button>
              <ButtonGroup size="small" variant="outlined">
                {[10, 25, 50, 100].map((count) => (
                  <Button
                    key={count}
                    onClick={() => selectFirst(count)}
                    disabled={!leads.length}
                  >
                    First {count}
                  </Button>
                ))}
              </ButtonGroup>
            </Stack>
          )}
        </Stack>
        {canManage && selected.size > 0 && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ sm: "center" }}
            sx={{
              mt: 1.5,
              pt: 1.5,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
            spacing={1}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {selected.size} lead{selected.size === 1 ? "" : "s"} selected
            </Typography>
            <Stack direction="row" spacing={1}>
              {canDelete && (
                <Button
                  color="error"
                  variant="outlined"
                  startIcon={<DeleteOutlineOutlinedIcon />}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete selected
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<AssignmentIndOutlinedIcon />}
                onClick={openAssign}
              >
                Assign selected
              </Button>
            </Stack>
          </Stack>
        )}
      </Paper>

      {compact ? (
        <Stack spacing={1.25}>
          {leads.map((lead) => (
            <LeadCard
              key={lead._id}
              lead={lead}
              canManage={canManage}
              selected={selected.has(lead._id)}
              onToggle={() => toggleLead(lead._id)}
              onEdit={() => openEdit(lead)}
              onNotes={() => openNotes(lead)}
              onStatus={(value) => updateStatus(lead, value)}
              statusChip={statusChip(lead)}
              detail={detailText(lead)}
            />
          ))}
          {!leads.length && (
            <EmptyLeads canManage={canManage} onAdd={openCreate} />
          )}
        </Stack>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            overflowX: "auto",
          }}
        >
          <Table size="small" sx={{ minWidth: 1040 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                {canManage && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={
                        Boolean(leads.length) &&
                        leads.every((lead) => selected.has(lead._id))
                      }
                      indeterminate={
                        selectedVisible.length > 0 &&
                        selectedVisible.length < leads.length
                      }
                      onChange={toggleVisible}
                    />
                  </TableCell>
                )}
                <TableCell>Lead</TableCell>
                <TableCell>Contact & requirement</TableCell>
                <TableCell>Assigned to</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Call notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead._id} hover>
                  {canManage && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.has(lead._id)}
                        onChange={() => toggleLead(lead._id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography sx={{ fontWeight: 800 }}>
                      {lead.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {lead.source === "import" ? "Imported" : "Manual"} ·{" "}
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {lead.mobileNumber}
                      {lead.email ? ` · ${lead.email}` : ""}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {detailText(lead)}
                    </Typography>
                    {Object.keys(customObject(lead.customFields)).length >
                      0 && (
                      <Box sx={{ mt: 0.5 }}>
                        {Object.entries(customObject(lead.customFields))
                          .slice(0, 2)
                          .map(([key, value]) => (
                            <Chip
                              key={key}
                              size="small"
                              label={`${columns.find((column) => column.key === key)?.label || key}: ${value}`}
                              sx={{
                                mr: 0.5,
                                mb: 0.3,
                                height: 20,
                                fontSize: ".66rem",
                              }}
                            />
                          ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.assignedToName ? (
                      <>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {lead.assignedToName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {lead.assignedAt
                            ? `Assigned ${new Date(lead.assignedAt).toLocaleDateString()}`
                            : ""}
                        </Typography>
                      </>
                    ) : (
                      <Chip
                        size="small"
                        label="Unassigned"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={lead.status}
                      onChange={(event) =>
                        updateStatus(lead, event.target.value)
                      }
                      sx={{
                        minWidth: 128,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: `${STATUS_STYLE[lead.status]?.color || "#0369a1"}55`,
                        },
                      }}
                    >
                      {STATUS_OPTIONS.map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      startIcon={<NotesOutlinedIcon />}
                      onClick={() => openNotes(lead)}
                    >
                      {leadNoteCount(lead)}/5 notes
                    </Button>
                  </TableCell>
                  <TableCell align="right">
                    {canManage && (
                      <Tooltip title="Edit lead">
                        <IconButton size="small" onClick={() => openEdit(lead)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!leads.length && (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6}>
                    <EmptyLeads canManage={canManage} onAdd={openCreate} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pagination.total > 0 && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          spacing={1}
          sx={{ mt: 2, px: 0.5 }}
        >
          <Typography variant="body2" color="text.secondary">
            Showing {(pagination.page - 1) * pagination.pageSize + 1}-
            {Math.min(pagination.page * pagination.pageSize, pagination.total)}{" "}
            of {pagination.total} matching leads
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              disabled={!pagination.hasPrevious || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Typography
              variant="body2"
              sx={{ minWidth: 68, textAlign: "center" }}
            >
              Page {pagination.page} / {pagination.totalPages}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={!pagination.hasNext || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      )}

      <Dialog
        open={Boolean(leadEditor)}
        onClose={() => !working && setLeadEditor(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {leadEditor === "create"
            ? "Add a lead"
            : `Edit ${leadEditor?.name || "lead"}`}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={1.5} sx={{ pt: 0.25 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Name"
                value={leadForm.name}
                onChange={(event) => changeForm("name", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Mobile number"
                value={leadForm.mobileNumber}
                onChange={(event) =>
                  changeForm("mobileNumber", event.target.value)
                }
                helperText="7 to 15 digits"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={leadForm.email}
                onChange={(event) => changeForm("email", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company name"
                value={leadForm.companyName}
                onChange={(event) =>
                  changeForm("companyName", event.target.value)
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Service requirement"
                value={leadForm.serviceRequirement}
                onChange={(event) =>
                  changeForm("serviceRequirement", event.target.value)
                }
              />
            </Grid>
            {customColumns.map((column) => (
              <Grid item xs={12} sm={6} key={column._id}>
                <TextField
                  fullWidth
                  label={column.label}
                  value={leadForm.customFields?.[column.key] || ""}
                  onChange={(event) =>
                    changeCustomField(column.key, event.target.value)
                  }
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeadEditor(null)}>Cancel</Button>
          <Button variant="contained" disabled={working} onClick={saveLead}>
            {working ? "Saving…" : "Save lead"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={importOpen}
        onClose={() => !working && setImportOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Import leads</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Required column names: <b>Name</b> and <b>Mobile Number</b>.
            Optional: Email, Service Requirement and Company Name. Extra columns
            are kept as editable custom fields.
          </Alert>
          <Stack spacing={1.5}>
            <Button
              alignSelf="flex-start"
              startIcon={<DownloadOutlinedIcon />}
              onClick={downloadTemplate}
            >
              Download CSV template
            </Button>
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadOutlinedIcon />}
            >
              {file ? file.name : "Choose CSV, XLS or XLSX file"}
              <input
                hidden
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              Maximum 5,000 leads and 12 MB per file. Rows missing a valid name
              or mobile number are skipped and reported.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!file || working}
            onClick={importFile}
          >
            {working ? "Importing…" : "Import leads"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={assignOpen}
        onClose={() => !working && setAssignOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Assign {selected.size} lead{selected.size === 1 ? "" : "s"}
        </DialogTitle>
        <DialogContent dividers>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
            The selected user receives an alert in their CRM notification bell
            and can then update their assigned work queue.
          </Typography>
          <TextField
            select
            fullWidth
            label="Assign to"
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            disabled={assignUsersLoading}
            helperText={
              assignUsersLoading
                ? "Loading available CRM users…"
                : users.length
                  ? "Choose who should receive these leads."
                  : "No active CRM users are available."
            }
          >
            {users.map((user) => (
              <MenuItem key={user.userId} value={user.userId}>
                {user.name} · {user.role}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={working || assignUsersLoading || !assignee}
            onClick={assignLeads}
          >
            Assign leads
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => !working && setDeleteOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete selected leads?</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning">
            This permanently deletes {selected.size} selected lead
            {selected.size === 1 ? "" : "s"}. This cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={working}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={working || selected.size === 0}
            startIcon={<DeleteOutlineOutlinedIcon />}
            onClick={deleteSelectedLeads}
          >
            {working ? "Deleting..." : "Delete leads"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(notesLead)}
        onClose={() => !working && setNotesLead(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Call notes · {notesLead?.name}</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Use note 1 after the first call, then continue in order. Each note
            retains its original author and timestamp.
          </Alert>
          <Stack spacing={1.5}>
            {[1, 2, 3, 4, 5].map((number) => {
              const saved = notesLead?.noteEntries?.find(
                (note) => note.number === number,
              );
              return (
                <Paper
                  key={number}
                  variant="outlined"
                  sx={{ p: 1.25, borderRadius: 2 }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ sm: "flex-start" }}
                  >
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      label={`Note ${number}${saved ? ` · ${saved.createdByName}` : ""}`}
                      value={noteDrafts[number] || ""}
                      onChange={(event) =>
                        setNoteDrafts((previous) => ({
                          ...previous,
                          [number]: event.target.value,
                        }))
                      }
                      helperText={
                        saved
                          ? `Saved ${new Date(saved.updatedAt || saved.createdAt).toLocaleString()}`
                          : "Not recorded yet"
                      }
                    />
                    <Button
                      variant="outlined"
                      disabled={
                        working || !String(noteDrafts[number] || "").trim()
                      }
                      onClick={() => saveNote(number)}
                    >
                      Save
                    </Button>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotesLead(null)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Custom lead columns</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Name, mobile number, email, service requirement and company name are
            standard fields. Add custom columns for information such as city,
            source or budget. Imported extra headers are added here
            automatically.
          </Alert>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ mb: 2 }}
          >
            <TextField
              fullWidth
              label="New column label"
              value={newColumn}
              onChange={(event) => setNewColumn(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addColumn()}
            />
            <Button
              variant="contained"
              disabled={working || !newColumn.trim()}
              onClick={addColumn}
            >
              Add
            </Button>
          </Stack>
          <Stack spacing={1}>
            {columns.map((column) => (
              <Paper
                variant="outlined"
                key={column._id}
                sx={{ p: 1, borderRadius: 2 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  {editingColumn === column._id ? (
                    <>
                      <TextField
                        size="small"
                        fullWidth
                        value={editingColumnLabel}
                        onChange={(event) =>
                          setEditingColumnLabel(event.target.value)
                        }
                      />
                      <Button
                        size="small"
                        onClick={() =>
                          updateColumn(column, { label: editingColumnLabel })
                        }
                      >
                        Save
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setEditingColumn(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Typography sx={{ flexGrow: 1, fontWeight: 700 }}>
                        {column.label}
                      </Typography>
                      <Tooltip title="Rename">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingColumn(column._id);
                            setEditingColumnLabel(column.label);
                          }}
                        >
                          <BorderColorOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <FormControlLabel
                        sx={{ mr: 0 }}
                        control={
                          <Switch
                            checked={Boolean(column.active)}
                            onChange={(event) =>
                              updateColumn(column, {
                                active: event.target.checked,
                              })
                            }
                          />
                        }
                        label={column.active ? "Visible" : "Hidden"}
                      />
                    </>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColumnsOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const Metric = ({ label, value, icon, color }) => (
  <Paper
    elevation={0}
    sx={{
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 2.5,
      p: 1.5,
      height: "100%",
    }}
  >
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 700 }}
        >
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 850, mt: 0.35 }}>
          {value}
        </Typography>
      </Box>
      <Box
        sx={{
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          borderRadius: 2,
          bgcolor: `${color}18`,
          color,
        }}
      >
        {icon}
      </Box>
    </Stack>
  </Paper>
);

const EmptyLeads = ({ canManage, onAdd }) => (
  <Box
    sx={{
      minHeight: 170,
      display: "grid",
      placeItems: "center",
      p: 3,
      textAlign: "center",
    }}
  >
    <Box>
      <PeopleAltOutlinedIcon color="disabled" sx={{ fontSize: 34 }} />
      <Typography sx={{ fontWeight: 800, mt: 1 }}>No leads found</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {canManage
          ? "Change the filter, add a lead, or import a list."
          : "You do not have any leads assigned yet."}
      </Typography>
      {canManage && (
        <Button size="small" sx={{ mt: 1 }} onClick={onAdd}>
          Add a lead
        </Button>
      )}
    </Box>
  </Box>
);

const LeadCard = ({
  lead,
  canManage,
  selected,
  onToggle,
  onEdit,
  onNotes,
  onStatus,
  statusChip,
  detail,
}) => (
  <Card variant="outlined" sx={{ borderRadius: 2.5 }}>
    <CardContent sx={{ p: "14px !important" }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        {canManage && (
          <Checkbox
            size="small"
            checked={selected}
            onChange={onToggle}
            sx={{ mt: -0.75, ml: -0.75 }}
          />
        )}
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            justifyContent="space-between"
            alignItems="flex-start"
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 850 }}>
                {lead.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {lead.mobileNumber}
                {lead.email ? ` · ${lead.email}` : ""}
              </Typography>
            </Box>
            {statusChip}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
            {detail}
          </Typography>
          {lead.assignedToName && (
            <Typography
              variant="caption"
              sx={{ display: "block", mt: 0.8, color: "text.secondary" }}
            >
              Assigned to <b>{lead.assignedToName}</b>
            </Typography>
          )}
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ mt: 1.1 }}
            alignItems="center"
          >
            <TextField
              select
              size="small"
              label="Status"
              value={lead.status}
              onChange={(event) => onStatus(event.target.value)}
              sx={{ flexGrow: 1 }}
            >
              {STATUS_OPTIONS.map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <Tooltip title="Call notes">
              <IconButton onClick={onNotes}>
                <NotesOutlinedIcon />
              </IconButton>
            </Tooltip>
            {canManage && (
              <Tooltip title="Edit lead">
                <IconButton onClick={onEdit}>
                  <EditOutlinedIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

export default LeadsManagement;
