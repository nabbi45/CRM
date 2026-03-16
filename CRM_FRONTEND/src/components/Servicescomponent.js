import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Box,
} from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";
import { enqueueSnackbar } from "notistack";
import { apiUrl } from "./LoginSignup";

const ServicesComponent = () => {
  const [services, setServices] = useState([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [serviceName, setServiceName] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const userSession = JSON.parse(localStorage.getItem("userSession"));

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await axios.get(`${apiUrl}/services/api/services`,{
          headers: {
            "Content-Type": "application/json",
            authorization: `${userSession.token}`,
          },
        });
        setServices(response.data);
      } catch (error) {
        console.error("Error fetching services", error);
      }
    };

    fetchServices();
  }, []);

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newServiceName.trim()) {
      enqueueSnackbar("Service name cannot be empty", { variant: "error" });
      return;
    }

    try {
      // Send the request to the backend
      await axios.post(
        `${apiUrl}/services/api/services`,
        {
          name: newServiceName, // Name of the service
          value: newServiceName, // Set value equal to name
          status: true, // Default status is true (enabled)
        },
        {
          headers: {
            "Content-Type": "application/json",
            authorization: `${userSession.token}`
          },
        }
      );

      // Fetch the updated list of services
      const response = await axios.get(`${apiUrl}/services/api/services`);
      setServices(response.data); // Update the state with the latest data

      enqueueSnackbar("Service added successfully!", { variant: "success" });

      // Reset the input field
      setNewServiceName("");
    } catch (error) {
      enqueueSnackbar(
        `${error.response?.data?.message || "Error adding service"}`,
        {
          variant: "error",
        }
      );
    }
  };

  const handleEditClick = (service) => {
    setIsEditing(true);
    setSelectedService(service._id); // Store only the service ID
    setServiceName(service.name); // Set the name to the current service name
  };

  const handleSave = async () => {
    try {
      await axios.patch(
        `${apiUrl}/services/api/services/${selectedService}`,
        {
          name: serviceName,
          value: serviceName,
          status: true,
        },
        {
          headers: {
            "Content-Type": "application/json",
            authorization: `${userSession.token}`

          },
        }
      );

      const response = await axios.get(`${apiUrl}/services/api/services`,{
        headers: {
          "Content-Type": "application/json",
          authorization: `${userSession.token}`,
        },
      });
      setServices(response.data);
      enqueueSnackbar("Service updated successfully!", { variant: "success" });
      setIsEditing(false);
      setSelectedService(null);
    } catch (error) {
      console.error("Error response:", error.response); // Log error details
      enqueueSnackbar(
        `${error.response?.data?.message || "Error updating service"}`,
        {
          variant: "error",
        }
      );
    }
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;

    try {
      const res = await axios.delete(`${apiUrl}/services/api/services/${serviceToDelete}`, {
        headers: {
          "Content-Type": "application/json",
          authorization: `${userSession.token}`,
        },
      });

      console.log(res)

      const response = await axios.get(`${apiUrl}/services/api/services/`);
      setServices(response.data);
      enqueueSnackbar("Service deleted successfully!", { variant: "success" });
      setIsDeleteModalOpen(false);
      setServiceToDelete(null);
    } catch (error) {
      enqueueSnackbar(
        `${error.response?.data?.message || "Error deleting service"}`,
        {
          variant: "error",
        }
      );
    }
  };

  const toggleServiceStatus = async (service) => {
    try {
      const res = await axios.patch(
        `${apiUrl}/services/api/services/${service._id}`, // Use the correct ID
        {
          status: !service.status, // Toggle the current status
        },
        {
          headers: {
            "Content-Type": "application/json",
            authorization: `${userSession.token}`,
          },
        }
      );
      console.log(res);

      const response = await axios.get(`${apiUrl}/services/api/services`,{
        headers: {
          "Content-Type": "application/json",
          authorization: `${userSession.token}`,
        },
      }
        
      );
      setServices(response.data); // Refresh the services list
      enqueueSnackbar(
        `Service ${service.status ? "disabled" : "enabled"} successfully!`,
        { variant: "success" }
      );
    } catch (error) {
      enqueueSnackbar(
        `${error.response?.data?.message || "Error toggling service status"}`,
        {
          variant: "error",
        }
      );
    }
  };

  const handleDeleteClick = (service) => {
    setServiceToDelete(service._id);
    console.log(serviceToDelete);
    
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setServiceToDelete(null);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Add Service
      </Typography>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <form
          onSubmit={handleAddService}
          style={{ display: "flex", gap: "8px" }}
        >
          <TextField
            label="Service Name"
            value={newServiceName}
            onChange={(e) => setNewServiceName(e.target.value)}
            required
          />
          <Button variant="contained" color="primary" type="submit">
            Add Service
          </Button>
        </form>
      </Box>
      <Typography variant="h4" align="center" gutterBottom>
        Services List
      </Typography>

      {/* Search Input */}
      <Box sx={{ mb: 3 }}>
        <TextField
          label="Search Services"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          fullWidth
        />
      </Box>

      {/* Table Container */}
      <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>No</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {services
              .filter((service) =>
                service.name.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((service, index) => (
                <TableRow key={service.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{service.name}</TableCell>
                  <TableCell>
                    {service.status ? "Enabled" : "Disabled"}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        onClick={() => handleEditClick(service)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="contained"
                        color={service.status ? "warning" : "success"} // Warning for Disable, Success for Enable
                        size="small"
                        onClick={() => toggleServiceStatus(service)}
                      >
                        {service.status ? "Disable" : "Enable"}{" "}
                        {/* Button text toggles */}
                      </Button>

                      <Button
                        variant="contained"
                        color="error"
                        size="small"
                        onClick={() => handleDeleteClick(service)}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Editing Dialog */}
      <Dialog open={isEditing} onClose={() => setIsEditing(false)} fullWidth>
        <DialogTitle>Edit Service</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSave} color="primary" variant="contained">
            Save
          </Button>
          <Button
            onClick={() => {
              setIsEditing(false);
              setSelectedService(null);
            }}
            color="secondary"
            variant="outlined"
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onClose={closeDeleteModal}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this service? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
          <Button
            onClick={closeDeleteModal}
            color="secondary"
            variant="outlined"
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ServicesComponent;
