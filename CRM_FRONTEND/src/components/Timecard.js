import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, TextField, Button, Select, MenuItem, InputLabel, FormControl,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Card, CardContent,
    Tab, Tabs, Avatar, IconButton, Tooltip, Stack, CircularProgress
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { enqueueSnackbar } from 'notistack';
import { apiUrl } from './LoginSignup';
import Loader from './Loader';
import { canAccessFeature } from '../utils/featureAccess';

const ACCENT = '#111827';

const statusColors = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };
const statusIcons = {
    pending: <HourglassEmptyOutlinedIcon sx={{ fontSize: 16 }} />,
    approved: <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />,
    rejected: <CancelOutlinedIcon sx={{ fontSize: 16 }} />,
};

const ATTENDANCE_STATUSES = [
    "Present", "Full Day Leave", "Half Day Leave", "WFH", "Week Off", "Holiday", "EL Taken"
];

const Timecard = () => {
    const session = JSON.parse(localStorage.getItem('userSession')) || {};
    const headers = { Authorization: session.token || '', 'Content-Type': 'application/json' };
    const isApprover = canAccessFeature(session, 'timecard_edit') || ['admin', 'dev', 'srdev', 'senior admin', 'super admin', 'hr'].includes(session.user_role?.toLowerCase());

    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(true);

    // Leave State
    const [myLeaves, setMyLeaves] = useState([]);
    const [allLeaves, setAllLeaves] = useState([]);
    const [form, setForm] = useState({ leave_type: '', start_date: '', end_date: '', reason: '' });
    const [submitting, setSubmitting] = useState(false);
    const [actionDialog, setActionDialog] = useState({ open: false, leave: null, action: '' });
    const [actionNote, setActionNote] = useState('');

    // Attendance State
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [myAttendance, setMyAttendance] = useState([]);
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
    const [dailyAttendance, setDailyAttendance] = useState([]);
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

    // ─── LEAVE ACTIONS ─────────────────────────────────────────────
    const handleSubmitLeave = async (e) => {
        e.preventDefault();
        if (!form.leave_type || !form.start_date || !form.end_date || !form.reason) {
            enqueueSnackbar('All fields are required.', { variant: 'warning' });
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${apiUrl}/leaves`, { method: 'POST', headers, body: JSON.stringify(form) });
            const data = await res.json();
            if (res.ok) {
                enqueueSnackbar('Leave request submitted!', { variant: 'success' });
                setForm({ leave_type: '', start_date: '', end_date: '', reason: '' });
                fetchData();
            } else { enqueueSnackbar(data.message || 'Failed', { variant: 'error' }); }
        } catch (e) { enqueueSnackbar('Error submitting leave.', { variant: 'error' }); }
        setSubmitting(false);
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
        try {
            const res = await fetch(`${apiUrl}/timecard/attendance/mark`, {
                method: 'POST', headers, body: JSON.stringify({ userId, date: attendanceDate, status })
            });
            if (res.ok) {
                enqueueSnackbar('Attendance updated', { variant: 'success' });
                fetchDailyAttendance();
            } else {
                enqueueSnackbar('Failed to update attendance', { variant: 'error' });
            }
        } catch (e) { enqueueSnackbar('Failed to update attendance', { variant: 'error' }); }
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

        const totalLeave = fullDayLeave + halfDay;
        const payableDays = present + weekOff + holiday + halfDay + wfh + elTaken;

        return { present, fullDayLeave, weekOff, holiday, halfDay, wfh, elTaken, totalLeave, payableDays };
    }, [myAttendance]);

    const tabsToRender = [
        { label: "My Timecard", show: true },
        { label: "Apply for Leave", show: true },
        { label: "My Leave History", show: true },
        { label: "Organization Holidays", show: true },
        { label: "Manage Leaves", show: isApprover },
        { label: "Mark Attendance", show: isApprover }
    ];
    
    // Create an accessible array of tabs
    const validTabs = tabsToRender.filter(t => t.show);
    const activeTabLabel = validTabs[tab]?.label || '';

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><Loader /></Box>;

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <EventNoteOutlinedIcon sx={{ color: ACCENT }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Timecard & Leave</Typography>
            </Box>

            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 3, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
            >
                {validTabs.map((t, i) => <Tab key={i} label={t.label} />)}
            </Tabs>

            {/* TAB: MY TIMECARD */}
            {activeTabLabel === 'My Timecard' && (
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>Attendance Summary</Typography>
                        <TextField 
                            label="Month" 
                            type="month" 
                            size="small" 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(e.target.value)} 
                            InputLabelProps={{ shrink: true }}
                        />
                    </Box>
                    
                    <Grid container spacing={2} sx={{ mb: 4 }}>
                        {[
                            { label: 'Present Days', val: stats.present, color: '#10b981' },
                            { label: 'Week Off', val: stats.weekOff, color: '#6366f1' },
                            { label: 'Holiday', val: stats.holiday, color: '#ec4899' },
                            { label: 'WFH', val: stats.wfh, color: '#8b5cf6' },
                            { label: 'Half Day', val: stats.halfDay, color: '#f59e0b' },
                            { label: 'Total Leaves', val: stats.totalLeave, color: '#ef4444' },
                            { label: 'EL Taken', val: stats.elTaken, color: '#06b6d4' },
                            { label: 'Payable Days', val: stats.payableDays, color: '#111827', main: true }
                        ].map((s, i) => (
                            <Grid item xs={6} sm={3} key={i}>
                                <Card sx={{ bgcolor: s.main ? '#f3f4f6' : 'white', border: s.main ? '2px solid #111827' : '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
                                        <Typography variant="h4" sx={{ fontWeight: 800, color: s.color }}>{s.val}</Typography>
                                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>{s.label}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Daily Records</Typography>
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f9fafb' }}>
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
                <Card>
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
                                    <Button type="submit" variant="contained" disabled={submitting} sx={{ px: 4 }}>
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
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead sx={{ bgcolor: '#f9fafb' }}>
                            <TableRow>
                                <TableCell>Type</TableCell><TableCell>From</TableCell><TableCell>To</TableCell>
                                <TableCell>Days</TableCell><TableCell>Status</TableCell><TableCell>Notes</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {myLeaves.length === 0 && <TableRow><TableCell colSpan={6} align="center">No request history</TableCell></TableRow>}
                            {myLeaves.map((l) => (
                                <TableRow key={l._id}>
                                    <TableCell><Chip size="small" label={l.leave_type} sx={{ textTransform: 'capitalize' }} /></TableCell>
                                    <TableCell>{formatDate(l.start_date)}</TableCell>
                                    <TableCell>{formatDate(l.end_date)}</TableCell>
                                    <TableCell>{dayCount(l.start_date, l.end_date)}</TableCell>
                                    <TableCell><Chip size="small" icon={statusIcons[l.status]} label={l.status} sx={{ bgcolor: `${statusColors[l.status]}18`, color: statusColors[l.status], fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>
                                    <TableCell>{l.notes || '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* TAB: HOLIDAYS */}
            {activeTabLabel === 'Organization Holidays' && (
                <Box>
                    {isApprover && (
                        <Card sx={{ mb: 3 }}>
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
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f9fafb' }}>
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
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead sx={{ bgcolor: '#f9fafb' }}>
                            <TableRow>
                                <TableCell>Employee</TableCell><TableCell>Type</TableCell><TableCell>From</TableCell>
                                <TableCell>To</TableCell><TableCell>Reason</TableCell><TableCell>Status</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {allLeaves.length === 0 && <TableRow><TableCell colSpan={7} align="center">No requests</TableCell></TableRow>}
                            {allLeaves.map((l) => (
                                <TableRow key={l._id}>
                                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{l.user_name}</Typography></TableCell>
                                    <TableCell><Chip size="small" label={l.leave_type} sx={{ textTransform: 'capitalize' }} /></TableCell>
                                    <TableCell>{formatDate(l.start_date)}</TableCell>
                                    <TableCell>{formatDate(l.end_date)}</TableCell>
                                    <TableCell>{l.reason}</TableCell>
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

                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f9fafb' }}>
                                <TableRow>
                                    <TableCell>Employee Name</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {employees.map(emp => {
                                    const currRecord = dailyAttendance.find(a => (a.userId?._id || a.userId) === emp._id) || {};
                                    return (
                                        <TableRow key={emp._id}>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{emp.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">{emp.user_role}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                {currRecord.status ? (
                                                    <Chip size="small" label={currRecord.status} color={currRecord.status === 'Present' ? 'success' : currRecord.status.includes('Leave') ? 'error' : 'default'} />
                                                ) : <Typography variant="caption" color="text.secondary">Not Marked</Typography>}
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    size="small"
                                                    displayEmpty
                                                    value={""}
                                                    onChange={(e) => handleMarkAttendance(emp._id, e.target.value)}
                                                    sx={{ minWidth: 150 }}
                                                >
                                                    <MenuItem value="" disabled>Update Status</MenuItem>
                                                    {ATTENDANCE_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
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
