import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { enqueueSnackbar } from "notistack";
import { apiUrl } from "./LoginSignup";

const MEETINGS = [
  { key: "meeting_1", label: "Meeting 1", tone: { bg: "#fff7d6", border: "#f4d77f", accent: "#a16207" } },
  { key: "meeting_2", label: "Meeting 2", tone: { bg: "#effbfe", border: "#93d4e1", accent: "#0f5f73" } },
  { key: "meeting_3", label: "Meeting 3", tone: { bg: "#fff0f0", border: "#efb0b0", accent: "#b42318" } },
];

const formatDate = (value) => {
  if (!value) return "Not updated";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not updated" : date.toLocaleDateString("en-GB");
};

const MeetingUpdates = () => {
  const theme = useTheme();
  const session = JSON.parse(localStorage.getItem("userSession")) || {};
  const [clients, setClients] = useState([]);
  const [notes, setNotes] = useState({});
  const [canEdit, setCanEdit] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, currentPage: 1 });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");

  const fetchClients = useCallback(async () => {
    if (!session.token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const response = await fetch(`${apiUrl}/meeting-updates?${params.toString()}`, {
        headers: { authorization: session.token },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load meeting updates.");

      const nextClients = Array.isArray(data.clients) ? data.clients : [];
      setClients(nextClients);
      setCanEdit(Boolean(data.permissions?.canEdit));
      setPagination(data.pagination || { totalPages: 1, currentPage: page });
      setNotes((previous) => {
        const next = { ...previous };
        nextClients.forEach((client) => {
          MEETINGS.forEach((meeting) => {
            const noteKey = `${client.clientKey}:${meeting.key}`;
            if (!Object.prototype.hasOwnProperty.call(next, noteKey)) {
              next[noteKey] = client.meetings?.[meeting.key]?.note || "";
            }
          });
        });
        return next;
      });
    } catch (error) {
      setClients([]);
      enqueueSnackbar(error.message || "Unable to load meeting updates.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [page, search, session.token]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleSave = async (client, meetingKey) => {
    const noteKey = `${client.clientKey}:${meetingKey}`;
    setSavingKey(noteKey);
    try {
      const response = await fetch(`${apiUrl}/meeting-updates/${encodeURIComponent(client.clientKey)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          authorization: session.token,
          "user-name": session.name || "",
        },
        body: JSON.stringify({
          meetingKey,
          note: notes[noteKey] || "",
          companyName: client.companyName,
          bookingIds: client.bookingIds,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to save meeting update.");

      setClients((previous) => previous.map((item) =>
        item.clientKey === client.clientKey
          ? { ...item, meetings: { ...item.meetings, [meetingKey]: data.meetingUpdate?.meetings?.[meetingKey] } }
          : item
      ));
      enqueueSnackbar(`${MEETINGS.find((meeting) => meeting.key === meetingKey)?.label} saved.`, { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error.message || "Unable to save meeting update.", { variant: "error" });
    } finally {
      setSavingKey("");
    }
  };

  const surfaceSx = {
    borderRadius: "8px",
    border: "1px solid",
    borderColor: "divider",
    boxShadow: theme.palette.mode === "dark" ? "0 12px 28px rgba(2,6,23,0.28)" : "0 14px 34px rgba(15,23,42,0.05)",
    bgcolor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.94)" : "#ffffff",
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 1560, mx: "auto", overflowX: "hidden" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 34, height: 34, borderRadius: "8px", display: "grid", placeItems: "center", bgcolor: "rgba(15,118,110,0.12)", color: "#0f766e" }}>
              <CalendarMonthOutlinedIcon fontSize="small" />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Meeting Updates</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.55 }}>
            One client timeline across all of their bookings. Meeting notes remain visible to the assigned BDMs.
          </Typography>
        </Box>
        <Chip
          label={canEdit ? "You can edit meeting notes" : "View only"}
          color={canEdit ? "success" : "default"}
          sx={{ borderRadius: "999px", fontWeight: 800 }}
        />
      </Box>

      <Paper sx={{ ...surfaceSx, p: { xs: 1.15, sm: 1.4 }, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            fullWidth
            size="small"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
            placeholder="Search client or company name"
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> }}
          />
          <Button variant="contained" onClick={handleSearch} startIcon={<SearchOutlinedIcon />} sx={{ minWidth: { xs: "100%", sm: 116 }, borderRadius: "8px" }}>
            Search
          </Button>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ py: 8, display: "grid", placeItems: "center" }}><CircularProgress /></Box>
      ) : clients.length === 0 ? (
        <Paper sx={{ ...surfaceSx, p: 4, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 800 }}>No client meetings found.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Try another company name or check your booking access.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.6}>
          {clients.map((client) => (
            <Paper key={client.clientKey} sx={{ ...surfaceSx, overflow: "hidden" }}>
              <Box sx={{ px: { xs: 1.25, sm: 1.8 }, py: 1.25, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, flexWrap: "wrap" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, textTransform: "uppercase" }}>{client.companyName}</Typography>
                  <Typography variant="caption" color="text.secondary">Latest booking: {formatDate(client.latestBookingDate)}</Typography>
                </Box>
                <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`${client.bookingCount} booking${client.bookingCount === 1 ? "" : "s"}`} sx={{ fontWeight: 800 }} />
                  {client.services.slice(0, 3).map((service) => <Chip key={service} size="small" label={service} variant="outlined" />)}
                  {client.services.length > 3 && <Chip size="small" label={`+${client.services.length - 3} services`} variant="outlined" />}
                </Stack>
              </Box>

              <Grid container>
                {MEETINGS.map((meeting) => {
                  const noteKey = `${client.clientKey}:${meeting.key}`;
                  const meetingData = client.meetings?.[meeting.key] || {};
                  const value = notes[noteKey] ?? meetingData.note ?? "";
                  return (
                    <Grid item xs={12} md={4} key={meeting.key} sx={{ borderRight: { md: meeting.key === "meeting_3" ? "none" : "1px solid" }, borderBottom: { xs: meeting.key === "meeting_3" ? "none" : "1px solid", md: "none" }, borderColor: "divider" }}>
                      <Box sx={{ p: { xs: 1.2, sm: 1.45 }, bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.025)" : meeting.tone.bg, minHeight: { md: 235 } }}>
                        <Typography sx={{ fontWeight: 900, color: meeting.tone.accent, mb: 1 }}>{meeting.label}</Typography>
                        <TextField
                          fullWidth
                          multiline
                          minRows={5}
                          value={value}
                          onChange={(event) => setNotes((previous) => ({ ...previous, [noteKey]: event.target.value }))}
                          placeholder={canEdit ? `Add ${meeting.label.toLowerCase()} notes...` : "No note added."}
                          InputProps={{ readOnly: !canEdit }}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              bgcolor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.76)" : "rgba(255,255,255,0.78)",
                              borderRadius: "8px",
                              fontSize: "0.9rem",
                            },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", minHeight: 20, mt: 0.8 }}>
                          {meetingData.updatedAt ? `Updated by ${meetingData.updatedByName || "authorized user"} on ${formatDate(meetingData.updatedAt)}` : "No update yet"}
                        </Typography>
                        {canEdit && (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<SaveOutlinedIcon fontSize="small" />}
                            disabled={savingKey === noteKey}
                            onClick={() => handleSave(client, meeting.key)}
                            sx={{ mt: 0.65, borderRadius: "8px", bgcolor: meeting.tone.accent, "&:hover": { bgcolor: meeting.tone.accent } }}
                          >
                            {savingKey === noteKey ? "Saving..." : "Save Note"}
                          </Button>
                        )}
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Paper>
          ))}
        </Stack>
      )}

      {pagination.totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2.25 }}>
          <Pagination page={pagination.currentPage || page} count={pagination.totalPages} onChange={(_, value) => setPage(value)} color="primary" />
        </Box>
      )}
    </Box>
  );
};

export default MeetingUpdates;
