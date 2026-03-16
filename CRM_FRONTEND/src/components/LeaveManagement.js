import React, { useState, useEffect } from 'react';
import {
    Box, Typography, TextField, Button, Select, MenuItem, InputLabel, FormControl,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Chip, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Card, CardContent,
    Tab, Tabs, Avatar,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import { enqueueSnackbar } from 'notistack';
import { apiUrl } from './LoginSignup';
import Loader from './Loader';

const ACCENT = '#e87c2a';

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

const LeaveManagement = () => {
    const session = JSON.parse(localStorage.getItem('userSession')) || {};
    const headers = { Authorization: session.token || '', 'Content-Type': 'application/json' };
    const isApprover = ['admin', 'dev', 'srdev', 'senior admin', 'HR'].includes(session.user_role);

    const [tab, setTab] = useState(0);
    const [myLeaves, setMyLeaves] = useState([]);
    const [allLeaves, setAllLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ leave_type: '', start_date: '', end_date: '', reason: '' });
    const [submitting, setSubmitting] = useState(false);
    const [actionDialog, setActionDialog] = useState({ open: false, leave: null, action: '' });
    const [actionNote, setActionNote] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.leave_type || !form.start_date || !form.end_date || !form.reason) {
            enqueueSnackbar('All fields are required.', { variant: 'warning' });
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${apiUrl}/leaves`, {
                method: 'POST',
                headers,
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) {
                enqueueSnackbar('Leave request submitted!', { variant: 'success' });
                setForm({ leave_type: '', start_date: '', end_date: '', reason: '' });
                fetchData();
            } else {
                enqueueSnackbar(data.message || 'Failed', { variant: 'error' });
            }
        } catch (e) {
            enqueueSnackbar('Error submitting leave.', { variant: 'error' });
        }
        setSubmitting(false);
    };

    const handleAction = async () => {
        const { leave, action } = actionDialog;
        try {
            const res = await fetch(`${apiUrl}/leaves/${leave._id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status: action, notes: actionNote }),
            });
            if (res.ok) {
                enqueueSnackbar(`Leave ${action}.`, { variant: 'success' });
                setActionDialog({ open: false, leave: null, action: '' });
                setActionNote('');
                fetchData();
            }
        } catch (e) {
            enqueueSnackbar('Error processing leave.', { variant: 'error' });
        }
    };

    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const dayCount = (s, e) => Math.max(1, Math.ceil((new Date(e) - new Date(s)) / 86400000) + 1);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><Loader /></Box>;

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <EventNoteOutlinedIcon sx={{ color: ACCENT }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Leave Management</Typography>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    { label: 'Total', count: myLeaves.length, color: '#64748b' },
                    { label: 'Pending', count: myLeaves.filter((l) => l.status === 'pending').length, color: statusColors.pending },
                    { label: 'Approved', count: myLeaves.filter((l) => l.status === 'approved').length, color: statusColors.approved },
                    { label: 'Rejected', count: myLeaves.filter((l) => l.status === 'rejected').length, color: statusColors.rejected },
                ].map((s, i) => (
                    <Grid item xs={6} sm={3} key={i}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Typography variant="h5" sx={{ fontWeight: 700, color: s.color }}>{s.count}</Typography>
                                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
            >
                <Tab label="Apply for Leave" />
                <Tab label="My Leave History" />
                {isApprover && <Tab label="All Requests" />}
            </Tabs>

            {/* Tab 0: Apply */}
            {tab === 0 && (
                <Card>
                    <CardContent>
                        <form onSubmit={handleSubmit}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth required>
                                        <InputLabel>Leave Type</InputLabel>
                                        <Select
                                            label="Leave Type"
                                            value={form.leave_type}
                                            onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                                        >
                                            {['sick', 'casual', 'earned', 'unpaid', 'other'].map((t) => (
                                                <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <TextField
                                        label="From"
                                        type="date"
                                        fullWidth
                                        required
                                        InputLabelProps={{ shrink: true }}
                                        value={form.start_date}
                                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <TextField
                                        label="To"
                                        type="date"
                                        fullWidth
                                        required
                                        InputLabelProps={{ shrink: true }}
                                        value={form.end_date}
                                        onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        label="Reason"
                                        fullWidth
                                        required
                                        multiline
                                        rows={3}
                                        value={form.reason}
                                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                    />
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

            {/* Tab 1: My History */}
            {tab === 1 && (
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
                            {myLeaves.length === 0 && (
                                <TableRow><TableCell colSpan={7} align="center">No leave history</TableCell></TableRow>
                            )}
                            {myLeaves.map((l) => (
                                <TableRow key={l._id}>
                                    <TableCell>
                                        <Chip size="small" label={l.leave_type} sx={{ textTransform: 'capitalize' }} />
                                    </TableCell>
                                    <TableCell>{formatDate(l.start_date)}</TableCell>
                                    <TableCell>{formatDate(l.end_date)}</TableCell>
                                    <TableCell>{dayCount(l.start_date, l.end_date)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            icon={statusIcons[l.status]}
                                            label={l.status}
                                            sx={{
                                                bgcolor: `${statusColors[l.status]}18`,
                                                color: statusColors[l.status],
                                                fontWeight: 600,
                                                textTransform: 'capitalize',
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {l.approved_by ? (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Avatar sx={{ width: 22, height: 22, fontSize: '0.65rem', bgcolor: ACCENT }}>
                                                    {l.approved_by.charAt(0)}
                                                </Avatar>
                                                <Typography variant="body2">{l.approved_by}</Typography>
                                                {l.approver_role && (
                                                    <Chip size="small" label={l.approver_role} sx={{ height: 16, fontSize: '0.6rem' }} />
                                                )}
                                            </Box>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>{l.notes || '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Tab 2: All Requests (Approver) */}
            {tab === 2 && isApprover && (
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
                                <TableCell>Approved By</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {allLeaves.length === 0 && (
                                <TableRow><TableCell colSpan={9} align="center">No requests</TableCell></TableRow>
                            )}
                            {allLeaves.map((l) => (
                                <TableRow key={l._id} sx={{ bgcolor: l.status === 'pending' ? 'rgba(245,158,11,0.05)' : 'inherit' }}>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{l.user_name}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip size="small" label={l.leave_type} sx={{ textTransform: 'capitalize' }} />
                                    </TableCell>
                                    <TableCell>{formatDate(l.start_date)}</TableCell>
                                    <TableCell>{formatDate(l.end_date)}</TableCell>
                                    <TableCell>{dayCount(l.start_date, l.end_date)}</TableCell>
                                    <TableCell sx={{ maxWidth: 180 }}>
                                        <Typography variant="body2" noWrap title={l.reason}>{l.reason}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small"
                                            icon={statusIcons[l.status]}
                                            label={l.status}
                                            sx={{
                                                bgcolor: `${statusColors[l.status]}18`,
                                                color: statusColors[l.status],
                                                fontWeight: 600,
                                                textTransform: 'capitalize',
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>{l.approved_by || '-'}</TableCell>
                                    <TableCell>
                                        {l.status === 'pending' ? (
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    color="success"
                                                    sx={{ fontSize: '0.7rem', minWidth: 0, px: 1 }}
                                                    onClick={() => setActionDialog({ open: true, leave: l, action: 'approved' })}
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="error"
                                                    sx={{ fontSize: '0.7rem', minWidth: 0, px: 1 }}
                                                    onClick={() => setActionDialog({ open: true, leave: l, action: 'rejected' })}
                                                >
                                                    Reject
                                                </Button>
                                            </Box>
                                        ) : (
                                            <Typography variant="caption" color="text.secondary">Done</Typography>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Action Dialog */}
            <Dialog open={actionDialog.open} onClose={() => setActionDialog({ open: false, leave: null, action: '' })} maxWidth="xs" fullWidth>
                <DialogTitle>
                    {actionDialog.action === 'approved' ? 'Approve' : 'Reject'} Leave Request
                </DialogTitle>
                <DialogContent>
                    {actionDialog.leave && (
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                            {actionDialog.leave.user_name}'s {actionDialog.leave.leave_type} leave from{' '}
                            {formatDate(actionDialog.leave.start_date)} to {formatDate(actionDialog.leave.end_date)}
                        </Typography>
                    )}
                    <TextField
                        label="Notes (optional)"
                        fullWidth
                        multiline
                        rows={2}
                        value={actionNote}
                        onChange={(e) => setActionNote(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setActionDialog({ open: false, leave: null, action: '' }); setActionNote(''); }}>Cancel</Button>
                    <Button
                        variant="contained"
                        color={actionDialog.action === 'approved' ? 'success' : 'error'}
                        onClick={handleAction}
                    >
                        {actionDialog.action === 'approved' ? 'Approve' : 'Reject'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default LeaveManagement;
