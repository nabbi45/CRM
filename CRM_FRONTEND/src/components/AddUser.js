import React, { useState, useEffect } from "react";
import { enqueueSnackbar } from "notistack";
import { apiUrl } from "./LoginSignup";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  ROLE_TEMPLATE_OPTIONS,
  applyRoleTemplate,
  getDefaultFeaturePermissionsForRole,
} from "../utils/featureAccess";

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
    feature_permissions: [],
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleRoleChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      user_role: value,
      feature_permissions: getDefaultFeaturePermissionsForRole(value),
    }));
  };

  const toggleFeature = (featureKey) => {
    setFormData((prev) => ({
      ...prev,
      feature_permissions: prev.feature_permissions.includes(featureKey)
        ? prev.feature_permissions.filter((key) => key !== featureKey)
        : [...prev.feature_permissions, featureKey],
    }));
  };

  const applyPresetRole = (roleKey) => {
    const preset = applyRoleTemplate(roleKey);
    setFormData((prev) => ({
      ...prev,
      user_role: preset.role,
      feature_permissions: preset.permissions,
    }));
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
          setFormData({ name: "", email: "", user_role: "", password: "", feature_permissions: [] });
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
      <input
        list="available-roles"
        id="user_role"
        name="user_role"
        value={formData.user_role}
        onChange={handleRoleChange}
        placeholder="e.g. admin / super admin / custom role"
        style={{
          padding: "8px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          flex: "1 1 auto",
          minWidth: "220px",
        }}
        required
      />
      <datalist id="available-roles">
        <option value="admin" />
        <option value="senior admin" />
        <option value="super admin" />
        <option value="HR" />
        <option value="dev" />
        <option value="srdev" />
        <option value="bdm" />
      </datalist>

      <div
        style={{
          width: "100%",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "4px",
          marginBottom: "2px",
        }}
      >
        {ROLE_TEMPLATE_OPTIONS.map((template) => {
          const isActive = formData.user_role.toLowerCase() === template.key;
          return (
            <button
              key={template.key}
              type="button"
              onClick={() => applyPresetRole(template.key)}
              style={{
                padding: "6px 10px",
                borderRadius: "999px",
                border: isActive ? "1px solid #ff3b1f" : "1px solid rgba(148,163,184,0.45)",
                backgroundColor: isActive ? "rgba(255,59,31,0.12)" : "#fff",
                color: isActive ? "#b42318" : "#334155",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {template.label}
            </button>
          );
        })}
      </div>

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

      <div
        style={{
          width: "100%",
          marginTop: "8px",
          border: "1px solid rgba(148,163,184,0.35)",
          borderRadius: "10px",
          padding: "10px",
          backgroundColor: "rgba(15,23,42,0.03)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: "8px" }}>Role tab permissions</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "6px 10px" }}>
          {FEATURE_KEYS.map((featureKey) => (
            <label key={featureKey} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
              <input
                type="checkbox"
                checked={formData.feature_permissions.includes(featureKey)}
                onChange={() => toggleFeature(featureKey)}
              />
              {FEATURE_LABELS[featureKey] || featureKey}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddUser;
