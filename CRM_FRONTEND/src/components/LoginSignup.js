import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  TextField,
  IconButton,
  Divider,
  Snackbar,
  Alert,
  useTheme,
} from "@mui/material";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { useNavigate } from "react-router-dom";
// Static logo imports removed to prevent cross-company branding leakage
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
  const headlineWords = ["innovation", "growth", "progress", "impact"];

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
    // Fetch company logo
    const fetchBranding = async () => {
      try {
        const res = await fetch(`${apiUrl}/company/public`);
        const data = await res.json();
        if (res.ok && data.logo_url) setCompanyLogo(data.logo_url);
      } catch (e) { /* fallback to static logo */ }
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
        setSnackbar({
          open: true,
          message: data.message || "Registration failed",
          severity: "error",
        });
      } else {
        setSnackbar({
          open: true,
          message: "Registration successful!",
          severity: "success",
        });
        setFormData({ email: "", password: "", name: "", userrole: "" });
        setIsActive(false);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: "An error occurred. Please try again.",
        severity: "error",
      });
    }
    setLoading(false);
  };

  const loginUser = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setFormErrors({ login: data.message || "Login failed" });
        setSnackbar({
          open: true,
          message: data.message || "Login failed",
          severity: "error",
        });
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
            feature_permissions: Array.isArray(user.feature_permissions) ? user.feature_permissions : [],
            profilePicture: user.profilePicture || "",
            loginTime: Date.now(),
          })
        );
        localStorage.setItem("isAuthenticated", "true");
        setSnackbar({
          open: true,
          message: "Login successful!",
          severity: "success",
        });
        onLoginSuccess();
        navigate("/dashboard");
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: "An error occurred. Please try again.",
        severity: "error",
      });
    }
    setLoading(false);
  };

  const logoutUser = () => {
    localStorage.removeItem("userSession");
    localStorage.removeItem("isAuthenticated");
    setSnackbar({
      open: true,
      message: "Session expired. Logging out...",
      severity: "info",
    });
    navigate("/");
  };

  const [salesModalOpen, setSalesModalOpen] = useState(false);
  const [salesForm, setSalesForm] = useState({
    name: "", mobile: "", email: "", address: "", companyName: "", location: "", noOfEmails: "", companyDomain: ""
  });
  const [salesLoading, setSalesLoading] = useState(false);
  const [typedWord, setTypedWord] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeletingWord, setIsDeletingWord] = useState(false);

  useEffect(() => {
    const currentWord = headlineWords[wordIndex % headlineWords.length];
    const typingSpeed = isDeletingWord ? 45 : 90;

    const timer = setTimeout(() => {
      if (!isDeletingWord && charIndex < currentWord.length) {
        setTypedWord(currentWord.slice(0, charIndex + 1));
        setCharIndex((prev) => prev + 1);
      } else if (!isDeletingWord && charIndex === currentWord.length) {
        setTimeout(() => setIsDeletingWord(true), 850);
      } else if (isDeletingWord && charIndex > 0) {
        setTypedWord(currentWord.slice(0, charIndex - 1));
        setCharIndex((prev) => prev - 1);
      } else {
        setIsDeletingWord(false);
        setWordIndex((prev) => prev + 1);
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [charIndex, isDeletingWord, wordIndex]);

  const handleSalesChange = (e) => setSalesForm({ ...salesForm, [e.target.name]: e.target.value });

  const handleSalesSubmit = async (e) => {
    e.preventDefault();
    setSalesLoading(true);
    try {
      const response = await fetch(`${apiUrl}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(salesForm)
      });
      if (response.ok) {
        setSnackbar({ open: true, message: "Our team will reach out to you shortly!", severity: "success" });
        setSalesModalOpen(false);
        setSalesForm({ name: "", mobile: "", email: "", address: "", companyName: "", location: "", noOfEmails: "", companyDomain: "" });
      } else {
        const errorData = await response.json();
        setSnackbar({ open: true, message: errorData.message || "Failed to submit request.", severity: "error" });
      }
    } catch (err) {
      setSnackbar({ open: true, message: "Network error, please try again.", severity: "error" });
    }
    setSalesLoading(false);
  };

  return (
    <>
      <Box
        sx={{
          display: "grid",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.palette.mode === "light" ? "#f5f5f0" : "#0a0a0a",
          padding: 2,
          gap: 2,
        }}
      >
        <Box sx={{ textAlign: "center", mb: 1 }}>
          <Typography
            sx={{
              fontSize: { xs: "1.35rem", sm: "1.75rem", md: "2.15rem" },
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: mode === "dark" ? "#f8fafc" : "#111827",
            }}
          >
            Innovation starts with {" "}
            <Box
              component="span"
              sx={{
                color: "#ff3b1f",
                borderRight: `2px solid ${mode === "dark" ? "#f8fafc" : "#111827"}`,
                pr: 0.5,
                minWidth: { xs: 100, md: 135 },
                display: "inline-block",
                textAlign: "left",
              }}
            >
              {typedWord}
            </Box>
          </Typography>
        </Box>

        <Box
          sx={{
            width: "100%",
            maxWidth: 440,
            backgroundColor: theme.palette.mode === "light" ? "#ffffff" : "#111111",
            borderRadius: 4,
            boxShadow: theme.palette.mode === "light" ? "0 12px 40px rgba(0,0,0,0.06)" : "0 12px 40px rgba(0,0,0,0.5)",
            border: theme.palette.mode === "light" ? "1px solid rgba(0,0,0,0.05)" : "1px solid rgba(255,255,255,0.05)",
            p: { xs: 3, md: 5 },
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4 }}>
            <Box sx={{ minHeight: 48, display: 'flex', alignItems: 'center' }}>
              {companyLogo && (
                <img src={companyLogo} alt="Company Logo" style={{ height: 48, objectFit: "contain" }} />
              )}
            </Box>
            <IconButton onClick={toggleColorMode} sx={{ bgcolor: "background.default" }} size="small">
              {mode === "light" ? <DarkModeRoundedIcon fontSize="small" /> : <LightModeRoundedIcon fontSize="small" />}
            </IconButton>
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: "-0.02em" }}>
            Sign in
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 4 }}>
            Enter your credentials to access your workspace.
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              required
              label="Email address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              error={!!formErrors.email}
              helperText={formErrors.email}
              autoComplete="email"
            />
            <TextField
              fullWidth
              required
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              error={!!formErrors.password}
              helperText={formErrors.password}
              autoComplete="current-password"
            />

            {formErrors.login && (
              <Typography color="error" variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
                {formErrors.login}
              </Typography>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 4, py: 1.5, fontSize: "1rem", borderRadius: 3 }}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Continue"}
            </Button>
          </form>

          <Divider sx={{ my: 4 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", px: 1 }}>OR</Typography>
          </Divider>

          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Need a solution for your business?{" "}
              <span 
                style={{ color: theme.palette.mode === "light" ? "#111827" : "#fff", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
                onClick={() => setSalesModalOpen(true)}
              >
                Contact sales
              </span>
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Contact Sales Modal */}
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: "100%", borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Temporary basic unstyled Dialog, can use MUI layout natively */}
      {salesModalOpen && (
        <Box sx={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.5)", p: 2, backdropFilter: "blur(4px)" }}>
          <Box sx={{ width: "100%", maxWidth: 500, bgcolor: "background.paper", borderRadius: 4, p: 4, boxShadow: "0 20px 40px rgba(0,0,0,0.2)", position: 'relative' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Contact Sales</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Fill out the details below and our team will reach out to you.</Typography>
            
            <form onSubmit={handleSalesSubmit}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField size="small" required label="Full Name" name="name" value={salesForm.name} onChange={handleSalesChange} />
                <TextField size="small" required label="Mobile Number" name="mobile" value={salesForm.mobile} onChange={handleSalesChange} />
                <TextField size="small" required label="Email Address" type="email" name="email" value={salesForm.email} onChange={handleSalesChange} />
                <TextField size="small" required label="Company Name" name="companyName" value={salesForm.companyName} onChange={handleSalesChange} />
                <TextField size="small" required label="Company Domain" name="companyDomain" value={salesForm.companyDomain} onChange={handleSalesChange} placeholder="e.g. yourcompany.com" />
                <TextField size="small" required label="No. of Emails Needed" type="number" name="noOfEmails" value={salesForm.noOfEmails} onChange={handleSalesChange} />
              </Box>
              <TextField size="small" fullWidth required label="Headquarters Location" name="location" value={salesForm.location} onChange={handleSalesChange} sx={{ mt: 2 }} />
              <TextField size="small" fullWidth required label="Full Address" name="address" value={salesForm.address} onChange={handleSalesChange} sx={{ mt: 2 }} multiline rows={2} />
              
              <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
                <Button fullWidth variant="outlined" color="inherit" onClick={() => setSalesModalOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
                <Button fullWidth variant="contained" type="submit" disabled={salesLoading} sx={{ borderRadius: 2 }}>
                  {salesLoading ? "Submitting..." : "Submit Request"}
                </Button>
              </Box>
            </form>
          </Box>
        </Box>
      )}
    </>
  );
};

export default LoginSignup;
