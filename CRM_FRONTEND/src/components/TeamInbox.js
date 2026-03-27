import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, TextField, IconButton, Avatar, List, ListItem,
    ListItemAvatar, ListItemText, Divider, Paper, Badge, InputAdornment, CircularProgress
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EmojiPicker from 'emoji-picker-react';
import { apiUrl } from './LoginSignup';
import { socket } from '../socket';
import { useColorMode } from '../context/AppThemeProvider';

const ACCENT = '#e87c2a';

const playMessageSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(900, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) { }
};

const TeamInbox = () => {
    const session = JSON.parse(localStorage.getItem('userSession')) || {};
    const headers = { Authorization: session.token || '', 'Content-Type': 'application/json' };
    const { mode } = useColorMode();

    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [activeChat, setActiveChat] = useState({ id: 'global', name: 'All Company', isGlobal: true });
    const [messages, setMessages] = useState([]);
    const [inputMsg, setInputMsg] = useState('');
    const [typingUsers, setTypingUsers] = useState({});
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${apiUrl}/chat/users`, { headers });
            if (res.ok) setUsers(await res.json());
        } catch (e) { }
    };

    useEffect(() => {
        if (!session.user_id) return;
        socket.connect();
        socket.emit("join", session.user_id);

        const handleReceiveMessage = (msg) => {
            const belongsToGlobal = msg.is_global && activeChat.isGlobal;
            const belongsToDirect = !msg.is_global && !activeChat.isGlobal && (msg.sender_id === activeChat.id || msg.receiver_id === activeChat.id);
            if (belongsToGlobal || belongsToDirect) {
                setMessages(prev => [...prev, msg]);
                scrollToBottom();
            }
            if (msg.sender_id !== session.user_id) playMessageSound();
            fetchUsers();
        };

        const handleOnlineStatus = ({ userId, isOnline }) => {
            setUsers(prev => prev.map(u => u._id === userId ? { ...u, isOnline } : u));
        };

        const handleTyping = ({ sender_id, sender_name, typing, is_global }) => {
            const chatId = is_global ? 'global' : sender_id;
            setTypingUsers(prev => {
                const current = { ...prev };
                if (typing) current[chatId] = sender_name;
                else delete current[chatId];
                return current;
            });
        };

        socket.on("receiveMessage", handleReceiveMessage);
        socket.on("user_online_status", handleOnlineStatus);
        socket.on("user_typing", handleTyping);

        return () => {
            socket.off("receiveMessage", handleReceiveMessage);
            socket.off("user_online_status", handleOnlineStatus);
            socket.off("user_typing", handleTyping);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeChat]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const endpoint = activeChat.isGlobal ? '/chat/global' : `/chat/direct/${activeChat.id}`;
                const res = await fetch(`${apiUrl}${endpoint}`, { headers });
                if (res.ok) {
                    setMessages(await res.json());
                    scrollToBottom();
                }
            } catch (e) { }
        };
        fetchHistory();
        setTypingUsers({});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeChat]);

    const scrollToBottom = () => {
        setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputMsg.trim()) return;
        socket.emit("sendMessage", {
            sender_id: session.user_id, sender_name: session.name,
            receiver_id: activeChat.isGlobal ? null : activeChat.id,
            is_global: activeChat.isGlobal, message: inputMsg.trim()
        });
        socket.emit("typing", {
            sender_id: session.user_id, sender_name: session.name,
            receiver_id: activeChat.isGlobal ? null : activeChat.id,
            is_global: activeChat.isGlobal, typing: false
        });
        setInputMsg('');
        setShowEmojiPicker(false);
    };

    const handleEmojiClick = (emojiObj) => { setInputMsg(prev => prev + emojiObj.emoji); };

    const handleTyping = (e) => {
        setInputMsg(e.target.value);
        socket.emit("typing", {
            sender_id: session.user_id, sender_name: session.name,
            receiver_id: activeChat.isGlobal ? null : activeChat.id,
            is_global: activeChat.isGlobal, typing: e.target.value.length > 0
        });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await fetch(`${apiUrl}/chat-upload`, {
                method: "POST", headers: { Authorization: session.token }, body: formData
            });
            if (res.ok) {
                const data = await res.json();
                socket.emit("sendMessage", {
                    sender_id: session.user_id, sender_name: session.name,
                    receiver_id: activeChat.isGlobal ? null : activeChat.id,
                    is_global: activeChat.isGlobal, message: inputMsg.trim() || "Sent an attachment",
                    attachment_url: data.attachment_url, attachment_type: data.attachment_type
                });
                setInputMsg('');
            }
        } catch (error) { console.error("Upload failed", error); }
        finally { setIsUploading(false); e.target.value = null; }
    };

    const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
    const activeUser = !activeChat.isGlobal ? users.find(u => u._id === activeChat.id) : null;

    // Dynamic theme colors
    const bgMain = mode === 'light' ? '#fafbfc' : '#0a0e1a';
    const bgPaper = mode === 'light' ? '#ffffff' : '#111827';
    const bgHover = mode === 'light' ? '#f3f4f6' : '#1f2937';
    const borderCol = mode === 'light' ? '#e5e7eb' : '#1f2937';
    const msgBgMe = mode === 'light' ? '#111827' : '#1e293b';
    const msgBgOther = mode === 'light' ? '#ffffff' : '#1f2937';
    const chatBg = mode === 'light' ? '#f9fafb' : '#0b1120';
    const inputBg = mode === 'light' ? '#f3f4f6' : '#1f2937';

    return (
        <Box sx={{
            display: 'flex', height: 'calc(100vh - 100px)',
            bgcolor: bgPaper, borderRadius: 3,
            overflow: 'hidden', border: `1px solid ${borderCol}`,
            boxShadow: mode === 'light' ? '0 1px 3px rgba(0,0,0,0.04)' : '0 4px 12px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.4s ease-out',
            '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
        }}>

            {/* ═══ LEFT PANE: CONTACTS ═══ */}
            <Box sx={{ width: 320, borderRight: `1px solid ${borderCol}`, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2.5, borderBottom: `1px solid ${borderCol}` }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, letterSpacing: '-0.02em' }}>Messages</Typography>
                    <TextField
                        size="small" fullWidth placeholder="Search conversations..."
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment>,
                            sx: { borderRadius: 3, bgcolor: inputBg, '& fieldset': { borderColor: 'transparent' }, '&:hover fieldset': { borderColor: borderCol }, '&.Mui-focused fieldset': { borderColor: ACCENT, borderWidth: '1.5px' } }
                        }}
                    />
                </Box>

                <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                    {/* Global Chat */}
                    <ListItem
                        button
                        onClick={() => setActiveChat({ id: 'global', name: 'All Company', isGlobal: true })}
                        sx={{
                            bgcolor: activeChat.isGlobal ? `rgba(232,124,42,0.06)` : 'inherit',
                            borderLeft: activeChat.isGlobal ? `3px solid ${ACCENT}` : '3px solid transparent',
                            transition: 'all 0.2s ease',
                            '&:hover': { bgcolor: bgHover },
                            py: 1.5,
                        }}
                    >
                        <ListItemAvatar>
                            <Avatar sx={{
                                background: `linear-gradient(135deg, ${ACCENT} 0%, #f59e4b 100%)`,
                                color: '#fff', fontWeight: 700,
                            }}>AC</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                            primary="All Company"
                            secondary="Company-wide announcements"
                            primaryTypographyProps={{ fontWeight: activeChat.isGlobal ? 700 : 500, fontSize: '0.9rem' }}
                            secondaryTypographyProps={{ fontSize: '0.75rem' }}
                        />
                    </ListItem>
                    <Divider sx={{ borderColor: borderCol }} />

                    {/* DM List */}
                    {filteredUsers.map((u, idx) => {
                        const isActive = activeChat.id === u._id;
                        const lastMsg = u.lastMessage ? u.lastMessage.message : '';
                        const unread = u.lastMessage && u.lastMessage.sender_id !== session.user_id && !u.lastMessage.read_by?.some(r => r.user_id === session.user_id);

                        return (
                            <ListItem
                                key={u._id}
                                button
                                onClick={() => setActiveChat({ id: u._id, name: u.name, isGlobal: false })}
                                sx={{
                                    bgcolor: isActive ? 'rgba(232,124,42,0.06)' : 'inherit',
                                    borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
                                    transition: 'all 0.2s ease',
                                    '&:hover': { bgcolor: bgHover },
                                    py: 1.5,
                                    animation: 'slideIn 0.3s ease-out both',
                                    animationDelay: `${idx * 0.03}s`,
                                    '@keyframes slideIn': {
                                        from: { opacity: 0, transform: 'translateX(-8px)' },
                                        to: { opacity: 1, transform: 'translateX(0)' },
                                    },
                                }}
                            >
                                <ListItemAvatar>
                                    <Badge
                                        overlap="circular"
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        variant="dot"
                                        sx={{ '& .MuiBadge-badge': { backgroundColor: u.isOnline ? '#10b981' : '#d1d5db', width: 10, height: 10, borderRadius: '50%', border: `2px solid ${bgPaper}` } }}
                                    >
                                        <Avatar src={u.profilePicture || ''} sx={{ bgcolor: '#6366f1' }}>
                                            {!u.profilePicture && u.name.charAt(0)}
                                        </Avatar>
                                    </Badge>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={u.name}
                                    secondary={typingUsers[u._id] ? 'typing...' : lastMsg}
                                    secondaryTypographyProps={{
                                        noWrap: true,
                                        fontWeight: unread ? 700 : 400,
                                        fontSize: '0.75rem',
                                        color: typingUsers[u._id] ? ACCENT : (unread ? 'text.primary' : 'text.secondary')
                                    }}
                                    primaryTypographyProps={{ fontWeight: isActive ? 700 : 500, fontSize: '0.9rem' }}
                                />
                                {u.lastMessage && (
                                    <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', top: 12, right: 16, fontSize: '0.65rem' }}>
                                        {formatTime(u.lastMessage.createdAt)}
                                    </Typography>
                                )}
                            </ListItem>
                        );
                    })}
                </List>
            </Box>

            {/* ═══ RIGHT PANE: CHAT AREA ═══ */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Chat Header */}
                <Box sx={{
                    p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: `1px solid ${borderCol}`, backgroundColor: bgPaper,
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar
                            src={!activeChat.isGlobal && activeUser ? (activeUser.profilePicture || '') : ''}
                            sx={{
                                background: activeChat.isGlobal ? `linear-gradient(135deg, ${ACCENT} 0%, #f59e4b 100%)` : '#6366f1',
                                color: '#fff', fontWeight: 700,
                            }}
                        >
                            {(!activeChat.isGlobal && activeUser?.profilePicture) ? null : activeChat.name.charAt(0)}
                        </Avatar>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{activeChat.name}</Typography>
                            {!activeChat.isGlobal && activeUser && (
                                <Typography variant="caption" color={activeUser.isOnline ? 'success.main' : 'text.secondary'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: activeUser.isOnline ? '#10b981' : '#d1d5db', display: 'inline-block' }} />
                                    {activeUser.isOnline ? 'Active Now' : 'Offline'}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton size="small" sx={{ transition: 'all 0.2s', '&:hover': { bgcolor: bgHover } }}><MoreVertIcon /></IconButton>
                    </Box>
                </Box>

                {/* Chat Messages */}
                <Box sx={{ flex: 1, p: 3, overflowY: 'auto', bgcolor: chatBg }}>
                    {messages.map((m, i) => {
                        const isMe = m.sender_id === session.user_id;
                        const showName = activeChat.isGlobal && !isMe;
                        const sender = users.find(u => u._id === m.sender_id);
                        const senderProfilePic = isMe ? session.profilePicture : sender?.profilePicture;

                        return (
                            <Box
                                key={m._id || i}
                                sx={{
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: isMe ? 'flex-end' : 'flex-start', mb: 2,
                                    animation: isMe
                                        ? 'msgSlideRight 0.3s ease-out both'
                                        : 'msgSlideLeft 0.3s ease-out both',
                                    '@keyframes msgSlideRight': {
                                        from: { opacity: 0, transform: 'translateX(15px)' },
                                        to: { opacity: 1, transform: 'translateX(0)' },
                                    },
                                    '@keyframes msgSlideLeft': {
                                        from: { opacity: 0, transform: 'translateX(-15px)' },
                                        to: { opacity: 1, transform: 'translateX(0)' },
                                    },
                                }}
                            >
                                {showName && <Typography variant="caption" sx={{ ml: 1, mb: 0.5, color: 'text.secondary', fontSize: '0.7rem' }}>{m.sender_name}</Typography>}
                                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                    <Avatar
                                        src={senderProfilePic || ''}
                                        sx={{
                                            width: 28, height: 28, fontSize: '0.75rem',
                                            bgcolor: isMe ? ACCENT : '#6366f1',
                                            fontWeight: 700,
                                        }}
                                    >
                                        {!senderProfilePic && m.sender_name.charAt(0)}
                                    </Avatar>
                                    <Paper
                                        elevation={0}
                                        sx={{
                                            p: 1.5, px: 2, maxWidth: 420,
                                            bgcolor: isMe ? msgBgMe : msgBgOther,
                                            color: isMe ? '#fff' : 'text.primary',
                                            borderRadius: 3,
                                            borderTopRightRadius: isMe ? 4 : 12,
                                            borderTopLeftRadius: !isMe ? 4 : 12,
                                            border: isMe ? 'none' : `1px solid ${borderCol}`,
                                            boxShadow: mode === 'light'
                                                ? '0 1px 2px rgba(0,0,0,0.04)'
                                                : 'none',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        {m.attachment_url && (
                                            <Box sx={{ mb: 1 }}>
                                                {m.attachment_type === 'image' ? (
                                                    <a href={m.attachment_url} target="_blank" rel="noreferrer">
                                                        <img src={m.attachment_url} alt="attachment" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} />
                                                    </a>
                                                ) : m.attachment_type === 'video' ? (
                                                    <video src={m.attachment_url} controls style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} />
                                                ) : (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 2 }}>
                                                        <InsertDriveFileIcon sx={{ color: isMe ? '#fff' : 'text.secondary' }} />
                                                        <a href={m.attachment_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all', fontSize: '0.813rem' }}>
                                                            View Attachment
                                                        </a>
                                                    </Box>
                                                )}
                                            </Box>
                                        )}
                                        {m.message && m.message !== "Sent an attachment" && (
                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: isMe ? '#ffffff' : 'inherit', fontSize: '0.875rem', lineHeight: 1.5 }}>{m.message}</Typography>
                                        )}
                                    </Paper>
                                </Box>
                                <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary', px: 1, fontSize: '0.6rem' }}>
                                    {formatTime(m.createdAt || new Date())}
                                </Typography>
                            </Box>
                        );
                    })}

                    {/* Typing Indicator with bouncing dots */}
                    {typingUsers[activeChat.isGlobal ? 'global' : activeChat.id] && (
                        <Box sx={{
                            display: 'flex', alignItems: 'center', gap: 1, ml: 5, mb: 1,
                            animation: 'fadeIn 0.3s ease-out',
                            '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
                        }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                {typingUsers[activeChat.isGlobal ? 'global' : activeChat.id]} is typing
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {[0, 1, 2].map(i => (
                                    <Box
                                        key={i}
                                        sx={{
                                            width: 5, height: 5, borderRadius: '50%', bgcolor: ACCENT,
                                            animation: 'bounceDot 1.4s infinite ease-in-out both',
                                            animationDelay: `${i * 0.16}s`,
                                            '@keyframes bounceDot': {
                                                '0%, 80%, 100%': { transform: 'scale(0)', opacity: 0.3 },
                                                '40%': { transform: 'scale(1)', opacity: 1 },
                                            },
                                        }}
                                    />
                                ))}
                            </Box>
                        </Box>
                    )}
                    <div ref={messagesEndRef} />
                </Box>

                {/* Input Area */}
                <Box sx={{ p: 2, borderTop: `1px solid ${borderCol}`, bgcolor: bgPaper, position: 'relative' }}>
                    {showEmojiPicker && (
                        <Box sx={{ position: 'absolute', bottom: '100%', left: 24, zIndex: 10 }}>
                            <EmojiPicker onEmojiClick={handleEmojiClick} theme={mode === 'light' ? 'light' : 'dark'} />
                        </Box>
                    )}

                    <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Paper elevation={0} sx={{
                            flex: 1, display: 'flex', alignItems: 'center', px: 1.5, py: 0.5,
                            bgcolor: inputBg, borderRadius: 3,
                            border: `1px solid ${borderCol}`,
                            transition: 'all 0.2s ease',
                            '&:focus-within': { borderColor: ACCENT, boxShadow: `0 0 0 3px rgba(232,124,42,0.08)` },
                        }}>
                            <IconButton size="small" onClick={() => setShowEmojiPicker(!showEmojiPicker)} sx={{ transition: 'all 0.2s', '&:hover': { transform: 'scale(1.15)' } }}>
                                <SentimentSatisfiedAltIcon sx={{ color: 'text.secondary' }} />
                            </IconButton>

                            <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx" />
                            <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={isUploading} sx={{ transition: 'all 0.2s', '&:hover': { transform: 'scale(1.15)' } }}>
                                {isUploading ? <CircularProgress size={20} /> : <AttachFileIcon sx={{ color: 'text.secondary' }} />}
                            </IconButton>

                            <TextField
                                fullWidth placeholder={`Type your reply...`}
                                variant="standard"
                                InputProps={{ disableUnderline: true }}
                                sx={{ ml: 1, '& input': { py: 1, fontSize: '0.875rem' } }}
                                value={inputMsg} onChange={handleTyping}
                            />
                        </Paper>
                        <IconButton
                            type="submit" disabled={!inputMsg.trim()}
                            sx={{
                                background: !inputMsg.trim() ? (mode === 'light' ? '#e5e7eb' : '#374151')
                                    : `linear-gradient(135deg, ${ACCENT} 0%, #f59e4b 100%)`,
                                color: '#fff',
                                width: 42, height: 42,
                                boxShadow: inputMsg.trim() ? '0 2px 8px rgba(232,124,42,0.3)' : 'none',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    background: `linear-gradient(135deg, #d06820 0%, #e87c2a 100%)`,
                                    transform: 'scale(1.05)',
                                    boxShadow: '0 4px 12px rgba(232,124,42,0.4)',
                                },
                                '&.Mui-disabled': {
                                    background: mode === 'light' ? '#e5e7eb' : '#374151',
                                    color: mode === 'light' ? '#9ca3af' : '#4b5563',
                                },
                            }}
                        >
                            <SendIcon fontSize="small" />
                        </IconButton>
                    </form>
                </Box>
            </Box>
        </Box>
    );
};

export default TeamInbox;
