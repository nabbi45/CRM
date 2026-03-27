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
        main: '#e87c2a',
        dark: '#d06820',
        light: '#f59e4b',
      },
      secondary: {
        main: mode === 'light' ? '#111827' : '#f1f5f9',
        dark: '#0f172a',
        light: '#374151',
      },
      background: {
        default: mode === 'light' ? '#fafbfc' : '#0a0e1a',
        paper: mode === 'light' ? '#ffffff' : '#111827',
      },
      text: {
        primary: mode === 'light' ? '#111827' : '#f3f4f6',
        secondary: mode === 'light' ? '#6b7280' : '#9ca3af',
      },
      success: { main: '#10b981' },
      warning: { main: '#f59e0b' },
      error: { main: '#ef4444' },
      info: { main: '#3b82f6' },
      divider: mode === 'light' ? '#e5e7eb' : 'rgba(31,41,55,0.8)',
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'sans-serif',
      ].join(','),
      h4: { fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2 },
      h5: { fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3 },
      h6: { fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.4 },
      subtitle1: { fontWeight: 500, letterSpacing: '-0.005em' },
      subtitle2: { fontWeight: 600, fontSize: '0.875rem' },
      body1: { fontSize: '0.938rem', lineHeight: 1.6 },
      body2: { fontSize: '0.813rem', lineHeight: 1.5, color: mode === 'light' ? '#6b7280' : '#9ca3af' },
      button: { fontWeight: 600, letterSpacing: '0.01em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 10,
            fontWeight: 600,
            paddingInline: 20,
            paddingBlock: 10,
            fontSize: '0.875rem',
            boxShadow: 'none',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(232, 124, 42, 0.25)',
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0px)',
            },
          },
          containedPrimary: {
            backgroundColor: '#e87c2a',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#d06820',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            backgroundColor: mode === 'light' ? '#ffffff' : '#111827',
            border: mode === 'light'
              ? '1px solid #e5e7eb'
              : '1px solid rgba(31,41,55,0.6)',
            boxShadow: mode === 'light'
              ? '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)'
              : '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: mode === 'light' ? '1px solid #e5e7eb' : '1px solid rgba(31,41,55,0.5)',
            backgroundColor: mode === 'light' ? '#ffffff' : '#0f172a',
            transition: 'background-color 0.3s ease',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            border: mode === 'light'
              ? '1px solid #e5e7eb'
              : '1px solid rgba(31,41,55,0.6)',
            boxShadow: mode === 'light'
              ? '0 1px 3px rgba(0,0,0,0.04)'
              : '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              boxShadow: mode === 'light'
                ? '0 4px 12px rgba(0,0,0,0.08)'
                : '0 8px 24px rgba(0,0,0,0.4)',
              transform: 'translateY(-2px)',
            },
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'light' ? '#f9fafb' : '#0f172a',
            '& .MuiTableCell-head': {
              fontWeight: 700,
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: mode === 'light' ? '#6b7280' : '#9ca3af',
              borderBottom: mode === 'light' ? '2px solid #e5e7eb' : '2px solid rgba(31,41,55,0.5)',
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 0.2s ease',
            '&:hover': {
              backgroundColor: mode === 'light' ? '#f9fafb' : 'rgba(31,41,55,0.3)',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: mode === 'light'
              ? '1px solid #f3f4f6'
              : '1px solid rgba(31,41,55,0.4)',
            padding: '14px 16px',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'all 0.2s ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: mode === 'light' ? '#d1d5db' : '#4b5563',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#e87c2a',
              borderWidth: '1.5px',
            },
            '& input:-webkit-autofill': {
              WebkitBoxShadow: mode === 'light'
                ? '0 0 0 1000px #ffffff inset'
                : '0 0 0 1000px #111827 inset',
              WebkitTextFillColor: mode === 'light' ? '#111827' : '#f3f4f6',
            },
          },
          notchedOutline: {
            borderColor: mode === 'light' ? '#e5e7eb' : '#374151',
            transition: 'border-color 0.2s ease',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontSize: '0.75rem',
            borderRadius: 8,
            transition: 'all 0.2s ease',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '6px 12px',
          },
        },
      },
      MuiSnackbar: {
        styleOverrides: {
          root: {
            '& .MuiAlert-root': {
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            },
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
