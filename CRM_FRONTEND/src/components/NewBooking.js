import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Button,
  Typography,
  CircularProgress, // Import CircularProgress for the loader
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import servicesList from "../Data/ServicesData";
import ServiceDropdown from "./Servicesdropdown";
import { apiUrl } from "./LoginSignup";

import Mailer from "./mail";

const AddBooking = ({ onClose }) => {
  const [formData, setFormData] = useState({
    branch: "",
    companyName: "",
    contactPerson: "",
    contactNumber: "",
    email: "",
    date: new Date().toISOString().split("T")[0],
    services: [], // Updated to handle multiple services
    totalAmount: "",
    selectTerm: "",
    amount: "",
    paymentDate: "",
    closed: "",
    pan: "",
    gst: "",
    notes: "",
    bank: "",
    state: "",
    funddisbursement: "",
  });

  const [errors, setErrors] = useState({});
  const [openDialog, setOpenDialog] = useState(false); // Dialog state for popup
  const [bookingId, setBookingId] = useState(null); // Store booking ID
  const [loading, setLoading] = useState(false); // State to manage the loading spinner
  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const [sharedPersons, setSharedPersons] = useState([{ userId: "", percentage: "" }]);
  const [shareCount, setShareCount] = useState(1);
  const [users, setUsers] = useState([]);

  // Fetch all users to populate the Shared With dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const userSession = JSON.parse(localStorage.getItem('userSession'));
        if (!userSession) return;

        // Use /user/all to get the full list of employees for sharing
        const response = await fetch(`${apiUrl}/user/all`, {
          headers: { 'Authorization': userSession?.token || '' }
        });

        if (response.ok) {
          const data = await response.json();
          // Backend returns { Users: [...] }
          setUsers(Array.isArray(data.Users) ? data.Users : []);
        } else {
          // If restricted or error, default to empty to prevent crash
          setUsers([]);
        }
      } catch (error) {
        console.error("Failed to fetch users for sharing:", error);
        setUsers([]); // Fallback to empty array
      }
    };
    fetchUsers();
  }, []);

  // Handle multiple services selection
  const handleServiceChange = (selectedOptions) => {
    setFormData({
      ...formData,
      services: selectedOptions
        ? selectedOptions.map((option) => option.value)
        : [], // Map selected options to an array
    });
  };

  const validate = () => {
    let validationErrors = {};


    // Validation logic (unchanged)
    if (!formData.branch) validationErrors.branch = "Branch is required";
    // if (!formData.companyName) validationErrors.companyName = "Company Name is required";
    if (!formData.contactPerson)
      validationErrors.contactPerson = "Contact Person is required";
    const contactNumberRegex = /^\d{10}$/;
    if (
      !formData.contactNumber ||
      !contactNumberRegex.test(formData.contactNumber)
    ) {
      validationErrors.contactNumber =
        "Valid Contact Number is required (10 digits, no spaces)";
    }
    if (!formData.email) validationErrors.email = "Email is required";
    if (!formData.date) validationErrors.date = "Date is required";
    if (!formData.totalAmount || isNaN(formData.totalAmount)) {
      validationErrors.totalAmount = "Valid Total Amount is required";
    }
    if (!formData.selectTerm)
      validationErrors.selectTerm = "Select Term is required";
    if (!formData.amount || isNaN(formData.amount)) {
      validationErrors.amount = "Valid Amount is required";
    }
    if (Number(formData.amount) > Number(formData.totalAmount)) {
      validationErrors.amount =
        "Received Amount cannot be greater than Total Amount";
    }
    if (!formData.paymentDate)
      validationErrors.paymentDate = "Payment Date is required";
    if (!formData.pan) {
      validationErrors.pan = "PAN Number is required";
    } else {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(formData.pan.toUpperCase())) {
        validationErrors.pan =
          "Valid PAN is required (e.g. ABCDE1234F)";
      }
    }
    if (!formData.state) validationErrors.state = "State is required";

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validate()) {
      setLoading(true); // Show loader when form is being submitted

      const userSession = JSON.parse(localStorage.getItem("userSession"));
      if (!userSession) {
        enqueueSnackbar("User session not found. Please log in again.", {
          variant: "warning",
        });
        setLoading(false);
        return;
      }

      const sharedTotal = sharedPersons.reduce(
        (sum, person) => sum + Number(person.percentage || 0),
        0
      );

      if (sharedTotal > 100) {
        enqueueSnackbar("Total percentage shared cannot exceed 100%", {
          variant: "error",
        });
        setLoading(false);
        return;
      }

      const receivedAmount = Number(formData.amount);
      const total_amount = Number(formData.totalAmount);

      const dataToSubmit = {
        user_id: userSession.user_id,
        bdm: userSession.name,
        branch_name: formData.branch,
        company_name: formData.companyName?.toUpperCase() || "",
        contact_person: formData.contactPerson,
        email: formData.email,
        contact_no: Number(formData.contactNumber),
        services: formData.services,
        total_amount,
        closed_by: formData.closed || "",
        term_1: formData.selectTerm === "Term 1" ? receivedAmount : null,
        term_2: formData.selectTerm === "Term 2" ? receivedAmount : null,
        term_3: formData.selectTerm === "Term 3" ? receivedAmount : null,
        payment_date: formData.paymentDate,
        pan: formData.pan,
        gst: formData.gst || "N/A",
        remark: formData.notes,
        date: formData.date,
        bank: formData.bank,
        state: formData.state,
        status: "Pending",
        after_disbursement: formData.funddisbursement || "",

        shared_with: sharedPersons.map((person) => ({
          user_id: person.userId, // ✅ renamed to match backend schema
          percentage: Number(person.percentage),
        })),
      };

      console.log("Submitting booking payload:", dataToSubmit);

      fetch(`${apiUrl}/booking/addbooking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `${userSession.token}`,
        },
        body: JSON.stringify(dataToSubmit),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || "Error creating booking");
          }
          return response.json();
        })
        .then((res) => {
          const bookingId = res.booking_id?.toUpperCase?.() || "N/A";
          setBookingId(bookingId);
          setOpenDialog(true);

          const data = {
            email: res.booking.email,
            name: res.booking.company_name,
          };

          // Send welcome email (non-blocking — booking success is not affected if email fails)
          if (res.booking.term_1 != null) {
            try {
              Mailer(data);
              enqueueSnackbar("Welcome email sent!", { variant: "info" });
            } catch (mailErr) {
              console.warn("Welcome email failed (non-critical):", mailErr);
            }
          }

          enqueueSnackbar("Booking created successfully!", {
            variant: "success",
          });

          // Reset form
          setFormData({
            branch: "",
            companyName: "",
            contactPerson: "",
            contactNumber: "",
            email: "",
            date: "",
            services: [],
            totalAmount: "",
            closed: "",
            selectTerm: "",
            amount: "",
            paymentDate: "",
            pan: "",
            gst: "",
            notes: "",
            bank: "",
            state: "",
            funddisbursement: "",
          });
          setSharedPersons([]);
          setShareCount(0);
          setLoading(false);

          if (onClose) onClose();
        })
        .catch((error) => {
          console.error("Booking submission error:", error);
          enqueueSnackbar(`Error creating booking: ${error.message}`, {
            variant: "error",
          });
          setLoading(false);
        });
    }
  };


  const handleDialogClose = () => {
    setOpenDialog(false);
    if (onClose) onClose();
  };

  return (
    <Box
      sx={{
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: { xs: 2, sm: 10, md: 20 }, // Responsive padding
        paddingRight: { xs: 2, sm: 10, md: 20 }, // Responsive padding
        backgroundColor: "background.paper",
        borderRadius: 3,
        boxShadow: 3,
      }}
    >
      <Typography
        variant="h5"
        component="h2"
        sx={{
          marginBottom: 3,
          textAlign: "center",
          fontWeight: "bold",
          color: "text.primary",
        }}
      >
        Create New Booking
      </Typography>
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Left Side Inputs */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={Boolean(errors.branch)}>
              <InputLabel>Branch *</InputLabel>
              <Select
                name="branch"
                value={formData.branch}
                onChange={handleChange}
                label="Branch *"
                variant="outlined"
              >
                <MenuItem value="">Select branch</MenuItem>
                <MenuItem value="Main Branch">Main Branch</MenuItem>
              </Select>
              {errors.branch && <Typography color="error" variant="caption">{errors.branch}</Typography>}
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Company Name"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              placeholder="Enter company name"
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Contact Person Name *"
              name="contactPerson"
              value={formData.contactPerson}
              onChange={handleChange}
              placeholder="Enter contact person name"
              variant="outlined"
              error={Boolean(errors.contactPerson)}
              helperText={errors.contactPerson}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Contact Number *"
              name="contactNumber"
              type="text"
              value={formData.contactNumber}
              onChange={handleChange}
              placeholder="Enter contact number"
              variant="outlined"
              error={Boolean(errors.contactNumber)}
              helperText={errors.contactNumber}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email ID *"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter email ID"
              variant="outlined"
              error={Boolean(errors.email)}
              helperText={errors.email}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Booking Date"
              name="date"
              type="date"
              value={formData.date}  // use state date
              InputLabelProps={{ shrink: true }}
              variant="outlined"
              InputProps={{
                readOnly: true,  // user cannot edit this field
              }}
            />

          </Grid>


          <ServiceDropdown formData={formData} setFormData={setFormData} />

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Total Amount *"
              name="totalAmount"
              type="text"
              value={formData.totalAmount}
              onChange={handleChange}
              placeholder="Enter total amount"
              variant="outlined"
              error={Boolean(errors.totalAmount)}
              helperText={errors.totalAmount}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={Boolean(errors.selectTerm)}>
              <InputLabel>Select Term *</InputLabel>
              <Select
                name="selectTerm"
                value={formData.selectTerm}
                onChange={handleChange}
                label="Select Term *"
                variant="outlined"
              >
                <MenuItem value="">Select Term</MenuItem>
                <MenuItem value="Term 1">Term 1</MenuItem>
                <MenuItem value="Term 2">Term 2</MenuItem>
                <MenuItem value="Term 3">Term 3</MenuItem>
              </Select>
              {errors.selectTerm && <Typography color="error" variant="caption">{errors.selectTerm}</Typography>}
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Received Amount *"
              name="amount"
              type="text"
              value={formData.amount}
              onChange={handleChange}
              placeholder="Enter received amount"
              variant="outlined"
              error={Boolean(errors.amount)}
              helperText={errors.amount}
            />
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Number of Salespersons to Share</InputLabel>
              <Select
                value={shareCount}
                label="Number of Salespersons to Share"
                onChange={(e) => {
                  const count = parseInt(e.target.value);
                  setShareCount(count);
                  setSharedPersons(Array.from({ length: count }, () => ({ userId: "", percentage: "" })));
                }}
              >
                <MenuItem value={1}>1</MenuItem>
                <MenuItem value={2}>2</MenuItem>
                <MenuItem value={3}>3</MenuItem>
                <MenuItem value={4}>4</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {sharedPersons.map((person, index) => (
            <Grid container spacing={2} key={index} sx={{ mt: 1, px: 2 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!person.userId}>
                  <InputLabel>Share with User</InputLabel>
                  <Select
                    value={person.userId}
                    label="Share with User"
                    onChange={(e) => {
                      const updated = [...sharedPersons];
                      updated[index].userId = e.target.value;
                      setSharedPersons(updated);
                    }}
                  >
                    {users.map((u) => (
                      <MenuItem key={u._id} value={u._id}>
                        {u.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Percentage Share"
                  type="number"
                  value={person.percentage}
                  onChange={(e) => {
                    const updated = [...sharedPersons];
                    updated[index].percentage = e.target.value;
                    setSharedPersons(updated);
                  }}
                  InputProps={{
                    endAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>%</Typography>
                  }}
                />
              </Grid>
            </Grid>
          ))}


          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Lead Closed By"
              name="closed"
              value={formData.closed || ""}
              onChange={handleChange}
              variant="outlined"
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {users.map((u) => (
                <MenuItem key={u._id} value={u.name}>
                  {u.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Payment Date *"
              name="paymentDate"
              type="date"
              value={formData.paymentDate}
              onChange={handleChange}
              InputLabelProps={{ shrink: true }}
              variant="outlined"
              error={Boolean(errors.paymentDate)}
              helperText={errors.paymentDate}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="PAN Number *"
              name="pan"
              value={formData.pan}
              onChange={handleChange}
              placeholder="e.g. ABCDE1234F"
              variant="outlined"
              error={Boolean(errors.pan)}
              helperText={errors.pan}
              inputProps={{ style: { textTransform: 'uppercase' } }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="GST Number"
              name="gst"
              value={formData.gst}
              onChange={handleChange}
              placeholder="Enter GST"
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Payment Mode</InputLabel>
              <Select
                name="bank"
                value={formData.bank}
                onChange={handleChange}
                variant="outlined"
              >
                <MenuItem value="">Select Payment Mode</MenuItem>
                <MenuItem value="Axis Bank">Axis Bank</MenuItem>
                <MenuItem value="IDFC BANK">IDFC Bank</MenuItem>
                <MenuItem value="Razor Pay">Razor Pay</MenuItem>
                <MenuItem value="Cashfree">Cashfree</MenuItem>
                <MenuItem value="Cheque IDFC Bank">Cheque IDFC Bank</MenuItem>
                <MenuItem value="Cheque Axis Bank">Cheque Axis Bank</MenuItem>
                <MenuItem value="Cash">Cash</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="After Fund Disbursement"
              name="funddisbursement"
              value={formData.funddisbursement}
              onChange={handleChange}
              placeholder="Enter percentage"
              variant="outlined"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={Boolean(errors.state)}>
              <InputLabel>Select State *</InputLabel>
              <Select
                name="state"
                value={formData.state}
                onChange={handleChange}
                label="Select State *"
                variant="outlined"
              >
                <MenuItem value="">Select State</MenuItem>
                <MenuItem value="Andhra Pradesh">Andhra Pradesh</MenuItem>
                <MenuItem value="Arunachal Pradesh">Arunachal Pradesh</MenuItem>
                <MenuItem value="Assam">Assam</MenuItem>
                <MenuItem value="Bihar">Bihar</MenuItem>
                <MenuItem value="Chhattisgarh">Chhattisgarh</MenuItem>
                <MenuItem value="Goa">Goa</MenuItem>
                <MenuItem value="Gujarat">Gujarat</MenuItem>
                <MenuItem value="Haryana">Haryana</MenuItem>
                <MenuItem value="Himachal Pradesh">Himachal Pradesh</MenuItem>
                <MenuItem value="Jharkhand">Jharkhand</MenuItem>
                <MenuItem value="Karnataka">Karnataka</MenuItem>
                <MenuItem value="Kerala">Kerala</MenuItem>
                <MenuItem value="Madhya Pradesh">Madhya Pradesh</MenuItem>
                <MenuItem value="Maharashtra">Maharashtra</MenuItem>
                <MenuItem value="Manipur">Manipur</MenuItem>
                <MenuItem value="Meghalaya">Meghalaya</MenuItem>
                <MenuItem value="Mizoram">Mizoram</MenuItem>
                <MenuItem value="Nagaland">Nagaland</MenuItem>
                <MenuItem value="Odisha">Odisha</MenuItem>
                <MenuItem value="Punjab">Punjab</MenuItem>
                <MenuItem value="Chandigarh">Chandigarh</MenuItem>
                <MenuItem value="Rajasthan">Rajasthan</MenuItem>
                <MenuItem value="Sikkim">Sikkim</MenuItem>
                <MenuItem value="Tamil Nadu">Tamil Nadu</MenuItem>
                <MenuItem value="Telangana">Telangana</MenuItem>
                <MenuItem value="Tripura">Tripura</MenuItem>
                <MenuItem value="Uttar Pradesh">Uttar Pradesh</MenuItem>
                <MenuItem value="Uttarakhand">Uttarakhand</MenuItem>
                <MenuItem value="West Bengal">West Bengal</MenuItem>
                <MenuItem value="Delhi">Delhi</MenuItem>
                <MenuItem value="Andaman and Nicobar">Andaman and Nicobar</MenuItem>
                <MenuItem value="Jammu and Kashmir">Jammu and Kashmir</MenuItem>
              </Select>
              {errors.state && <Typography color="error" variant="caption">{errors.state}</Typography>}
            </FormControl>
          </Grid>


          {/* Notes Field (Full Width) */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Enter any notes"
              multiline
              rows={3}
              variant="outlined"
            />
          </Grid>

          {/* Loader */}
          {loading && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                marginTop: "20px",
              }}
            >
              <CircularProgress size={24} />
            </Box>
          )}

          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              fullWidth
              disabled={loading} // Disable the submit button when loading
              sx={{
                mt: 1,
              }}
            >
              {loading ? "Submitting..." : "Submit Booking"}
            </Button>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default AddBooking;
