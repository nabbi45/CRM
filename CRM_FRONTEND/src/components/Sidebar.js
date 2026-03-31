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
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
import logo from '../assets/whitelogo.png';
import { apiUrl } from './LoginSignup';
import { useColorMode } from '../context/AppThemeProvider';
import { canAccessFeature } from '../utils/featureAccess';
import UserEditModal from './UserEditModal';
import axios from 'axios';

/* ──────────────────── colour tokens ──────────────────── */
const SIDEBAR_HEADER = '#0b1120';
const TEXT_DIM = '#94a3b8';
const TEXT_BRIGHT = '#f1f5f9';
const ACCENT = '#ff3b1f';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [companyLogo, setCompanyLogo] = useState(null);
  const [unreads, setUnreads] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userSessionState, setUserSessionState] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useColorMode();
  const theme = useTheme();

  const userSession = useMemo(
    () => userSessionState || JSON.parse(localStorage.getItem('userSession')),
    [userSessionState]
  );

  useEffect(() => {
    if (!userSession?.user_id) return;

    // Fetch initial unread count on mount
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
      // Don't notify if user is sender
      if (msg.sender_id === userSession.user_id) return;

      // If we are not currently on the communication page, increment the bubble
      if (!location.pathname.includes('/dashboard/communication')) {
        setUnreads(prev => prev + 1);
      }
    };

    socket.on("receiveMessage", handleReceive);

    return () => {
      socket.off("receiveMessage", handleReceive);
    };
  }, [location.pathname, userSession?.user_id]);

  // When user navigates to communication page, clear badge
  useEffect(() => {
    if (location.pathname.includes('/dashboard/communication')) {
      setUnreads(0);
    }
  }, [location.pathname]);

  const toggleDrawer = () => {
    setIsOpen((prev) => !prev);
  };

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

    // Fetch company logo
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
      } catch (e) { /* fallback to static logo */ }
    };
    fetchLogo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSession?.user_id, userSession?.token, userSession?.user_role]);

  const menuItems = useMemo(() => {
    const items = [];

    if (canAccessFeature(userSession, 'dashboard_overview')) {
      items.push({ text: 'Dashboard', icon: <DashboardOutlinedIcon />, path: '/dashboard' });
    }
    if (canAccessFeature(userSession, 'new_booking')) {
      items.push({ text: 'New Booking', icon: <AddCircleOutlineIcon />, path: '/dashboard/new-booking' });
    }
    if (canAccessFeature(userSession, 'all_bookings')) {
      items.push({ text: 'All Booking', icon: <ListAltOutlinedIcon />, path: '/dashboard/history' });
    }
    if (canAccessFeature(userSession, 'proforma_invoice')) {
      items.push({ text: 'Proforma Invoice', icon: <ReceiptLongOutlinedIcon />, path: '/dashboard/ProformaInvoice' });
    }
    if (canAccessFeature(userSession, 'agreements_generator')) {
      items.push({ text: 'Agreements Generator', icon: <DescriptionOutlinedIcon />, path: '/dashboard/Agreementsgenerator' });
    }
    if (canAccessFeature(userSession, 'generated_documents')) {
      items.push({ text: 'Generated Documents', icon: <FolderOpenOutlinedIcon />, path: '/dashboard/generated-documents' });
    }
    if (canAccessFeature(userSession, 'manage_users')) {
      items.push({ text: 'Manage User', icon: <PeopleAltOutlinedIcon />, path: '/dashboard/removeuser' });
    }
    if (canAccessFeature(userSession, 'manage_services')) {
      items.push({ text: 'Manage Services', icon: <MiscellaneousServicesOutlinedIcon />, path: '/dashboard/addservices' });
    }
    if (canAccessFeature(userSession, 'company_profile')) {
      items.push({ text: 'Company Profile', icon: <BusinessOutlinedIcon />, path: '/dashboard/company-profile' });
    }
    if (canAccessFeature(userSession, 'leave_management')) {
      items.push({ text: 'Leave Management', icon: <EventNoteOutlinedIcon />, path: '/dashboard/leave-management' });
    }
    if (canAccessFeature(userSession, 'communication')) {
      items.push({
        text: 'Communication',
        icon: (
          <Badge badgeContent={unreads} color="error" max={99}>
            <ChatBubbleOutlineIcon />
          </Badge>
        ),
        path: '/dashboard/communication',
      });
    }

    if (hasProfile && canAccessFeature(userSession, 'my_profile')) {
      items.push({ text: 'My Profile', icon: <AccountCircleOutlinedIcon />, path: '/dashboard/my-profile' });
    } else if (!hasProfile && canAccessFeature(userSession, 'create_profile')) {
      items.push({ text: 'Create Profile', icon: <AccountCircleOutlinedIcon />, path: '/dashboard/create-profile' });
    }

    if (canAccessFeature(userSession, 'trash')) {
      items.push({ text: 'Trash', icon: <DeleteOutlineIcon />, path: '/dashboard/trash' });
    }

    return items;
  }, [userSession, hasProfile, unreads]);

  const drawerPaperSx = {
    width: 250,
    boxSizing: 'border-box',
    backgroundColor: theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(16px)',
    borderRight: theme.palette.mode === 'light' ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
    color: theme.palette.mode === 'light' ? '#0f172a' : '#e2e8f0',
    boxShadow: theme.palette.mode === 'light' ? '0 12px 40px rgba(0,0,0,0.04)' : '0 12px 40px rgba(0,0,0,0.3)',
    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
  };

  return (
    <Box>
      <IconButton
        color="inherit"
        aria-label="open drawer"
        edge="start"
        onClick={toggleDrawer}
        sx={{
          display: { xs: 'block', md: 'none' },
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
          display: { xs: 'block', md: 'none' },
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
        />
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': drawerPaperSx,
        }}
      >
        <SidebarContent
          onLogout={handleLogout}
          menuItems={menuItems}
          userSession={userSession}
          companyLogo={companyLogo}
          onEditProfile={() => setEditModalOpen(true)}
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

const SidebarContent = ({ onLogout, toggleDrawer, menuItems, userSession, companyLogo, onEditProfile }) => {
  const { mode, toggleColorMode } = useColorMode();
  const theme = useTheme();
  const initials = (userSession?.name || 'U').charAt(0).toUpperCase();

  const isLight = theme.palette.mode === 'light';
  const navTextColor = isLight ? '#475569' : '#cbd5e1';
  const navHoverBg = isLight ? 'rgba(255,59,31,0.11)' : 'rgba(255,90,31,0.18)';
  const activeTabBg = 'linear-gradient(120deg, #ff3b1f 0%, #ff5a1f 100%)';

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
          backgroundColor: isLight ? '#f8fafc' : SIDEBAR_HEADER,
          borderBottom: isLight ? '1px solid rgba(0,0,0,0.06)' : 'none',
        }}
      >
        <img
          src={companyLogo || logo}
          alt="Dashboard Logo"
          style={{ width: '140px', marginBottom: '12px', objectFit: 'contain' }}
        />
        <Typography
          variant="caption"
          sx={{
            color: isLight ? '#64748b' : TEXT_DIM,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: '0.65rem',
            mb: 1.5,
          }}
        >
          Welcome
        </Typography>
        <Box 
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          onClick={onEditProfile}
          title="Click to edit profile"
        >
          <Avatar
            src={userSession?.profilePicture || ""}
            sx={{
              width: 32,
              height: 32,
              bgcolor: ACCENT,
              fontSize: '0.85rem',
              fontWeight: 700,
            }}
          >
            {!userSession?.profilePicture && initials}
          </Avatar>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography
              variant="subtitle2"
              sx={{
                color: isLight ? '#0f172a' : TEXT_BRIGHT,
                fontWeight: 700,
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                lineHeight: 1.2,
              }}
            >
              {userSession?.name || 'User'}
            </Typography>
            <Typography variant="caption" sx={{ color: TEXT_DIM, fontSize: '0.65rem' }}>
              Edit Profile
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(148,163,184,0.1)', mt: 1 }} />

      {/* ── Navigation Items ── */}
      <List sx={{ flexGrow: 1, pt: 1.5, px: 1 }}>
        {menuItems.map((item) => (
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
                  borderRadius: 2,
                  py: 0.8,
                  px: 1.5,
                  transition: 'all 0.15s ease',
                  color: isActive ? '#ffffff' : navTextColor,
                  background: isActive ? activeTabBg : 'transparent',
                  borderLeft: '3px solid transparent',
                  boxShadow: isActive ? '0 10px 22px rgba(255,59,31,0.4)' : 'none',
                  '&:hover': {
                    background: isActive ? activeTabBg : navHoverBg,
                    color: isActive ? '#ffffff' : (isLight ? '#0f172a' : '#f8fafc'),
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

      <Divider sx={{ borderColor: 'rgba(148,163,184,0.1)', mx: 2 }} />

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
            borderRadius: 2,
            color: isLight ? '#334155' : '#e2e8f0',
            fontSize: '0.8rem',
            justifyContent: 'flex-start',
            pl: 2,
            border: isLight ? '1px solid rgba(148,163,184,0.45)' : '1px solid rgba(255,255,255,0.15)',
            backgroundColor: isLight ? '#ffffff' : 'rgba(255,255,255,0.04)',
            '&:hover': {
              backgroundColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.16)',
              color: isLight ? '#0f172a' : '#ffffff',
            },
          }}
          fullWidth
        >
          {mode === 'light' ? 'Dark mode' : 'Light mode'}
        </Button>

        <Button
          variant="contained"
          sx={{
            backgroundColor: ACCENT,
            color: '#fff',
            borderRadius: 2,
            fontSize: '0.8rem',
            '&:hover': {
              backgroundColor: '#d93025',
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
