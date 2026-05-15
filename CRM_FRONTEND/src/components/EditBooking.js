import React, { useEffect, useState } from 'react';
import { apiUrl } from './LoginSignup';
import { useNavigate } from 'react-router-dom';
import './EditBooking.css';
import {
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Button,
  Box,
  Grid,
  TextareaAutosize,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SelectMUI from 'react-select';
import { enqueueSnackbar } from 'notistack';
import servicesList from '../Data/ServicesData';
import ServiceDropdown from './Servicesdropdown'
const userSession = JSON.parse(localStorage.getItem('userSession')) || {};
const updatedBy = userSession.name || 'Unknown';

const EditBooking = ({ initialData, onClose }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    branch: '',
    companyName: '',
    contactPerson: '',
    contactNumber: '',
    email: '',
    date: '',
    services: [], // Updated to handle multiple services
    totalAmount: '',
    selectTerm: '',
    amount: '',
    paymentDate: '',
    pan: '',
    gst: '',
    notes: '',
    note: '',
    updatedBy: '',
    bank: '',
    closed: '',
    status: '',
    funddisbursement: ''
  });

  const [errors, setErrors] = useState({});
  const [companyBranches, setCompanyBranches] = useState([]);

  const nextReceivableTerm = Number(initialData?.term_1 || 0) > 0 && Number(initialData?.term_2 || 0) <= 0
    ? 'Term 2'
    : Number(initialData?.term_2 || 0) > 0 && Number(initialData?.term_3 || 0) <= 0
      ? 'Term 3'
      : '';

  // Populate the form with initialData if available
  useEffect(() => {
    if (initialData) {
      console.log(initialData)
      setFormData({
        branch: initialData.branch_name || '',
        companyName: initialData.company_name ? initialData.company_name.toUpperCase() : '',
        contactPerson: initialData.contact_person ? initialData.contact_person.toUpperCase() : '',
        contactNumber: initialData.contact_no || '',
        email: initialData.email ? initialData.email.toLowerCase() : '',
        date: initialData.date ? new Date(initialData.date).toLocaleDateString('en-GB').split('/').reverse().join('-') : '', // format to 'dd-mm-yyyy',
        services: Array.isArray(initialData.services) ? initialData.services : [],
        totalAmount: initialData.total_amount || '',
        selectTerm: initialData.term_1 ? 'Term 1' : initialData.term_2 ? 'Term 2' : '',
        amount: initialData.term_1 || initialData.term_2 || '',
        paymentDate: initialData.payment_date ? new Date(initialData.payment_date).toLocaleDateString('en-GB').split('/').reverse().join('-') : '',
        pan: initialData.pan ? initialData.pan.toUpperCase() : '',
        gst: initialData.gst ? initialData.gst.toUpperCase() : '',
        notes: initialData.remark || '',
        note: initialData.note || '',
        updatedBy: updatedBy || "Unknown",
        bank: initialData.bank,
        status: initialData.status || '',
        closed: initialData.closed_by || '',
        funddisbursement: initialData.after_disbursement || ''
      });
    }
  }, [initialData]);

  // Fetch company branches
  useEffect(() => {
    fetch(`${apiUrl}/company/public`)
      .then(res => res.json())
      .then(data => {
        if (data && data.branches) {
          const branchesArray = data.branches.split(',').map(b => b.trim()).filter(Boolean);
          setCompanyBranches(branchesArray);
        }
      })
      .catch(err => console.error("Error fetching branches:", err));
  }, []);

  // Handle multiple services selection
  const handleServiceChange = (selectedOptions) => {
    setFormData({
      ...formData,
      services: selectedOptions ? selectedOptions.map(option => option.value) : [], // Map selected options to an array
    });
  };

  const handleAddNextTerm = () => {
    if (!nextReceivableTerm) return;
    if (onClose) onClose();
    navigate('/dashboard/new-booking', {
      state: {
        termPrefillBooking: initialData,
        requestedTerm: nextReceivableTerm,
      },
    });
  };
  // Prepare service options
  const serviceOptions = servicesList.map((service) => ({
    value: service.value,
    label: service.label,
    isDisabled: service.disabled, // Optional: Handle disabled options
  }));

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    const upperFields = ["companyName", "contactPerson", "pan", "gst"];
    const nextValue = name === "email"
      ? value.toLowerCase()
      : upperFields.includes(name)
        ? value.toUpperCase()
        : value;

    setFormData({
      ...formData,
      [name]: nextValue,
    });
  };

  const handleWheel = (event) => {
    // Prevent default behavior
    event.preventDefault();
  };

  // Validate form
  const validate = () => {
    let validationErrors = {};
    if (!formData.branch) validationErrors.branch = "Branch is required";
    if (!formData.companyName) validationErrors.companyName = "Company Name is required";
    if (!formData.contactPerson) validationErrors.contactPerson = "Contact Person is required";
    if (!formData.contactNumber || isNaN(formData.contactNumber)) validationErrors.contactNumber = "Valid Contact Number is required";
    if (!formData.email) validationErrors.email = "Email is required";
    if (!formData.date) validationErrors.date = "Date is required";
    if (!formData.totalAmount || isNaN(formData.totalAmount)) validationErrors.totalAmount = "Valid Total Amount is required";
    if (!formData.selectTerm) validationErrors.selectTerm = "Select Term is required";
    if (!formData.amount || isNaN(formData.amount)) validationErrors.amount = "Valid Amount is required";
    if (!formData.paymentDate) validationErrors.paymentDate = "Payment Date is required";

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validate()) {
      const userSession = JSON.parse(localStorage.getItem('userSession'));

      if (userSession) {
        const dataToSubmit = {
          branch_name: formData.branch,
          company_name: formData.companyName?.toUpperCase() || "",
          contact_person: formData.contactPerson?.toUpperCase() || "",
          email: formData.email?.toLowerCase() || "",
          contact_no: Number(formData.contactNumber),
          services: formData.services,
          closed_by: formData.closed,
          total_amount: Number(formData.totalAmount),
          term_1: formData.selectTerm === "Term 1" ? Number(formData.amount) : initialData.term_1 || null,
          term_2: formData.selectTerm === "Term 2" ? Number(formData.amount) : initialData.term_2 || null,
          term_3: formData.selectTerm === "Term 3" ? Number(formData.amount) : null, // Ensure Term 3 is handled correctly
          pan: formData.pan?.toUpperCase() || "",
          gst: formData.gst?.toUpperCase() || "",
          payment_date:formData.paymentDate,
          remark: formData.notes,
          date: formData.date,
          bank: formData.bank,
          status: formData.status,
          updatedBy: formData.updatedBy,
          note: formData.note,
          after_disbursement: formData.funddisbursement
        };
        console.log(dataToSubmit);

        fetch(`${apiUrl}/booking/editbooking/${initialData._id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'user-role': userSession.user_role,
            authorization: `${userSession.token}`
          },
          body: JSON.stringify(dataToSubmit),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error('Error updating booking');
            }
            return response.json();
          })
          .then(() => {
            enqueueSnackbar('Booking Updated successfully!', { variant: 'success' }); // Use notistack's success notification
            if (onClose) onClose(); // Close the form after submission
          })
          .catch((error) => {
            console.error('Error:', error);
            enqueueSnackbar(`Error Updating  booking: ${error.message}`, { variant: 'error' }); // Use notistack's error notification
          });
      } else {
        enqueueSnackbar('User session not found. Please log in again.', { variant: 'warning' }); // Use notistack's warning notification
      }
    }
  };



  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Edit Booking
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '75vh', overflowY: 'auto' }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {/* Branch */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Branch</InputLabel>
                <Select
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                >
                  <MenuItem value="">Select branch</MenuItem>
                  {companyBranches.map((branch, idx) => (
                    <MenuItem key={idx} value={branch}>{branch}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Company Name */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Name"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
              />
            </Grid>

            {/* Contact Person */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Person"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
              />
            </Grid>

            {/* Contact Number */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Number"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
              />
            </Grid>

            {/* Email */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </Grid>

            {/* Booking Date */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Booking Date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& input::-webkit-calendar-picker-indicator': {
                    filter: theme.palette.mode === 'dark' ? 'invert(1)' : 'none',
                  }
                }}
              />
            </Grid>

            {/* Services */}
            <ServiceDropdown formData={formData} setFormData={setFormData} />

            {/* Total Amount */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Total Amount"
                name="totalAmount"
                value={formData.totalAmount}
                onChange={handleChange}
              />
            </Grid>

            {/* Select Term */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Select Term</InputLabel>
                <Select
                  name="selectTerm"
                  value={formData.selectTerm}
                  onChange={handleChange}
                >
                  <MenuItem value="">Select Term</MenuItem>
                  <MenuItem value="Term 1">Term 1</MenuItem>
                  <MenuItem value="Term 2">Term 2</MenuItem>
                  <MenuItem value="Term 3">Term 3</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Received Amount */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Received Amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
              />
            </Grid>

            {/* Closed By */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Closed By"
                name="closed"
                value={formData.closed}
                onChange={handleChange}
              />
            </Grid>

            {/* Payment Date */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Payment Date"
                name="paymentDate"
                type="date"
                value={formData.paymentDate}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& input::-webkit-calendar-picker-indicator': {
                    filter: isDark ? 'invert(1)' : 'none',
                  }
                }}
              />
            </Grid>

            {/* PAN Number */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="PAN Number"
                name="pan"
                value={formData.pan}
                onChange={handleChange}
              />
            </Grid>

            {/* GST Number */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="GST Number"
                name="gst"
                value={formData.gst}
                onChange={handleChange}
              />
            </Grid>

            {/* Bank Name */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Bank Name</InputLabel>
                <Select
                  name="bank"
                  value={formData.bank}
                  onChange={handleChange}
                >
                  <MenuItem value="">Select Bank</MenuItem>
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

            {/* Status */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="In Progress">In Progress</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Fund Disbursement */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Fund Disbursement"
                name="funddisbursement"
                value={formData.funddisbursement}
                onChange={handleChange}
              />
            </Grid>



            {/* Notes */}
            <Grid item xs={12}>
              <TextareaAutosize
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Enter Notes"
                minRows={3}
                style={{ width: '100%', borderRadius: 4, padding: 8, border: '1px solid #ccc' }}
              />
            </Grid>
          </Grid>

          {/* Buttons */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              mt: 2,
            }}
          >
            <Box>
              {nextReceivableTerm && (
                <Button variant="outlined" color="success" onClick={handleAddNextTerm}>
                  Add {nextReceivableTerm} Receivable
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button type="submit" variant="contained" color="primary">
                Update
              </Button>
              <Button variant="outlined" color="secondary" onClick={onClose}>
                Cancel
              </Button>
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>);
};

export default EditBooking;
