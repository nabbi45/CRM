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
import { useColorMode } from "../context/AppThemeProvider";

const AddUser = () => {
  const { mode } = useColorMode();
  const isDark = mode === "dark";
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
      [name]: name === "email" ? value.toLowerCase() : name === "name" ? value.toUpperCase() : value,
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
    <form
      onSubmit={handleSubmit}
      style={{
        margin: "0 auto",
        padding: "18px",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(148,163,184,0.35)"}`,
        borderRadius: "8px",
        background: isDark
          ? "linear-gradient(145deg, rgba(15,23,42,1) 0%, rgba(30,41,59,1) 100%)"
          : "linear-gradient(145deg, rgba(255,255,255,1) 0%, rgba(255,249,244,1) 100%)",
        maxWidth: "100%",
        boxShadow: isDark ? "0 14px 34px rgba(0,0,0,0.28)" : "0 16px 36px rgba(15,23,42,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, display: "grid", placeItems: "center", background: isDark ? "rgba(255,59,31,0.18)" : "rgba(255,59,31,0.12)", color: "#ff3b1f", fontWeight: 800 }}>
          +
        </div>
        <div>
          <div style={{ fontSize: "1.15rem", fontWeight: 800, color: isDark ? "#f8fafc" : "#0f172a" }}>Add New User</div>
          <div style={{ fontSize: "0.84rem", color: isDark ? "#94a3b8" : "#64748b" }}>Create user, assign role, and control tab access in one place.</div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="name" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            style={{
              padding: "10px 12px",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(148,163,184,0.35)"}`,
              borderRadius: "8px",
              backgroundColor: isDark ? "rgba(15,23,42,0.85)" : "#fbfdff",
              color: isDark ? "#f8fafc" : "#0f172a",
            }}
            required
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="email" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            style={{
              padding: "10px 12px",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(148,163,184,0.35)"}`,
              borderRadius: "8px",
              backgroundColor: isDark ? "rgba(15,23,42,0.85)" : "#f7fbff",
              color: isDark ? "#f8fafc" : "#0f172a",
            }}
            required
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="user_role" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
            Role
          </label>
          <input
            list="available-roles"
            id="user_role"
            name="user_role"
            value={formData.user_role}
            onChange={handleRoleChange}
            placeholder="e.g. admin / super admin / custom role"
            style={{
              padding: "10px 12px",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(148,163,184,0.35)"}`,
              borderRadius: "8px",
              backgroundColor: isDark ? "rgba(15,23,42,0.85)" : "#fffaf4",
              color: isDark ? "#f8fafc" : "#0f172a",
            }}
            required
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="password" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            style={{
              padding: "10px 12px",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(148,163,184,0.35)"}`,
              borderRadius: "8px",
              backgroundColor: isDark ? "rgba(15,23,42,0.85)" : "#fff7fb",
              color: isDark ? "#f8fafc" : "#0f172a",
            }}
            required
          />
        </div>
      </div>

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
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "12px",
          marginBottom: "8px",
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
                backgroundColor: isActive ? "rgba(255,59,31,0.12)" : (isDark ? "rgba(15,23,42,0.78)" : "#fff"),
                color: isActive ? "#b42318" : (isDark ? "#cbd5e1" : "#334155"),
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

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          type="submit"
          style={{
            padding: "11px 18px",
            backgroundColor: "#ff3b1f",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            fontWeight: 700,
            boxShadow: "0 12px 24px rgba(255,59,31,0.22)",
          }}
        >
          Save User
        </button>
      </div>

      <div
        style={{
          width: "100%",
          marginTop: "14px",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.16)" : "rgba(148,163,184,0.35)"}`,
          borderRadius: "8px",
          padding: "14px",
          backgroundColor: isDark ? "rgba(15,23,42,0.5)" : "rgba(248,250,252,0.9)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "10px", color: isDark ? "#f8fafc" : "#0f172a", fontSize: "0.95rem" }}>Role tab permissions</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "8px 12px" }}>
          {FEATURE_KEYS.map((featureKey) => (
            <label key={featureKey} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: isDark ? "#e2e8f0" : "#0f172a", padding: "6px 8px", borderRadius: 8, background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff" }}>
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
    </form>
  );
};

export default AddUser;
