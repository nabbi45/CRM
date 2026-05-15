import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Avatar,
  Box,
  IconButton,
  CircularProgress,
  Typography,
} from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import CloseIcon from "@mui/icons-material/Close";
import axios from "axios";
import { enqueueSnackbar } from "notistack";
import { apiUrl } from "./LoginSignup";

const UserEditModal = ({ open, onClose, userSession, onProfileUpdated }) => {
  const [name, setName] = useState(userSession?.name?.toUpperCase() || "");
  const [email, setEmail] = useState(userSession?.email?.toLowerCase() || "");
  const [profilePicture, setProfilePicture] = useState(userSession?.profilePicture || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        enqueueSnackbar("File size should be less than 5MB", { variant: "error" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (password && password.length < 6) {
      enqueueSnackbar("Password must be at least 6 characters long", { variant: "error" });
      return;
    }

    if (password && password !== confirmPassword) {
      enqueueSnackbar("Password and confirm password do not match", { variant: "error" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.toUpperCase(),
        email: email.toLowerCase(),
        profilePicture,
        ...(password ? { password } : {}),
      };
      const response = await axios.put(`${apiUrl}/user/update-profile`, payload, {
        headers: { Authorization: userSession.token },
      });

      if (response.status === 200) {
        enqueueSnackbar("Profile updated successfully!", { variant: "success" });
        // Update local session
        const newSession = {
          ...userSession,
          name: response.data.user.name,
          email: response.data.user.email,
          profilePicture: response.data.user.profilePicture,
        };
        localStorage.setItem("userSession", JSON.stringify(newSession));
        onProfileUpdated(newSession);
        setPassword("");
        setConfirmPassword("");
        onClose();
      }
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || "Failed to update profile";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        Edit Profile
        <IconButton onClick={onClose} disabled={loading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
          <Box sx={{ position: "relative" }}>
            <Avatar src={profilePicture} sx={{ width: 100, height: 100, mb: 2, fontSize: "2rem" }}>
              {!profilePicture && (name ? name.charAt(0).toUpperCase() : "U")}
            </Avatar>
            <IconButton
              component="label"
              sx={{
                position: "absolute",
                bottom: 12,
                right: -8,
                backgroundColor: "primary.main",
                color: "white",
                "&:hover": { backgroundColor: "primary.dark" },
              }}
            >
              <PhotoCameraIcon fontSize="small" />
              <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleFileChange} />
            </IconButton>
          </Box>
          <Typography variant="body2" color="textSecondary">
            Upload a profile picture (Max 5MB)
          </Typography>
        </Box>

        <TextField
          fullWidth
          label="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          margin="normal"
          disabled={loading}
        />
        <TextField
          fullWidth
          label="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase())}
          margin="normal"
          disabled={loading}
          type="email"
        />
        <TextField
          fullWidth
          label="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          margin="normal"
          disabled={loading}
          type="password"
          helperText="Leave empty to keep current password"
        />
        <TextField
          fullWidth
          label="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          margin="normal"
          disabled={loading}
          type="password"
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={24} color="inherit" /> : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserEditModal;
