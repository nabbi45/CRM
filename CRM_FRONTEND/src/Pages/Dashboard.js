import React, { useEffect, useState } from 'react';
import {
  Toolbar,
  CssBaseline,
  useMediaQuery,
  useTheme,
  Box,
} from '@mui/material';
import { Route, Routes } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DashboardContent from '../components/DashboardContent';
import AddBooking from '../components/NewBooking';
import AddUser from '../components/AddUser';
import RemoveUser from '../components/RemoveUser';
import History from '../components/History';
import Scorecard from '../components/Scorecard';
import AgreementGeneratorPage from './AgreementGeneratorPage';
import ServicesComponent from '../components/Servicescomponent';
import Trash from '../components/Trash';
import Proformainvoice from '../Pages/InvoicePage';
import { apiUrl } from '../components/LoginSignup';
import { CreateProfile } from '../components/EmployeeProfileForm';
import { MyProfile } from '../components/MyProfile';
import { EmployeeManagement } from '../components/EmployeeManagement';
import CompanyProfile from '../components/CompanyProfile';
import DocumentsPage from '../components/DocumentsPage';
import LeaveManagement from '../components/LeaveManagement';
import NotificationBell from '../components/NotificationBell';
import DynamicHead from '../components/DynamicHead';
import TeamInbox from '../components/TeamInbox';
import ChatFAB from '../components/ChatFAB';
import { canAccessFeature } from '../utils/featureAccess';

const FeatureGuard = ({ userSession, feature, children }) => {
  if (canAccessFeature(userSession, feature)) return children;

  return (
    <Box
      sx={{
        minHeight: 300,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 3,
        border: '1px dashed',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        p: 3,
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ fontSize: 32, mb: 1 }}>🔒</Box>
        <Box sx={{ fontWeight: 700, color: 'text.primary' }}>Access restricted</Box>
        <Box sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
          Your role does not currently have permission for this feature.
        </Box>
      </Box>
    </Box>
  );
};

const InitialLoader = ({ theme }) => {
  const [progress, setProgress] = useState(0);
  const [companyLogo, setCompanyLogo] = useState(null);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await fetch(`${apiUrl}/company/public`);
        const data = await res.json();
        if (res.ok && data.logo_url) setCompanyLogo(data.logo_url);
      } catch (e) {}
    };
    fetchBranding();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress >= 100) {
          clearInterval(timer);
          return 100;
        }
        const diff = Math.random() * 20;
        return Math.min(oldProgress + diff, 100);
      });
    }, 150);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const isLight = theme.palette.mode === 'light';

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: isLight ? '#ffffff' : '#0a0a0a',
        color: isLight ? '#0f172a' : '#ffffff'
      }}
    >
      <Box 
        sx={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {companyLogo && (
          <img src={companyLogo} alt="Loading Logo" style={{ height: 60, objectFit: 'contain', marginBottom: 24 }} />
        )}
        <Box sx={{ width: 240, height: 4, bgcolor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', mb: 1 }}>
          <Box sx={{ width: `${progress}%`, height: '100%', bgcolor: '#ff3b1f', transition: 'width 0.15s linear' }} />
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: isLight ? '#64748b' : '#9ca3af' }}>
          {Math.floor(progress)}% Loading...
        </Typography>
      </Box>
    </Box>
  );
};

const Dashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const theme = useTheme();
  const isTabletOrBelow = useMediaQuery(theme.breakpoints.down('md'));
  const userSession = JSON.parse(localStorage.getItem('userSession')) || {};

  const [showInitialLoader, setShowInitialLoader] = useState(() => {
    return !sessionStorage.getItem('crm_initial_load');
  });

  useEffect(() => {
    if (showInitialLoader) {
      // simulate 1.5s loading time for 100% animation
      const timer = setTimeout(() => {
        setShowInitialLoader(false);
        sessionStorage.setItem('crm_initial_load', 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showInitialLoader]);

  useEffect(() => {
    const userSession = JSON.parse(localStorage.getItem('userSession')) || {};

    if (!userSession.name) {
      console.warn('No user name found in session data');
    }
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      {showInitialLoader && <InitialLoader theme={theme} />}
      <CssBaseline />
      <DynamicHead />

      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      {/* Notification Bell — fixed top-right */}
      <Box
        sx={{
          position: 'fixed',
          top: { xs: 10, sm: 12 },
          right: { xs: 12, sm: 20 },
          zIndex: 1300,
        }}
      >
        <NotificationBell />
      </Box>

      {/* Floating Chat Icon — fixed bottom-right */}
      <ChatFAB />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          marginLeft: isTabletOrBelow ? 0 : '250px',
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          p: { xs: 1.5, sm: 2, md: 2.5, lg: 3 },
        }}
      >
        {isTabletOrBelow && <Toolbar />}

        <Routes>
          <Route path="/" element={<FeatureGuard userSession={userSession} feature="dashboard_overview"><DashboardContent /></FeatureGuard>} />
          <Route path="new-booking" element={<FeatureGuard userSession={userSession} feature="new_booking"><AddBooking /></FeatureGuard>} />
          <Route path="history" element={<FeatureGuard userSession={userSession} feature="all_bookings"><History /></FeatureGuard>} />
          <Route path="adduser" element={<FeatureGuard userSession={userSession} feature="manage_users"><AddUser /></FeatureGuard>} />
          <Route path="removeuser" element={<FeatureGuard userSession={userSession} feature="manage_users"><RemoveUser /></FeatureGuard>} />
          <Route path="scorecard" element={<FeatureGuard userSession={userSession} feature="dashboard_overview"><Scorecard /></FeatureGuard>} />
          <Route path="addservices" element={<FeatureGuard userSession={userSession} feature="manage_services"><ServicesComponent /></FeatureGuard>} />
          <Route path="trash" element={<FeatureGuard userSession={userSession} feature="trash"><Trash /></FeatureGuard>} />
          <Route path="Proformainvoice" element={<FeatureGuard userSession={userSession} feature="proforma_invoice"><Proformainvoice /></FeatureGuard>} />
          <Route path="Agreementsgenerator" element={<FeatureGuard userSession={userSession} feature="agreements_generator"><AgreementGeneratorPage /></FeatureGuard>} />
          <Route path="create-profile" element={<FeatureGuard userSession={userSession} feature="create_profile"><CreateProfile apiUrl={apiUrl} userSession={userSession} /></FeatureGuard>} />
          <Route path="my-profile" element={<FeatureGuard userSession={userSession} feature="my_profile"><MyProfile apiUrl={apiUrl} userSession={userSession} /></FeatureGuard>} />
          <Route path="manage-employees" element={<FeatureGuard userSession={userSession} feature="manage_employees"><EmployeeManagement apiUrl={apiUrl} userSession={userSession} /></FeatureGuard>} />
          <Route path="company-profile" element={<FeatureGuard userSession={userSession} feature="company_profile"><CompanyProfile /></FeatureGuard>} />
          <Route path="generated-documents" element={<FeatureGuard userSession={userSession} feature="generated_documents"><DocumentsPage /></FeatureGuard>} />
          <Route path="leave-management" element={<FeatureGuard userSession={userSession} feature="leave_management"><LeaveManagement /></FeatureGuard>} />
          <Route path="communication" element={<FeatureGuard userSession={userSession} feature="communication"><TeamInbox /></FeatureGuard>} />
        </Routes>
      </Box>
    </Box>
  );
};

export default Dashboard;