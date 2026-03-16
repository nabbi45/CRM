import React, { useState, useEffect } from 'react';
import './Loader.css';
import { useColorMode } from '../context/AppThemeProvider';
import { apiUrl } from './LoginSignup';
import { CircularProgress, Box } from '@mui/material';

const Loader = () => {
  const { mode } = useColorMode();
  const [logoUrl, setLogoUrl] = useState(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const userSession = JSON.parse(localStorage.getItem('userSession'));
        const res = await fetch(`${apiUrl}/company/public`); // Use public route to get branding
        const data = await res.json();
        if (res.ok && data && data.logo_url) {
          setLogoUrl(data.logo_url);
        }
      } catch (err) {
        console.warn("Loader branding fetch failed:", err);
      } finally {
        setFetching(false);
      }
    };
    fetchLogo();
  }, []);

  return (
    <div className="loader-container">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Loading..."
          className="loader-logo"
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={40} sx={{ color: mode === 'light' ? '#000' : '#fff' }} />
        </Box>
      )}
    </div>
  );
};

export default Loader;
