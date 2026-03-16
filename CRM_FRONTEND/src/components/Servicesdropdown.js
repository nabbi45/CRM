import React, { useEffect, useState } from "react";
import { Grid, FormControl } from "@mui/material";
import SelectReact from "react-select";
import { apiUrl } from "./LoginSignup";

const ServiceDropdown = ({ formData, setFormData }) => {
  const [serviceOptions, setServiceOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const userSession = JSON.parse(localStorage.getItem("userSession"));


  // Fetch services from API
  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiUrl}/services/api/services`,{
          headers: {
            "Content-Type": "application/json",
            authorization: `${userSession.token}`,
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
            control: (base) => ({
              ...base,
              minHeight: "56px",
              padding: "5px",
              backgroundColor: "#f9f9f9",
            }),
            menu: (base) => ({
              ...base,
              zIndex: 9999,
            }),
          }}
        />
      </FormControl>
    </Grid>
  );
};

export default ServiceDropdown;
