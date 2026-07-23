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
const TERM_KEYS = Array.from({ length: 10 }, (_, index) => `term_${index + 1}`);
const TERM_OPTIONS = TERM_KEYS.map((termKey, index) => ({
  key: termKey,
  label: `Term ${index + 1}`,
}));

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
  const [users, setUsers] = useState([]);
  const [sharedPersons, setSharedPersons] = useState([]);
  const userOptions = [
    ...users,
    ...(Array.isArray(initialData?.shared_with)
      ? initialData.shared_with
          .filter((sw) => sw.user_id && !users.some((u) => String(u._id) === String(sw.user_id)))
          .map((sw) => ({ _id: sw.user_id, name: sw.user_name || 'Shared employee' }))
      : []),
  ];

  const nextReceivableTerm = (() => {
    for (let index = 1; index < TERM_KEYS.length; index += 1) {
      if (Number(initialData?.[TERM_KEYS[index - 1]] || 0) > 0 && Number(initialData?.[TERM_KEYS[index]] || 0) <= 0) {
        return `Term ${index + 1}`;
      }
    }
    return "";
  })();

  // Populate the form with initialData if available
  useEffect(() => {
    if (initialData) {
      console.log(initialData)
      const firstActiveTermKey = TERM_KEYS.find((termKey) => Number(initialData?.[termKey] || 0) > 0) || 'term_1';
      setFormData({
        branch: initialData.branch_name || '',
        companyName: initialData.company_name ? initialData.company_name.toUpperCase() : '',
        contactPerson: initialData.contact_person ? initialData.contact_person.toUpperCase() : '',
        contactNumber: initialData.contact_no || '',
        email: initialData.email ? initialData.email.toLowerCase() : '',
        date: initialData.date ? new Date(initialData.date).toLocaleDateString('en-GB').split('/').reverse().join('-') : '', // format to 'dd-mm-yyyy',
        services: Array.isArray(initialData.services) ? initialData.services : [],
        totalAmount: initialData.total_amount || '',
        selectTerm: TERM_OPTIONS.find((option) => option.key === firstActiveTermKey)?.label || 'Term 1',
        amount: initialData[firstActiveTermKey] || '',
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
      setSharedPersons(
        Array.isArray(initialData.shared_with)
          ? initialData.shared_with.map((sw) => ({
              userId: sw.user_id || '',
              percentage: sw.percentage || '',
            }))
          : []
      );
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

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('userSession')) || {};
    fetch(`${apiUrl}/user/options`, {
      headers: { Authorization: session.token || '' },
    })
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data.users) ? data.users : []))
      .catch(() => setUsers([]));
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
        const buildShareEntries = () =>
          sharedPersons
            .filter((person) => person.userId && person.percentage)
            .map((person) => {
              const userObj = users.find((u) => String(u._id) === String(person.userId));
              return {
                user_id: person.userId,
                user_name: userObj ? userObj.name?.toUpperCase() : "COWORKER",
                percentage: Number(person.percentage),
              };
            });
        const selectedTermNumber = Math.min(
          Math.max(Number(String(formData.selectTerm || "Term 1").replace(/\D/g, "")) || 1, 1),
          TERM_KEYS.length
        );
        const termKey = TERM_KEYS[selectedTermNumber - 1] || "term_1";
        const shareEntries = buildShareEntries();
        const termAmounts = TERM_KEYS.reduce((acc, currentTermKey, index) => {
          acc[currentTermKey] = currentTermKey === termKey
            ? Number(formData.amount || 0)
            : Number(initialData?.[currentTermKey] || 0) || null;
          return acc;
        }, {});
        const dataToSubmit = {
          branch_name: formData.branch,
          company_name: formData.companyName?.toUpperCase() || "",
          contact_person: formData.contactPerson?.toUpperCase() || "",
          email: formData.email?.toLowerCase() || "",
          contact_no: Number(formData.contactNumber),
          services: formData.services,
          closed_by: formData.closed,
          total_amount: Number(formData.totalAmount),
          ...termAmounts,
          pan: formData.pan?.toUpperCase() || "",
          gst: formData.gst?.toUpperCase() || "",
          payment_date:formData.paymentDate,
          remark: formData.notes,
          date: formData.date,
          bank: formData.bank,
          status: formData.status,
          updatedBy: formData.updatedBy,
          note: formData.note,
          after_disbursement: formData.funddisbursement,
          shared_with: shareEntries,
          term_shares: {
            [termKey]: {
              ...(initialData.term_shares?.[termKey] || {}),
              creator: initialData.term_shares?.[termKey]?.creator || {
                user_id: initialData.user_id,
                user_name: initialData.bdm,
              },
              payment_date: formData.paymentDate,
              payment_mode: formData.bank,
              shared_with: shareEntries,
            },
          },
        };
        console.log(dataToSubmit);

        fetch(`${apiUrl}/booking/editbooking/${initialData._id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'user-role': userSession.user_role,
            'user-name': userSession.name || '',
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
                  {TERM_OPTIONS.map((term) => (
                    <MenuItem key={term.key} value={term.label}>{term.label}</MenuItem>
                  ))}
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

            <Grid item xs={12}>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box>
                    <strong>Edit Booking Sharing</strong>
                    <Box sx={{ color: 'text.secondary', fontSize: 12 }}>
                      Admins can add, remove, or change shared employees and percentages here.
                    </Box>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setSharedPersons((prev) => [...prev, { userId: '', percentage: '' }])}
                  >
                    Add Share
                  </Button>
                </Box>
                {sharedPersons.length === 0 && (
                  <Box sx={{ color: 'text.secondary', fontSize: 14 }}>No shared employees.</Box>
                )}
                {sharedPersons.map((person, index) => (
                  <Grid container spacing={1.5} key={index} sx={{ mb: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Employee</InputLabel>
                        <Select
                          value={person.userId}
                          label="Employee"
                          onChange={(e) => {
                            const next = [...sharedPersons];
                            next[index].userId = e.target.value;
                            setSharedPersons(next);
                          }}
                        >
                          {userOptions.map((u) => (
                            <MenuItem key={u._id} value={u._id}>{u.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={8} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Percentage"
                        type="number"
                        value={person.percentage}
                        onChange={(e) => {
                          const next = [...sharedPersons];
                          next[index].percentage = e.target.value;
                          setSharedPersons(next);
                        }}
                      />
                    </Grid>
                    <Grid item xs={4} sm={2}>
                      <Button
                        fullWidth
                        color="error"
                        variant="outlined"
                        onClick={() => setSharedPersons((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </Grid>
                  </Grid>
                ))}
              </Box>
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
