import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, TextField, Button, Select, MenuItem, InputLabel, FormControl,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Card, CardContent,
    Tab, Tabs, Avatar, IconButton, Tooltip, Stack, CircularProgress, useTheme
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { enqueueSnackbar } from 'notistack';
import { apiUrl } from './LoginSignup';
import Loader from './Loader';
import { canAccessFeature } from '../utils/featureAccess';

const statusColors = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };
const statusIcons = {
    pending: <HourglassEmptyOutlinedIcon sx={{ fontSize: 16 }} />,
    approved: <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />,
    rejected: <CancelOutlinedIcon sx={{ fontSize: 16 }} />,
};

const ATTENDANCE_STATUSES = [
    "Present", "Full Day Leave", "Half Day Leave", "WFH", "Week Off", "Holiday", "EL Taken"
];

const ATTENDANCE_COLORS = {
    "Present":        { bg: 'rgba(22, 163, 74, 0.15)', color: '#16a34a', border: 'rgba(22, 163, 74, 0.3)' },
    "WFH":            { bg: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', border: 'rgba(37, 99, 235, 0.3)' },
    "Half Day Leave": { bg: 'rgba(202, 138, 4, 0.15)', color: '#ca8a04', border: 'rgba(202, 138, 4, 0.3)' },
    "EL Taken":       { bg: 'rgba(8, 145, 178, 0.15)', color: '#0891b2', border: 'rgba(8, 145, 178, 0.3)' },
    "Full Day Leave": { bg: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', border: 'rgba(220, 38, 38, 0.3)' },
    "Week Off":       { bg: 'rgba(147, 51, 234, 0.15)', color: '#9333ea', border: 'rgba(147, 51, 234, 0.3)' },
    "Holiday":        { bg: 'rgba(219, 39, 119, 0.15)', color: '#db2777', border: 'rgba(219, 39, 119, 0.3)' },
};

const toDateKey = (value) => new Date(value).toISOString().slice(0, 10);
const isWeekendDate = (value) => {
    const day = new Date(value).getDay();
    return day === 0 || day === 6;
};

const Timecard = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isDark = theme.palette.mode === 'dark';
    const ACCENT = isDark ? '#fff' : '#111827';
    const session = JSON.parse(localStorage.getItem('userSession')) || {};
    const headers = { Authorization: session.token || '', 'Content-Type': 'application/json' };
    const systemTimecardRoles = ['dev', 'srdev', 'sr dev', 'super admin', 'director'];
    const isApprover = canAccessFeature(session, 'timecard_edit') || systemTimecardRoles.includes(session.user_role?.toLowerCase());

    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(true);

    // Leave State
    const [myLeaves, setMyLeaves] = useState([]);
    const [allLeaves, setAllLeaves] = useState([]);
    const [form, setForm] = useState({ leave_type: '', start_date: '', end_date: '', reason: '' });
    const [supportingDocument, setSupportingDocument] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [actionDialog, setActionDialog] = useState({ open: false, leave: null, action: '' });
    const [actionNote, setActionNote] = useState('');

    // Attendance State
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [myAttendance, setMyAttendance] = useState([]);
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
    const [dailyAttendance, setDailyAttendance] = useState([]);
    
    // Activity Log State
    const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
    const [dailyActivities, setDailyActivities] = useState([]);
    
    const [employees, setEmployees] = useState([]);
    
    // Holiday State
    const [holidays, setHolidays] = useState([]);
    const [holidayForm, setHolidayForm] = useState({ date: '', name: '' });

    // One-time load: employees, leaves, holidays
    useEffect(() => {
        fetchData();
        fetchHolidays();
        if (isApprover) {
            fetchEmployees();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-fetch when month or date changes
    useEffect(() => {
        fetchMyAttendance();
        if (isApprover) {
            fetchDailyAttendance();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, attendanceDate]);

    // Re-fetch activities when activity date changes
    useEffect(() => {
        if (isApprover) fetchDailyActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activityDate]);

    // ─── DATA FETCHING ─────────────────────────────────────────────
    const fetchData = async () => {
        setLoading(true);
        try {
            const myRes = await fetch(`${apiUrl}/leaves/my`, { headers });
            if (myRes.ok) setMyLeaves(await myRes.json());
            if (isApprover) {
                const allRes = await fetch(`${apiUrl}/leaves/all`, { headers });
                if (allRes.ok) setAllLeaves(await allRes.json());
            }
        } catch (e) {
             console.error(e);
        }
        setLoading(false);
    };

    const fetchMyAttendance = async () => {
        try {
            const res = await fetch(`${apiUrl}/timecard/attendance/my-month/${selectedMonth}`, { headers });
            if (res.ok) {
                const data = await res.json();
                setMyAttendance(data.records || []);
            }
        } catch (e) { console.error(e); }
    };

    const fetchHolidays = async () => {
        try {
            const res = await fetch(`${apiUrl}/timecard/holidays`, { headers });
            if (res.ok) {
                const data = await res.json();
                setHolidays(data.holidays || []);
            }
        } catch (e) { console.error(e); }
    };

    const fetchEmployees = async () => {
        try {
            const res = await fetch(`${apiUrl}/timecard/employees`, { headers });
            if (res.ok) {
                const data = await res.json();
                setEmployees(data.users || []);
            } else {
                const err = await res.json().catch(() => ({}));
                console.error('fetchEmployees failed:', res.status, err);
                enqueueSnackbar(`Failed to load employees: ${err.error || res.status}`, { variant: 'error' });
            }
        } catch (e) { console.error('fetchEmployees error:', e); }
    };

    const fetchDailyAttendance = async () => {
        if (!attendanceDate) return;
        try {
            const res = await fetch(`${apiUrl}/timecard/attendance/daily/${attendanceDate}`, { headers });
            if (res.ok) {
                const data = await res.json();
                setDailyAttendance(data.records || []);
            }
        } catch (e) { console.error(e); }
    };

    const fetchDailyActivities = async () => {
        if (!activityDate) return;
        try {
            const res = await fetch(`${apiUrl}/user/activities/${activityDate}`, { headers });
            if (res.ok) {
                const data = await res.json();
                setDailyActivities(data.activities || []);
            }
        } catch (e) { console.error(e); }
    };

    const formatTime = (dateString) => {
        if (!dateString) return '--:--';
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getOnlineDuration = (first, last) => {
        if (!first || !last) return '--:--';
        const firstD = new Date(first);
        const lastD = new Date(last);
        if (isNaN(firstD) || isNaN(lastD)) return '--:--';
        const msDiff = Math.abs(lastD - firstD);
        if (msDiff < 60000 && lastD > firstD) return 'Just logged in';
        const minsDiff = Math.floor(msDiff / 60000);
        const hours = Math.floor(minsDiff / 60);
        const mins = minsDiff % 60;
        return `${hours}h ${mins}m`;
    };

    const isUserOnline = (lastOnline) => {
        if (!lastOnline) return false;
        const msDiff = new Date() - new Date(lastOnline);
        const minsDiff = msDiff / 60000;
        const isToday = new Date(lastOnline).toISOString().slice(0,10) === new Date().toISOString().slice(0,10);
        return isToday && minsDiff <= 8; // Ping is 5 mins, allow up to 8 mins delay
    };

    // ─── LEAVE ACTIONS ─────────────────────────────────────────────
    const handleSubmitLeave = async (e) => {
        e.preventDefault();
        if (!form.leave_type || !form.start_date || !form.end_date || !form.reason) {
            enqueueSnackbar('All fields are required.', { variant: 'warning' });
            return;
        }
        setSubmitting(true);
        try {
            const leaveForm = new FormData();
            leaveForm.append('leave_type', form.leave_type);
            leaveForm.append('start_date', form.start_date);
            leaveForm.append('end_date', form.end_date);
            leaveForm.append('reason', form.reason);
            if (supportingDocument) leaveForm.append('supportingDocument', supportingDocument);
            const res = await fetch(`${apiUrl}/leaves`, {
                method: 'POST',
                headers: { Authorization: session.token || '' },
                body: leaveForm
            });
            const data = await res.json();
            if (res.ok) {
                enqueueSnackbar('Leave request submitted!', { variant: 'success' });
                setForm({ leave_type: '', start_date: '', end_date: '', reason: '' });
                setSupportingDocument(null);
                fetchData();
            } else { enqueueSnackbar(data.message || 'Failed', { variant: 'error' }); }
        } catch (e) { enqueueSnackbar('Error submitting leave.', { variant: 'error' }); }
        setSubmitting(false);
    };

    const handleDownloadSupportDoc = async (leave) => {
        if (!leave?.supporting_document_url) return;
        try {
            const response = await fetch(leave.supporting_document_url);
            if (!response.ok) throw new Error('Unable to fetch document');
            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = leave.supporting_document_file_name || 'leave-supporting-document';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(objectUrl);
        } catch (error) {
            window.open(leave.supporting_document_url, '_blank', 'noopener,noreferrer');
        }
    };

    const handleActionLeave = async () => {
        const { leave, action } = actionDialog;
        try {
            const res = await fetch(`${apiUrl}/leaves/${leave._id}`, {
                method: 'PATCH', headers, body: JSON.stringify({ status: action, notes: actionNote }),
            });
            if (res.ok) {
                enqueueSnackbar(`Leave ${action}.`, { variant: 'success' });
                setActionDialog({ open: false, leave: null, action: '' });
                setActionNote('');
                fetchData();
            }
        } catch (e) { enqueueSnackbar('Error processing leave.', { variant: 'error' }); }
    };

    // ─── TIMECARD ACTIONS ─────────────────────────────────────────────
    const handleMarkAttendance = async (userId, status) => {
        // Optimistic update: reflect change immediately in UI
        setDailyAttendance(prev => {
            const exists = prev.find(a => (a.userId?._id || a.userId)?.toString() === userId.toString());
            if (exists) {
                return prev.map(a =>
                    (a.userId?._id || a.userId)?.toString() === userId.toString()
                        ? { ...a, status }
                        : a
                );
            } else {
                return [...prev, { userId, date: attendanceDate, status }];
            }
        });
        try {
            const res = await fetch(`${apiUrl}/timecard/attendance/mark`, {
                method: 'POST', headers, body: JSON.stringify({ userId, date: attendanceDate, status })
            });
            if (res.ok) {
                enqueueSnackbar('Attendance updated', { variant: 'success' });
                fetchDailyAttendance(); // sync with server
            } else {
                enqueueSnackbar('Failed to update attendance', { variant: 'error' });
                fetchDailyAttendance(); // revert on failure
            }
        } catch (e) {
            enqueueSnackbar('Failed to update attendance', { variant: 'error' });
            fetchDailyAttendance(); // revert on error
        }
    };

    const handleAddHoliday = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${apiUrl}/timecard/holidays`, {
                method: 'POST', headers, body: JSON.stringify(holidayForm)
            });
            if (res.ok) {
                enqueueSnackbar('Holiday added', { variant: 'success' });
                setHolidayForm({ date: '', name: '' });
                fetchHolidays();
            } else { enqueueSnackbar('Failed to add holiday', { variant: 'error' }); }
        } catch (e) { enqueueSnackbar('Failed to add holiday', { variant: 'error' }); }
    };

    const handleDeleteHoliday = async (id) => {
        try {
            const res = await fetch(`${apiUrl}/timecard/holidays/${id}`, { method: 'DELETE', headers });
            if (res.ok) {
                enqueueSnackbar('Holiday deleted', { variant: 'success' });
                fetchHolidays();
            }
        } catch (e) { enqueueSnackbar('Failed to delete holiday', { variant: 'error' }); }
    };

    // ─── CALCULATIONS ─────────────────────────────────────────────
    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const dayCount = (s, e) => Math.max(1, Math.ceil((new Date(e) - new Date(s)) / 86400000) + 1);
    const getImplicitStatusForDate = (dateValue) => {
        const dateKey = toDateKey(dateValue);
        if (holidays.some((holiday) => toDateKey(holiday.date) === dateKey)) return "Holiday";
        if (isWeekendDate(dateValue)) return "Week Off";
        return "Not Marked";
    };

    const stats = useMemo(() => {
        let present = 0, fullDayLeave = 0, weekOff = 0, holiday = 0, halfDay = 0, wfh = 0, elTaken = 0;
        myAttendance.forEach(att => {
            if (att.status === 'Present') present++;
            if (att.status === 'Full Day Leave') fullDayLeave++;
            if (att.status === 'Week Off') weekOff++;
            if (att.status === 'Holiday') holiday++;
            if (att.status === 'Half Day Leave') halfDay++;
            if (att.status === 'WFH') wfh++;
            if (att.status === 'EL Taken') elTaken++;
        });

        const existingAttendanceDays = new Set(myAttendance.map((att) => toDateKey(att.date)));
        const [year, month] = selectedMonth.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateValue = new Date(year, month - 1, day);
            const dateKey = toDateKey(dateValue);
            if (existingAttendanceDays.has(dateKey)) continue;
            if (holidays.some((holiday) => toDateKey(holiday.date) === dateKey)) {
                holiday++;
            } else if (isWeekendDate(dateValue)) {
                weekOff++;
            }
        }

        const totalLeave = fullDayLeave + halfDay;
        const payableDays = present + weekOff + holiday + halfDay + wfh + elTaken;

        return { present, fullDayLeave, weekOff, holiday, halfDay, wfh, elTaken, totalLeave, payableDays };
    }, [myAttendance, selectedMonth, holidays]);

    const dailyAttendanceByUser = useMemo(() => {
        const map = new Map();
        dailyAttendance.forEach((record) => {
            const id = (record.userId?._id || record.userId)?.toString();
            if (id) map.set(id, record);
        });
        return map;
    }, [dailyAttendance]);

    const dailySummary = useMemo(() => {
        const summary = ATTENDANCE_STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
        let notMarked = 0;

        employees.forEach((emp) => {
            const record = dailyAttendanceByUser.get(emp._id?.toString());
            const effectiveStatus = record?.status || getImplicitStatusForDate(attendanceDate);
            if (effectiveStatus && summary[effectiveStatus] !== undefined) {
                summary[effectiveStatus] += 1;
            } else if (effectiveStatus && effectiveStatus !== "Not Marked") {
                summary[effectiveStatus] = (summary[effectiveStatus] || 0) + 1;
            } else {
                notMarked += 1;
            }
        });

        return { ...summary, notMarked };
    }, [dailyAttendanceByUser, employees, attendanceDate, holidays]);

    const downloadDailyAttendanceExcel = () => {
        const rows = employees.map((emp) => {
            const record = dailyAttendanceByUser.get(emp._id?.toString());
            return {
                employee: emp.name || "-",
                email: emp.email || "-",
                role: emp.user_role || "-",
                status: record?.status || getImplicitStatusForDate(attendanceDate),
                notes: record?.notes || "-",
            };
        });

        const html = `
          <table>
            <tr><th>Employee</th><th>Email</th><th>Role</th><th>Status</th><th>Notes</th></tr>
            ${rows.map((row) => `<tr><td>${String(row.employee).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td><td>${String(row.email).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td><td>${String(row.role).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td><td>${String(row.status).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td><td>${String(row.notes).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td></tr>`).join("")}
          </table>
        `;
        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `daily_attendance_${attendanceDate}.xls`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const tabsToRender = [
        { label: "My Timecard", show: true },
        { label: "Apply for Leave", show: true },
        { label: "My Leave History", show: true },
        { label: "Organization Holidays", show: true },
        { label: "Manage Leaves", show: isApprover },
        { label: "Login Activity Logs", show: isApprover },
        { label: "Daily Attendance", show: isApprover },
        { label: "Mark Attendance", show: isApprover }
    ];
    
    // Create an accessible array of tabs
    const validTabs = tabsToRender.filter(t => t.show);
    const activeTabLabel = validTabs[tab]?.label || '';
    const surfaceSx = {
        borderRadius: '8px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: isDark ? '0 14px 30px rgba(2,6,23,0.28)' : '0 14px 36px rgba(15,23,42,0.06)',
        background: isDark ? 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.94) 100%)' : '#fff',
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><Loader /></Box>;

    return (
        <Box sx={{ p: { xs: 1, sm: 1.5, md: 2 }, maxWidth: 1560, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EventNoteOutlinedIcon sx={{ color: ACCENT }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Timecard & Leave</Typography>
              </Box>
              {activeTabLabel === 'My Timecard' && (
                <TextField 
                    label="Month" 
                    type="month" 
                    size="small" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)} 
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: { xs: '100%', sm: 190 } }}
                />
              )}
            </Box>

            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                    mb: 3,
                    p: 0.5,
                    borderRadius: '8px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
                    '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 42, borderRadius: '8px' }
                }}
            >
                {validTabs.map((t, i) => <Tab key={i} label={t.label} />)}
            </Tabs>

            {/* TAB: MY TIMECARD */}
            {activeTabLabel === 'My Timecard' && (
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Attendance Summary</Typography>
                    
                    <Grid container spacing={2} sx={{ mb: 4 }}>
                        { [
                            { label: 'Present Days', val: stats.present, color: '#10b981' },
                            { label: 'Week Off', val: stats.weekOff, color: '#6366f1' },
                            { label: 'Holiday', val: stats.holiday, color: '#ec4899' },
                            { label: 'WFH', val: stats.wfh, color: '#8b5cf6' },
                            { label: 'Half Day', val: stats.halfDay, color: '#f59e0b' },
                            { label: 'Total Leaves', val: stats.totalLeave, color: '#ef4444' },
                            { label: 'EL Taken', val: stats.elTaken, color: '#06b6d4' },
                            { label: 'Payable Days', val: stats.payableDays, color: isDark ? '#fff' : '#111827', main: true }
                        ].map((s, i) => (
                            <Grid item xs={6} sm={3} key={i}>
                                <Card sx={{ 
                                    ...surfaceSx,
                                    bgcolor: s.main ? (isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6') : (isDark ? 'background.paper' : 'white'), 
                                    border: s.main ? `2px solid ${isDark ? '#fff' : '#111827'}` : '1px solid',
                                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'
                                }}>
                                    <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
                                        <Typography variant="h4" sx={{ fontWeight: 800, color: s.color }}>{s.val}</Typography>
                                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>{s.label}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Daily Records</Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ ...surfaceSx, bgcolor: isDark ? 'background.paper' : 'inherit', overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                                <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Notes</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {myAttendance.length === 0 ? (
                                    <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3 }}>No records for this month</TableCell></TableRow>
                                ) : (
                                    myAttendance.map((m) => (
                                        <TableRow key={m._id}>
                                            <TableCell sx={{ fontWeight: 500 }}>{formatDate(m.date)}</TableCell>
                                            <TableCell>
                                                <Chip size="small" label={m.status} 
                                                    color={m.status === 'Present' ? 'success' : m.status.includes('Leave') ? 'error' : 'default'}
                                                />
                                            </TableCell>
                                            <TableCell>{m.notes || '-'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {/* TAB: APPLY FOR LEAVE */}
            {activeTabLabel === 'Apply for Leave' && (
                <Card sx={{ ...surfaceSx, bgcolor: isDark ? 'background.paper' : 'white' }}>
                    <CardContent>
                        <form onSubmit={handleSubmitLeave}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth required>
                                        <InputLabel>Leave Type</InputLabel>
                                        <Select label="Leave Type" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                                            {['sick', 'casual', 'earned', 'unpaid', 'other'].map((t) => (
                                                <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <TextField label="From" type="date" fullWidth required InputLabelProps={{ shrink: true }} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <TextField label="To" type="date" fullWidth required InputLabelProps={{ shrink: true }} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField label="Reason" fullWidth required multiline rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                                </Grid>
                                <Grid item xs={12}>
                                    <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ borderRadius: '8px', justifyContent: 'flex-start', width: { xs: '100%', sm: 'auto' } }}>
                                        {supportingDocument ? supportingDocument.name : 'Upload Supporting Document (Optional)'}
                                        <input
                                            type="file"
                                            hidden
                                            accept="image/*,.pdf"
                                            onChange={(e) => setSupportingDocument(e.target.files?.[0] || null)}
                                        />
                                    </Button>
                                </Grid>
                                <Grid item xs={12}>
                                    <Button type="submit" variant="contained" disabled={submitting} sx={{ px: 4, borderRadius: '8px', width: { xs: '100%', sm: 'auto' } }}>
                                        {submitting ? 'Submitting...' : 'Submit Leave Request'}
                                    </Button>
                                </Grid>
                            </Grid>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* TAB: MY LEAVES HISTORY */}
            {activeTabLabel === 'My Leave History' && (
                isMobile ? (
                  <Stack spacing={1.25}>
                    {myLeaves.length === 0 && <Paper sx={{ ...surfaceSx, p: 2 }}><Typography>No request history</Typography></Paper>}
                    {myLeaves.map((l) => (
                      <Paper key={l._id} sx={{ ...surfaceSx, p: 1.4 }}>
                        <Stack spacing={0.9}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Chip size="small" label={l.leave_type} sx={{ textTransform: 'capitalize', borderRadius: '8px' }} />
                            <Chip size="small" icon={statusIcons[l.status]} label={l.status} sx={{ bgcolor: `${statusColors[l.status]}18`, color: statusColors[l.status], fontWeight: 600, textTransform: 'capitalize', borderRadius: '8px' }} />
                          </Stack>
                          <Typography variant="body2"><strong>From:</strong> {formatDate(l.start_date)}</Typography>
                          <Typography variant="body2"><strong>To:</strong> {formatDate(l.end_date)}</Typography>
                          <Typography variant="body2"><strong>Days:</strong> {dayCount(l.start_date, l.end_date)}</Typography>
                          <Typography variant="body2"><strong>Notes:</strong> {l.notes || '-'}</Typography>
                          {l.supporting_document_url ? (
                            <Stack direction="row" spacing={1}>
                              <Button size="small" variant="outlined" onClick={() => window.open(l.supporting_document_url, '_blank', 'noopener,noreferrer')}>View</Button>
                              <Button size="small" onClick={() => handleDownloadSupportDoc(l)}>Download</Button>
                            </Stack>
                          ) : null}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ ...surfaceSx, bgcolor: isDark ? 'background.paper' : 'inherit' }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                            <TableRow>
                                <TableCell>Type</TableCell><TableCell>From</TableCell><TableCell>To</TableCell>
                                <TableCell>Days</TableCell><TableCell>Status</TableCell><TableCell>Document</TableCell><TableCell>Notes</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {myLeaves.length === 0 && <TableRow><TableCell colSpan={7} align="center">No request history</TableCell></TableRow>}
                            {myLeaves.map((l) => (
                                <TableRow key={l._id}>
                                    <TableCell><Chip size="small" label={l.leave_type} sx={{ textTransform: 'capitalize' }} /></TableCell>
                                    <TableCell>{formatDate(l.start_date)}</TableCell>
                                    <TableCell>{formatDate(l.end_date)}</TableCell>
                                    <TableCell>{dayCount(l.start_date, l.end_date)}</TableCell>
                                    <TableCell><Chip size="small" icon={statusIcons[l.status]} label={l.status} sx={{ bgcolor: `${statusColors[l.status]}18`, color: statusColors[l.status], fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>
                                    <TableCell>
                                        {l.supporting_document_url ? (
                                            <Stack direction="row" spacing={1}>
                                                <Button size="small" variant="outlined" onClick={() => window.open(l.supporting_document_url, '_blank', 'noopener,noreferrer')}>View</Button>
                                                <Button size="small" onClick={() => handleDownloadSupportDoc(l)}>Download</Button>
                                            </Stack>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>{l.notes || '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                )
            )}

            {/* TAB: HOLIDAYS */}
            {activeTabLabel === 'Organization Holidays' && (
                <Box>
                    {isApprover && (
                        <Card sx={{ mb: 3, bgcolor: isDark ? 'background.paper' : 'white' }}>
                            <CardContent>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Add New Holiday</Typography>
                                <form onSubmit={handleAddHoliday}>
                                    <Grid container spacing={2} alignItems="center">
                                        <Grid item xs={12} sm={4}>
                                            <TextField type="date" label="Date" fullWidth required size="small" InputLabelProps={{ shrink: true }} value={holidayForm.date} onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })} />
                                        </Grid>
                                        <Grid item xs={12} sm={5}>
                                            <TextField label="Holiday Name" fullWidth required size="small" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} />
                                        </Grid>
                                        <Grid item xs={12} sm={3}>
                                            <Button type="submit" variant="contained" fullWidth startIcon={<AddIcon />}>Add Holiday</Button>
                                        </Grid>
                                    </Grid>
                                </form>
                            </CardContent>
                        </Card>
                    )}
                    <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: isDark ? 'background.paper' : 'inherit' }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                                <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Holiday Name</TableCell>
                                    {isApprover && <TableCell align="right">Action</TableCell>}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {holidays.length === 0 ? (
                                    <TableRow><TableCell colSpan={isApprover ? 3 : 2} align="center" sx={{ py: 3 }}>No holidays added yet</TableCell></TableRow>
                                ) : (
                                    holidays.map((h) => (
                                        <TableRow key={h._id}>
                                            <TableCell sx={{ fontWeight: 600 }}>{formatDate(h.date)}</TableCell>
                                            <TableCell>{h.name}</TableCell>
                                            {isApprover && (
                                                <TableCell align="right">
                                                    <IconButton size="small" color="error" onClick={() => handleDeleteHoliday(h._id)}><DeleteIcon fontSize="small" /></IconButton>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {/* TAB: MANAGE LEAVES */}
            {activeTabLabel === 'Manage Leaves' && isApprover && (
                <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: isDark ? 'background.paper' : 'inherit' }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                            <TableRow>
                                <TableCell>Employee</TableCell><TableCell>Type</TableCell><TableCell>From</TableCell>
                                <TableCell>To</TableCell><TableCell>Reason</TableCell><TableCell>Document</TableCell><TableCell>Status</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {allLeaves.length === 0 && <TableRow><TableCell colSpan={8} align="center">No requests</TableCell></TableRow>}
                            {allLeaves.map((l) => (
                                <TableRow key={l._id}>
                                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{l.user_name}</Typography></TableCell>
                                    <TableCell><Chip size="small" label={l.leave_type} sx={{ textTransform: 'capitalize' }} /></TableCell>
                                    <TableCell>{formatDate(l.start_date)}</TableCell>
                                    <TableCell>{formatDate(l.end_date)}</TableCell>
                                    <TableCell>{l.reason}</TableCell>
                                    <TableCell>
                                        {l.supporting_document_url ? (
                                            <Stack direction="row" spacing={1}>
                                                <Button size="small" variant="outlined" onClick={() => window.open(l.supporting_document_url, '_blank', 'noopener,noreferrer')}>View</Button>
                                                <Button size="small" onClick={() => handleDownloadSupportDoc(l)}>Download</Button>
                                            </Stack>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell><Chip size="small" icon={statusIcons[l.status]} label={l.status} sx={{ bgcolor: `${statusColors[l.status]}18`, color: statusColors[l.status], fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>
                                    <TableCell>
                                        {l.status === 'pending' ? (
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                <Button size="small" variant="contained" color="success" onClick={() => setActionDialog({ open: true, leave: l, action: 'approved' })}>Approve</Button>
                                                <Button size="small" variant="outlined" color="error" onClick={() => setActionDialog({ open: true, leave: l, action: 'rejected' })}>Reject</Button>
                                            </Box>
                                        ) : <Typography variant="caption" color="text.secondary">Done</Typography>}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* TAB: DAILY ATTENDANCE */}
            {activeTabLabel === 'Daily Attendance' && isApprover && (
                <Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>All Employees Attendance</Typography>
                            <Typography variant="body2" color="text.secondary">View marked attendance for every employee on a selected date.</Typography>
                        </Box>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                            <TextField
                                label="Attendance Date"
                                type="date"
                                size="small"
                                value={attendanceDate}
                                onChange={(e) => setAttendanceDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                            />
                            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadDailyAttendanceExcel}>
                                Download Excel
                            </Button>
                        </Stack>
                    </Box>

                    <Grid container spacing={1.5} sx={{ mb: 3 }}>
                        {[
                            { label: 'Present', val: dailySummary.Present || 0, color: '#16a34a' },
                            { label: 'Leave', val: (dailySummary['Full Day Leave'] || 0) + (dailySummary['Half Day Leave'] || 0), color: '#dc2626' },
                            { label: 'WFH', val: dailySummary.WFH || 0, color: '#2563eb' },
                            { label: 'Week Off', val: dailySummary['Week Off'] || 0, color: '#9333ea' },
                            { label: 'Holiday', val: dailySummary.Holiday || 0, color: '#db2777' },
                            { label: 'Not Marked', val: dailySummary.notMarked || 0, color: '#6b7280' },
                        ].map((item) => (
                            <Grid item xs={6} sm={4} md={2} key={item.label}>
                                <Card variant="outlined" sx={{ bgcolor: isDark ? 'background.paper' : 'white' }}>
                                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Typography variant="h5" sx={{ fontWeight: 800, color: item.color }}>{item.val}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: isDark ? 'background.paper' : 'inherit' }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                                <TableRow>
                                    <TableCell>Employee</TableCell>
                                    <TableCell>Role</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Notes</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {employees.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>No employees found</TableCell></TableRow>
                                ) : (
                                    employees.map((emp) => {
                                        const record = dailyAttendanceByUser.get(emp._id?.toString());
                                        const status = record?.status || getImplicitStatusForDate(attendanceDate);
                                        const statusColor = ATTENDANCE_COLORS[status];
                                        return (
                                            <TableRow key={`daily-${emp._id}`}>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{emp.name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{emp.email}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ textTransform: 'capitalize' }}>{emp.user_role || '-'}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        label={status}
                                                        sx={{
                                                            fontWeight: 700,
                                                            bgcolor: statusColor?.bg || 'rgba(107, 114, 128, 0.12)',
                                                            color: statusColor?.color || '#6b7280',
                                                            border: `1px solid ${statusColor?.border || 'rgba(107, 114, 128, 0.25)'}`,
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>{record?.notes || '-'}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {/* TAB: MARK ATTENDANCE */}
            {activeTabLabel === 'Mark Attendance' && isApprover && (
                <Box>
                    <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
                        <TextField 
                            label="Target Date" 
                            type="date" 
                            size="small" 
                            value={attendanceDate} 
                            onChange={(e) => setAttendanceDate(e.target.value)} 
                            InputLabelProps={{ shrink: true }}
                        />
                        <Typography variant="body2" color="text.secondary">Select a date to view and mark attendance records.</Typography>
                    </Box>

                    <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: isDark ? 'background.paper' : 'inherit' }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                                <TableRow>
                                    <TableCell>Employee Name</TableCell>
                                    <TableCell>Attendance</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {employees.map(emp => {
                                    const currRecord = dailyAttendance.find(a => (a.userId?._id || a.userId)?.toString() === emp._id?.toString()) || {};
                                    return (
                                        <TableRow key={emp._id} sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#f9fafb' } }}>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{emp.name}</Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{emp.user_role}</Typography>
                                            </TableCell>
                                            <TableCell sx={{ minWidth: 190 }}>
                                                <Select
                                                    size="small"
                                                    displayEmpty
                                                    value={currRecord.status || ''}
                                                    onChange={(e) => handleMarkAttendance(emp._id, e.target.value)}
                                                    sx={{
                                                        minWidth: 170,
                                                        fontWeight: 600,
                                                        fontSize: '0.8rem',
                                                        bgcolor: isDark ? 'background.paper' : 'background.default',
                                                        color: isDark ? 'text.primary' : 'inherit',
                                                        ...(currRecord.status && ATTENDANCE_COLORS[currRecord.status] ? {
                                                            bgcolor: ATTENDANCE_COLORS[currRecord.status].bg,
                                                            color: ATTENDANCE_COLORS[currRecord.status].color,
                                                            border: `1px solid ${ATTENDANCE_COLORS[currRecord.status].border}`,
                                                            borderRadius: 2,
                                                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                                            '& .MuiSvgIcon-root': { color: ATTENDANCE_COLORS[currRecord.status].color }
                                                        } : {})
                                                    }}
                                                    MenuProps={{
                                                        PaperProps: {
                                                            sx: {
                                                                bgcolor: isDark ? 'background.paper' : 'background.default',
                                                                '& .MuiMenuItem-root': {
                                                                    color: isDark ? 'text.primary' : 'inherit',
                                                                }
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <MenuItem value="" disabled sx={{ color: isDark ? 'text.secondary' : 'text.secondary' }}>— Not Marked —</MenuItem>
                                                    {ATTENDANCE_STATUSES.map(s => (
                                                        <MenuItem key={s} value={s} sx={{
                                                            fontWeight: 600,
                                                            color: ATTENDANCE_COLORS[s]?.color || (isDark ? 'text.primary' : 'inherit'),
                                                            bgcolor: ATTENDANCE_COLORS[s]?.bg || (isDark ? 'background.paper' : 'inherit'),
                                                            '&:hover': { filter: 'brightness(0.95)' },
                                                            '&.Mui-selected': { bgcolor: ATTENDANCE_COLORS[s]?.bg || (isDark ? 'action.selected' : 'inherit') },
                                                        }}>
                                                            {s}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {/* TAB: LOGIN ACTIVITY LOGS */}
            {activeTabLabel === 'Login Activity Logs' && isApprover && (
                <Box>
                    <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
                        <TextField 
                            label="Activity Date" 
                            type="date" 
                            size="small" 
                            value={activityDate} 
                            onChange={(e) => setActivityDate(e.target.value)} 
                            InputLabelProps={{ shrink: true }}
                        />
                        <Typography variant="body2" color="text.secondary">Select a date to view employee login/logout activities and durations.</Typography>
                    </Box>

                    <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: isDark ? 'background.paper' : 'inherit' }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb' }}>
                                <TableRow>
                                    <TableCell>Employee Details</TableCell>
                                    <TableCell>Current Status</TableCell>
                                    <TableCell>First Login Time</TableCell>
                                    <TableCell>Last Activity Time</TableCell>
                                    <TableCell>Total Online Duration</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {employees.map(emp => {
                                    const actRecord = dailyActivities.find(a => (a.userId?._id || a.userId)?.toString() === emp._id?.toString()) || {};
                                    const online = actRecord.lastOnline ? isUserOnline(actRecord.lastOnline) : false;
                                    return (
                                        <TableRow key={`act-${emp._id}`} sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#f9fafb' } }}>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{emp.name}</Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{emp.user_role}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip 
                                                    size="small" 
                                                    label={online ? "Online Now" : (actRecord.firstOnline ? "Offline" : "No Activity")} 
                                                    sx={{ 
                                                        bgcolor: online ? 'rgba(16, 185, 129, 0.15)' : (actRecord.firstOnline ? 'rgba(107, 114, 128, 0.15)' : 'transparent'), 
                                                        color: online ? '#10b981' : '#6b7280', 
                                                        fontWeight: 600,
                                                        ...( !actRecord.firstOnline ? { border: '1px dashed' } : {} )
                                                    }} 
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {actRecord.firstOnline ? (
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                        {formatTime(actRecord.firstOnline)}
                                                    </Typography>
                                                ) : <Typography variant="caption" color="text.secondary">—</Typography>}
                                            </TableCell>
                                            <TableCell>
                                                {actRecord.lastOnline ? (
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                        {formatTime(actRecord.lastOnline)}
                                                    </Typography>
                                                ) : <Typography variant="caption" color="text.secondary">—</Typography>}
                                            </TableCell>
                                            <TableCell>
                                                {actRecord.firstOnline ? (
                                                    <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                                                        {getOnlineDuration(actRecord.firstOnline, actRecord.lastOnline)}
                                                    </Typography>
                                                ) : <Typography variant="caption" color="text.secondary">—</Typography>}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {/* LEAVE APPROVAL DIALOG */}
            <Dialog open={actionDialog.open} onClose={() => setActionDialog({ open: false, leave: null, action: '' })} maxWidth="xs" fullWidth>
                <DialogTitle>{actionDialog.action === 'approved' ? 'Approve' : 'Reject'} Leave Request</DialogTitle>
                <DialogContent>
                    <TextField autoFocus label="Notes (optional)" fullWidth multiline rows={2} value={actionNote} onChange={(e) => setActionNote(e.target.value)} sx={{ mt: 1 }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setActionDialog({ open: false, leave: null, action: '' })}>Cancel</Button>
                    <Button variant="contained" color={actionDialog.action === 'approved' ? 'success' : 'error'} onClick={handleActionLeave}>
                        {actionDialog.action === 'approved' ? 'Approve' : 'Reject'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};

export default Timecard;
