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

const Dashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const userSession = JSON.parse(localStorage.getItem('userSession')) || {};
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
      <CssBaseline />
      <DynamicHead />

      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      {/* Notification Bell — fixed top-right */}
      <Box sx={{ position: 'fixed', top: 12, right: 20, zIndex: 1300 }}>
        <NotificationBell />
      </Box>

      {/* Floating Chat Icon — fixed bottom-right */}
      <ChatFAB />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          marginLeft: isSmallScreen ? 0 : '260px',
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          p: { xs: 2, md: 3 },
        }}
      >
        {isSmallScreen && <Toolbar />}

        <Routes>
          <Route path="/" element={<DashboardContent />} />
          <Route path="new-booking" element={<AddBooking />} />
          <Route path="history" element={<History />} />
          <Route path="adduser" element={<AddUser />} />
          <Route path="removeuser" element={<RemoveUser />} />
          <Route path="scorecard" element={<Scorecard />} />
          <Route path="addservices" element={<ServicesComponent />} />
          <Route path="trash" element={<Trash />} />
          <Route path="Proformainvoice" element={<Proformainvoice />} />
          <Route path="Agreementsgenerator" element={<AgreementGeneratorPage />} />
          <Route path="create-profile" element={<CreateProfile apiUrl={apiUrl} userSession={userSession} />} />
          <Route path="my-profile" element={<MyProfile apiUrl={apiUrl} userSession={userSession} />} />
          <Route path="manage-employees" element={<EmployeeManagement apiUrl={apiUrl} userSession={userSession} />} />
          <Route path="company-profile" element={<CompanyProfile />} />
          <Route path="generated-documents" element={<DocumentsPage />} />
          <Route path="leave-management" element={<LeaveManagement />} />
          <Route path="communication" element={<TeamInbox />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default Dashboard;