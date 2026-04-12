import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  TextField,
  Autocomplete,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Button,
  Typography,
  CircularProgress, // Import CircularProgress for the loader
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import { useLocation } from "react-router-dom";
import servicesList from "../Data/ServicesData";
import ServiceDropdown from "./Servicesdropdown";
import { apiUrl } from "./LoginSignup";

import Mailer from "./mail";

const AddBooking = ({ onClose }) => {
  const location = useLocation();
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

  const handleSelectTermSourceBooking = (_, booking) => {
    setSelectedSourceBooking(booking || null);
    if (!booking) return;

    setFormData((prev) => ({
      ...prev,
      ...mapBookingToForm(booking, prev.selectTerm),
    }));
  };

  const [sharedPersons, setSharedPersons] = useState([{ userId: "", percentage: "" }]);
  const [shareCount, setShareCount] = useState(1);
  const [users, setUsers] = useState([]);
  const [termSourceBookings, setTermSourceBookings] = useState([]);
  const [termSearchLoading, setTermSearchLoading] = useState(false);
  const [selectedSourceBooking, setSelectedSourceBooking] = useState(null);

  const projectionLeadId = location?.state?.projectionLeadId || "";
  const projectionPrefill = location?.state?.prefill || null;
  const termPrefillBooking = location?.state?.termPrefillBooking || null;
  const requestedTerm = location?.state?.requestedTerm || "";

  const isContinuationTerm = formData.selectTerm === "Term 2" || formData.selectTerm === "Term 3";

  const formatDateInput = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  const mapBookingToForm = (booking, forcedTerm = "") => ({
    branch: booking?.branch_name || "",
    companyName: booking?.company_name || "",
    contactPerson: booking?.contact_person || "",
    contactNumber: booking?.contact_no || "",
    email: booking?.email || "",
    date: formatDateInput(booking?.date) || new Date().toISOString().split("T")[0],
    services: Array.isArray(booking?.services) ? booking.services : [],
    totalAmount: booking?.total_amount || "",
    selectTerm: forcedTerm || formData.selectTerm,
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    closed: booking?.closed_by || "",
    pan: booking?.pan || "",
    gst: booking?.gst || "",
    notes: booking?.remark || "",
    bank: booking?.bank || "",
    state: booking?.state || "",
    funddisbursement: booking?.after_disbursement || "",
  });

  useEffect(() => {
    if (!projectionPrefill) return;

    setFormData((prev) => ({
      ...prev,
      branch: projectionPrefill.branch || prev.branch,
      companyName: projectionPrefill.companyName || prev.companyName,
      contactPerson: projectionPrefill.contactPerson || prev.contactPerson,
      contactNumber: projectionPrefill.contactNumber || prev.contactNumber,
      state: projectionPrefill.state || prev.state,
      notes: projectionPrefill.notes || prev.notes,
    }));
  }, [projectionPrefill]);

  useEffect(() => {
    if (!requestedTerm) return;
    setFormData((prev) => ({
      ...prev,
      selectTerm: requestedTerm,
    }));
  }, [requestedTerm]);

  useEffect(() => {
    if (!termPrefillBooking) return;
    setSelectedSourceBooking(termPrefillBooking);
    setFormData((prev) => ({
      ...prev,
      ...mapBookingToForm(termPrefillBooking, requestedTerm || prev.selectTerm),
    }));
  }, [termPrefillBooking, requestedTerm]);

  useEffect(() => {
    if (!isContinuationTerm) {
      setTermSourceBookings([]);
      setSelectedSourceBooking(null);
      return;
    }

    const fetchTermSourceBookings = async () => {
      try {
        setTermSearchLoading(true);
        const userSession = JSON.parse(localStorage.getItem("userSession"));
        if (!userSession) return;

        const isAdmin = ["admin", "dev", "senior admin", "srdev", "super admin"].includes(
          (userSession.user_role || "").toLowerCase()
        );

        const bookingUrl = isAdmin
          ? `${apiUrl}/booking/all`
          : `${apiUrl}/user/bookings/${userSession.user_id}`;

        const response = await fetch(bookingUrl, {
          headers: {
            "Content-Type": "application/json",
            authorization: `${userSession.token}`,
          },
        });

        if (!response.ok) {
          setTermSourceBookings([]);
          return;
        }

        const data = await response.json();
        const bookings = Array.isArray(data?.Allbookings) ? data.Allbookings : Array.isArray(data) ? data : [];

        const eligibleBookings = bookings.filter((booking) => {
          const t1 = Number(booking.term_1 || 0);
          const t2 = Number(booking.term_2 || 0);
          const t3 = Number(booking.term_3 || 0);

          if (formData.selectTerm === "Term 2") {
            return t1 > 0 && t2 <= 0;
          }

          if (formData.selectTerm === "Term 3") {
            return t2 > 0 && t3 <= 0;
          }

          return false;
        });

        setTermSourceBookings(eligibleBookings);
      } catch (error) {
        console.error("Failed to fetch continuation term bookings:", error);
        setTermSourceBookings([]);
      } finally {
        setTermSearchLoading(false);
      }
    };

    fetchTermSourceBookings();
  }, [isContinuationTerm, formData.selectTerm]);

  // Fetch all users to populate the Shared With dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const userSession = JSON.parse(localStorage.getItem('userSession'));
        if (!userSession) return;

        // Use /user/options so all authenticated roles can access employee options
        const response = await fetch(`${apiUrl}/user/options`, {
          headers: { 'Authorization': userSession?.token || '' }
        });

        if (response.ok) {
          const data = await response.json();
          // Backend returns { users: [...] }
          setUsers(Array.isArray(data.users) ? data.users : []);
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
    if (isContinuationTerm && !selectedSourceBooking) {
      validationErrors.termSource = `Please select existing ${formData.selectTerm === "Term 2" ? "Term 1" : "Term 2"} booking first`;
    }
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

  const handleSubmit = async (e) => {
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

      try {
        if (isContinuationTerm && selectedSourceBooking?._id) {
          const continuationPayload = {
            payment_date: formData.paymentDate,
            updatedBy: userSession.name || "Unknown",
            note: `${formData.selectTerm} added from continuation flow`,
          };

          if (formData.selectTerm === "Term 2") {
            continuationPayload.term_2 = receivedAmount;
          }

          if (formData.selectTerm === "Term 3") {
            continuationPayload.term_3 = receivedAmount;
          }

          const continuationRes = await fetch(`${apiUrl}/booking/editbooking/${selectedSourceBooking._id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "user-role": userSession.user_role,
              authorization: `${userSession.token}`,
            },
            body: JSON.stringify(continuationPayload),
          });

          const continuationData = await continuationRes.json().catch(() => ({}));
          if (!continuationRes.ok) {
            throw new Error(continuationData.message || `Error adding ${formData.selectTerm}`);
          }

          enqueueSnackbar(`${formData.selectTerm} added successfully!`, { variant: "success" });
          setFormData((prev) => ({
            ...prev,
            amount: "",
            paymentDate: new Date().toISOString().split("T")[0],
          }));
          setLoading(false);
          if (onClose) onClose();
          return;
        }

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
            user_id: person.userId,
            percentage: Number(person.percentage),
          })),
        };

        const response = await fetch(`${apiUrl}/booking/addbooking`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `${userSession.token}`,
          },
          body: JSON.stringify(dataToSubmit),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || "Error creating booking");
        }

        const res = await response.json();
        const bookingId = res.booking_id?.toUpperCase?.() || "N/A";
        setBookingId(bookingId);
        setOpenDialog(true);

        if (projectionLeadId) {
          try {
            const transferRes = await fetch(`${apiUrl}/projection-leads/${projectionLeadId}/mark-transferred`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                authorization: `${userSession?.token || ""}`,
              },
              body: JSON.stringify({ booking_id: bookingId }),
            });

            if (transferRes.ok) {
              enqueueSnackbar("Projection lead transferred to bookings.", {
                variant: "success",
              });
            } else {
              const transferErr = await transferRes.json().catch(() => ({}));
              enqueueSnackbar(
                transferErr?.message || "Booking created, but lead transfer was not completed.",
                { variant: "warning" }
              );
            }
          } catch (transferError) {
            console.error("Failed to transfer projection lead:", transferError);
            enqueueSnackbar("Booking created, but lead transfer failed.", {
              variant: "warning",
            });
          }
        }

        const data = {
          email: res.booking.email,
          name: res.booking.company_name,
        };

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

        setFormData({
          branch: "",
          companyName: "",
          contactPerson: "",
          contactNumber: "",
          email: "",
          date: new Date().toISOString().split("T")[0],
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
      } catch (error) {
        console.error("Booking submission error:", error);
        enqueueSnackbar(`Error creating booking: ${error.message}`, {
          variant: "error",
        });
        setLoading(false);
      }
    }
  };


  const handleDialogClose = () => {
    setOpenDialog(false);
    if (onClose) onClose();
  };

  const bookingSearchLabel = (booking) => {
    const bookingDate = formatDateInput(booking?.date || booking?.createdAt);
    const bookingIdShort = booking?._id ? String(booking._id).slice(-6).toUpperCase() : "N/A";
    return `${booking?.company_name || "No Company"} | ${booking?.bdm || "Unknown"} | ${bookingDate || "No Date"} | ID: ${bookingIdShort}`;
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
              value={formData.date}
              onChange={handleChange}
              InputLabelProps={{ shrink: true }}
              variant="outlined"
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
                onChange={(e) => {
                  handleChange(e);
                  if (e.target.value === "Term 1") {
                    setSelectedSourceBooking(null);
                  }
                }}
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

          {isContinuationTerm && (
            <Grid item xs={12}>
              <Autocomplete
                options={termSourceBookings}
                value={selectedSourceBooking}
                onChange={handleSelectTermSourceBooking}
                loading={termSearchLoading}
                getOptionLabel={bookingSearchLabel}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={`Search ${formData.selectTerm === "Term 2" ? "Term 1" : "Term 2"} Booking`}
                    placeholder="Search by company, user, date, booking id"
                    error={Boolean(errors.termSource)}
                    helperText={errors.termSource || `Select existing ${formData.selectTerm === "Term 2" ? "Term 1" : "Term 2"} record to continue receivable`}
                  />
                )}
              />
            </Grid>
          )}

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
              fullWidth
              label="Closed By"
              name="closed"
              value={formData.closed}
              onChange={handleChange}
              placeholder="Lead closed by"
              variant="outlined"
            />
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
