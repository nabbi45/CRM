import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  TextField,
  IconButton,
  Snackbar,
  Alert,
  Select,
  MenuItem,
  useTheme,
  CircularProgress,
} from "@mui/material";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import BusinessIcon from "@mui/icons-material/Business";
import { useNavigate } from "react-router-dom";
import { useColorMode } from "../context/AppThemeProvider";

export const apiUrl =
  process.env.REACT_APP_API_URL || "https://crm-backend-3026.onrender.com";

const LoginSignup = ({ onLoginSuccess }) => {
  const [isActive, setIsActive] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    userrole: "",
  });
  const [companyLogo, setCompanyLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");

  // Inquiry form state
  const [inquiryData, setInquiryData] = useState({
    name: "", mobile: "", email: "", address: "",
    companyName: "", location: "", numberOfEmployees: "", companyDomain: "",
  });
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquirySubmitted, setInquirySubmitted] = useState(false);

  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const navigate = useNavigate();

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem("userSession"));
    if (session) {
      const currentTime = Date.now();
      const loginTime = session.loginTime;
      if (currentTime - loginTime >= 20 * 60 * 60 * 1000) {
        logoutUser();
      }
    }
    const fetchBranding = async () => {
      try {
        const res = await fetch(`${apiUrl}/company/public`);
        const data = await res.json();
        if (res.ok && data.logo_url) setCompanyLogo(data.logo_url);
        if (res.ok && data.company_name) setCompanyName(data.company_name);
      } catch (e) { }
    };
    fetchBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateForm = () => {
    let errors = {};
    if (!formData.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Email address is invalid";
    }
    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    if (isActive && !formData.name) {
      errors.name = "Name is required for registration";
    }
    if (isActive && !formData.userrole) {
      errors.userrole = "Role is required for registration";
    }
    return errors;
  };

  const handleRegisterClick = () => {
    setIsActive(true);
    setFormErrors({});
    setFormData({ email: "", password: "", name: "", userrole: "" });
  };

  const handleLoginClick = () => {
    setIsActive(false);
    setFormErrors({});
    setFormData({ email: "", password: "", name: "", userrole: "" });
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length === 0) {
      isActive ? await registerUser() : await loginUser();
    } else {
      setFormErrors(errors);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInquiryChange = (e) => {
    const { name, value } = e.target;
    setInquiryData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    if (!inquiryData.name || !inquiryData.mobile || !inquiryData.email) {
      setSnackbar({ open: true, message: "Name, mobile, and email are required.", severity: "error" });
      return;
    }
    setInquirySubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/lead/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inquiryData),
      });
      const data = await res.json();
      if (res.ok) {
        setInquirySubmitted(true);
        setSnackbar({ open: true, message: data.message, severity: "success" });
      } else {
        setSnackbar({ open: true, message: data.message || "Submission failed", severity: "error" });
      }
    } catch (err) {
      setSnackbar({ open: true, message: "Network error. Please try again.", severity: "error" });
    } finally {
      setInquirySubmitting(false);
    }
  };

  const registerUser = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) {
        setFormErrors({ email: data.message || "Registration failed" });
        setSnackbar({ open: true, message: data.message || "Registration failed", severity: "error" });
      } else {
        setSnackbar({ open: true, message: "Registration successful!", severity: "success" });
        setFormData({ email: "", password: "", name: "", userrole: "" });
        setIsActive(false);
      }
    } catch (error) {
      setSnackbar({ open: true, message: "An error occurred. Please try again.", severity: "error" });
    }
    setLoading(false);
  };

  const loginUser = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFormErrors({ login: data.message || "Login failed" });
        setSnackbar({ open: true, message: data.message || "Login failed", severity: "error" });
      } else {
        const { token, user } = data;
        localStorage.setItem(
          "userSession",
          JSON.stringify({
            token,
            user_id: user._id,
            name: user.name,
            email: user.email,
            user_role: user.user_role,
            profilePicture: user.profilePicture || "",
            loginTime: Date.now(),
          })
        );
        localStorage.setItem("isAuthenticated", "true");
        setSnackbar({ open: true, message: "Login successful!", severity: "success" });
        onLoginSuccess();
        navigate("/dashboard");
      }
    } catch (error) {
      setSnackbar({ open: true, message: "An error occurred. Please try again.", severity: "error" });
    }
    setLoading(false);
  };

  const logoutUser = () => {
    localStorage.removeItem("userSession");
    localStorage.removeItem("isAuthenticated");
    setSnackbar({ open: true, message: "Session expired. Logging out...", severity: "info" });
    navigate("/");
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
      transition: 'all 0.3s ease',
      '&:hover fieldset': { borderColor: '#d1d5db' },
      '&.Mui-focused fieldset': { borderColor: '#e87c2a', borderWidth: '1.5px' },
    },
  };

  const inquiryInputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
      backgroundColor: 'rgba(255,255,255,0.08)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
      '&.Mui-focused fieldset': { borderColor: '#f59e4b', borderWidth: '1.5px' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#f59e4b' },
    '& .MuiOutlinedInput-input': { color: '#ffffff' },
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        {/* ════════ LEFT SIDE: LOGIN ════════ */}
        <Box
          sx={{
            flex: { xs: '1', md: '0 0 45%' },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: theme.palette.mode === "light"
              ? "#fafbfc"
              : "#0a0e1a",
            p: { xs: 3, md: 5 },
            position: 'relative',
          }}
        >
          {/* Theme toggle button */}
          <IconButton
            onClick={toggleColorMode}
            sx={{
              position: 'absolute',
              top: 20,
              right: 20,
              borderRadius: 999,
              border: theme.palette.mode === 'light' ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)',
              backgroundColor: theme.palette.mode === 'light' ? '#fff' : 'rgba(255,255,255,0.05)',
              transition: 'all 0.3s ease',
              '&:hover': { transform: 'rotate(180deg)' },
            }}
          >
            {mode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon sx={{ color: '#f59e4b' }} />}
          </IconButton>

          <Box
            sx={{
              width: "100%",
              maxWidth: 400,
              animation: 'fadeIn 0.6s ease-out',
              '@keyframes fadeIn': {
                from: { opacity: 0, transform: 'translateY(20px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
            }}
          >
            {/* Logo */}
            <Box sx={{ display: "flex", justifyContent: "center", mb: 4, minHeight: 56 }}>
              {companyLogo ? (
                <img src={companyLogo} alt="Company Logo" style={{ height: 56, objectFit: 'contain' }} />
              ) : (
                <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary" }}>
                  {companyName || "CRM"}
                </Typography>
              )}
            </Box>

            <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, color: 'text.primary' }}>
              {isActive ? "Create account" : "Welcome back"}
            </Typography>
            <Typography variant="body2" sx={{ mb: 4, color: 'text.secondary' }}>
              {isActive
                ? "Join your CRM workspace in seconds."
                : "Sign in to continue to your dashboard."}
            </Typography>

            <form onSubmit={handleSubmit}>
              {isActive && (
                <>
                  <TextField fullWidth required label="Name" name="name" value={formData.name} onChange={handleChange} margin="normal" sx={inputSx} />
                  <Select name="userrole" label="Role" margin="normal" value={formData.userrole} onChange={handleChange} fullWidth sx={{ mt: 2, borderRadius: '10px' }}>
                    <MenuItem value="SELECT USER ROLE" disabled>SELECT USER ROLE</MenuItem>
                    <MenuItem value="bdm">BDM</MenuItem>
                    <MenuItem value="admin">ADMIN</MenuItem>
                    <MenuItem value="senior admin">SENIOR ADMIN</MenuItem>
                    <MenuItem value="dev">DEV</MenuItem>
                  </Select>
                </>
              )}
              <TextField fullWidth required label="Email" name="email" type="email" value={formData.email} onChange={handleChange} margin="normal" error={!!formErrors.email} helperText={formErrors.email} sx={inputSx} />
              <TextField fullWidth required label="Password" name="password" type="password" value={formData.password} onChange={handleChange} margin="normal" error={!!formErrors.password} helperText={formErrors.password} sx={inputSx} />

              {formErrors.login && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>{formErrors.login}</Typography>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  mt: 3,
                  py: 1.5,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #e87c2a 0%, #f59e4b 100%)',
                  boxShadow: '0 4px 15px rgba(232, 124, 42, 0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #d06820 0%, #e87c2a 100%)',
                    boxShadow: '0 6px 20px rgba(232, 124, 42, 0.4)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : isActive ? "Create account" : "Sign in"}
              </Button>
            </form>
          </Box>
        </Box>

        {/* ════════ RIGHT SIDE: INQUIRY FORM ════════ */}
        <Box
          sx={{
            flex: { xs: '1', md: '0 0 55%' },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: 'linear-gradient(135deg, #111827 0%, #1e293b 50%, #0f172a 100%)',
            p: { xs: 3, md: 5 },
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-50%',
              right: '-30%',
              width: '600px',
              height: '600px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(232,124,42,0.08) 0%, transparent 70%)',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: '-40%',
              left: '-20%',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
            },
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: 520,
              position: 'relative',
              zIndex: 1,
              animation: 'slideInRight 0.7s ease-out',
              '@keyframes slideInRight': {
                from: { opacity: 0, transform: 'translateX(30px)' },
                to: { opacity: 1, transform: 'translateX(0)' },
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <BusinessIcon sx={{ color: '#e87c2a', fontSize: 32 }} />
              <Typography variant="overline" sx={{ color: '#e87c2a', fontWeight: 700, letterSpacing: '0.12em' }}>
                BUSINESS SOLUTIONS
              </Typography>
            </Box>

            <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', mb: 1, lineHeight: 1.2 }}>
              Need a solution for your business?
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', mb: 4 }}>
              Contact our sales team. Fill in your details and we'll get back to you within 24 hours.
            </Typography>

            {inquirySubmitted ? (
              <Box sx={{
                textAlign: 'center', py: 6,
                animation: 'scaleIn 0.5s ease-out',
                '@keyframes scaleIn': {
                  from: { opacity: 0, transform: 'scale(0.9)' },
                  to: { opacity: 1, transform: 'scale(1)' },
                },
              }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 64, color: '#10b981', mb: 2 }} />
                <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 700, mb: 1 }}>
                  Thank you!
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  Our team will reach out to you shortly.
                </Typography>
              </Box>
            ) : (
              <form onSubmit={handleInquirySubmit}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField size="small" label="Full Name *" name="name" value={inquiryData.name} onChange={handleInquiryChange} sx={inquiryInputSx} />
                  <TextField size="small" label="Mobile Number *" name="mobile" value={inquiryData.mobile} onChange={handleInquiryChange} sx={inquiryInputSx} />
                  <TextField size="small" label="Email Address *" name="email" type="email" value={inquiryData.email} onChange={handleInquiryChange} sx={inquiryInputSx} />
                  <TextField size="small" label="Company Name" name="companyName" value={inquiryData.companyName} onChange={handleInquiryChange} sx={inquiryInputSx} />
                  <TextField size="small" label="Location" name="location" value={inquiryData.location} onChange={handleInquiryChange} sx={inquiryInputSx} />
                  <TextField size="small" label="Address" name="address" value={inquiryData.address} onChange={handleInquiryChange} sx={inquiryInputSx} />
                  <TextField size="small" label="Number of Employees" name="numberOfEmployees" value={inquiryData.numberOfEmployees} onChange={handleInquiryChange} sx={inquiryInputSx} />
                  <TextField size="small" label="Company Domain" name="companyDomain" value={inquiryData.companyDomain} onChange={handleInquiryChange} sx={inquiryInputSx} />
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={inquirySubmitting}
                  endIcon={!inquirySubmitting && <ArrowForwardIcon />}
                  sx={{
                    mt: 3,
                    py: 1.5,
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #e87c2a 0%, #f59e4b 100%)',
                    boxShadow: '0 4px 20px rgba(232, 124, 42, 0.35)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #d06820 0%, #e87c2a 100%)',
                      boxShadow: '0 6px 25px rgba(232, 124, 42, 0.45)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  {inquirySubmitting ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : "Contact Sales"}
                </Button>
              </form>
            )}
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: "100%", borderRadius: '12px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default LoginSignup;
