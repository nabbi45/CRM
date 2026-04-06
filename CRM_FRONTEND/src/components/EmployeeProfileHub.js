import React from 'react';
import { Box } from '@mui/material';
import { CreateProfile } from './EmployeeProfileForm';
import { EmployeeManagement } from './EmployeeManagement';

export default function EmployeeProfileHub({ apiUrl, userSession }) {
  const adminRoles = ["Admin", "Super Admin", "HR", "Dev"];
  const isAdmin = adminRoles.includes(userSession?.user_role);

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      {isAdmin ? (
        <EmployeeManagement apiUrl={apiUrl} userSession={userSession} />
      ) : (
        <CreateProfile apiUrl={apiUrl} userSession={userSession} />
      )}
    </Box>
  );
}
