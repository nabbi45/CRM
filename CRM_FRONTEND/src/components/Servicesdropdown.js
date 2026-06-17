import React, { useEffect, useState } from "react";
import { Grid, FormControl, useTheme } from "@mui/material";
import SelectReact from "react-select";
import { apiUrl } from "./LoginSignup";

const ServiceDropdown = ({ formData, setFormData, accentColor = "#8b5cf6", surfaceColor = "#fbf7ff" }) => {
  const [serviceOptions, setServiceOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const userSession = JSON.parse(localStorage.getItem("userSession")) || {};
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';


  // Fetch services from API
  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiUrl}/services/api/services`,{
          headers: {
            "Content-Type": "application/json",
            authorization: userSession.token || "",
          },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch services");
        }
        const data = await response.json();

        // Map API response to serviceOptions format
        const options = data.map((service) => ({
          value: service.name, // Ensure the ID field matches the API
          label: service.name,
          isDisabled: !service.status, // Disable the option if the service is not enabled
        }));

        setServiceOptions(options);
      } catch (error) {
        console.error("Error fetching services:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  return (
    <Grid item xs={12} sm={6}>
      <FormControl fullWidth>
        <SelectReact
          isMulti
          options={serviceOptions} // Options fetched from API
          value={serviceOptions.filter((option) =>
            formData.services.includes(option.value)
          )} // Match selected services
          onChange={(selectedOptions) => {
            const updatedServices = selectedOptions
              ? selectedOptions.map((option) => option.value)
              : []; // Map selected options to their values
            setFormData({
              ...formData,
              services: updatedServices,
            });
          }}
          closeMenuOnSelect={false} // Keep dropdown open for multiple selections
          placeholder={loading ? "Loading services..." : "Search and select services"}
          isSearchable
          styles={{
            control: (base, state) => ({
              ...base,
              minHeight: "56px",
              padding: "5px",
              borderRadius: 8,
              backgroundColor: isDark ? '#1e293b' : surfaceColor,
              borderColor: state.isFocused ? accentColor : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(148,163,184,0.22)'),
              boxShadow: state.isFocused
                ? (isDark ? 'none' : `0 0 0 3px ${accentColor}18`)
                : 'none',
              "&:hover": {
                borderColor: accentColor,
              },
            }),
            menu: (base) => ({
              ...base,
              zIndex: 9999,
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
            }),
            option: (base, state) => ({
              ...base,
              backgroundColor: state.isSelected
                ? (isDark ? '#3b82f6' : '#2563eb')
                : state.isFocused
                  ? (isDark ? '#334155' : '#f3f4f6')
                  : (isDark ? '#1e293b' : '#ffffff'),
              color: state.isSelected
                ? '#ffffff'
                : (isDark ? '#f8fafc' : '#1f2937'),
              '&:hover': {
                backgroundColor: isDark ? '#334155' : '#f3f4f6',
              },
            }),
            multiValue: (base) => ({
              ...base,
              backgroundColor: isDark ? '#334155' : '#e5e7eb',
            }),
            multiValueLabel: (base) => ({
              ...base,
              color: isDark ? '#f8fafc' : '#374151',
            }),
            placeholder: (base) => ({
              ...base,
              color: isDark ? 'rgba(248,250,252,0.6)' : '#6b7280',
            }),
            input: (base) => ({
              ...base,
              color: isDark ? '#f8fafc' : '#1f2937',
            }),
          }}
        />
      </FormControl>
    </Grid>
  );
};

export default ServiceDropdown;
