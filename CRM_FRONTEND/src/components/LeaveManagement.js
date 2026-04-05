import React, { useMemo, useState, useEffect } from 'react';
import {
    Box, Typography, TextField, Button, Select, MenuItem, InputLabel, FormControl,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Card, CardContent,
    Tab, Tabs,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import { enqueueSnackbar } from 'notistack';
import { apiUrl } from './LoginSignup';
import Loader from './Loader';

const statusColors = {
    pending: '#f59e0b',
    approved: '#10b981',
    rejected: '#ef4444',
};

const statusIcons = {
    pending: <HourglassEmptyOutlinedIcon sx={{ fontSize: 16 }} />,
    approved: <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />,
    rejected: <CancelOutlinedIcon sx={{ fontSize: 16 }} />,
};

const blankAttendance = {
    user_id: '',
    present_days: 0,
    leave_days: 0,
    week_off: 0,
    holiday: 0,
    half_day: 0,
    wfh: 0,
    el_taken: 0,
    notes: '',
};

const normalizeRole = (role = '') => role.toString().trim().toLowerCase();
const approverRoles = ['hr', 'admin', 'super admin', 'dev', 'srdev', 'senior admin'];
const currentMonth = () => new Date().toISOString().slice(0, 7);

const numberValue = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const LeaveManagement = () => {
    const session = JSON.parse(localStorage.getItem('userSession')) || {};
    const headers = { Authorization: session.token || '', 'Content-Type': 'application/json' };
    const isApprover = approverRoles.includes(normalizeRole(session.user_role));

    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(0);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth());

    const [myLeaves, setMyLeaves] = useState([]);
    const [allLeaves, setAllLeaves] = useState([]);
    const [myTimecard, setMyTimecard] = useState(null);
    const [allTimecards, setAllTimecards] = useState([]);
    const [employees, setEmployees] = useState([]);

    const [leaveForm, setLeaveForm] = useState({ leave_type: '', start_date: '', end_date: '', reason: '' });
    const [attendanceForm, setAttendanceForm] = useState(blankAttendance);
    const [submittingLeave, setSubmittingLeave] = useState(false);
    const [savingAttendance, setSavingAttendance] = useState(false);

    const [actionDialog, setActionDialog] = useState({ open: false, leave: null, action: '' });
    const [actionNote, setActionNote] = useState('');

    const attendanceComputed = useMemo(() => {
        const present_days = numberValue(attendanceForm.present_days);
        const leave_days = numberValue(attendanceForm.leave_days);
        const week_off = numberValue(attendanceForm.week_off);
        const holiday = numberValue(attendanceForm.holiday);
        const half_day = numberValue(attendanceForm.half_day);
        const wfh = numberValue(attendanceForm.wfh);
        const el_taken = numberValue(attendanceForm.el_taken);

        const total_leave = leave_days + half_day;
        const payable_days = present_days + week_off + holiday + half_day + wfh + el_taken;

        return { present_days, leave_days, week_off, holiday, half_day, wfh, el_taken, total_leave, payable_days };
    }, [attendanceForm]);

    useEffect(() => {
        loadInitial();
    }, []);

    useEffect(() => {
        loadMonthData(selectedMonth);
    }, [selectedMonth]);

    const loadInitial = async () => {
        setLoading(true);
        await Promise.all([loadLeaveData(), loadMonthData(selectedMonth)]);
        setLoading(false);
    };

    const loadLeaveData = async () => {
        try {
            const myRes = await fetch(`${apiUrl}/leaves/my`, { headers });
            if (myRes.ok) setMyLeaves(await myRes.json());

            if (isApprover) {
                const allRes = await fetch(`${apiUrl}/leaves/all`, { headers });
                if (allRes.ok) setAllLeaves(await allRes.json());
            }
        } catch (error) {
            console.error(error);
        }
    };

    const loadMonthData = async (month) => {
        try {
            const myCardRes = await fetch(`${apiUrl}/leaves/timecard/my?month=${month}`, { headers });
            if (myCardRes.ok) setMyTimecard(await myCardRes.json());

            if (isApprover) {
                const [allCardsRes, usersRes] = await Promise.all([
                    fetch(`${apiUrl}/leaves/timecard/all?month=${month}`, { headers }),
                    fetch(`${apiUrl}/user/options`, { headers: { Authorization: session.token || '' } }),
                ]);

                if (allCardsRes.ok) setAllTimecards(await allCardsRes.json());
                if (usersRes.ok) {
                    const data = await usersRes.json();
                    setEmployees(Array.isArray(data.users) ? data.users : []);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleLeaveSubmit = async (e) => {
        e.preventDefault();
        if (!leaveForm.leave_type || !leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason) {
            enqueueSnackbar('All leave fields are required.', { variant: 'warning' });
            return;
        }

        setSubmittingLeave(true);
        try {
            const res = await fetch(`${apiUrl}/leaves`, {
                method: 'POST',
                headers,
                body: JSON.stringify(leaveForm),
            });
            const data = await res.json();
            if (!res.ok) {
                enqueueSnackbar(data.message || 'Failed to submit leave.', { variant: 'error' });
                return;
            }

            enqueueSnackbar('Leave request submitted.', { variant: 'success' });
            setLeaveForm({ leave_type: '', start_date: '', end_date: '', reason: '' });
            loadLeaveData();
        } catch (error) {
            enqueueSnackbar('Error submitting leave request.', { variant: 'error' });
        }
        setSubmittingLeave(false);
    };

    const handleLeaveAction = async () => {
        const { leave, action } = actionDialog;
        if (!leave?._id) return;

        try {
            const res = await fetch(`${apiUrl}/leaves/${leave._id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status: action, notes: actionNote }),
            });

            if (!res.ok) {
                enqueueSnackbar('Unable to update leave status.', { variant: 'error' });
                return;
            }

            enqueueSnackbar(`Leave ${action}.`, { variant: 'success' });
            setActionDialog({ open: false, leave: null, action: '' });
            setActionNote('');
            loadLeaveData();
        } catch (error) {
            enqueueSnackbar('Error while processing leave action.', { variant: 'error' });
        }
    };

    const handlePickEmployee = (userId) => {
        if (!userId) {
            setAttendanceForm(blankAttendance);
            return;
        }

        const existing = allTimecards.find((card) => card.user_id === userId);
        if (existing) {
            setAttendanceForm({
                user_id: userId,
                present_days: existing.present_days || 0,
                leave_days: existing.leave_days || 0,
                week_off: existing.week_off || 0,
                holiday: existing.holiday || 0,
                half_day: existing.half_day || 0,
                wfh: existing.wfh || 0,
                el_taken: existing.el_taken || 0,
                notes: existing.notes || '',
            });
            return;
        }

        setAttendanceForm({ ...blankAttendance, user_id: userId });
    };

    const handleSaveAttendance = async () => {
        if (!attendanceForm.user_id) {
            enqueueSnackbar('Please select an employee first.', { variant: 'warning' });
            return;
        }

        setSavingAttendance(true);
        try {
            const res = await fetch(`${apiUrl}/leaves/timecard/mark`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    user_id: attendanceForm.user_id,
                    month: selectedMonth,
                    ...attendanceComputed,
                    notes: attendanceForm.notes,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                enqueueSnackbar(data.message || 'Failed to save timecard.', { variant: 'error' });
                return;
            }

            enqueueSnackbar('Timecard saved successfully.', { variant: 'success' });
            loadMonthData(selectedMonth);
        } catch (error) {
            enqueueSnackbar('Error saving attendance.', { variant: 'error' });
        }
        setSavingAttendance(false);
    };

    const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const leaveDays = (from, to) => Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1);

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><Loader /></Box>;
    }

    const summaryCard = myTimecard || {
        present_days: 0,
        leave_days: 0,
        week_off: 0,
        holiday: 0,
        half_day: 0,
        wfh: 0,
        el_taken: 0,
        total_leave: 0,
        payable_days: 0,
        notes: '',
    };

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AccessTimeOutlinedIcon sx={{ color: '#111827' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Timecard</Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                HR/Admin/Super Admin/Dev can mark monthly attendance and approve or reject leave requests.
            </Typography>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}>
                <Tab label="My Timecard" />
                <Tab label="Apply Leave" />
                <Tab label="My Leave History" />
                {isApprover && <Tab label="Leave Requests" />}
                {isApprover && <Tab label="Attendance Marking" />}
            </Tabs>

            {tab === 0 && (
                <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                        <TextField
                            label="Month"
                            type="month"
                            fullWidth
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    {[ 
                        ['Present Days', summaryCard.present_days],
                        ['Leave Days', summaryCard.leave_days],
                        ['Week Off', summaryCard.week_off],
                        ['Holiday', summaryCard.holiday],
                        ['Half Day', summaryCard.half_day],
                        ['WFH', summaryCard.wfh],
                        ['EL Taken', summaryCard.el_taken],
                        ['Total Leave', summaryCard.total_leave],
                        ['Payable Days', summaryCard.payable_days],
                    ].map(([label, value]) => (
                        <Grid item xs={6} sm={4} md={3} key={label}>
                            <Card>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Payable Days Formula</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Present Days + Week Off + Holiday + Half Day + WFH + EL Taken = Payable Days
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {summaryCard.present_days} + {summaryCard.week_off} + {summaryCard.holiday} + {summaryCard.half_day} + {summaryCard.wfh} + {summaryCard.el_taken} = {summaryCard.payable_days}
                            </Typography>
                            {summaryCard.notes ? (
                                <Typography variant="body2" sx={{ mt: 1.5 }}><strong>Notes:</strong> {summaryCard.notes}</Typography>
                            ) : null}
                        </Paper>
                    </Grid>
                </Grid>
            )}

            {tab === 1 && (
                <Card>
                    <CardContent>
                        <form onSubmit={handleLeaveSubmit}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth required>
                                        <InputLabel>Leave Type</InputLabel>
                                        <Select label="Leave Type" value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>
                                            {['sick', 'casual', 'earned', 'unpaid', 'other'].map((type) => (
                                                <MenuItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <TextField label="From" type="date" fullWidth required InputLabelProps={{ shrink: true }} value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} />
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <TextField label="To" type="date" fullWidth required InputLabelProps={{ shrink: true }} value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField label="Reason" fullWidth multiline rows={3} required value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
                                </Grid>
                                <Grid item xs={12}>
                                    <Button type="submit" variant="contained" disabled={submittingLeave}>{submittingLeave ? 'Submitting...' : 'Submit Leave Request'}</Button>
                                </Grid>
                            </Grid>
                        </form>
                    </CardContent>
                </Card>
            )}

            {tab === 2 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Type</TableCell>
                                <TableCell>From</TableCell>
                                <TableCell>To</TableCell>
                                <TableCell>Days</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Approved By</TableCell>
                                <TableCell>Notes</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {myLeaves.length === 0 ? (
                                <TableRow><TableCell colSpan={7} align="center">No leave history found.</TableCell></TableRow>
                            ) : myLeaves.map((item) => (
                                <TableRow key={item._id}>
                                    <TableCell><Chip size="small" label={item.leave_type} sx={{ textTransform: 'capitalize' }} /></TableCell>
                                    <TableCell>{formatDate(item.start_date)}</TableCell>
                                    <TableCell>{formatDate(item.end_date)}</TableCell>
                                    <TableCell>{leaveDays(item.start_date, item.end_date)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            icon={statusIcons[item.status]}
                                            label={item.status}
                                            sx={{ bgcolor: `${statusColors[item.status]}18`, color: statusColors[item.status], textTransform: 'capitalize' }}
                                        />
                                    </TableCell>
                                    <TableCell>{item.approved_by || '-'}</TableCell>
                                    <TableCell>{item.notes || '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {tab === 3 && isApprover && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Employee</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>From</TableCell>
                                <TableCell>To</TableCell>
                                <TableCell>Days</TableCell>
                                <TableCell>Reason</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Action</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {allLeaves.length === 0 ? (
                                <TableRow><TableCell colSpan={8} align="center">No leave requests.</TableCell></TableRow>
                            ) : allLeaves.map((item) => (
                                <TableRow key={item._id}>
                                    <TableCell>{item.user_name}</TableCell>
                                    <TableCell><Chip size="small" label={item.leave_type} sx={{ textTransform: 'capitalize' }} /></TableCell>
                                    <TableCell>{formatDate(item.start_date)}</TableCell>
                                    <TableCell>{formatDate(item.end_date)}</TableCell>
                                    <TableCell>{leaveDays(item.start_date, item.end_date)}</TableCell>
                                    <TableCell>{item.reason}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            icon={statusIcons[item.status]}
                                            label={item.status}
                                            sx={{ bgcolor: `${statusColors[item.status]}18`, color: statusColors[item.status], textTransform: 'capitalize' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {item.status === 'pending' ? (
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button size="small" variant="contained" color="success" onClick={() => setActionDialog({ open: true, leave: item, action: 'approved' })}>Approve</Button>
                                                <Button size="small" variant="outlined" color="error" onClick={() => setActionDialog({ open: true, leave: item, action: 'rejected' })}>Reject</Button>
                                            </Box>
                                        ) : 'Done'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {tab === 4 && isApprover && (
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <TextField
                            label="Month"
                            type="month"
                            fullWidth
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={8}>
                        <FormControl fullWidth>
                            <InputLabel>Employee</InputLabel>
                            <Select label="Employee" value={attendanceForm.user_id} onChange={(e) => handlePickEmployee(e.target.value)}>
                                {employees.map((employee) => (
                                    <MenuItem key={employee._id} value={employee._id}>{employee.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    {[ 
                        ['present_days', 'Present Days'],
                        ['leave_days', 'Leave Days'],
                        ['week_off', 'Week Off'],
                        ['holiday', 'Holiday'],
                        ['half_day', 'Half Day'],
                        ['wfh', 'WFH'],
                        ['el_taken', 'EL Taken'],
                    ].map(([key, label]) => (
                        <Grid item xs={12} sm={6} md={4} key={key}>
                            <TextField
                                type="number"
                                label={label}
                                fullWidth
                                value={attendanceForm[key]}
                                onChange={(e) => setAttendanceForm({ ...attendanceForm, [key]: Number(e.target.value || 0) })}
                                inputProps={{ min: 0 }}
                            />
                        </Grid>
                    ))}

                    <Grid item xs={12}>
                        <TextField
                            label="Notes"
                            fullWidth
                            multiline
                            rows={3}
                            value={attendanceForm.notes}
                            onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="body2"><strong>Total Leave:</strong> {attendanceComputed.leave_days} + {attendanceComputed.half_day} = {attendanceComputed.total_leave}</Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                <strong>Payable Days:</strong> {attendanceComputed.present_days} + {attendanceComputed.week_off} + {attendanceComputed.holiday} + {attendanceComputed.half_day} + {attendanceComputed.wfh} + {attendanceComputed.el_taken} = {attendanceComputed.payable_days}
                            </Typography>
                        </Paper>
                    </Grid>

                    <Grid item xs={12}>
                        <Button variant="contained" onClick={handleSaveAttendance} disabled={savingAttendance}>
                            {savingAttendance ? 'Saving...' : 'Save Attendance'}
                        </Button>
                    </Grid>

                    <Grid item xs={12}>
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Employee</TableCell>
                                        <TableCell>Present</TableCell>
                                        <TableCell>Leave</TableCell>
                                        <TableCell>Week Off</TableCell>
                                        <TableCell>Holiday</TableCell>
                                        <TableCell>Half Day</TableCell>
                                        <TableCell>WFH</TableCell>
                                        <TableCell>EL Taken</TableCell>
                                        <TableCell>Total Leave</TableCell>
                                        <TableCell>Payable Days</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {allTimecards.length === 0 ? (
                                        <TableRow><TableCell colSpan={10} align="center">No attendance data for this month.</TableCell></TableRow>
                                    ) : allTimecards.map((row) => (
                                        <TableRow key={`${row.user_id}-${row.month}`}>
                                            <TableCell>{row.user_name}</TableCell>
                                            <TableCell>{row.present_days}</TableCell>
                                            <TableCell>{row.leave_days}</TableCell>
                                            <TableCell>{row.week_off}</TableCell>
                                            <TableCell>{row.holiday}</TableCell>
                                            <TableCell>{row.half_day}</TableCell>
                                            <TableCell>{row.wfh}</TableCell>
                                            <TableCell>{row.el_taken}</TableCell>
                                            <TableCell>{row.total_leave}</TableCell>
                                            <TableCell>{row.payable_days}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Grid>
                </Grid>
            )}

            <Dialog open={actionDialog.open} onClose={() => setActionDialog({ open: false, leave: null, action: '' })} maxWidth="xs" fullWidth>
                <DialogTitle>{actionDialog.action === 'approved' ? 'Approve' : 'Reject'} Leave Request</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Notes (optional)"
                        fullWidth
                        multiline
                        rows={3}
                        value={actionNote}
                        onChange={(e) => setActionNote(e.target.value)}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setActionDialog({ open: false, leave: null, action: '' }); setActionNote(''); }}>Cancel</Button>
                    <Button variant="contained" color={actionDialog.action === 'approved' ? 'success' : 'error'} onClick={handleLeaveAction}>
                        {actionDialog.action === 'approved' ? 'Approve' : 'Reject'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default LeaveManagement;
