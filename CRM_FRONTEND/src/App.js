import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginSignup from './components/LoginSignup';
import Dashboard from './Pages/Dashboard';
// import Scorecard from './components/Scorecard';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { SnackbarProvider } from 'notistack';
import './App.css';
import { apiUrl } from './components/LoginSignup';

const LOGIN_DURATION = 20 * 60 * 60 * 1000; // 20 hours in milliseconds

// Validate JWT token with backend
const validateToken = async () => {
  const session = JSON.parse(localStorage.getItem('userSession'));
  if (!session?.token) return false;

  try {
    // Try to validate token by making a request to a protected endpoint
    const res = await fetch(`${apiUrl}/booking/all`, {
      method: 'GET',
      headers: {
        'Authorization': session.token,
        'Content-Type': 'application/json'
      }
    });
    
    // If we get 200, token is valid
    return res.ok;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

// Check if user session is valid
const checkAuth = () => {
  const loggedIn = localStorage.getItem('isAuthenticated');
  const loginTime = localStorage.getItem('loginTime');
  const session = localStorage.getItem('userSession');
  const currentTime = Date.now();

  // Must have all three and be within session duration
  if (loggedIn === 'true' && loginTime && session) {
    if (currentTime - parseInt(loginTime) <= LOGIN_DURATION) {
      return true;
    }
  }
  return false;
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const isAuth = checkAuth();
  const location = useLocation();
  
  if (!isAuth) {
    // Clear any stale auth data
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('loginTime');
    localStorage.removeItem('userSession');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
};

// Public Route Component (redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const isAuth = checkAuth();
  const location = useLocation();
  
  if (isAuth) {
    // If user is already logged in, redirect to dashboard or the page they came from
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }
  
  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(checkAuth());
  const [isLoading, setIsLoading] = useState(true);

  // Validate token on app mount and periodically
  useEffect(() => {
    const validateAndUpdateAuth = async () => {
      const hasSession = checkAuth();
      
      if (hasSession) {
        // Validate token with backend
        const isValid = await validateToken();
        setIsAuthenticated(isValid);
        
        if (!isValid) {
          // Token invalid, clear auth data
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('loginTime');
          localStorage.removeItem('userSession');
        }
      } else {
        setIsAuthenticated(false);
      }
      
      setIsLoading(false);
    };

    validateAndUpdateAuth();

    // Set up periodic token validation (every 5 minutes)
    const interval = setInterval(validateAndUpdateAuth, 5 * 60 * 1000);
    
    // Listen for storage changes (for multi-tab support)
    const handleStorageChange = (e) => {
      if (e.key === 'isAuthenticated' || e.key === 'userSession') {
        setIsAuthenticated(checkAuth());
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('loginTime', Date.now().toString());
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('loginTime');
    localStorage.removeItem('userSession');
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      }}>
        <div style={{ 
          width: 40, 
          height: 40, 
          border: '3px solid #e2e8f0', 
          borderTop: '3px solid #ff3b1f',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <SnackbarProvider>
      <Routes>
        {/* Public routes - Login and Signup (redirect to dashboard if already logged in) */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginSignup onLoginSuccess={handleLoginSuccess} />
            </PublicRoute>
          }
        />
        <Route
          path="/login/*"
          element={
            <PublicRoute>
              <LoginSignup onLoginSuccess={handleLoginSuccess} />
            </PublicRoute>
          }
        />
        
        {/* Protected routes - Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <Dashboard onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        {/* Root route - Redirect based on auth status */}
        <Route
          path="/"
          element={
            isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <Navigate to="/login" replace />
          }
        />

        {/* Catch-all - 404 or redirect based on auth */}
        <Route 
          path="*" 
          element={
            isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <Navigate to="/login" replace />
          } 
        />
      </Routes>
    </SnackbarProvider>
  );
}

export default App;
