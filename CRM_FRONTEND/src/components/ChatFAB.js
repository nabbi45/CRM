import React, { useState, useEffect } from 'react';
import { Badge, Fab } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from './LoginSignup';
import { io } from 'socket.io-client';
import { useColorMode } from '../context/AppThemeProvider';

const socketUrl = apiUrl.replace('/api', ''); // Adjust if apiUrl points to /api exactly
const socket = io(socketUrl, { autoConnect: false });

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

const ChatFAB = () => {
    const { mode } = useColorMode();
    const session = JSON.parse(localStorage.getItem('userSession')) || {};
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!session.user_id) return;
        socket.connect();
        socket.emit("join", session.user_id);

        // Re-fetch users specifically looking for total unread direct messages (since global messages might not trigger unreads unless we tracked per user but direct ones certainly do)
        // For simplicity, we just listen to incoming messages to increment the badge if we aren't on the communication page
        const handleReceive = (msg) => {
            // Don't notify if user is sender
            if (msg.sender_id === session.user_id) return;

            // If we are not currently on the communication page, increment the bubble
            if (!window.location.pathname.includes('/dashboard/communication')) {
                setUnreadCount(prev => prev + 1);
                playMessageSound();
            }
        };

        socket.on("receiveMessage", handleReceive);

        return () => {
            socket.off("receiveMessage", handleReceive);
            socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When user navigates to communication page, clear badge
    useEffect(() => {
        if (window.location.pathname.includes('/dashboard/communication')) {
            setUnreadCount(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [window.location.pathname]);

    return (
        <Fab
            aria-label="chat"
            sx={{
                position: 'fixed',
                bottom: 32,
                right: 32,
                zIndex: 1200,
                bgcolor: 'transparent',
                boxShadow: 'none',
                color: '#ffffff',
                '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    transform: 'scale(1.1) rotate(-5deg)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                filter: mode === 'light'
                    ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
                    : 'drop-shadow(0 0 15px rgba(232,124,42,0.4))',
            }}
            onClick={() => {
                setUnreadCount(0);
                navigate('/dashboard/communication');
            }}
        >
            <Badge badgeContent={unreadCount} color="error" max={99}>
                <ChatBubbleOutlineIcon sx={{ fontSize: '2rem' }} />
            </Badge>
        </Fab>
    );
};

export default ChatFAB;
