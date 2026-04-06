import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, TextField, IconButton, Avatar, List, ListItem,
    ListItemAvatar, ListItemText, Divider, Paper, Badge, InputAdornment, CircularProgress,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EmojiPicker from 'emoji-picker-react';
import { apiUrl } from './LoginSignup';
import { socket } from '../socket';
import bgChat from '../assets/bg_chat.jpg';

const ACCENT = '#ff3b1f';

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
    const theme = useTheme();
    const isTabletOrBelow = useMediaQuery(theme.breakpoints.down('md'));
    const isDark = theme.palette.mode === 'dark';

    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [activeChat, setActiveChat] = useState({ id: 'global', name: 'All Company', isGlobal: true });
    const [mobilePane, setMobilePane] = useState('list');
    const [messages, setMessages] = useState([]);
    const [inputMsg, setInputMsg] = useState('');
    const [typingUsers, setTypingUsers] = useState({});
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Load users
    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${apiUrl}/chat/users`, { headers });
            if (res.ok) setUsers(await res.json());
        } catch (e) { }
    };

    // Socket Connection and Global listeners
    useEffect(() => {
        if (!session.user_id) return;

        socket.connect();
        socket.emit("join", session.user_id);

        const handleReceiveMessage = (msg) => {
            // If message belongs to active chat, append it
            const belongsToGlobal = msg.is_global && activeChat.isGlobal;
            const belongsToDirect = !msg.is_global && !activeChat.isGlobal && (msg.sender_id === activeChat.id || msg.receiver_id === activeChat.id);

            if (belongsToGlobal || belongsToDirect) {
                setMessages(prev => [...prev, msg]);
                scrollToBottom();
            }

            // If we are NOT the sender, play sound
            if (msg.sender_id !== session.user_id) {
                playMessageSound();
            }

            // Update sidebar previews
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

    // Load Chat History when activeChat changes
    useEffect(() => {
        setMessages([]); // instantly clear old messages when switching chat
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
        // clear typing map on switch
        setTypingUsers({});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeChat]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputMsg.trim()) return;

        socket.emit("sendMessage", {
            sender_id: session.user_id,
            sender_name: session.name,
            receiver_id: activeChat.isGlobal ? null : activeChat.id,
            is_global: activeChat.isGlobal,
            message: inputMsg.trim()
        });

        socket.emit("typing", {
            sender_id: session.user_id,
            sender_name: session.name,
            receiver_id: activeChat.isGlobal ? null : activeChat.id,
            is_global: activeChat.isGlobal,
            typing: false
        });

        setInputMsg('');
        setShowEmojiPicker(false);
    };

    const handleEmojiClick = (emojiObj) => {
        setInputMsg(prev => prev + emojiObj.emoji);
    };

    const handleTyping = (e) => {
        setInputMsg(e.target.value);
        socket.emit("typing", {
            sender_id: session.user_id,
            sender_name: session.name,
            receiver_id: activeChat.isGlobal ? null : activeChat.id,
            is_global: activeChat.isGlobal,
            typing: e.target.value.length > 0
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
                method: "POST",
                headers: { Authorization: session.token },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();

                // Immediately emit a message with the attachment
                socket.emit("sendMessage", {
                    sender_id: session.user_id,
                    sender_name: session.name,
                    receiver_id: activeChat.isGlobal ? null : activeChat.id,
                    is_global: activeChat.isGlobal,
                    message: inputMsg.trim() || "Sent an attachment",
                    attachment_url: data.attachment_url,
                    attachment_type: data.attachment_type
                });
                setInputMsg(''); // clear if they typed any text along with it
            }
        } catch (error) {
            console.error("Upload failed", error);
        } finally {
            setIsUploading(false);
            e.target.value = null; // reset input
        }
    };

    const formatTime = (ts) => {
        return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

    useEffect(() => {
        if (isTabletOrBelow) {
            setMobilePane('list');
        }
    }, [isTabletOrBelow]);

    // Determine active contact formatting
    const activeUser = !activeChat.isGlobal ? users.find(u => u._id === activeChat.id) : null;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: isTabletOrBelow ? 'column' : 'row',
                height: { xs: 'calc(100vh - 132px)', md: 'calc(100vh - 100px)' },
                bgcolor: 'background.paper',
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: 3,
                animation: 'fadeSlideIn 320ms ease',
            }}
        >
            <style>{`
                @keyframes bounceSlideUp {
                    0% { opacity: 0; transform: translateY(15px) scale(0.98); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>

            {/* LEFT PANE = CONTACTS */}
            <Box
                sx={{
                    width: { xs: '100%', md: 320 },
                    borderRight: { xs: 'none', md: '1px solid' },
                    borderBottom: { xs: '1px solid', md: 'none' },
                    borderColor: 'divider',
                    bgcolor: isDark ? 'rgba(15,23,42,0.6)' : '#f8fafc',
                    display: isTabletOrBelow && mobilePane === 'chat' ? 'none' : 'flex',
                    flexDirection: 'column',
                    height: { xs: '100%', md: 'auto' },
                }}
            >
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Team Inbox</Typography>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Search conversations..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                            sx: { borderRadius: 8, bgcolor: 'action.hover' }
                        }}
                    />
                </Box>

                <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                    {/* Global Chat Item */}
                    <ListItem
                        button
                        onClick={() => {
                            setActiveChat({ id: 'global', name: 'All Company', isGlobal: true });
                            if (isTabletOrBelow) setMobilePane('chat');
                        }}
                        sx={{ bgcolor: activeChat.isGlobal ? 'rgba(232,124,42,0.08)' : 'inherit', borderLeft: activeChat.isGlobal ? `4px solid ${ACCENT}` : '4px solid transparent' }}
                    >
                        <ListItemAvatar>
                            <Avatar sx={{ bgcolor: ACCENT, color: '#fff' }}>AC</Avatar>
                        </ListItemAvatar>
                        <ListItemText primary="All Company Group" secondary="Company-wide announcements" primaryTypographyProps={{ fontWeight: activeChat.isGlobal ? 700 : 500 }} />
                    </ListItem>
                    <Divider />

                    {/* DMs List */}
                    {filteredUsers.map(u => {
                        const isActive = activeChat.id === u._id;
                        const lastMsg = u.lastMessage ? u.lastMessage.message : 'Draft available';
                        const unread = u.lastMessage && u.lastMessage.sender_id !== session.user_id && !u.lastMessage.read_by?.some(r => r.user_id === session.user_id);

                        return (
                            <ListItem
                                key={u._id}
                                button
                                onClick={() => {
                                    setActiveChat({ id: u._id, name: u.name, isGlobal: false });
                                    if (isTabletOrBelow) setMobilePane('chat');
                                }}
                                sx={{ bgcolor: isActive ? 'rgba(232,124,42,0.08)' : 'inherit', borderLeft: isActive ? `4px solid ${ACCENT}` : '4px solid transparent' }}
                            >
                                <ListItemAvatar>
                                    <Badge
                                        overlap="circular"
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        variant="dot"
                                        sx={{ '& .MuiBadge-badge': { backgroundColor: u.isOnline ? '#44b700' : '#bdbdbd', width: 10, height: 10, borderRadius: '50%', border: '2px solid white' } }}
                                    >
                                        <Avatar src={u.profilePicture || ''} sx={{ bgcolor: 'primary.main' }}>
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
                                        color: typingUsers[u._id] ? ACCENT : (unread ? 'text.primary' : 'text.secondary')
                                    }}
                                    primaryTypographyProps={{ fontWeight: isActive ? 700 : 500 }}
                                />
                                {u.lastMessage && (
                                    <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', top: 12, right: 16 }}>
                                        {formatTime(u.lastMessage.createdAt)}
                                    </Typography>
                                )}
                            </ListItem>
                        );
                    })}
                </List>
            </Box>

            {/* RIGHT PANE = CHAT AREA */}
            <Box
                sx={{
                    flex: 1,
                    display: isTabletOrBelow && mobilePane === 'list' ? 'none' : 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Chat Header */}
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {isTabletOrBelow && (
                            <IconButton size="small" onClick={() => setMobilePane('list')}>
                                <ArrowBackRoundedIcon />
                            </IconButton>
                        )}
                        <Avatar src={!activeChat.isGlobal && activeUser ? (activeUser.profilePicture || '') : ''} sx={{ bgcolor: activeChat.isGlobal ? ACCENT : 'primary.main' }}>
                            {(!activeChat.isGlobal && activeUser?.profilePicture) ? null : activeChat.name.charAt(0)}
                        </Avatar>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{activeChat.name}</Typography>
                            {!activeChat.isGlobal && activeUser && (
                                <Typography variant="caption" color={activeUser.isOnline ? 'success.main' : 'text.secondary'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: activeUser.isOnline ? '#44b700' : '#bdbdbd' }} />
                                    {activeUser.isOnline ? 'Active Now' : 'Offline'}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton size="small"><MoreVertIcon /></IconButton>
                    </Box>
                </Box>

                {/* Chat Messages Log */}
                <Box sx={{ 
                    flex: 1, 
                    p: { xs: 1.5, sm: 2.5, md: 3 }, 
                    overflowY: 'auto', 
                    bgcolor: isDark ? '#0b1220' : '#efeae2',
                    backgroundImage: `url(${bgChat})`,
                    backgroundRepeat: 'repeat',
                    backgroundBlendMode: isDark ? 'overlay' : 'normal',
                    opacity: isDark ? 0.9 : 1,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {messages.length === 0 && (
                        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <Paper elevation={0} sx={{ p: 1.5, px: 3, borderRadius: 8, bgcolor: isDark ? 'rgba(30,41,59,0.7)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                                <Typography variant="body2" sx={{ color: isDark ? '#cbd5e1' : '#64748b', fontWeight: 500 }}>
                                    Send a message to start the conversation
                                </Typography>
                            </Paper>
                        </Box>
                    )}
                    {messages.map((m, i) => {
                        const isMe = m.sender_id === session.user_id;
                        const showName = activeChat.isGlobal && !isMe;
                        const sender = users.find(u => u._id === m.sender_id);
                        const senderProfilePic = isMe ? session.profilePicture : sender?.profilePicture;
                        
                        return (
                            <Box 
                                key={m._id || i} 
                                sx={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: isMe ? 'flex-end' : 'flex-start', 
                                    mb: 2,
                                    opacity: 0,
                                    animation: `bounceSlideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.25) forwards`,
                                }}
                            >
                                {showName && <Typography variant="caption" sx={{ ml: 1, mb: 0.5, color: 'text.secondary' }}>{m.sender_name}</Typography>}
                                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                    <Avatar src={senderProfilePic || ''} sx={{ width: 28, height: 28, fontSize: '0.8rem', bgcolor: isMe ? ACCENT : 'primary.main' }}>
                                        {!senderProfilePic && m.sender_name.charAt(0)}
                                    </Avatar>
                                        <Paper
                                            elevation={0}
                                            sx={{
                                                p: 1.5,
                                                px: 2,
                                                maxWidth: { xs: 260, sm: 360, md: 420 },
                                                background: isMe ? 'linear-gradient(135deg, #ff512f 0%, #dd2476 100%)' : (isDark ? '#1e293b' : '#ffffff'),
                                                color: isMe ? '#fff' : (isDark ? '#f8fafc' : '#111827'),
                                                borderRadius: 3,
                                                borderTopRightRadius: isMe ? 0 : 12,
                                                borderTopLeftRadius: !isMe ? 0 : 12,
                                                border: isMe ? 'none' : (isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'),
                                                boxShadow: isMe ? '0 4px 14px rgba(221, 36, 118, 0.3)' : (isDark ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.03)')
                                            }}
                                        >
                                        {m.attachment_url && (
                                            <Box sx={{ mb: 1 }}>
                                                {m.attachment_type === 'image' ? (
                                                    <a href={m.attachment_url} target="_blank" rel="noreferrer">
                                                        <img src={m.attachment_url} alt="attachment" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }} />
                                                    </a>
                                                ) : m.attachment_type === 'video' ? (
                                                    <video src={m.attachment_url} controls style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }} />
                                                ) : (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                                                        <InsertDriveFileIcon sx={{ color: isMe ? '#fff' : 'text.secondary' }} />
                                                        <a href={m.attachment_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}>
                                                            View Attachment Document
                                                        </a>
                                                    </Box>
                                                )}
                                            </Box>
                                        )}
                                        {m.message && m.message !== "Sent an attachment" && (
                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: isMe ? '#ffffff' : 'inherit' }}>{m.message}</Typography>
                                        )}
                                    </Paper>
                                </Box>
                                <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary', px: 1 }}>
                                    {formatTime(m.createdAt || new Date())}
                                </Typography>
                            </Box>
                        );
                    })}
                    {typingUsers[activeChat.isGlobal ? 'global' : activeChat.id] && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', ml: 5 }}>
                            {typingUsers[activeChat.isGlobal ? 'global' : activeChat.id]} is typing...
                        </Typography>
                    )}
                    <div ref={messagesEndRef} />
                </Box>

                <Box sx={{ p: { xs: 1.2, sm: 2 }, borderTop: '1px solid', borderColor: 'divider', bgcolor: isDark ? '#0f172a' : '#fff', position: 'relative' }}>

                    {/* Emoji Picker Popover */}
                    {showEmojiPicker && (
                        <Box sx={{ position: 'absolute', bottom: '100%', left: 24, zIndex: 10 }}>
                            <EmojiPicker onEmojiClick={handleEmojiClick} theme={isDark ? "dark" : "light"} />
                        </Box>
                    )}

                    <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Paper elevation={0} sx={{ flex: 1, display: 'flex', alignItems: 'center', px: 1, py: 0.5, bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'action.hover', borderRadius: 8 }}>
                            <IconButton size="small" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                <SentimentSatisfiedAltIcon />
                            </IconButton>

                            <input
                                type="file"
                                hidden
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx"
                            />
                            <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                {isUploading ? <CircularProgress size={20} /> : <AttachFileIcon />}
                            </IconButton>

                            <TextField
                                fullWidth
                                placeholder={`Type your reply to ${activeChat.name}...`}
                                variant="standard"
                                InputProps={{
                                    disableUnderline: true,
                                    sx: {
                                        color: isDark ? '#f8fafc' : 'inherit',
                                        '& input::placeholder': {
                                            color: isDark ? 'rgba(248,250,252,0.6)' : 'rgba(0,0,0,0.5)',
                                            opacity: 1,
                                        },
                                    }
                                }}
                                sx={{
                                    ml: 1,
                                    py: 1,
                                    '& .MuiInput-root': {
                                        color: isDark ? '#f8fafc' : 'inherit',
                                    },
                                }}
                                value={inputMsg}
                                onChange={handleTyping}
                            />
                        </Paper>
                        <IconButton
                            type="submit"
                            disabled={!inputMsg.trim()}
                            sx={{
                                bgcolor: isDark ? '#111827' : ACCENT,
                                color: isDark ? '#ffffff' : '#fff',
                                borderRadius: '12px',
                                border: isDark ? '1px solid rgba(248,250,252,0.35)' : 'none',
                                boxShadow: isDark ? '0 6px 18px rgba(0,0,0,0.45)' : 'none',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    bgcolor: isDark ? '#1f2937' : '#e03118'
                                },
                                '&.Mui-disabled': {
                                    bgcolor: isDark ? '#334155' : '#e0e0e0',
                                    color: isDark ? '#f1f5f9' : '#9e9e9e',
                                    opacity: 1
                                },
                                '& svg': {
                                    color: isDark ? '#ffffff' : '#fff'
                                }
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
