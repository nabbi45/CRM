import React, { useEffect, useState } from "react";
import "./History.css";
import AddBooking from "./EditBooking"; // Assuming you have the AddBooking component
import EditBooking from "./EditBooking"; // Import the EditBooking component
import Popup from "./Popup"; // Importing the Popup component
import DeleteConfirmationModal from "./DeleteConfirmationModal"; // Import the modal
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Checkbox,
  FormControlLabel,
  Button,
  Box,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import servicesList from "../Data/ServicesData";
import Loader from "./Loader";
import { apiUrl } from "./LoginSignup";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import { canAccessFeature, isHigherAuthority } from "../utils/featureAccess";
import { jsonToCSV, downloadCSV } from "./exelData";
import { useColorMode } from "../context/AppThemeProvider"; // Import for theming

const History = () => {
  const { mode } = useColorMode(); // Extract theme mode
  const [bookings, setBookings] = useState([]); // Initialize bookings as an empty array
  const [loading, setLoading] = useState(true);
  const [openDialogInfo, setOpenDialogInfo] = useState({ bookingIndex: null, updateIndex: null });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 100;

  // Handle view details click
  const handleViewDetailsClick = (bookingIndex, updateIndex) => {
    setOpenDialogInfo({ bookingIndex, updateIndex });
  };


  // Close modal
  const handleCloseModal = () => {
    setOpenDialogInfo({ bookingIndex: null, updateIndex: null });

  };

  //New Changes by Jitendra
  const [selectedFields, setSelectedFields] = useState({
    companyName: true,
    bdmName: true,
    contactNo: true,
    email: true,
    bookingDate: true,
    paymentDate: true,
    totalPayment: true,
    receivedPayment: true,
    afterDisbursement: true,
    remark: true,
    services: true,
    gst: true, // Added GST checkbox
    state: true, // Added State checkbox
    pan: true, // Added PAN checkbox
    termType: true,
  });

  const [openPopupD, setOpenPopupD] = useState(false);

  //changes end
  const [searchInput, setSearchInput] = useState(""); // Single input field for both company name and booking ID
  const [debouncedSearchInput, setDebouncedSearchInput] = useState(searchInput);
  const [bdmSearch, setBdmSearch] = useState("");
  const [startDate, setStartDate] = useState(""); // Add startDate state
  const [endDate, setEndDate] = useState(""); // Add endDate state
  const [status, setStatus] = useState(""); // State for the status filter
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState(""); // Store the logged-in user's ID
  const [isPopupOpen, setIsPopupOpen] = useState(false); // State to control popup visibility
  const [editBooking, setEditBooking] = useState(null); // State to hold the booking to be edited
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // State for delete confirmation modal
  const [bookingToDelete, setBookingToDelete] = useState(null); // Track which booking to delete
  const [services, setService] = useState(""); //state for sevrvice filter
  const [paymentmode, setPaymentmode] = useState("");
  const [exelData, setexelData] = useState("");
  const userSession = JSON.parse(localStorage.getItem("userSession"));

  const [activeFilters, setActiveFilters] = useState({});
  const [downloadAll, setDownloadAll] = useState(false); // ✅ checkbox state
  const [dateType, setDateType] = useState("booking");

  // NEW State for Shared Bookings Toggle
  const [shareFilter, setShareFilter] = useState("All"); // "All" | "SharedByMe" | "SharedWithMe"

  // Document viewing state
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [selectedBookingDocs, setSelectedBookingDocs] = useState(null);
  const [bookingDocuments, setBookingDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [usersMap, setUsersMap] = useState({});

  useEffect(() => {
    // Retroactively map user IDs to names for older bookings
    if (userSession && userSession.token) {
      fetch(`${apiUrl}/user/options`, {
        headers: { 'Authorization': userSession.token }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.users) {
          const map = {};
          data.users.forEach(u => map[u._id] = u.name);
          setUsersMap(map);
        }
      })
      .catch(err => console.error("Error fetching users options:", err));
    }
  }, []);

  useEffect(() => {
    if (userSession && userSession.user_id) {
      setUserRole(userSession.user_role); // Set user role
      setUserId(userSession.user_id); // Set user ID
      fetchAllBookings(userSession, {}, 1, limit);
      // Pass userSession to the function
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userSession && userSession.user_id) {
      fetchAllBookings(userSession, activeFilters, page, limit); // ✅ Use stored filters
    }
  }, [page]);


  // Debounce effect for searchInput
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchInput(searchInput);
    }, 900);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Effect to fetch when debouncedSearchInput changes
  useEffect(() => {
    setPage(1); // reset page to 1 on new search term
    if (debouncedSearchInput) {
      fetchAllBookings(userSession, { searchInput: debouncedSearchInput }, 1, limit);
    } else {
      fetchAllBookings(userSession, {}, 1, limit);
    }
  }, [debouncedSearchInput]);


  const handleDeleteClick = (bookingId) => {
    setBookingToDelete(bookingId); // Set the booking ID to delete
    setIsDeleteModalOpen(true); // Open the delete confirmation modal
  };

  const isBookingId = (input) => {
    return /^[0-9a-fA-F]{24}$/.test(input); // Assuming MongoDB ObjectID format (24-character hex string)
  };

  const fetchAllBookings = (userSession, filters = {}, pageNumber = page, limitNumber = limit) => {
    setLoading(true);
    const { startDate, endDate, searchInput, status, services, bdmName, paymentmode, paymentStartDate, paymentEndDate } =
      filters;
    const userRole = userSession.user_role;
    const userId = userSession.user_id;

    const params = new URLSearchParams();

    // Dynamic query building
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (status) params.append("status", status);
    if (services) params.append("service", services);
    if (bdmName) params.append("bdmName", bdmName);
    if (paymentmode) params.append("paymentmode", paymentmode);
    if (paymentStartDate) params.append("paymentStartDate", paymentStartDate);
    if (paymentEndDate) params.append("paymentEndDate", paymentEndDate);


    params.append("page", pageNumber);
    params.append("limit", limitNumber);

    params.append("userId", userId);
    params.append("userRole", userRole);

    let url;

    if (searchInput) {
      url = isBookingId(searchInput)
        ? `${apiUrl}/user/${searchInput}?userRole=${userRole}&userId=${userId}`
        : `${apiUrl}/user/?pattern=${searchInput}&userRole=${userRole}&userId=${userId}`;
    } else {
      url = `${apiUrl}/booking/bookings/filter?${params.toString()}`;
    }

    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `${userSession.token}`,
      },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.json();
      })
      .then((data) => {
        let bookingsData = [];

        // Handle paginated response format
        if (data.bookings && Array.isArray(data.bookings)) {
          bookingsData = data.bookings;
          setTotalPages(data.totalPages || 1);  // Add this state in your component
          setPage(data.currentPage || 1);       // Add this state in your component
        } else if (Array.isArray(data)) {
          bookingsData = data;
        } else if (data && Array.isArray(data.Allbookings)) {
          bookingsData = data.Allbookings;
        }

        if (bookingsData.length === 0) {
          setBookings([]);
        } else {
          const sortedBookings = bookingsData.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
          setBookings(sortedBookings);
          console.log(sortedBookings);

          try {
            setexelData(jsonToCSV(sortedBookings, selectedFields));
          } catch (error) {
            console.error("Error while converting to CSV:", error);
            enqueueSnackbar("Failed to generate CSV data", { variant: "error" });
          }
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setLoading(false);
      });
  };

  const handleDownload = () => {
    // Show the pop-up when the user clicks the download button
    setOpenPopupD(true);
  };

  const handleFieldSelectionChange = (field) => {
    setSelectedFields((prevState) => ({
      ...prevState,
      [field]: !prevState[field],
    }));
  };

  const handleDownloadCSV = async () => {
    if (!downloadAll) {
      if (!bookings || bookings.length === 0) {
        enqueueSnackbar("No data available to download!", { variant: "warning" });
        return;
      }

      const csvData = jsonToCSV(bookings, selectedFields);
      downloadCSV(csvData, "bookings_data.csv");
      setOpenPopupD(false);
      return;
    }

    try {
      setLoading(true);
      const userSession = JSON.parse(localStorage.getItem("userSession"));
      const url = `${apiUrl}/booking/all`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: userSession.token,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch all bookings");

      const data = await response.json();

      const allBookings = data.Allbookings || []; // ✅ Access correctly

      if (allBookings.length === 0) {
        enqueueSnackbar("No bookings found for download", { variant: "warning" });
      } else {
        const csvData = jsonToCSV(allBookings, selectedFields);
        downloadCSV(csvData, "all_bookings_data.csv");
        enqueueSnackbar("All bookings downloaded successfully!", { variant: "success" });
      }

    } catch (error) {
      console.error("Download error:", error);
      enqueueSnackbar("Download failed!", { variant: "error" });
    } finally {
      setLoading(false);
      setOpenPopupD(false);
    }
  };


  const handleClosePopup = () => {
    setOpenPopupD(false); // Close the popup without downloading
  };

  const handleResetFilters = () => {
    // Reset the selectedFields to their default values (all true, for example)
    setSelectedFields({
      companyName: true,
      bdmName: true,
      contactNo: true,
      email: true,
      bookingDate: true,
      paymentDate: true,
      totalPayment: true,
      receivedPayment: true,
      afterDisbursement: true,
      remark: true,
      services: true,
      gst: true,
      state: true,
      pan: true,
    });

    // Reset other filter values like search input, date filters, status
    setSearchInput("");
    setStartDate("");
    setEndDate("");
    setStatus("");
    setBdmSearch("");
    setService("");
    setPaymentmode(""); // ✅ Fix added

    setActiveFilters({}); // ✅ Also clear active filters
    setPage(1); // reset to page 1

    // Refetch data without any filters applied
    // Ensure that userSession is available
    const userSession = JSON.parse(localStorage.getItem("userSession"));

    if (userSession && userSession.user_id) {
      // Refetch data without any filters applied
      fetchAllBookings(userSession);
    } else {
      // If userSession is missing, handle it gracefully (maybe show a message or redirect)
      console.log("User session is missing or invalid.");
    }
  };

  // chnages End

  const handleEditClick = (booking) => {
    setEditBooking(booking);
    setIsPopupOpen(true);
  };

  const closePopup = () => {
    setIsPopupOpen(false);
    setEditBooking(null); // Clear the current booking on popup close
    fetchAllBookings(JSON.parse(localStorage.getItem("userSession"))); // Fetch updated bookings
  };

  const confirmDelete = () => {
    if (!bookingToDelete) return;

    fetch(`${apiUrl}/booking/trash/${bookingToDelete}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "user-role": userSession.user_role,
        "user-name": userSession?.name,
        authorization: `${userSession.token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || "Error moving the booking to trash");
        }
        setBookings((prev) =>
          prev.filter((booking) => booking._id !== bookingToDelete)
        );
        enqueueSnackbar("Booking moved to trash successfully!", {
          variant: "success",
        });
      })
      .catch((error) => {
        enqueueSnackbar(error.message || "Failed to move booking to trash!", { variant: "error" });
      })
      .finally(() => {
        setIsDeleteModalOpen(false);
        setBookingToDelete(null);
      });
  };


  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setBookingToDelete(null);
  };
  // Function to handle search functionality (by booking ID, company name, date range, and status)

  //After change
  const handleSearch = () => {
    const userSession = JSON.parse(localStorage.getItem("userSession"));
    const filters = {};
    // Date filter logic based on selection

    if (searchInput) {
      filters.searchInput = searchInput;
      setActiveFilters(filters); // ✅ Store filters
      setPage(1);
      fetchAllBookings(userSession, filters, 1, limit);
      return;
    }

    if (startDate && endDate) {
      if (dateType === "booking") {
        filters.startDate = startDate;
        filters.endDate = endDate;
      } else if (dateType === "payment") {
        filters.paymentStartDate = startDate;
        filters.paymentEndDate = endDate;
      }
    }

    if (bdmSearch) filters.bdmName = bdmSearch;
    if (status) filters.status = status;
    if (paymentmode) filters.paymentmode = paymentmode;
    if (services) filters.services = services;

    setActiveFilters(filters); // ✅ Store filters
    setPage(1);
    fetchAllBookings(userSession, filters, 1, limit);
  };


  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      handleSearch(); // Trigger search when Enter key is pressed
    }
  };

  const formatDisplayDate = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const upperText = (value) => value ? String(value).toUpperCase() : "N/A";
  const lowerEmail = (value) => value ? String(value).toLowerCase() : "N/A";

  const handleCopy = (booking) => {
    const bookingDetails = `
      Booking ID: ${booking._id}
      Booking Date: ${formatDisplayDate(booking.date)}
      Payment Date: ${formatDisplayDate(booking.payment_date)}

      Company Name: ${upperText(booking.company_name)}
      Contact Person: ${upperText(booking.contact_person)}
      Email: ${lowerEmail(booking.email)}
      Contact Number: ${booking.contact_no}
      Service: ${booking.services}
      Total Amount: ${booking.total_amount}₹
      Received Amount: ${booking.term_1 + booking.term_2 + booking.term_3}₹
      Pending Amount: ${booking.total_amount -
      (booking.term_1 + booking.term_2 + booking.term_3)
      }₹
      Term ${booking.term_1 ? "1" : booking.term_2 ? "2" : booking.term_3 ? "3" : ""
      }:  ${booking.term_1 || booking.term_2 || booking.term_3}
      Bdm name : ${upperText(booking.bdm)}
      Lead Closed By: ${booking.closed_by || "N/A"}
      GST No: ${upperText(booking.gst)}
      PAN No: ${upperText(booking.pan)}
      Bank Name: ${booking.bank}
      Notes: ${booking.remark}
      After Disbursement:${booking.after_disbursement}
      State:${booking.state}
      Status: ${booking.status}
    `;
    navigator.clipboard.writeText(bookingDetails).then(() => {
      enqueueSnackbar("Booking details copied to clipboard!", {
        variant: "success",
      });
    });
  };

  // Document handling functions
  const handleViewDocuments = async (booking) => {
    setSelectedBookingDocs(booking);
    setDocumentsDialogOpen(true);
    setDocsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/booking-documents/booking/${booking._id}`, {
        headers: { authorization: userSession.token }
      });
      if (res.ok) {
        const docs = await res.json();
        const bdmUploadedIdentityDocs = docs.filter((doc) => {
          const type = (doc.documentType || "").toLowerCase();
          return ["aadhaar", "adhar", "pan"].includes(type) &&
            String(doc.uploadedBy || "") === String(booking.user_id || "");
        });
        setBookingDocuments(bdmUploadedIdentityDocs);
      } else {
        setBookingDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setBookingDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleCloseDocumentsDialog = () => {
    setDocumentsDialogOpen(false);
    setSelectedBookingDocs(null);
    setBookingDocuments([]);
  };

  const downloadDocument = (doc) => {
    if (!doc || !doc.fileUrl) {
      enqueueSnackbar('Invalid document or no file available', { variant: 'error' });
      return;
    }
    window.open(doc.fileUrl, '_blank');
  };

  const handleDeleteDocument = async (doc) => {
    if (!doc || !doc._id) {
      enqueueSnackbar('Invalid document', { variant: 'error' });
      return;
    }

    const canDelete = isHigherAuthority(userSession) || 
                     canAccessFeature(userSession, 'manage_documents') ||
                     canAccessFeature(userSession, 'edit_documents');
    
    if (!canDelete) {
      enqueueSnackbar('You do not have permission to delete documents', { variant: 'warning' });
      return;
    }

    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const res = await fetch(`${apiUrl}/booking-documents/${doc._id}`, {
        method: 'DELETE',
        headers: { authorization: userSession.token }
      });

      if (res.ok) {
        enqueueSnackbar('Document deleted successfully', { variant: 'success' });
        handleViewDocuments(selectedBookingDocs);
      } else {
        enqueueSnackbar('Failed to delete document', { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('Error deleting document', { variant: 'error' });
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh", // Ensures the container takes the full height of the viewport
        }}
      >
        <Loader />
      </div>
    );

  return (
    <div className="history-page" style={{
      backgroundColor: mode === 'light' ? '#f1f5f9' : '#020617',
      color: mode === 'light' ? '#0f172a' : '#e5e7eb',
      minHeight: '100vh',
      transition: 'all 0.3s ease'
    }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
          gap: { xs: 1.25, md: 0 },
          mb: 2,
        }}
      >
        <h2
          className="history-header"
          style={{
            color: mode === 'light' ? '#0f172a' : '#ffffff',
            margin: 0,
            fontSize: 'clamp(1.15rem, 3.7vw, 1.8rem)',
            lineHeight: 1.2,
          }}
        >
          {shareFilter === "SharedByMe" ? "Shared Bookings (By Me)" : shareFilter === "SharedWithMe" ? "Shared Bookings (With Me)" : "All Bookings"}
        </h2>
        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
          <Button
            variant={shareFilter === "All" ? "contained" : "outlined"}
            size="small"
            onClick={() => setShareFilter("All")}
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              minWidth: 0,
              px: { xs: 1.15, md: 1.5 },
              py: { xs: 0.3, md: 0.45 },
              fontSize: { xs: '0.72rem', md: '0.78rem' },
              lineHeight: 1.1,
            }}
          >
            All Bookings
          </Button>
          <Button
            variant={shareFilter === "SharedByMe" ? "contained" : "outlined"}
            size="small"
            onClick={() => setShareFilter("SharedByMe")}
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              minWidth: 0,
              px: { xs: 1.15, md: 1.5 },
              py: { xs: 0.3, md: 0.45 },
              fontSize: { xs: '0.72rem', md: '0.78rem' },
              lineHeight: 1.1,
            }}
          >
            Shared By Me
          </Button>
          <Button
            variant={shareFilter === "SharedWithMe" ? "contained" : "outlined"}
            size="small"
            onClick={() => setShareFilter("SharedWithMe")}
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              minWidth: 0,
              px: { xs: 1.15, md: 1.5 },
              py: { xs: 0.3, md: 0.45 },
              fontSize: { xs: '0.72rem', md: '0.78rem' },
              lineHeight: 1.1,
            }}
          >
            Shared With Me
          </Button>
        </Box>
      </Box>

      {/* Unified Search Bar Container */}
      <div className="filter-container search-container" style={{ margin: '20px auto', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
        <input
          type="text"
          className="search-bar"
          style={{ padding: '10px 15px', width: '100%', maxWidth: '600px', borderRadius: '8px', border: '1px solid #ccc' }}
          placeholder="Search by Employee, Date (YYYY-MM-DD), Client, Booking ID, Service, Status..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <button
          className="search-button"
          onClick={handleSearch}
          style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          <i className="fa-solid fa-magnifying-glass" style={{ marginRight: '8px' }}></i>
          Search
        </button>
        <button
          className="reset-button"
          onClick={handleResetFilters}
          style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          Reset
        </button>
      </div>
      <div className="filter-container" style={{ margin: '0 auto 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', alignItems: 'end' }}>
        <select value={dateType} onChange={(e) => setDateType(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}>
          <option value="booking">Booking Date</option>
          <option value="payment">Payment Date</option>
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
        <input type="month" onChange={(e) => {
          if (!e.target.value) return;
          const [year, month] = e.target.value.split('-').map(Number);
          const first = `${e.target.value}-01`;
          const lastDate = new Date(year, month, 0).getDate();
          setStartDate(first);
          setEndDate(`${e.target.value}-${String(lastDate).padStart(2, '0')}`);
        }} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
        <input type="text" placeholder="BDM name" value={bdmSearch} onChange={(e) => setBdmSearch(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
        <select value={paymentmode} onChange={(e) => setPaymentmode(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}>
          <option value="">Payment Method</option>
          <option value="Axis Bank">Axis Bank</option>
          <option value="IDFC BANK">IDFC Bank</option>
          <option value="Razor Pay">Razor Pay</option>
          <option value="Cashfree">Cashfree</option>
          <option value="Cheque IDFC Bank">Cheque IDFC Bank</option>
          <option value="Cheque Axis Bank">Cheque Axis Bank</option>
          <option value="Cash">Cash</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}>
          <option value="">Status</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
        <select value={services} onChange={(e) => setService(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}>
          <option value="">Service</option>
          {servicesList.map((service) => (
            <option key={service.value || service.label} value={service.value || service.label}>{service.label || service.value}</option>
          ))}
        </select>
      </div>
      <div className="booking-list">
        {bookings
          .filter(b => {
            if (shareFilter === "All") return true;
            if (shareFilter === "SharedByMe") {
              return Array.isArray(b.shared_with) && b.shared_with.length > 0 && b.user_id === userId;
            }
            if (shareFilter === "SharedWithMe") {
              return Array.isArray(b.shared_with) && b.shared_with.some(sw => sw.user_id === userId);
            }
            return true;
          })
          .length > 0 ? (
          bookings
            .filter(b => {
              if (shareFilter === "All") return true;
              if (shareFilter === "SharedByMe") {
                return Array.isArray(b.shared_with) && b.shared_with.length > 0 && b.user_id === userId;
              }
              if (shareFilter === "SharedWithMe") {
                return Array.isArray(b.shared_with) && b.shared_with.some(sw => sw.user_id === userId);
              }
              return true;
            })
            .map((booking) => (
              <div className="booking-item" key={booking._id} style={{
                backgroundColor: mode === 'light' ? '#ffffff' : '#0f172a',
                borderColor: mode === 'light' ? 'rgba(148, 163, 184, 0.35)' : 'rgba(30, 64, 175, 0.7)',
                color: mode === 'light' ? '#333' : '#e5e7eb'
              }}>
                <div className="booking-header">
                  <button
                    className="copy-button"
                    onClick={() => handleCopy(booking)}
                  >
                    Copy
                  </button>
                </div>
                <table className="booking-table">
                  <tbody>
                    <tr>
                      <td>
                        <strong>Booking Date</strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {formatDisplayDate(booking.date)}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Payment Date</strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {formatDisplayDate(booking.payment_date)}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Booking ID </strong>
                      </td>
                      <td style={{ textTransform: "uppercase" }}>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {booking._id}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Company Name </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        <strong>{upperText(booking.company_name)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Contact Person </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {upperText(booking.contact_person)}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Email </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;{" "}
                        {lowerEmail(booking.email)}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Contact Number</strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {booking.contact_no}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Service</strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span>
                        &nbsp;&nbsp;
                        <strong>
                          {Array.isArray(booking.services)
                            ? booking.services.join(", ")
                            : booking.services || "N/A"}
                        </strong>
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <strong>
                          Term{" "}
                          <span>
                            {booking.term_1
                              ? "1"
                              : booking.term_2
                                ? "2"
                                : booking.term_3
                                  ? "3"
                                  : ""}
                          </span>{" "}
                        </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {booking.term_1 || booking.term_2 || booking.term_3} ₹
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Total Amount </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {booking.total_amount}₹
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Received Amount </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {booking.term_1 + booking.term_2 + booking.term_3}₹
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Pending Amount </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {booking.total_amount -
                          (booking.term_1 + booking.term_2 + booking.term_3)}
                        ₹
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Scorecard Amount</strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span>&nbsp;&nbsp;
                        {Array.isArray(booking.scorecard) ? (
                          <ul className="pl-2 list-disc">
                            {booking.scorecard.map((person, i) => (
                              <li key={i}>
                                <strong>{person.name}</strong> – {person.percentage}% – ₹{person.score_amount}
                              </li>
                            ))}
                          </ul>
                        ) : booking.scorecard ? (
                          <>
                            <strong>{booking.scorecard.name}</strong> – {booking.scorecard.percentage}% – ₹{booking.scorecard.score_amount}
                          </>
                        ) : (
                          "N/A"
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <strong>Shared With</strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span>&nbsp;&nbsp;
                        {Array.isArray(booking.shared_with) && booking.shared_with.length > 0 ? (
                          <ul style={{ paddingLeft: '20px', margin: 0 }}>
                            {booking.shared_with.map((sw, idx) => (
                              <li key={idx}>
                                <strong>{upperText(sw.user_name || usersMap[sw.user_id] || "Coworker")}</strong> – {sw.percentage}%
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "Not Shared"
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <strong>GST </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {upperText(booking.gst)}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>PAN No </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {upperText(booking.pan)}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Bank Name </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {booking.bank}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Bdm Name </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        <strong>{upperText(booking.bdm)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Closed By </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {booking.closed_by || "N/A"}
                      </td>
                    </tr>

                    <tr>
                      <td><strong>Update History</strong></td>
                      <td>
                        <span className="colon-bold">:</span>&nbsp;&nbsp;
                        {booking.updatedhistory && booking.updatedhistory.length > 0 ? (
                          <ul className="pl-4">
                            {booking.updatedhistory.map((update, updateIndex) => (
                              <li key={update._id || updateIndex} className="mb-4">
                                <strong>{update.updatedBy}</strong> on{" "}
                                {new Date(update.updatedAt).toLocaleString()}
                                <br />
                                <button
                                  className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                  onClick={() => handleViewDetailsClick(bookings.indexOf(booking), updateIndex)}

                                >
                                  View Details
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "N/A"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>State </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {booking.state}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>After Fund disbursement </strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {booking.after_disbursement || "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Notes</strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        {booking.remark}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Status</strong>
                      </td>
                      <td>
                        <span className="colon-bold">:</span> &nbsp;&nbsp;
                        <span
                          className={
                            booking.status === "Pending"
                              ? "status-pending"
                              : booking.status === "In Progress"
                                ? "status-in-progress"
                                : booking.status === "Completed"
                                  ? "status-completed"
                                  : ""
                          }
                        >
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="booking-footer">
                  <button
                    className="view-docs-link"
                    onClick={() => handleViewDocuments(booking)}
                    style={{
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <FolderOpenIcon fontSize="small" />
                    Documents
                  </button>

                  {(userRole.includes("dev") ||
                    userRole.includes("senior admin")) && (
                      <button
                        className="edit-link"
                        onClick={() => handleEditClick(booking)}
                      >
                        Edit
                      </button>
                    )}

                  {["dev", "srdev"].includes(userRole) && (
                    <button
                      className="delete-link"
                      onClick={() => handleDeleteClick(booking._id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
        ) : (
          <p>No bookings found for the selected filters.</p>
        )}
      </div>

      {/* Modal for View Details */}
      <Dialog open={openDialogInfo.bookingIndex !== null} onClose={handleCloseModal}>
        <DialogTitle>Update Details</DialogTitle>
        <DialogContent>
          {openDialogInfo.bookingIndex !== null &&
            openDialogInfo.updateIndex !== null &&
            bookings[openDialogInfo.bookingIndex]?.updatedhistory?.[openDialogInfo.updateIndex] && (
              <>
                <h4>{bookings[openDialogInfo.bookingIndex].updatedhistory[openDialogInfo.updateIndex].updatedBy}</h4>
                <p><strong>Approved By:</strong> {bookings[openDialogInfo.bookingIndex].updatedhistory[openDialogInfo.updateIndex].note || "N/A"}</p>
                <div>
                  <strong>Changes:</strong>
                  <ul>
                    {Object.entries(bookings[openDialogInfo.bookingIndex].updatedhistory[openDialogInfo.updateIndex].changes || {}).map(([field, value], idx) => (
                      <li key={idx}>
                        <strong>{field}</strong>: <span style={{ color: "red" }}>{String(value.old)}</span> &rarr; <span style={{ color: "green" }}>{String(value.new)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
      />
      <button className="floating-download-button" onClick={handleDownload}>
        <i className="fa-solid fa-download"></i>
      </button>

      {/* Changed Code */}
      <Dialog open={openPopupD} onClose={handleClosePopup}>
        <DialogTitle>Select Fields to Download</DialogTitle>
        <DialogContent>
          {/* List of checkboxes for field selection */}
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.companyName}
                onChange={() => handleFieldSelectionChange("companyName")}
                color="primary"
              />
            }
            label="Company Name"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.bdmName}
                onChange={() => handleFieldSelectionChange("bdmName")}
                color="primary"
              />
            }
            label="BDM Name"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.contactNo}
                onChange={() => handleFieldSelectionChange("contactNo")}
                color="primary"
              />
            }
            label="Contact No."
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.email}
                onChange={() => handleFieldSelectionChange("email")}
                color="primary"
              />
            }
            label="Email"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.bookingDate}
                onChange={() => handleFieldSelectionChange("bookingDate")}
                color="primary"
              />
            }
            label="Booking Date"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.paymentDate}
                onChange={() => handleFieldSelectionChange("paymentDate")}
                color="primary"
              />
            }
            label="Payment Date"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.totalPayment}
                onChange={() => handleFieldSelectionChange("totalPayment")}
                color="primary"
              />
            }
            label="Total Payment"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.receivedPayment}
                onChange={() => handleFieldSelectionChange("receivedPayment")}
                color="primary"
              />
            }
            label="Received Payment"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.afterDisbursement}
                onChange={() => handleFieldSelectionChange("afterDisbursement")}
                color="primary"
              />
            }
            label="After Disbursement:1%"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.remark}
                onChange={() => handleFieldSelectionChange("remark")}
                color="primary"
              />
            }
            label="Remark"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.services}
                onChange={() => handleFieldSelectionChange("services")}
                color="primary"
              />
            }
            label="Services"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.termType}
                onChange={() => handleFieldSelectionChange("termType")}
                color="primary"
              />
            }
            label="Term Type"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.gst}
                onChange={() => handleFieldSelectionChange("gst")}
                color="primary"
              />
            }
            label="GST"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.state}
                onChange={() => handleFieldSelectionChange("state")}
                color="primary"
              />
            }
            label="State"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedFields.pan}
                onChange={() => handleFieldSelectionChange("pan")}
                color="primary"
              />
            }
            label="PAN"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={downloadAll}
                onChange={() => setDownloadAll(!downloadAll)} // Toggle value
                color="primary"
              />
            }
            label="Download all bookings (ignore current filters & pagination)"
          />

        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePopup} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDownloadCSV} color="primary">
            Download
          </Button>
        </DialogActions>
      </Dialog>
      {/* changed code End */}
      <div className="total-bookings">Total Bookings: {bookings.length}</div>

      <div className="pagination-controls">
        <button
          disabled={page <= 1 || !!searchInput}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>

        <span>Page {page} of {totalPages}</span>

        <button
          disabled={page >= totalPages || !!searchInput}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>


      {isPopupOpen && (
        <Popup isOpen={isPopupOpen} onClose={closePopup}>
          {editBooking ? (
            <EditBooking
              initialData={editBooking} // Pass the booking data to be edited
              onClose={closePopup} // Callback to close popup after form submission
            />
          ) : (
            <AddBooking onClose={closePopup} /> // Render AddBooking if creating new booking
          )}
        </Popup>
      )}

      {/* Documents Dialog */}
      <Dialog 
        open={documentsDialogOpen} 
        onClose={handleCloseDocumentsDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Documents - {selectedBookingDocs?.company_name}
          <IconButton
            onClick={handleCloseDocumentsDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {docsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <Loader />
            </Box>
          ) : bookingDocuments.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No BDM-uploaded Aadhaar/PAN documents found for this booking
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>File Name</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Uploaded By</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bookingDocuments.map((doc) => (
                    <TableRow key={doc._id}>
                      <TableCell>
                        <Chip
                          label={doc.documentType.replace('_', ' ').toUpperCase()}
                          size="small"
                          sx={{
                            bgcolor: 
                              doc.documentType === 'agreement' ? '#8b5cf620' :
                              doc.documentType === 'pitch_deck' ? '#06b6d420' :
                              doc.documentType === 'dpr' ? '#f59e0b20' :
                              doc.documentType === 'application' ? '#10b98120' :
                              '#64748b20',
                            color:
                              doc.documentType === 'agreement' ? '#8b5cf6' :
                              doc.documentType === 'pitch_deck' ? '#06b6d4' :
                              doc.documentType === 'dpr' ? '#f59e0b' :
                              doc.documentType === 'application' ? '#10b981' :
                              '#64748b',
                            fontWeight: 500,
                            fontSize: '0.7rem'
                          }}
                        />
                      </TableCell>
                      <TableCell>{doc.fileName}</TableCell>
                      <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                      <TableCell>{doc.uploadedByName}</TableCell>
                      <TableCell>
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Download">
                          <IconButton 
                            size="small" 
                            onClick={() => downloadDocument(doc)}
                            sx={{ color: '#3b82f6' }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {(isHigherAuthority(userSession) || 
                          canAccessFeature(userSession, 'manage_documents') ||
                          canAccessFeature(userSession, 'edit_documents')) && (
                          <Tooltip title="Delete">
                            <IconButton 
                              size="small"
                              onClick={() => handleDeleteDocument(doc)}
                              sx={{ color: '#ef4444' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDocumentsDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default History;
