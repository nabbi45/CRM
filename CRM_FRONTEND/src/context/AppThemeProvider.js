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
        main: '#e87c2a', // Default Orange Theme
        dark: '#c2641c',
        light: '#f59e4b',
      },
      secondary: {
        main: mode === 'light' ? '#1e293b' : '#f1f5f9',
        dark: '#0f172a',
        light: '#334155',
      },
      background: {
        default: mode === 'light' ? '#f1f5f9' : '#0b1120',
        paper: mode === 'light' ? '#ffffff' : '#111827',
      },
      text: {
        primary: mode === 'light' ? '#1e293b' : '#f1f5f9',
        secondary: mode === 'light' ? '#64748b' : '#94a3b8',
      },
      success: { main: '#10b981' },
      warning: { main: '#f59e0b' },
      error: { main: '#ef4444' },
      info: { main: '#3b82f6' },
      divider: mode === 'light' ? 'rgba(148,163,184,0.3)' : 'rgba(30,41,59,0.8)',
    },
    shape: {
      borderRadius: 12,
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
      h5: { fontWeight: 700, letterSpacing: '-0.02em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 500 },
      body2: { color: mode === 'light' ? '#64748b' : '#94a3b8' },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 10,
            fontWeight: 600,
            paddingInline: 20,
            paddingBlock: 10,
            fontSize: '0.875rem',
          },
          containedPrimary: {
            backgroundColor: '#e87c2a',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#c2641c',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            backgroundColor: mode === 'monochrome' ? '#ffffff' : (mode === 'light' ? '#ffffff' : '#111827'),
            border: mode === 'monochrome'
              ? '1px solid rgba(0,0,0,0.1)'
              : (mode === 'light'
                ? '1px solid rgba(148,163,184,0.2)'
                : '1px solid rgba(30,41,59,0.6)'),
            boxShadow: mode === 'light' || mode === 'monochrome'
              ? '0 1px 3px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.04)'
              : '0 4px 12px rgba(0,0,0,0.3)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: 'none',
            backgroundColor: '#0f172a',
            color: '#cbd5e1',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            border: mode === 'light'
              ? '1px solid rgba(148,163,184,0.2)'
              : '1px solid rgba(30,41,59,0.6)',
            boxShadow: mode === 'light'
              ? '0 1px 3px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.04)'
              : '0 4px 12px rgba(0,0,0,0.3)',
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'light' ? '#f8fafc' : '#0f172a',
            '& .MuiTableCell-head': {
              fontWeight: 700,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: mode === 'light' ? '#64748b' : '#94a3b8',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: mode === 'light'
              ? '1px solid rgba(148,163,184,0.15)'
              : '1px solid rgba(30,41,59,0.5)',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            '& input:-webkit-autofill': {
              WebkitBoxShadow: mode === 'light'
                ? '0 0 0 1000px #ffffff inset'
                : '0 0 0 1000px #111827 inset',
              WebkitTextFillColor: mode === 'light' ? '#1e293b' : '#f1f5f9',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontSize: '0.75rem',
            borderRadius: 8,
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
