import React, { useState, useEffect } from "react";
import { enqueueSnackbar } from "notistack";
import { apiUrl } from "./LoginSignup";

const AddUser = () => {
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState(""); // Store the logged-in user's ID
  const [Token, setToken] = useState(""); // Store the logged-in user's ID

  useEffect(() => {
    const userSession = JSON.parse(localStorage.getItem("userSession"));
    if (userSession && userSession.user_id) {
      setUserRole(userSession.user_role); // Set user role
      setUserId(userSession.user_id); // Set user ID
      setToken(userSession.token);
    }
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    user_role: "",
    password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    // console.log(formData);

    e.preventDefault();
    // Handle form submission logic here
    try {
      const response = await fetch(`${apiUrl}/user/adduser`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `${Token}`,
        },
        body: JSON.stringify(formData),
      })
        .then((response) => {
          if (response.status == 403) {
            enqueueSnackbar(
              `Access denied. Only devs can access this route.!`,
              { variant: "error" }
            );
            // throw new Error('Access denied. Only devs can access this route.');
          }
          if (!response.ok) {
            enqueueSnackbar(`Error creating user.!`, { variant: "error" });
            throw new Error("Error creating user");
          }
          return response.json();
        })
        .then((res) => {
          enqueueSnackbar(`User Added successfully!`, { variant: "success" });
          setFormData({ name: "", email: "", role: "", password: "" }); // Reset the form
        });
    } catch (error) {
      //setResponseMessage('Failed to connect to the server.');
      console.log(error.message);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        margin: "16px auto",
        padding: "16px",
        border: "1px solid rgba(148,163,184,0.4)",
        borderRadius: "12px",
        backgroundColor: "rgba(15,23,42,0.02)",
        maxWidth: "100%",
        overflowX: "auto",
      }}
    >
      <label htmlFor="name" style={{ whiteSpace: "nowrap" }}>
        Name:
      </label>
      <input
        type="text"
        id="name"
        name="name"
        value={formData.name}
        onChange={handleChange}
        style={{
          padding: "8px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          flex: "1 1 auto",
          minWidth: "150px",
        }}
        required
      />

      <label htmlFor="email" style={{ whiteSpace: "nowrap" }}>
        Email:
      </label>
      <input
        type="email"
        id="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        style={{
          padding: "8px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          flex: "1 1 auto",
          minWidth: "150px",
        }}
        required
      />

      <label htmlFor="user_role" style={{ whiteSpace: "nowrap" }}>
        Role:
      </label>
      <select
        id="user_role"
        name="user_role"
        value={formData.user_role}
        onChange={handleChange}
        style={{
          padding: "8px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          flex: "1 1 auto",
          minWidth: "150px",
        }}
        required
      >
        <option value="">Select Role</option>
        <option value="admin">Admin</option>
        <option value="senior admin">Senior Admin</option>
        <option value="HR">HR</option>
        <option value="dev">Dev</option>
        <option value="bdm">Bdm</option>
        {/* <option value="srdev">Sr Dev</option> 👈 ADD THIS LINE */}
      </select>

      <label htmlFor="password" style={{ whiteSpace: "nowrap" }}>
        Password:
      </label>
      <input
        type="password"
        id="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        style={{
          padding: "8px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          flex: "1 1 auto",
          minWidth: "150px",
        }}
        required
      />

      <button
        type="submit"
        onClick={handleSubmit}
        style={{
          padding: "10px 20px",
          backgroundColor: "#007BFF",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Add User
      </button>
    </div>
  );
};

export default AddUser;
