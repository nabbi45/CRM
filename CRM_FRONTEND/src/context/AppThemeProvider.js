import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';

const ColorModeContext = createContext({
  mode: 'light',
  toggleColorMode: () => { },
});

export const useColorMode = () => useContext(ColorModeContext);

const createAppTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'light' ? '#111827' : '#ffffff', // Jet Black in light mode, White in dark mode
        dark: mode === 'light' ? '#000000' : '#e2e8f0',
        light: mode === 'light' ? '#334155' : '#94a3b8',
      },
      secondary: {
        main: mode === 'light' ? '#ffffff' : '#1e293b',
        dark: mode === 'light' ? '#f8fafc' : '#0f172a',
        light: mode === 'light' ? '#f1f5f9' : '#334155',
      },
      background: {
        default: mode === 'light' ? '#f5f5f0' : '#0a0a0a', // Beige off-white background
        paper: mode === 'light' ? '#ffffff' : '#111111',  // Pure white cards
      },
      text: {
        primary: mode === 'light' ? '#111827' : '#f8fafc',
        secondary: mode === 'light' ? '#475569' : '#94a3b8',
      },
      success: { main: '#10b981' },
      warning: { main: '#f59e0b' },
      error: { main: '#ef4444' },
      info: { main: '#3b82f6' },
      divider: mode === 'light' ? 'rgba(17,24,39,0.08)' : 'rgba(255,255,255,0.1)',
    },
    shape: {
      borderRadius: 16, // Softer, more modern rounded corners
    },
    typography: {
      fontFamily: [
        'Inter',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'sans-serif',
      ].join(','),
      h1: { fontWeight: 700, letterSpacing: '-0.03em' },
      h2: { fontWeight: 700, letterSpacing: '-0.03em' },
      h3: { fontWeight: 700, letterSpacing: '-0.02em' },
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 500 },
      body2: { color: mode === 'light' ? '#475569' : '#94a3b8' },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 12,
            fontWeight: 600,
            paddingInline: 24,
            paddingBlock: 12,
            fontSize: '0.9rem',
            boxShadow: 'none', // Flat premium look
          },
          containedPrimary: {
            backgroundColor: mode === 'light' ? '#111827' : '#ffffff',
            color: mode === 'light' ? '#ffffff' : '#111827',
            '&:hover': {
              backgroundColor: mode === 'light' ? '#000000' : '#e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundImage: 'none',
            backgroundColor: mode === 'light' ? '#ffffff' : '#111111',
            border: mode === 'light'
                ? '1px solid rgba(0,0,0,0.06)'
                : '1px solid rgba(255,255,255,0.1)',
            boxShadow: mode === 'light'
              ? '0 4px 24px rgba(0,0,0,0.04)'
              : '0 4px 24px rgba(0,0,0,0.4)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: 'none',
            backgroundColor: mode === 'light' ? '#ffffff' : '#111111',
            color: mode === 'light' ? '#111827' : '#f8fafc',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            border: mode === 'light'
              ? '1px solid rgba(0,0,0,0.06)'
              : '1px solid rgba(255,255,255,0.1)',
            boxShadow: mode === 'light'
              ? '0 4px 24px rgba(0,0,0,0.04)'
              : '0 4px 24px rgba(0,0,0,0.4)',
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'light' ? '#f8fafc' : '#1e293b',
            '& .MuiTableCell-head': {
              fontWeight: 700,
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: mode === 'light' ? '#64748b' : '#94a3b8',
              borderBottom: mode === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: mode === 'light'
              ? '1px solid rgba(0,0,0,0.06)'
              : '1px solid rgba(255,255,255,0.1)',
            padding: '16px',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: mode === 'light' ? '#ffffff' : '#111111',
            '& input:-webkit-autofill': {
              WebkitBoxShadow: mode === 'light'
                ? '0 0 0 1000px #ffffff inset'
                : '0 0 0 1000px #111111 inset',
              WebkitTextFillColor: mode === 'light' ? '#111827' : '#f8fafc',
            },
          },
          notchedOutline: {
            borderColor: mode === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontSize: '0.8rem',
            borderRadius: 10,
          },
        },
      },
    },
  });

export const AppThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem('app-theme-mode');
    if (stored === 'light' || stored === 'dark') return stored;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('app-theme-mode', mode);
    document.body.dataset.theme = mode;
  }, [mode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem('app-theme-variant');
  }, []);

  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
      },
    }),
    [mode]
  );

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
};
