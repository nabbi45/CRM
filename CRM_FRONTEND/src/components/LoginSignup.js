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
  Select,
  MenuItem,
  useTheme,
} from "@mui/material";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { useNavigate } from "react-router-dom";
import lightLogo from "../assets/logo.png";
import darkLogo from "../assets/whitelogo.png";
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

  return (
    <>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: theme.palette.mode === "light"
            ? "radial-gradient(circle at top left, #e0f2fe, #f9fafb)"
            : "radial-gradient(circle at top left, #1e293b, #020617)",
          padding: 2,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 420,
            backdropFilter: "blur(18px)",
            backgroundColor:
              theme.palette.mode === "light"
                ? "rgba(255,255,255,0.95)"
                : "rgba(15,23,42,0.96)",
            borderRadius: 4,
            boxShadow:
              "0 24px 60px rgba(15,23,42,0.45)",
            border:
              theme.palette.mode === "light"
                ? "1px solid rgba(148,163,184,0.35)"
                : "1px solid rgba(30,64,175,0.7)",
            p: 4,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
            <img
              src={companyLogo || (mode === "light" ? lightLogo : darkLogo)}
              alt="Logo"
              style={{ height: 56 }}
            />
          </Box>

          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {isActive ? "Create account" : "Welcome back"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isActive
                  ? "Join your CRM workspace in seconds."
                  : "Sign in to continue to your CRM."}
              </Typography>
            </Box>
            <IconButton
              onClick={toggleColorMode}
              sx={{
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.5)",
                ml: 2,
                backgroundColor:
                  theme.palette.mode === "light"
                    ? "rgba(248,250,252,0.9)"
                    : "rgba(15,23,42,0.9)",
              }}
            >
              {mode === "light" ? (
                <DarkModeRoundedIcon />
              ) : (
                <LightModeRoundedIcon />
              )}
            </IconButton>
          </Box>

          <form onSubmit={handleSubmit}>
            {isActive && (
              <>
                <TextField
                  fullWidth
                  required
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  margin="normal"
                />
                <Select
                  name="userrole"
                  label="Role"
                  margin="normal"
                  value={formData.userrole}
                  onChange={handleChange}
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  <MenuItem value="SELECT USER ROLE" disabled>
                    SELECT USER ROLE
                  </MenuItem>
                  <MenuItem value="bdm">BDM</MenuItem>
                  <MenuItem value="admin">ADMIN</MenuItem>
                  <MenuItem value="senior admin">SENIOR ADMIN</MenuItem>
                  <MenuItem value="dev">DEV</MenuItem>
                </Select>
              </>
            )}
            <TextField
              fullWidth
              required
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              error={!!formErrors.email}
              helperText={formErrors.email}
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
            />

            {formErrors.login && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {formErrors.login}
              </Typography>
            )}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? "Loading..." : isActive ? "Create account" : "Sign in"}
            </Button>
          </form>

          {/* Signup is disabled — only login is available */}
        </Box>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default LoginSignup;
