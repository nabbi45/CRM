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
  Grid,
  IconButton,
} from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";
import { enqueueSnackbar } from "notistack";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { apiUrl } from "./LoginSignup";
import AddUser from "./AddUser";

const RemoveUser = () => {
  const [searchTerm, setSearchTerm] = useState(""); // State for search term
  const [users, setUsers] = useState([]); // State for users data
  const [filteredUsers, setFilteredUsers] = useState([]); // State for filtered users
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [Token, setToken] = useState("");

  const theme = useTheme();
  const isMobileOrTablet = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    const userSession = JSON.parse(localStorage.getItem("userSession"));
    if (userSession && userSession.user_id) {
      setToken(userSession.token);
    }
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${apiUrl}/user/all`, {
          headers: {
            authorization: `${userSession.token}`,
            "Content-Type": "application/json",
          },
        });
        setUsers(response.data.Users);
        setFilteredUsers(response.data.Users); // Initialize filtered users
      } catch (error) {
        console.error("Error fetching users", error);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    // Filter users based on search term
    const filtered = users.filter((user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]); // Re-run filter whenever searchTerm or users change

  const handleEditClick = (user) => {
    setIsEditing(true);
    setSelectedUser(user);
    setName(user.name);
    setEmail(user.email);
    setUserRole(user.user_role);
    setPassword("");
  };

  const handleSave = async () => {
    try {
      const body = { name, email, user_role: userRole };
      if (password.trim()) body.password = password;

      await axios.patch(
        `${apiUrl}/user/edituser/${selectedUser._id}`,
        body,
        {
          headers: {
            Authorization: `${Token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const response = await axios.get(`${apiUrl}/user/all`, {
        headers: { authorization: Token },
      });
      setUsers(response.data.Users);
      enqueueSnackbar("User Updated successfully!", { variant: "success" });
      setIsEditing(false);
      setSelectedUser(null);
    } catch (error) {
      enqueueSnackbar(`${error.response?.data?.message || 'Error updating user'}`, { variant: "error" });
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await axios.delete(`${apiUrl}/user/deleteuser/${userToDelete}`, {
        headers: {
          Authorization: `${Token}`,
          "Content-Type": "application/json",
        },
      });

      const response = await axios.get(`${apiUrl}/user/all`, {
        headers: { authorization: Token },
      });
      setUsers(response.data.Users);
      enqueueSnackbar("User Deleted successfully!", { variant: "success" });
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (error) {
      enqueueSnackbar(`${error.response?.data?.message || 'Error deleting user'}`, { variant: "error" });
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user._id);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setUserToDelete(null);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Add User
      </Typography>
      <AddUser />
      <Typography variant="h4" align="center" gutterBottom>
        Users List
      </Typography>
      {/* Search Input */}
      <Box sx={{ mb: 3 }}>
        <TextField
          label="Search Users"
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
              {!isMobileOrTablet && <TableCell>Email</TableCell>}
              <TableCell>Role</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user, index) => (
                <TableRow key={user._id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  {!isMobileOrTablet && <TableCell>{user.email}</TableCell>}
                  <TableCell>{user.user_role}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {isMobileOrTablet ? (
                        <>
                          <IconButton
                            color="primary"
                            onClick={() => handleEditClick(user)}
                            size="small"
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            color="error"
                            onClick={() => handleDeleteClick(user)}
                            size="small"
                          >
                            <Delete />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            onClick={() => handleEditClick(user)}
                            sx={{ mr: 1 }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="contained"
                            color="error"
                            size="small"
                            onClick={() => handleDeleteClick(user)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={isEditing} onClose={() => setIsEditing(false)} fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Name"
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Role"
                fullWidth
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Password"
                type="password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSave} color="primary" variant="contained">
            Save
          </Button>
          <Button
            onClick={() => {
              setIsEditing(false);
              setSelectedUser(null);
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
            Are you sure you want to delete this user? This action cannot be
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

export default RemoveUser;
