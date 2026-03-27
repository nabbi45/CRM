import React, { useMemo, useState, useEffect } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  Box,
  Button,
  Divider,
  Avatar,
  useTheme,
  Badge,
} from '@mui/material';
import { NavLink, useNavigate } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import MiscellaneousServicesOutlinedIcon from '@mui/icons-material/MiscellaneousServicesOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';

import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { socket } from '../socket';
import { apiUrl } from './LoginSignup';
import { useColorMode } from '../context/AppThemeProvider';
import UserEditModal from './UserEditModal';
import axios from 'axios';

const ACCENT = '#e87c2a';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [companyLogo, setCompanyLogo] = useState(null);
  const [unreads, setUnreads] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userSessionState, setUserSessionState] = useState(null);
  const navigate = useNavigate();
  const { mode } = useColorMode();
  const theme = useTheme();

  const userSession = useMemo(
    () => userSessionState || JSON.parse(localStorage.getItem('userSession')),
    [userSessionState]
  );

  useEffect(() => {
    if (!userSession?.user_id) return;
    const fetchInitialUnreads = async () => {
      try {
        const res = await fetch(`${apiUrl}/chat/unreads`, {
          headers: { Authorization: userSession.token }
        });
        if (res.ok) {
          const data = await res.json();
          setUnreads(data.unreadCount || 0);
        }
      } catch (e) { }
    };
    fetchInitialUnreads();

    if (!socket.connected) {
      socket.connect();
      socket.emit("join", userSession.user_id);
    }

    const handleReceive = (msg) => {
      if (msg.sender_id === userSession.user_id) return;
      if (!window.location.pathname.includes('/dashboard/communication')) {
        setUnreads(prev => prev + 1);
      }
    };

    socket.on("receiveMessage", handleReceive);
    return () => { socket.off("receiveMessage", handleReceive); };
  }, [userSession?.user_id, window.location.pathname]);

  useEffect(() => {
    if (window.location.pathname.includes('/dashboard/communication')) {
      setUnreads(0);
    }
  }, [window.location.pathname]);

  const toggleDrawer = () => setIsOpen((prev) => !prev);

  const handleLogout = () => {
    localStorage.removeItem('userSession');
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
  };

  useEffect(() => {
    const fetchProfileStatus = async () => {
      try {
        const res = await axios.get(
          `${apiUrl}/employee/profile/${userSession?.user_id}`,
          { headers: { authorization: userSession?.token } }
        );
        if (res.data?.profile) setHasProfile(true);
      } catch {
        setHasProfile(false);
      }
    };
    if (userSession?.user_id) fetchProfileStatus();

    const fetchLogo = async () => {
      try {
        const res = await fetch(`${apiUrl}/company`, {
          headers: {
            'Authorization': userSession?.token || '',
            'user-role': userSession?.user_role || '',
          }
        });
        const data = await res.json();
        if (res.ok && data?.logo_url) setCompanyLogo(data.logo_url);
      } catch (e) { }
    };
    fetchLogo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSession?.user_id]);

  const menuItems = useMemo(() => {
    const items = [];
    if (userSession?.user_role !== 'HR') {
      items.push(
        { text: 'Dashboard', icon: <DashboardOutlinedIcon />, path: '/dashboard' },
        { text: 'New Booking', icon: <AddCircleOutlineIcon />, path: '/dashboard/new-booking' },
        { text: 'All Booking', icon: <ListAltOutlinedIcon />, path: '/dashboard/history' },
        { text: 'Proforma Invoice', icon: <ReceiptLongOutlinedIcon />, path: '/dashboard/ProformaInvoice' },
        { text: 'Agreements Generator', icon: <DescriptionOutlinedIcon />, path: '/dashboard/Agreementsgenerator' },
        { text: 'Generated Documents', icon: <FolderOpenOutlinedIcon />, path: '/dashboard/generated-documents' }
      );
    }

    if (userSession?.user_role === 'dev') {
      items.push(
        { text: 'Manage User', icon: <PeopleAltOutlinedIcon />, path: '/dashboard/removeuser' },
        { text: 'Manage Services', icon: <MiscellaneousServicesOutlinedIcon />, path: '/dashboard/addservices' },
        { text: 'Company Profile', icon: <BusinessOutlinedIcon />, path: '/dashboard/company-profile' },
      );
    } else if (userSession?.user_role === 'srdev') {
      items.push(
        { text: 'Manage User', icon: <PeopleAltOutlinedIcon />, path: '/dashboard/removeuser' },
        { text: 'Manage Services', icon: <MiscellaneousServicesOutlinedIcon />, path: '/dashboard/addservices' },
        { text: 'Company Profile', icon: <BusinessOutlinedIcon />, path: '/dashboard/company-profile' },
      );
    } else if (userSession?.user_role === 'HR') {
      items.push(
        { text: 'Manage Employees', icon: <PeopleAltOutlinedIcon />, path: '/dashboard/manage-employees' },
      );
    }

    items.push(
      { text: 'Leave Management', icon: <EventNoteOutlinedIcon />, path: '/dashboard/leave-management' }
    );

    items.push({
      text: 'Communication',
      icon: (
        <Badge badgeContent={unreads} color="error" max={99}>
          <ChatBubbleOutlineIcon />
        </Badge>
      ),
      path: '/dashboard/communication'
    });

    if (hasProfile) {
      items.push({ text: 'My Profile', icon: <AccountCircleOutlinedIcon />, path: '/dashboard/my-profile' });
    } else if (['HR', 'admin', 'dev', 'srdev'].includes(userSession?.user_role)) {
      items.push({ text: 'Create Profile', icon: <AccountCircleOutlinedIcon />, path: '/dashboard/create-profile' });
    }

    if (userSession?.user_role === 'dev' || userSession?.user_role === 'srdev') {
      items.push({ text: 'Trash', icon: <DeleteOutlineIcon />, path: '/dashboard/trash' });
    }

    return items;
  }, [userSession?.user_role, hasProfile, unreads]);

  // Dynamic sidebar colors based on theme
  const sidebarBg = mode === 'light' ? '#ffffff' : '#0f172a';
  const sidebarHeaderBg = mode === 'light' ? '#fafbfc' : '#0b1120';
  const textDim = mode === 'light' ? '#6b7280' : '#94a3b8';
  const textBright = mode === 'light' ? '#111827' : '#f1f5f9';
  const hoverBg = mode === 'light' ? 'rgba(232,124,42,0.06)' : 'rgba(232,124,42,0.08)';
  const activeBg = mode === 'light' ? 'rgba(232,124,42,0.1)' : 'rgba(232,124,42,0.15)';
  const borderColor = mode === 'light' ? '#e5e7eb' : 'rgba(31,41,55,0.5)';

  const drawerPaperSx = {
    width: 260,
    boxSizing: 'border-box',
    backgroundColor: sidebarBg,
    borderRight: `1px solid ${borderColor}`,
    color: textDim,
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
  };

  return (
    <Box>
      <IconButton
        color="inherit"
        aria-label="open drawer"
        edge="start"
        onClick={toggleDrawer}
        sx={{
          display: { xs: 'block', sm: 'none' },
          position: 'fixed',
          top: 10,
          left: 10,
          zIndex: 1301,
        }}
      >
        <MenuIcon />
      </IconButton>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={isOpen}
        onClose={toggleDrawer}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': drawerPaperSx,
        }}
      >
        <SidebarContent
          onLogout={handleLogout}
          toggleDrawer={toggleDrawer}
          menuItems={menuItems}
          userSession={userSession}
          companyLogo={companyLogo}
          onEditProfile={() => setEditModalOpen(true)}
          mode={mode}
          colors={{ sidebarHeaderBg, textDim, textBright, hoverBg, activeBg, borderColor }}
        />
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': drawerPaperSx,
        }}
      >
        <SidebarContent
          onLogout={handleLogout}
          menuItems={menuItems}
          userSession={userSession}
          companyLogo={companyLogo}
          onEditProfile={() => setEditModalOpen(true)}
          mode={mode}
          colors={{ sidebarHeaderBg, textDim, textBright, hoverBg, activeBg, borderColor }}
        />
      </Drawer>

      <UserEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        userSession={userSession}
        onProfileUpdated={(newSession) => setUserSessionState(newSession)}
      />
    </Box>
  );
};

const SidebarContent = ({ onLogout, toggleDrawer, menuItems, userSession, companyLogo, onEditProfile, mode, colors }) => {
  const { toggleColorMode } = useColorMode();
  const initials = (userSession?.name || 'U').charAt(0).toUpperCase();
  const { sidebarHeaderBg, textDim, textBright, hoverBg, activeBg, borderColor } = colors;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header / Branding ── */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 3,
          pb: 2,
          px: 2,
          backgroundColor: sidebarHeaderBg,
        }}
      >
        {companyLogo ? (
          <img
            src={companyLogo}
            alt="Dashboard Logo"
            style={{ width: '130px', marginBottom: '12px', objectFit: 'contain' }}
          />
        ) : (
          <Typography variant="h6" sx={{ color: textBright, fontWeight: 700, mb: 1 }}>Dashboard</Typography>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            cursor: 'pointer',
            p: 1,
            borderRadius: 2,
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: hoverBg,
            },
          }}
          onClick={onEditProfile}
          title="Click to edit profile"
        >
          <Avatar
            src={userSession?.profilePicture || ""}
            sx={{
              width: 36,
              height: 36,
              bgcolor: ACCENT,
              fontSize: '0.9rem',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(232,124,42,0.3)',
            }}
          >
            {!userSession?.profilePicture && initials}
          </Avatar>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography
              variant="subtitle2"
              sx={{
                color: textBright,
                fontWeight: 600,
                fontSize: '0.85rem',
                lineHeight: 1.2,
              }}
            >
              {userSession?.name || 'User'}
            </Typography>
            <Typography variant="caption" sx={{ color: textDim, fontSize: '0.65rem' }}>
              Edit Profile
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor }} />

      {/* ── Navigation Items ── */}
      <List sx={{ flexGrow: 1, pt: 1.5, px: 1.5, overflow: 'auto' }}>
        {menuItems.map((item, index) => (
          <NavLink
            to={item.path}
            key={item.text}
            end={item.path === '/dashboard'}
            style={{ textDecoration: 'none' }}
            onClick={toggleDrawer}
          >
            {({ isActive }) => (
              <ListItem
                sx={{
                  mb: 0.3,
                  borderRadius: 2.5,
                  py: 0.9,
                  px: 1.5,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  color: isActive ? ACCENT : textDim,
                  backgroundColor: isActive ? activeBg : 'transparent',
                  borderLeft: isActive
                    ? `3px solid ${ACCENT}`
                    : '3px solid transparent',
                  '&:hover': {
                    backgroundColor: isActive ? activeBg : hoverBg,
                    color: textBright,
                    transform: 'translateX(3px)',
                  },
                  animation: `slideInLeft 0.3s ease-out ${index * 0.03}s both`,
                  '@keyframes slideInLeft': {
                    from: { opacity: 0, transform: 'translateX(-10px)' },
                    to: { opacity: 1, transform: 'translateX(0)' },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: 'inherit',
                    minWidth: 36,
                    '& .MuiSvgIcon-root': { fontSize: '1.2rem' },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.82rem',
                    fontWeight: isActive ? 600 : 400,
                  }}
                />
              </ListItem>
            )}
          </NavLink>
        ))}
      </List>

      <Divider sx={{ borderColor, mx: 2 }} />

      {/* ── Bottom Actions ── */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          alignItems: 'stretch',
        }}
      >
        <Button
          variant="text"
          onClick={toggleColorMode}
          startIcon={
            mode === 'light' ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />
          }
          sx={{
            borderRadius: 2.5,
            color: textDim,
            fontSize: '0.8rem',
            justifyContent: 'flex-start',
            pl: 2,
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: hoverBg,
              color: textBright,
            },
          }}
          fullWidth
        >
          {mode === 'light' ? 'Dark mode' : 'Light mode'}
        </Button>

        <Button
          variant="contained"
          sx={{
            background: `linear-gradient(135deg, ${ACCENT} 0%, #f59e4b 100%)`,
            borderRadius: 2.5,
            fontSize: '0.8rem',
            boxShadow: '0 2px 8px rgba(232,124,42,0.3)',
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'linear-gradient(135deg, #d06820 0%, #e87c2a 100%)',
              boxShadow: '0 4px 12px rgba(232,124,42,0.4)',
              transform: 'translateY(-1px)',
            },
          }}
          startIcon={<LogoutRoundedIcon />}
          onClick={onLogout}
          fullWidth
        >
          Logout
        </Button>
      </Box>
    </Box>
  );
};

export default Sidebar;
