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
        main: mode === 'light' ? '#ff3b1f' : '#ff4a2a',
        dark: mode === 'light' ? '#e03118' : '#ff3b1f',
        light: mode === 'light' ? '#ff6b52' : '#ff7a5f',
      },
      secondary: {
        main: mode === 'light' ? '#111827' : '#e2e8f0',
        dark: mode === 'light' ? '#020617' : '#94a3b8',
        light: mode === 'light' ? '#374151' : '#ffffff',
      },
      background: {
        default: mode === 'light' ? '#f4f5f7' : '#06080d',
        paper: mode === 'light' ? '#ffffff' : '#121722',
      },
      text: {
        primary: mode === 'light' ? '#111827' : '#f5f7fb',
        secondary: mode === 'light' ? '#475569' : '#b7c1d3',
      },
      success: { main: '#16a34a' },
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
            boxShadow: 'none',
            transition: 'all 220ms ease',
          },
          contained: {
            '&:hover': {
              boxShadow: mode === 'light'
                ? '0 10px 22px rgba(255,59,31,0.28)'
                : '0 10px 24px rgba(255,74,42,0.34)',
            },
          },
          containedPrimary: {
            backgroundColor: mode === 'light' ? '#ff3b1f' : '#ff4a2a',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: mode === 'light' ? '#e03118' : '#ff3b1f',
              transform: 'translateY(-1px)',
              boxShadow: mode === 'light' ? '0 10px 20px rgba(255,59,31,0.3)' : '0 10px 20px rgba(255,74,42,0.35)',
            },
          },
          outlined: {
            borderColor: mode === 'light' ? 'rgba(255,59,31,0.42)' : 'rgba(255,122,95,0.55)',
            color: mode === 'light' ? '#c72e16' : '#ffb4a6',
            '&:hover': {
              borderColor: mode === 'light' ? '#ff3b1f' : '#ff7a5f',
              backgroundColor: mode === 'light' ? 'rgba(255,59,31,0.06)' : 'rgba(255,74,42,0.14)',
            },
          },
          text: {
            '&:hover': {
              backgroundColor: mode === 'light' ? 'rgba(255,59,31,0.08)' : 'rgba(255,74,42,0.2)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundImage: 'none',
            backgroundColor: mode === 'light' ? '#ffffff' : '#121722',
            border: mode === 'light'
                ? '1px solid rgba(17,24,39,0.06)'
                : '1px solid rgba(255,255,255,0.12)',
            boxShadow: mode === 'light'
              ? '0 8px 28px rgba(15,23,42,0.06)'
              : '0 8px 30px rgba(0,0,0,0.45)',
            transition: 'box-shadow 220ms ease, transform 220ms ease',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: 'none',
            backgroundColor: mode === 'light' ? '#ffffff' : '#0f141f',
            color: mode === 'light' ? '#111827' : '#f5f7fb',
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
              ? '0 8px 24px rgba(15,23,42,0.05)'
              : '0 4px 24px rgba(0,0,0,0.4)',
            transition: 'transform 220ms ease, box-shadow 220ms ease',
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
