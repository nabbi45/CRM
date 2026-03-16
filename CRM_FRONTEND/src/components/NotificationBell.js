import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Badge, IconButton, Popover, Box, Typography, Button, TextField,
    Divider, Chip, List, ListItem, ListItemText, Tab, Tabs,
} from '@mui/material';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import CircleIcon from '@mui/icons-material/Circle';
import { apiUrl } from './LoginSignup';

const ACCENT = '#e87c2a';
const POLL_INTERVAL = 30000;

// Programmatic notification sound (Web Audio API — no file needed)
const playNotificationSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) { /* ignore audio errors in unsupported browsers */ }
};

const NotificationBell = () => {
    const session = JSON.parse(localStorage.getItem('userSession')) || {};
    const headers = { Authorization: session.token || '', 'Content-Type': 'application/json' };

    const [anchorEl, setAnchorEl] = useState(null);
    const [tab, setTab] = useState(0);
    const [broadcasts, setBroadcasts] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const prevUnreadCount = useRef(0);

    const canBroadcast = ['admin', 'dev', 'srdev', 'senior admin', 'HR'].includes(session.user_role);

    const fetchBroadcasts = useCallback(async () => {
        try {
            const res = await fetch(`${apiUrl}/broadcasts`, { headers });
            if (res.ok) {
                const data = await res.json();
                setBroadcasts(data);
                return data;
            }
        } catch (e) { /* silent */ }
        return [];
    }, []);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch(`${apiUrl}/leaves/notifications`, { headers });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
                return data;
            }
        } catch (e) { /* silent */ }
        return [];
    }, []);

    const getUnreadCount = useCallback((bList, nList) => {
        const unreadBroadcasts = (bList || broadcasts).filter(
            (b) => b.sender_id !== session.user_id && !b.read_by?.some((r) => r.user_id === session.user_id)
        ).length;
        const unreadNotifs = (nList || notifications).filter((n) => !n.read).length;
        return unreadBroadcasts + unreadNotifs;
    }, [broadcasts, notifications, session.user_id]);

    useEffect(() => {
        const poll = async () => {
            const [bData, nData] = await Promise.all([fetchBroadcasts(), fetchNotifications()]);
            const currentUnread = getUnreadCount(bData, nData);
            if (currentUnread > prevUnreadCount.current && prevUnreadCount.current >= 0) {
                playNotificationSound();
            }
            prevUnreadCount.current = currentUnread;
        };
        poll();
        const interval = setInterval(poll, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    const handleOpen = (e) => setAnchorEl(e.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const markBroadcastRead = async (id) => {
        try {
            await fetch(`${apiUrl}/broadcasts/${id}/read`, { method: 'PATCH', headers });
            setBroadcasts((prev) =>
                prev.map((b) =>
                    b._id === id
                        ? { ...b, read_by: [...(b.read_by || []), { user_id: session.user_id }] }
                        : b
                )
            );
        } catch (e) { /* silent */ }
    };

    const markNotifRead = async (id) => {
        try {
            await fetch(`${apiUrl}/leaves/notifications/${id}/read`, { method: 'PATCH', headers });
            setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
        } catch (e) { /* silent */ }
    };

    const sendBroadcast = async () => {
        if (!newMessage.trim()) return;
        setSending(true);
        try {
            const res = await fetch(`${apiUrl}/broadcasts`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ message: newMessage.trim() }),
            });
            if (res.ok) {
                setNewMessage('');
                fetchBroadcasts();
            }
        } catch (e) { /* silent */ }
        setSending(false);
    };

    const totalUnread = getUnreadCount();
    const open = Boolean(anchorEl);

    const timeAgo = (dateStr) => {
        const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    return (
        <>
            <IconButton onClick={handleOpen} sx={{ color: 'text.primary' }}>
                <Badge badgeContent={totalUnread} color="error" max={99}>
                    <NotificationsOutlinedIcon />
                </Badge>
            </IconButton>
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{ sx: { width: 380, maxHeight: 520, borderRadius: 2 } }}
            >
                <Box sx={{ p: 2, pb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Notifications
                    </Typography>
                </Box>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    variant="fullWidth"
                    sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: '0.78rem', textTransform: 'none' } }}
                >
                    <Tab label={`Broadcasts ${broadcasts.filter((b) => b.sender_id !== session.user_id && !b.read_by?.some((r) => r.user_id === session.user_id)).length ? `(${broadcasts.filter((b) => b.sender_id !== session.user_id && !b.read_by?.some((r) => r.user_id === session.user_id)).length})` : ''}`} />
                    <Tab label={`Alerts ${notifications.filter((n) => !n.read).length ? `(${notifications.filter((n) => !n.read).length})` : ''}`} />
                </Tabs>
                <Divider />

                {tab === 0 && (
                    <Box>
                        {canBroadcast && (
                            <Box sx={{ display: 'flex', gap: 1, p: 1.5, alignItems: 'center' }}>
                                <TextField
                                    size="small"
                                    fullWidth
                                    placeholder="Send a broadcast..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendBroadcast()}
                                />
                                <IconButton onClick={sendBroadcast} disabled={sending} sx={{ color: ACCENT }}>
                                    <SendOutlinedIcon />
                                </IconButton>
                            </Box>
                        )}
                        <List dense sx={{ maxHeight: 350, overflow: 'auto', pt: 0 }}>
                            {broadcasts.length === 0 && (
                                <ListItem><ListItemText secondary="No broadcasts yet" /></ListItem>
                            )}
                            {broadcasts.map((b) => {
                                const isMine = b.sender_id === session.user_id;
                                const isUnread = !isMine && !b.read_by?.some((r) => r.user_id === session.user_id);
                                return (
                                    <ListItem
                                        key={b._id}
                                        onClick={() => isUnread && markBroadcastRead(b._id)}
                                        sx={{
                                            cursor: isUnread ? 'pointer' : 'default',
                                            bgcolor: isUnread ? 'rgba(232,124,42,0.06)' : 'inherit',
                                            alignItems: 'flex-start',
                                            '&:hover': { bgcolor: 'action.hover' },
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                                            <CampaignOutlinedIcon sx={{ color: isMine ? '#94a3b8' : ACCENT, mt: 0.3, fontSize: 20 }} />
                                            <Box sx={{ flex: 1 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 600, color: isMine ? 'text.secondary' : 'text.primary' }}>
                                                        {isMine ? 'You sent:' : b.sender_name}
                                                        {!isMine && (
                                                            <Chip
                                                                size="small"
                                                                label={b.sender_role}
                                                                sx={{ ml: 0.5, height: 16, fontSize: '0.6rem', bgcolor: 'rgba(232,124,42,0.12)', color: ACCENT }}
                                                            />
                                                        )}
                                                    </Typography>
                                                    {isUnread && <CircleIcon sx={{ fontSize: 8, color: ACCENT }} />}
                                                </Box>
                                                <Typography variant="body2" sx={{ mt: 0.3, lineHeight: 1.4, color: 'text.primary' }}>
                                                    {b.message}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {timeAgo(b.createdAt)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </ListItem>
                                );
                            })}
                        </List>
                    </Box>
                )}

                {tab === 1 && (
                    <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
                        {notifications.length === 0 && (
                            <ListItem><ListItemText secondary="No alerts" /></ListItem>
                        )}
                        {notifications.map((n) => (
                            <ListItem
                                key={n._id}
                                onClick={() => !n.read && markNotifRead(n._id)}
                                sx={{
                                    cursor: !n.read ? 'pointer' : 'default',
                                    bgcolor: !n.read ? 'rgba(232,124,42,0.06)' : 'inherit',
                                    '&:hover': { bgcolor: 'action.hover' },
                                }}
                            >
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography variant="body2" sx={{ fontWeight: !n.read ? 600 : 400, flex: 1 }}>
                                                {n.message}
                                            </Typography>
                                            {!n.read && <CircleIcon sx={{ fontSize: 8, color: ACCENT, ml: 1 }} />}
                                        </Box>
                                    }
                                    secondary={timeAgo(n.createdAt)}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Popover>
        </>
    );
};

export default NotificationBell;
