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
import logo from '../assets/whitelogo.png';
import { apiUrl } from './LoginSignup';
import { useColorMode } from '../context/AppThemeProvider';
import UserEditModal from './UserEditModal';

/* ──────────────────── colour tokens ──────────────────── */
const SIDEBAR_BG = '#0f172a';
const SIDEBAR_HEADER = '#0b1120';
const TEXT_DIM = '#94a3b8';
const TEXT_BRIGHT = '#f1f5f9';
const ACCENT = '#e87c2a';
const HOVER_BG = 'rgba(232,124,42,0.08)';
const ACTIVE_BG = 'rgba(232,124,42,0.15)';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [companyLogo, setCompanyLogo] = useState(null);
  const [unreads, setUnreads] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userSessionState, setUserSessionState] = useState(null);
  const navigate = useNavigate();
  const { mode } = useColorMode();

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
      if (!window.location.pathname.includes('/dashboard/communication')) {
        setUnreads(prev => prev + 1);
      }
    };

    socket.on("receiveMessage", handleReceive);

    return () => {
      socket.off("receiveMessage", handleReceive);
    };
  }, [userSession?.user_id, window.location.pathname]);

  // When user navigates to communication page, clear badge
  useEffect(() => {
    if (window.location.pathname.includes('/dashboard/communication')) {
      setUnreads(0);
    }
  }, [window.location.pathname]);

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
  }, [userSession?.user_id]);

  const menuItems = useMemo(() => {
    const items = [];

    // only add base menu if not HR
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

    // Role-specific menu items
    if (userSession?.user_role === 'dev') {
      items.push(
        {
          text: 'Manage User',
          icon: <PeopleAltOutlinedIcon />,
          path: '/dashboard/removeuser',
        },
        {
          text: 'Manage Services',
          icon: <MiscellaneousServicesOutlinedIcon />,
          path: '/dashboard/addservices',
        },
        {
          text: 'Company Profile',
          icon: <BusinessOutlinedIcon />,
          path: '/dashboard/company-profile',
        },
      );
    } else if (userSession?.user_role === 'srdev') {
      items.push(
        {
          text: 'Manage User',
          icon: <PeopleAltOutlinedIcon />,
          path: '/dashboard/removeuser',
        },
        {
          text: 'Manage Services',
          icon: <MiscellaneousServicesOutlinedIcon />,
          path: '/dashboard/addservices',
        },
        {
          text: 'Company Profile',
          icon: <BusinessOutlinedIcon />,
          path: '/dashboard/company-profile',
        },
      );
    } else if (userSession?.user_role === 'HR') {
      items.push(
        {
          text: 'Manage Employees',
          icon: <PeopleAltOutlinedIcon />,
          path: '/dashboard/manage-employees',
        },
      );
    }

    // Leave Management — available to all users
    items.push(
      { text: 'Leave Management', icon: <EventNoteOutlinedIcon />, path: '/dashboard/leave-management' }
    );

    // Communication — available to all users
    items.push(
      {
        text: 'Communication',
        icon: (
          <Badge badgeContent={unreads} color="error" max={99}>
            <ChatBubbleOutlineIcon />
          </Badge>
        ),
        path: '/dashboard/communication'
      }
    );

    // Profile menu item
    if (hasProfile) {
      items.push({ text: 'My Profile', icon: <AccountCircleOutlinedIcon />, path: '/dashboard/my-profile' });
    } else if (['HR', 'admin', 'dev', 'srdev'].includes(userSession?.user_role)) {
      items.push({ text: 'Create Profile', icon: <AccountCircleOutlinedIcon />, path: '/dashboard/create-profile' });
    }

    // Trash at the very bottom (dev/srdev only)
    if (userSession?.user_role === 'dev' || userSession?.user_role === 'srdev') {
      items.push({ text: 'Trash', icon: <DeleteOutlineIcon />, path: '/dashboard/trash' });
    }

    return items;
  }, [userSession?.user_role, hasProfile]);

  const drawerPaperSx = {
    width: 250,
    boxSizing: 'border-box',
    backgroundColor: SIDEBAR_BG,
    borderRight: 'none',
    color: TEXT_DIM,
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
  const initials = (userSession?.name || 'U').charAt(0).toUpperCase();

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
          backgroundColor: SIDEBAR_HEADER,
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
            color: TEXT_DIM,
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
                color: TEXT_BRIGHT,
                fontWeight: 600,
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
                  color: isActive ? ACCENT : TEXT_DIM,
                  backgroundColor: isActive ? ACTIVE_BG : 'transparent',
                  borderLeft: isActive
                    ? `3px solid ${ACCENT}`
                    : '3px solid transparent',
                  '&:hover': {
                    backgroundColor: isActive ? ACTIVE_BG : HOVER_BG,
                    color: TEXT_BRIGHT,
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
            color: TEXT_DIM,
            fontSize: '0.8rem',
            justifyContent: 'flex-start',
            pl: 2,
            '&:hover': {
              backgroundColor: HOVER_BG,
              color: TEXT_BRIGHT,
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
            borderRadius: 2,
            fontSize: '0.8rem',
            '&:hover': {
              backgroundColor: '#c2641c',
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
