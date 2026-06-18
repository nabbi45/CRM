import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ToggleOnOutlinedIcon from "@mui/icons-material/ToggleOnOutlined";
import ToggleOffOutlinedIcon from "@mui/icons-material/ToggleOffOutlined";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import { enqueueSnackbar } from "notistack";
import { apiUrl } from "./LoginSignup";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const ServicesComponent = () => {
  const [services, setServices] = useState([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDeduction, setNewServiceDeduction] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceDeduction, setServiceDeduction] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const userSession = JSON.parse(localStorage.getItem("userSession")) || {};
  const theme = useTheme();

  const authHeaders = {
    "Content-Type": "application/json",
    authorization: userSession?.token || "",
  };

  const fetchServices = async () => {
    const response = await axios.get(`${apiUrl}/services/api/services`, {
      headers: authHeaders,
    });
    setServices(Array.isArray(response.data) ? response.data : []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await fetchServices();
      } catch (error) {
        console.error("Error fetching services", error);
      }
    };

    load();
  }, []);

  const filteredServices = useMemo(
    () => services.filter((service) => service.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [searchTerm, services]
  );

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newServiceName.trim()) {
      enqueueSnackbar("Service name cannot be empty", { variant: "error" });
      return;
    }

    try {
      await axios.post(
        `${apiUrl}/services/api/services`,
        {
          name: newServiceName.trim(),
          value: newServiceName.trim(),
          status: true,
          deduction: Number(newServiceDeduction || 0),
        },
        { headers: authHeaders }
      );

      await fetchServices();
      enqueueSnackbar("Service added successfully!", { variant: "success" });
      setNewServiceName("");
      setNewServiceDeduction("");
    } catch (error) {
      enqueueSnackbar(`${error.response?.data?.message || "Error adding service"}`, { variant: "error" });
    }
  };

  const handleEditClick = (service) => {
    setIsEditing(true);
    setSelectedService(service._id);
    setServiceName(service.name);
    setServiceDeduction(String(service.deduction || ""));
  };

  const handleSave = async () => {
    try {
      await axios.patch(
        `${apiUrl}/services/api/services/${selectedService}`,
        {
          name: serviceName.trim(),
          value: serviceName.trim(),
          status: true,
          deduction: Number(serviceDeduction || 0),
        },
        { headers: authHeaders }
      );

      await fetchServices();
      enqueueSnackbar("Service updated successfully!", { variant: "success" });
      setIsEditing(false);
      setSelectedService(null);
    } catch (error) {
      enqueueSnackbar(`${error.response?.data?.message || "Error updating service"}`, { variant: "error" });
    }
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;

    try {
      await axios.delete(`${apiUrl}/services/api/services/${serviceToDelete}`, {
        headers: authHeaders,
      });
      await fetchServices();
      enqueueSnackbar("Service deleted successfully!", { variant: "success" });
      setIsDeleteModalOpen(false);
      setServiceToDelete(null);
    } catch (error) {
      enqueueSnackbar(`${error.response?.data?.message || "Error deleting service"}`, { variant: "error" });
    }
  };

  const toggleServiceStatus = async (service) => {
    try {
      await axios.patch(
        `${apiUrl}/services/api/services/${service._id}`,
        { status: !service.status },
        { headers: authHeaders }
      );
      await fetchServices();
      enqueueSnackbar(`Service ${service.status ? "disabled" : "enabled"} successfully!`, { variant: "success" });
    } catch (error) {
      enqueueSnackbar(`${error.response?.data?.message || "Error toggling service status"}`, { variant: "error" });
    }
  };

  const surfaceSx = {
    borderRadius: "8px",
    border: "1px solid",
    borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.18)",
    boxShadow: theme.palette.mode === "dark" ? "0 14px 30px rgba(2,6,23,0.28)" : "0 14px 36px rgba(15,23,42,0.06)",
    background: theme.palette.mode === "dark"
      ? "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.94) 100%)"
      : "#ffffff",
  };

  const fieldSx = (tint) => ({
    "& .MuiOutlinedInput-root": {
      borderRadius: "8px",
      backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : tint,
    },
  });

  const serviceCardSx = {
    p: 1.45,
    borderRadius: "8px",
    border: "1px solid",
    borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.16)" : "rgba(148,163,184,0.14)",
    background: theme.palette.mode === "dark"
      ? "linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.88) 100%)"
      : "linear-gradient(180deg, rgba(248,250,252,0.92) 0%, rgba(255,255,255,1) 100%)",
    boxShadow: theme.palette.mode === "dark" ? "none" : "0 8px 20px rgba(15,23,42,0.04)",
    transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: theme.palette.mode === "dark" ? "0 10px 24px rgba(2,6,23,0.22)" : "0 12px 26px rgba(15,23,42,0.08)",
      borderColor: theme.palette.mode === "dark" ? "rgba(148,163,184,0.22)" : "rgba(255,59,31,0.18)",
    },
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, width: "100%", maxWidth: 1560, mx: "auto" }}>
      <Stack spacing={2}>
        <Paper sx={{ ...surfaceSx, p: { xs: 1.4, sm: 1.8, md: 2.1 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.8 }}>
            <BuildOutlinedIcon sx={{ color: "#84cc16" }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Manage Services
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleAddService}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Service Name"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  required
                  fullWidth
                  size="small"
                  sx={fieldSx("rgba(219,234,254,0.5)")}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Deduction"
                  type="number"
                  value={newServiceDeduction}
                  onChange={(e) => setNewServiceDeduction(e.target.value)}
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, step: 1 }}
                  sx={fieldSx("rgba(254,243,199,0.52)")}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  variant="contained"
                  type="submit"
                  fullWidth
                  startIcon={<AddCircleOutlineRoundedIcon />}
                  sx={{ height: "100%", minHeight: 42, borderRadius: "8px", fontWeight: 800 }}
                >
                  Add Service
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>

        <Paper sx={{ ...surfaceSx, p: { xs: 1.4, sm: 1.8, md: 2 } }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, alignItems: "center", flexWrap: "wrap", mb: 1.5 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Services List
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Edit deductions, toggle service availability, and manage the master list.
              </Typography>
            </Box>
            <TextField
              label="Search Services"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            sx={{ minWidth: { xs: "100%", sm: 280 }, ...fieldSx("rgba(240,249,255,0.64)") }}
              InputProps={{
                startAdornment: <SearchOutlinedIcon sx={{ color: "text.secondary", mr: 1 }} />,
              }}
            />
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
              gap: 1.5,
            }}
          >
            {filteredServices.map((service, index) => {
              return (
                <Paper
                  key={service._id}
                  variant="outlined"
                  sx={serviceCardSx}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.25, flexWrap: "wrap" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>{service.name}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.8, flexWrap: "wrap" }} useFlexGap>
                        <Chip
                          size="small"
                          icon={<CurrencyRupeeOutlinedIcon sx={{ fontSize: "0.9rem !important" }} />}
                          label={formatCurrency(service.deduction || 0)}
                          sx={{ borderRadius: "999px", fontWeight: 800, bgcolor: "rgba(59,130,246,0.10)", color: "#2563eb" }}
                        />
                        <Chip
                          size="small"
                          label={service.status ? "Enabled" : "Disabled"}
                          sx={{
                            borderRadius: "999px",
                            fontWeight: 800,
                            bgcolor: service.status ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)",
                            color: service.status ? "#059669" : "#e11d48",
                          }}
                        />
                      </Stack>
                    </Box>

                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <IconButton onClick={() => handleEditClick(service)} sx={{ bgcolor: "rgba(59,130,246,0.10)", color: "#2563eb" }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton onClick={() => toggleServiceStatus(service)} sx={{ bgcolor: service.status ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)", color: service.status ? "#d97706" : "#059669" }}>
                        {service.status ? <ToggleOffOutlinedIcon fontSize="small" /> : <ToggleOnOutlinedIcon fontSize="small" />}
                      </IconButton>
                      <IconButton onClick={() => { setServiceToDelete(service._id); setIsDeleteModalOpen(true); }} sx={{ bgcolor: "rgba(244,63,94,0.12)", color: "#e11d48" }}>
                        <DeleteOutlineOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>
                </Paper>
              );
            })}
          </Box>

          {filteredServices.length === 0 && (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.secondary">No services match this search.</Typography>
            </Box>
          )}
        </Paper>
      </Stack>

      <Dialog open={isEditing} onClose={() => setIsEditing(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Service</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" fullWidth value={serviceName} onChange={(e) => setServiceName(e.target.value)} />
            <TextField label="Deduction" type="number" fullWidth value={serviceDeduction} onChange={(e) => setServiceDeduction(e.target.value)} inputProps={{ min: 0, step: 1 }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setIsEditing(false); setSelectedService(null); }} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Service</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this service? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteModalOpen(false)} variant="outlined">
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ServicesComponent;
