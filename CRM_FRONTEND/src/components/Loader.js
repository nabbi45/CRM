import React, { useState, useEffect } from 'react';
import './Loader.css';
import fallbackLightLogo from '../assets/logo.png';
import fallbackDarkLogo from '../assets/whitelogo.png';
import { useColorMode } from '../context/AppThemeProvider';
import { apiUrl } from './LoginSignup';

const Loader = () => {
  const { mode } = useColorMode();
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const userSession = JSON.parse(localStorage.getItem('userSession'));
        const res = await fetch(`${apiUrl}/company`, {
          headers: {
            'Authorization': userSession?.token || '',
            'user-role': userSession?.user_role || '',
          }
        });
        const data = await res.json();
        if (res.ok && data && data.logo_url) {
          setLogoUrl(data.logo_url);
        }
      } catch (err) {
        // Silently fall back to default logo
      }
    };
    fetchLogo();
  }, []);

  const fallback = mode === 'light' ? fallbackLightLogo : fallbackDarkLogo;

  return (
    <div className="loader-container">
      <img
        src={logoUrl || fallback}
        alt="Loading..."
        className="loader-logo"
      />
    </div>
  );
};

export default Loader;
