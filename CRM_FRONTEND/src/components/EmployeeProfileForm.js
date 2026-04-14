import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Box, Typography, Tabs, Tab, Card, CardContent, Grid, Avatar, Chip, Button,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions, Stack, Paper,
  CircularProgress, Divider, IconButton, InputAdornment, Select, MenuItem,
  FormControl, InputLabel, Alert, Tooltip, useTheme
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import PersonIcon from "@mui/icons-material/Person";
import BadgeIcon from "@mui/icons-material/Badge";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import WorkIcon from "@mui/icons-material/Work";
import SchoolIcon from "@mui/icons-material/School";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import "./CreateProfile.css";
import { useColorMode } from "../context/AppThemeProvider";
import { isHigherAuthority } from "../utils/featureAccess";

const STATUS_COLORS = {
  pending_review: "warning",
  approved: "success",
  rejected: "error",
  incomplete: "default",
};

const DOC_TYPE_LABELS = {
  offer_letter: "Offer Letter",
  promotion_letter: "Promotion Letter",
  marksheet: "Marksheet",
  experience_letter: "Experience Letter",
  other: "Other",
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────
export const CreateProfile = ({ apiUrl, userSession }) => {
  const { mode } = useColorMode();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isAuthority = isHigherAuthority(userSession);

  const [activeTab, setActiveTab] = useState(isAuthority ? 0 : 2);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState(null);

  // Authority lists
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [search, setSearch] = useState("");

  // Dialogs
  const [viewProfile, setViewProfile] = useState(null);
  const [rejectDialog, setRejectDialog] = useState({ open: false, userId: null, remark: "" });
  const [addDetailsDialog, setAddDetailsDialog] = useState({ open: false, userId: null });
  const [addCompDialog, setAddCompDialog] = useState({ open: false, userId: null });
  const [compForm, setCompForm] = useState({ ctc: "", basicSalary: "", hra: "", incentives: "", otherAllowances: "", notes: "" });
  const [detailFile, setDetailFile] = useState(null);
  const [detailForm, setDetailForm] = useState({ docType: "", title: "", notes: "" });
  const [additionalDetails, setAdditionalDetails] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadDocError, setUploadDocError] = useState("");

  // Create / Edit profile form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    employeeFullName: "", designation: "", department: "", branch: "",
    gender: "", maritalStatus: "", dateOfBirth: "",
    personalContactNumber: "", personalEmailAddress: "", workEmail: "", workPhoneNumber: "",
    permanentAddress: "", currentAddress: "",
    emergencyContactName: "", emergencyContactNumber: "", emergencyContactRelationship: "",
    dateOfJoining: "", reportingManager: "", offeredSalary: "",
    educationQualification: "", previousEmployer: "", totalWorkExperience: "",
    accountNumber: "", bankName: "", ifscCode: "", panNumber: "", aadharNumber: "",
    dateOfLastPromotion: ""
  });
  const [photo, setPhoto] = useState(null);
  const [aadhaar, setAadhaar] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [aadhaarPreview, setAadhaarPreview] = useState(null);
  const [errors, setErrors] = useState({});

  const departments = ["Sales", "Digital", "Admin", "Legal", "Finance"];
  const [companyBranches, setCompanyBranches] = useState([]);
  const maritalStatuses = ["Single", "Married", "Divorced", "Widowed"];
  const relationships = ["Father", "Mother", "Spouse", "Brother", "Sister", "Friend", "Other"];

  const headers = { authorization: userSession?.token || "" };

  // ─── DATA LOADING ──────────────────
  const fetchMyProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/employee/profile/${userSession.user_id}`, { headers: { authorization: userSession.token } });
      setMyProfile(res.data.profile);
    } catch {
      setMyProfile(null);
    }
  }, [apiUrl, userSession]);

  const fetchPending = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/employee/pending-approvals`, { headers: { authorization: userSession.token } });
      setPendingProfiles(res.data.profiles || []);
    } catch { setPendingProfiles([]); }
  }, [apiUrl, userSession]);

  const fetchAll = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/employee/all${search ? `?search=${search}` : ""}`, { headers: { authorization: userSession.token } });
      setAllEmployees(res.data.employees || []);
    } catch { setAllEmployees([]); }
  }, [apiUrl, userSession, search]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchMyProfile();
      if (isAuthority) {
        await Promise.all([fetchPending(), fetchAll()]);
      }
      setLoading(false);
    };
    if (userSession?.user_id && userSession?.token) init();
  }, [fetchMyProfile, fetchPending, fetchAll, isAuthority, userSession]);

  // Fetch branches
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
  }, [apiUrl]);

  // ─── APPROVAL ACTIONS ──────────────────
  const handleApprove = async (userId) => {
    try {
      await axios.post(`${apiUrl}/employee/approve/${userId}`, {}, { headers: { authorization: userSession.token } });
      fetchPending();
      fetchAll();
    } catch (err) {
      console.error("Approve error:", err);
    }
  };

  const handleReject = async () => {
    try {
      await axios.post(`${apiUrl}/employee/reject/${rejectDialog.userId}`, { remark: rejectDialog.remark }, { headers: { authorization: userSession.token } });
      setRejectDialog({ open: false, userId: null, remark: "" });
      fetchPending();
      fetchAll();
    } catch (err) {
      console.error("Reject error:", err);
    }
  };

  const handleDeleteProfile = async (userId) => {
    if (!window.confirm("Are you sure you want to deactivate this employee profile?")) return;
    try {
      await axios.delete(`${apiUrl}/employee/delete/${userId}`, { headers: { authorization: userSession.token } });
      fetchAll();
      fetchPending();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // ─── ADDITIONAL DETAILS ──────────────────
  const fetchAdditionalDetails = async (userId) => {
    try {
      const res = await axios.get(`${apiUrl}/employee/additional-details/${userId}`, { headers: { authorization: userSession.token } });
      setAdditionalDetails(res.data.additionalDetails || []);
    } catch { setAdditionalDetails([]); }
  };

  const handleAddDetails = async () => {
    if (!detailFile || !detailForm.docType || !detailForm.title) return;
    setUploadingDoc(true);
    setUploadDocError("");
    const fd = new FormData();
    fd.append("file", detailFile);
    fd.append("docType", detailForm.docType);
    fd.append("title", detailForm.title);
    fd.append("notes", detailForm.notes);
    try {
      await axios.post(`${apiUrl}/employee/additional-details/${addDetailsDialog.userId}`, fd, {
        headers: { authorization: userSession.token, "Content-Type": "multipart/form-data" }
      });
      setAddDetailsDialog({ open: false, userId: null });
      setDetailFile(null);
      setDetailForm({ docType: "", title: "", notes: "" });
      if (viewProfile) fetchAdditionalDetails(viewProfile.userId);
    } catch (err) {
      console.error("Add details error:", err);
      setUploadDocError("Failed to upload document. Ensure file format is valid (PDF/DOCX/JPG/PNG).");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleOpenComp = async (userId) => {
    setUploadingDoc(true);
    setUploadDocError("");
    setAddCompDialog({ open: true, userId });
    setCompForm({ ctc: "", basicSalary: "", hra: "", incentives: "", otherAllowances: "", notes: "" });
    try {
      const res = await axios.get(`${apiUrl}/employee/additional-details/${userId}`, { headers: { authorization: userSession.token } });
      if (res.data.compensationDetails) {
        setCompForm({
          ctc: res.data.compensationDetails.ctc || "",
          basicSalary: res.data.compensationDetails.basicSalary || "",
          hra: res.data.compensationDetails.hra || "",
          incentives: res.data.compensationDetails.incentives || "",
          otherAllowances: res.data.compensationDetails.otherAllowances || "",
          notes: res.data.compensationDetails.notes || ""
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleAddCompensation = async () => {
    setUploadingDoc(true);
    setUploadDocError("");
    try {
      await axios.put(`${apiUrl}/employee/compensation/${addCompDialog.userId}`, compForm, {
        headers: { authorization: userSession.token }
      });
      setAddCompDialog({ open: false, userId: null });
      if (viewProfile) fetchAdditionalDetails(viewProfile.userId);
    } catch (err) {
      console.error("Add comp error:", err);
      setUploadDocError("Failed to update compensation details.");
    } finally {
      setUploadingDoc(false);
    }
  };

  // ─── PROFILE CREATION FORM LOGIC ──────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: "" });
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErrors({ ...errors, [type]: "File must be less than 5MB" }); return; }
    if (!file.type.startsWith("image/")) { setErrors({ ...errors, [type]: "Please select an image file" }); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === "photo") { setPhotoPreview(e.target?.result); setPhoto(file); }
      else { setAadhaarPreview(e.target?.result); setAadhaar(file); }
    };
    reader.readAsDataURL(file);
    if (errors[type]) setErrors({ ...errors, [type]: "" });
  };

  const validateStep = (step) => {
    const ne = {};
    switch (step) {
      case 0:
        if (!formData.employeeFullName.trim()) ne.employeeFullName = "Required";
        if (!formData.designation.trim()) ne.designation = "Required";
        if (!formData.department) ne.department = "Required";
        if (!formData.branch) ne.branch = "Required";
        if (!formData.gender) ne.gender = "Required";
        if (!formData.maritalStatus) ne.maritalStatus = "Required";
        if (!formData.dateOfBirth) ne.dateOfBirth = "Required";
        break;
      case 1:
        if (!formData.personalContactNumber.trim()) ne.personalContactNumber = "Required";
        if (!formData.personalEmailAddress.trim()) ne.personalEmailAddress = "Required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personalEmailAddress)) ne.personalEmailAddress = "Invalid email";
        if (!formData.workEmail.trim()) ne.workEmail = "Required";
        if (!formData.workPhoneNumber.trim()) ne.workPhoneNumber = "Required";
        break;
      case 2:
        if (!formData.permanentAddress.trim()) ne.permanentAddress = "Required";
        if (!formData.currentAddress.trim()) ne.currentAddress = "Required";
        break;
      case 3:
        if (!formData.emergencyContactName.trim()) ne.emergencyContactName = "Required";
        if (!formData.emergencyContactNumber.trim()) ne.emergencyContactNumber = "Required";
        if (!formData.emergencyContactRelationship) ne.emergencyContactRelationship = "Required";
        break;
      case 4:
        if (!formData.dateOfJoining) ne.dateOfJoining = "Required";
        if (!formData.reportingManager.trim()) ne.reportingManager = "Required";
        break;
      case 5:
        if (!formData.educationQualification.trim()) ne.educationQualification = "Required";
        if (!formData.totalWorkExperience.trim()) ne.totalWorkExperience = "Required";
        break;
      case 6:
        if (!formData.accountNumber.trim()) ne.accountNumber = "Required";
        if (!formData.bankName.trim()) ne.bankName = "Required";
        if (!formData.ifscCode.trim()) ne.ifscCode = "Required";
        if (!formData.panNumber.trim()) ne.panNumber = "Required";
        if (!formData.aadharNumber.trim()) ne.aadharNumber = "Required";
        break;
      case 7:
        if (!photo) ne.photo = "Employee photo required";
        if (!aadhaar) ne.aadhaar = "Aadhaar card required";
        break;
      default: break;
    }
    setErrors(ne);
    return Object.keys(ne).length === 0;
  };

  const nextStep = () => { if (validateStep(currentStep)) setCurrentStep(currentStep + 1); };
  const prevStep = () => setCurrentStep(currentStep - 1);

  const handleEditProfile = () => {
    if (!myProfile) return;
    setFormData({
      employeeFullName: myProfile.employeeFullName || "",
      designation: myProfile.designation || "",
      department: myProfile.department || "",
      branch: myProfile.branch || "",
      gender: myProfile.gender || "",
      maritalStatus: myProfile.maritalStatus || "",
      dateOfBirth: myProfile.dateOfBirth ? new Date(myProfile.dateOfBirth).toISOString().split("T")[0] : "",
      personalContactNumber: myProfile.personalContactNumber || "",
      personalEmailAddress: myProfile.personalEmailAddress || "",
      workEmail: myProfile.workEmail || "",
      workPhoneNumber: myProfile.workPhoneNumber || "",
      permanentAddress: myProfile.permanentAddress || "",
      currentAddress: myProfile.currentAddress || "",
      emergencyContactName: myProfile.emergencyContactName || "",
      emergencyContactNumber: myProfile.emergencyContactNumber || "",
      emergencyContactRelationship: myProfile.emergencyContactRelationship || "",
      dateOfJoining: myProfile.dateOfJoining ? new Date(myProfile.dateOfJoining).toISOString().split("T")[0] : "",
      reportingManager: myProfile.reportingManager || "",
      offeredSalary: myProfile.offeredSalary || "",
      educationQualification: myProfile.educationQualification || "",
      previousEmployer: myProfile.previousEmployer || "",
      totalWorkExperience: myProfile.totalWorkExperience || "",
      accountNumber: myProfile.accountNumber || "",
      bankName: myProfile.bankName || "",
      ifscCode: myProfile.ifscCode || "",
      panNumber: myProfile.panNumber || "",
      aadharNumber: myProfile.aadharNumber || "",
      dateOfLastPromotion: myProfile.dateOfLastPromotion ? new Date(myProfile.dateOfLastPromotion).toISOString().split("T")[0] : ""
    });
    setPhotoPreview(myProfile.employeePhoto || null);
    setAadhaarPreview(myProfile.aadhaarCardPhoto || null);
    setEditMode(true);
    setShowCreateForm(true);
    setCurrentStep(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;
    setSubmitting(true);

    if (editMode) {
      // Update existing profile
      try {
        await axios.put(`${apiUrl}/employee/employee-update/${userSession.user_id}`, formData, {
          headers: { authorization: userSession?.token || "" }
        });
        setShowCreateForm(false);
        setEditMode(false);
        fetchMyProfile();
      } catch (err) {
        console.error("Error updating profile:", err);
        setErrors({ submit: err?.response?.data?.error || err?.response?.data?.message || "Failed to update profile." });
      } finally {
        setSubmitting(false);
      }
    } else {
      // Create new profile
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => { if (value) data.append(key, value); });
      data.append("employeePhoto", photo);
      data.append("aadhaarCardPhoto", aadhaar);
      try {
        await axios.post(`${apiUrl}/employee/profile`, data, {
          headers: { authorization: userSession?.token || "", "Content-Type": "multipart/form-data" }
        });
        setShowCreateForm(false);
        fetchMyProfile();
      } catch (err) {
        console.error("Error creating profile:", err);
        setErrors({ submit: err?.response?.data?.error || "Failed to create profile." });
      } finally {
        setSubmitting(false);
      }
    }
  };

  const steps = [
    { title: "Personal", icon: PersonOutlineIcon }, { title: "Contact", icon: PhoneIcon },
    { title: "Address", icon: LocationOnIcon }, { title: "Emergency", icon: FavoriteIcon },
    { title: "Professional", icon: WorkIcon }, { title: "Education", icon: SchoolIcon },
    { title: "Bank", icon: AttachMoneyIcon }, { title: "Documents", icon: CloudUploadIcon }
  ];

  // ─── RENDER HELPERS ──────────────────
  const renderProfileCard = (profile, actions) => (
    <Card key={profile._id} sx={{ borderRadius: 3, boxShadow: "0 4px 16px rgba(0,0,0,0.06)", mb: 2, border: "1px solid", borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Avatar src={profile.employeePhoto} sx={{ width: 56, height: 56, bgcolor: "#a855f7" }}>
              {profile.employeeFullName?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{profile.employeeFullName}</Typography>
              <Typography variant="body2" color="text.secondary">{profile.designation} • {profile.department}</Typography>
              <Typography variant="caption" color="text.secondary">Branch: {profile.branch} {profile.employeeId ? `• ID: ${profile.employeeId}` : ""}</Typography>
            </Box>
          </Box>
          <Chip label={profile.profileCompletionStatus?.replace("_", " ") || "pending"} color={STATUS_COLORS[profile.profileCompletionStatus] || "default"} size="small" sx={{ textTransform: "capitalize", fontWeight: 600 }} />
        </Box>

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Phone</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.personalContactNumber}</Typography></Grid>
          <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Email</Typography><Typography variant="body2" sx={{ fontWeight: 600, wordBreak: "break-all" }}>{profile.personalEmailAddress}</Typography></Grid>
          <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Joining</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.dateOfJoining ? new Date(profile.dateOfJoining).toLocaleDateString("en-IN") : "-"}</Typography></Grid>
          <Grid item xs={6} md={3}><Typography variant="caption" color="text.secondary">Manager</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{profile.reportingManager || "-"}</Typography></Grid>
        </Grid>

        {profile.rejectionRemark && (
          <Alert severity="error" sx={{ mb: 2 }}>Rejection Remark: {profile.rejectionRemark}</Alert>
        )}

        {actions && <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>{actions}</Box>}
      </CardContent>
    </Card>
  );

  const renderCreateForm = () => (
    <div className={`create-profile-container ${mode === "dark" ? "dark-mode" : ""}`}>
      <div className="create-profile-wrapper">
        <div className="profile-header">
          <div className="header-content">
            <BadgeIcon sx={{ fontSize: 32, color: "#a855f7" }} />
            <h1 className="header-title">Employee Profile</h1>
            <p className="header-description">Complete your comprehensive employee profile</p>
          </div>
        </div>

        <div className="stepper">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className={`step ${index === currentStep ? "active" : ""} ${index < currentStep ? "completed" : ""}`}>
                <div className="step-indicator"><Icon sx={{ fontSize: 20 }} /></div>
                <span className="step-label">{step.title}</span>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          {renderStepContent()}
          <div className="form-navigation">
            {currentStep > 0 && <button type="button" onClick={prevStep} className="nav-button prev-button">Previous</button>}
            <div className="nav-spacer" />
            {editMode && <button type="button" onClick={() => { setShowCreateForm(false); setEditMode(false); }} className="nav-button prev-button" style={{ marginRight: 8 }}>Cancel</button>}
            {currentStep < steps.length - 1 ? (
              <button type="button" onClick={nextStep} className="nav-button next-button">Next</button>
            ) : (
              <button type="submit" disabled={submitting} className={`nav-button submit-button ${submitting ? "loading" : ""}`}>
                {submitting ? (<><HourglassEmptyIcon className="button-spinner" />{editMode ? "Updating..." : "Creating..."}</>) : (<><CheckCircleIcon className="button-icon" />{editMode ? "Update Profile" : "Create Profile"}</>)}
              </button>
            )}
          </div>
          {errors.submit && <div className="submit-error"><ErrorOutlineIcon className="error-icon" /><span>{errors.submit}</span></div>}
        </form>
      </div>
    </div>
  );

  const renderStepContent = () => {
    const inputProps = (name, label, type = "text", required = true) => ({
      name, label: `${label}${required ? " *" : ""}`, type, value: formData[name], onChange: handleChange,
      error: !!errors[name], helperText: errors[name], fullWidth: true, size: "small", variant: "outlined"
    });
    const selectProps = (name, label, options) => (
      <FormControl fullWidth size="small" error={!!errors[name]}>
        <InputLabel>{label} *</InputLabel>
        <Select name={name} value={formData[name]} label={`${label} *`} onChange={handleChange}>
          {options.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </Select>
        {errors[name] && <Typography variant="caption" color="error">{errors[name]}</Typography>}
      </FormControl>
    );

    switch (currentStep) {
      case 0: return (
        <Box><Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Personal Information</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}><TextField {...inputProps("employeeFullName", "Full Name")} /></Grid>
            <Grid item xs={12} md={6}><TextField {...inputProps("designation", "Designation")} /></Grid>
            <Grid item xs={12} md={6}>{selectProps("department", "Department", departments)}</Grid>
            <Grid item xs={12} md={6}>{selectProps("branch", "Branch", companyBranches)}</Grid>
            <Grid item xs={12} md={4}>{selectProps("gender", "Gender", ["Male", "Female", "Other"])}</Grid>
            <Grid item xs={12} md={4}>{selectProps("maritalStatus", "Marital Status", maritalStatuses)}</Grid>
            <Grid item xs={12} md={4}><TextField {...inputProps("dateOfBirth", "Date of Birth", "date")} InputLabelProps={{ shrink: true }} /></Grid>
          </Grid>
        </Box>
      );
      case 1: return (
        <Box><Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Contact Information</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}><TextField {...inputProps("personalContactNumber", "Personal Contact")} /></Grid>
            <Grid item xs={12} md={6}><TextField {...inputProps("personalEmailAddress", "Personal Email", "email")} /></Grid>
            <Grid item xs={12} md={6}><TextField {...inputProps("workEmail", "Work Email", "email")} /></Grid>
            <Grid item xs={12} md={6}><TextField {...inputProps("workPhoneNumber", "Work Phone")} /></Grid>
          </Grid>
        </Box>
      );
      case 2: return (
        <Box><Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Address Information</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}><TextField {...inputProps("permanentAddress", "Permanent Address")} multiline rows={3} /></Grid>
            <Grid item xs={12}><TextField {...inputProps("currentAddress", "Current Address")} multiline rows={3} /></Grid>
          </Grid>
        </Box>
      );
      case 3: return (
        <Box><Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Emergency Contact</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}><TextField {...inputProps("emergencyContactName", "Contact Name")} /></Grid>
            <Grid item xs={12} md={4}><TextField {...inputProps("emergencyContactNumber", "Contact Number")} /></Grid>
            <Grid item xs={12} md={4}>{selectProps("emergencyContactRelationship", "Relationship", relationships)}</Grid>
          </Grid>
        </Box>
      );
      case 4: return (
        <Box><Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Professional Information</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}><TextField {...inputProps("dateOfJoining", "Date of Joining", "date")} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} md={6}><TextField {...inputProps("reportingManager", "Reporting Manager")} /></Grid>
            {isAuthority && <Grid item xs={12} md={6}><TextField {...inputProps("offeredSalary", "Offered Salary", "text", false)} /></Grid>}
            <Grid item xs={12} md={6}><TextField {...inputProps("dateOfLastPromotion", "Last Promotion", "date", false)} InputLabelProps={{ shrink: true }} /></Grid>
          </Grid>
        </Box>
      );
      case 5: return (
        <Box><Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Education & Experience</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}><TextField {...inputProps("educationQualification", "Education Qualification")} multiline rows={2} /></Grid>
            <Grid item xs={12} md={6}><TextField {...inputProps("previousEmployer", "Previous Employer", "text", false)} /></Grid>
            <Grid item xs={12} md={6}><TextField {...inputProps("totalWorkExperience", "Total Work Experience")} /></Grid>
          </Grid>
        </Box>
      );
      case 6: return (
        <Box><Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Bank Details</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}><TextField {...inputProps("accountNumber", "Account Number")} /></Grid>
            <Grid item xs={12} md={6}><TextField {...inputProps("bankName", "Bank Name")} /></Grid>
            <Grid item xs={12} md={4}><TextField {...inputProps("ifscCode", "IFSC Code")} /></Grid>
            <Grid item xs={12} md={4}><TextField {...inputProps("panNumber", "PAN Number")} /></Grid>
            <Grid item xs={12} md={4}><TextField {...inputProps("aadharNumber", "Aadhar Number")} /></Grid>
          </Grid>
        </Box>
      );
      case 7: return (
        <Box><Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Document Upload</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 2, border: "2px dashed", borderColor: errors.photo ? "error.main" : "divider", textAlign: "center", cursor: "pointer", position: "relative" }}>
                <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, "photo")} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
                {photoPreview ? <img src={photoPreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8 }} /> : <><CameraAltIcon sx={{ fontSize: 40, color: "#a855f7" }} /><Typography variant="body2" sx={{ mt: 1 }}>Employee Photo *</Typography></>}
              </Paper>
              {errors.photo && <Typography variant="caption" color="error">{errors.photo}</Typography>}
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 2, border: "2px dashed", borderColor: errors.aadhaar ? "error.main" : "divider", textAlign: "center", cursor: "pointer", position: "relative" }}>
                <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, "aadhaar")} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
                {aadhaarPreview ? <img src={aadhaarPreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8 }} /> : <><CreditCardIcon sx={{ fontSize: 40, color: "#a855f7" }} /><Typography variant="body2" sx={{ mt: 1 }}>Aadhaar Card *</Typography></>}
              </Paper>
              {errors.aadhaar && <Typography variant="caption" color="error">{errors.aadhaar}</Typography>}
            </Grid>
          </Grid>
        </Box>
      );
      default: return null;
    }
  };

  // ─── LOADING ──────────────────
  if (loading) return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress sx={{ color: "#a855f7" }} /></Box>
  );

  // ─── MAIN RENDER ──────────────────
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Employee Profile</Typography>
          <Typography variant="body2" color="text.secondary">{isAuthority ? "Manage employee profiles and approvals" : "View and manage your profile"}</Typography>
        </Box>
      </Box>

      {isAuthority ? (
        <>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3, "& .MuiTab-root": { fontWeight: 600, textTransform: "none" }, "& .Mui-selected": { color: "#a855f7" }, "& .MuiTabs-indicator": { bgcolor: "#a855f7" } }}>
            <Tab label={`Pending Approvals (${pendingProfiles.length})`} icon={<BadgeIcon />} iconPosition="start" />
            <Tab label={`All Employees (${allEmployees.length})`} icon={<PersonIcon />} iconPosition="start" />
            <Tab label="My Profile" icon={<PersonIcon />} iconPosition="start" />
          </Tabs>

          {/* Tab 0: Pending Approvals */}
          {activeTab === 0 && (
            <Box>
              {pendingProfiles.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
                  <CheckCircleIcon sx={{ fontSize: 48, color: "success.main", mb: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>All Caught Up!</Typography>
                  <Typography variant="body2" color="text.secondary">No pending profile approvals at the moment.</Typography>
                </Paper>
              ) : (
                pendingProfiles.map(p => renderProfileCard(p, <>
                  <Tooltip title="View Full Profile"><IconButton color="primary" onClick={() => { setViewProfile(p); fetchAdditionalDetails(p.userId); }}><VisibilityIcon /></IconButton></Tooltip>
                  <Button size="small" variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => handleApprove(p.userId)}>Approve</Button>
                  <Button size="small" variant="outlined" color="error" startIcon={<CancelIcon />} onClick={() => setRejectDialog({ open: true, userId: p.userId, remark: "" })}>Reject</Button>
                </>))
              )}
            </Box>
          )}

          {/* Tab 1: All Employees */}
          {activeTab === 1 && (
            <Box>
              <TextField fullWidth size="small" placeholder="Search employees..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") fetchAll(); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                sx={{ mb: 3 }}
              />
              {allEmployees.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
                  <Typography variant="body2" color="text.secondary">No employee profiles found.</Typography>
                </Paper>
              ) : (
                allEmployees.map(p => renderProfileCard(p, <>
                  <Tooltip title="View Profile"><IconButton color="primary" onClick={() => { setViewProfile(p); fetchAdditionalDetails(p.userId); }}><VisibilityIcon /></IconButton></Tooltip>
                  <Tooltip title="Add Documents"><IconButton color="secondary" onClick={() => setAddDetailsDialog({ open: true, userId: p.userId })}><UploadFileIcon /></IconButton></Tooltip>
                  <Tooltip title="Compensation/Incentives"><IconButton sx={{ color: "#10b981" }} onClick={() => handleOpenComp(p.userId)}><AttachMoneyIcon /></IconButton></Tooltip>
                  {p.profileCompletionStatus === "pending_review" && <Button size="small" variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => handleApprove(p.userId)}>Approve</Button>}
                  <Tooltip title="Deactivate"><IconButton color="error" onClick={() => handleDeleteProfile(p.userId)}><DeleteIcon /></IconButton></Tooltip>
                </>))
              )}
            </Box>
          )}

          {/* Tab 2: My Profile */}
          {activeTab === 2 && renderMyProfileSection()}
        </>
      ) : (
        renderMyProfileSection()
      )}

      {/* ─── VIEW PROFILE DIALOG ────────── */}
      <Dialog open={!!viewProfile} onClose={() => setViewProfile(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{viewProfile?.employeeFullName}'s Full Profile</DialogTitle>
        <DialogContent dividers>
          {viewProfile && (
            <Grid container spacing={2}>
              {[
                ["Employee ID", viewProfile.employeeId], ["Designation", viewProfile.designation],
                ["Department", viewProfile.department], ["Branch", viewProfile.branch],
                ["Gender", viewProfile.gender], ["Marital Status", viewProfile.maritalStatus],
                ["Date of Birth", viewProfile.dateOfBirth ? new Date(viewProfile.dateOfBirth).toLocaleDateString("en-IN") : "-"],
                ["Personal Phone", viewProfile.personalContactNumber], ["Personal Email", viewProfile.personalEmailAddress],
                ["Work Email", viewProfile.workEmail], ["Work Phone", viewProfile.workPhoneNumber],
                ["Permanent Address", viewProfile.permanentAddress], ["Current Address", viewProfile.currentAddress],
                ["Emergency Contact", `${viewProfile.emergencyContactName} (${viewProfile.emergencyContactRelationship}) - ${viewProfile.emergencyContactNumber}`],
                ["Date of Joining", viewProfile.dateOfJoining ? new Date(viewProfile.dateOfJoining).toLocaleDateString("en-IN") : "-"],
                ["Reporting Manager", viewProfile.reportingManager],
                ["Education", viewProfile.educationQualification],
                ["Previous Employer", viewProfile.previousEmployer || "-"],
                ["Experience", viewProfile.totalWorkExperience],
                ["Bank", `${viewProfile.bankName} - ${viewProfile.accountNumber}`],
                ["IFSC", viewProfile.ifscCode], ["PAN", viewProfile.panNumber], ["Aadhar", viewProfile.aadharNumber],
              ].map(([label, value], i) => (
                <Grid item xs={12} md={6} key={i}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{value || "-"}</Typography>
                </Grid>
              ))}
              {viewProfile.employeePhoto && (
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">Employee Photo</Typography><br/><img src={viewProfile.employeePhoto} alt="Photo" style={{ maxHeight: 120, borderRadius: 8 }} /></Grid>
              )}
              {viewProfile.aadhaarCardPhoto && (
                <Grid item xs={12} md={6}><Typography variant="caption" color="text.secondary">Aadhaar Card</Typography><br/><img src={viewProfile.aadhaarCardPhoto} alt="Aadhaar" style={{ maxHeight: 120, borderRadius: 8 }} /></Grid>
              )}

              {additionalDetails.length > 0 && (
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Additional Documents</Typography>
                  <Stack spacing={1}>
                    {additionalDetails.map((d, i) => (
                      <Paper key={i} sx={{ p: 2, borderRadius: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <InsertDriveFileIcon color="primary" />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.title}</Typography>
                            <Typography variant="caption" color="text.secondary">{DOC_TYPE_LABELS[d.docType] || d.docType} • {new Date(d.addedAt).toLocaleDateString("en-IN")}</Typography>
                          </Box>
                          <Button size="small" href={d.fileUrl} target="_blank">View</Button>
                        </Box>
                        {d.notes && <Typography variant="caption" color="text.secondary" sx={{ ml: 4.5 }}>{d.notes}</Typography>}
                      </Paper>
                    ))}
                  </Stack>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewProfile(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ─── REJECT DIALOG ────────── */}
      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ open: false, userId: null, remark: "" })}>
        <DialogTitle sx={{ fontWeight: 700 }}>Reject Profile</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Please provide a reason for rejecting this profile.</Typography>
          <TextField fullWidth multiline rows={3} value={rejectDialog.remark} onChange={(e) => setRejectDialog({ ...rejectDialog, remark: e.target.value })} placeholder="Enter rejection remark..." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog({ open: false, userId: null, remark: "" })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleReject} disabled={!rejectDialog.remark.trim()}>Reject</Button>
        </DialogActions>
      </Dialog>

      {/* ─── ADD DETAILS DIALOG ────────── */}
      <Dialog open={addDetailsDialog.open} onClose={() => setAddDetailsDialog({ open: false, userId: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Document / Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Document Type *</InputLabel>
              <Select value={detailForm.docType} label="Document Type *" onChange={(e) => setDetailForm({ ...detailForm, docType: e.target.value })}>
                {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth size="small" label="Title *" value={detailForm.title} onChange={(e) => setDetailForm({ ...detailForm, title: e.target.value })} />
            <TextField fullWidth size="small" label="Notes (optional)" multiline rows={2} value={detailForm.notes} onChange={(e) => setDetailForm({ ...detailForm, notes: e.target.value })} />
            <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={uploadingDoc}>
              {detailFile ? detailFile.name : "Upload File *"}
              <input type="file" hidden onChange={(e) => setDetailFile(e.target.files[0])} />
            </Button>
            {uploadDocError && <Alert severity="error">{uploadDocError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDetailsDialog({ open: false, userId: null })} disabled={uploadingDoc}>Cancel</Button>
          <Button variant="contained" onClick={handleAddDetails} disabled={!detailFile || !detailForm.docType || !detailForm.title || uploadingDoc}>
            {uploadingDoc ? <CircularProgress size={24} color="inherit" /> : "Upload"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── ADD COMPENSATION DIALOG ────────── */}
      <Dialog open={addCompDialog.open} onClose={() => setAddCompDialog({ open: false, userId: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Update Compensation & Incentives</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth size="small" label="CTC (Annual)" value={compForm.ctc} onChange={(e) => setCompForm({ ...compForm, ctc: e.target.value })} />
            <TextField fullWidth size="small" label="Basic Salary" value={compForm.basicSalary} onChange={(e) => setCompForm({ ...compForm, basicSalary: e.target.value })} />
            <TextField fullWidth size="small" label="HRA" value={compForm.hra} onChange={(e) => setCompForm({ ...compForm, hra: e.target.value })} />
            <TextField fullWidth size="small" label="Incentives / Variable" value={compForm.incentives} onChange={(e) => setCompForm({ ...compForm, incentives: e.target.value })} />
            <TextField fullWidth size="small" label="Other Allowances" value={compForm.otherAllowances} onChange={(e) => setCompForm({ ...compForm, otherAllowances: e.target.value })} />
            <TextField fullWidth size="small" label="Notes" multiline rows={3} value={compForm.notes} onChange={(e) => setCompForm({ ...compForm, notes: e.target.value })} />
            {uploadDocError && <Alert severity="error">{uploadDocError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCompDialog({ open: false, userId: null })} disabled={uploadingDoc}>Cancel</Button>
          <Button variant="contained" onClick={handleAddCompensation} disabled={uploadingDoc}>
            {uploadingDoc ? <CircularProgress size={24} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  // ─── MY PROFILE SECTION (reused by both authority + regular) ──────────
  function renderMyProfileSection() {
    if (showCreateForm || !myProfile) {
      if (!myProfile && !showCreateForm) {
        return (
          <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
            <PersonIcon sx={{ fontSize: 64, color: "#a855f7", mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>No Profile Yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Create your employee profile to get started.</Typography>
            <Button variant="contained" sx={{ bgcolor: "#a855f7", "&:hover": { bgcolor: "#9333ea" } }} startIcon={<AddIcon />} onClick={() => setShowCreateForm(true)}>Create My Profile</Button>
          </Paper>
        );
      }
      return renderCreateForm();
    }

    return (
      <Box>
        {renderProfileCard(myProfile, <>
          <Tooltip title="View Full Details"><IconButton color="primary" onClick={() => { setViewProfile(myProfile); fetchAdditionalDetails(myProfile.userId); }}><VisibilityIcon /></IconButton></Tooltip>
          <Tooltip title="Edit Profile"><IconButton color="secondary" onClick={handleEditProfile}><EditIcon /></IconButton></Tooltip>
        </>)}

        {myProfile.profileCompletionStatus === "rejected" && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Your profile was rejected. Reason: <strong>{myProfile.rejectionRemark}</strong>. Please update your profile and resubmit.
          </Alert>
        )}

        {myProfile.profileCompletionStatus === "pending_review" && (
          <Alert severity="warning" sx={{ mb: 2 }}>Your profile is pending review by an authority.</Alert>
        )}

        {myProfile.profileCompletionStatus === "approved" && (
          <Alert severity="success" sx={{ mb: 2 }}>Your profile has been approved!</Alert>
        )}

        {/* Additional Details (read-only for employees) */}
        <AdditionalDetailsReadOnly apiUrl={apiUrl} userSession={userSession} userId={myProfile.userId} isAuthority={isAuthority} />
      </Box>
    );
  }
};

// ─── ADDITIONAL DETAILS READ-ONLY COMPONENT ──────────────────────────
const DOC_TYPE_LABELS_SUB = {
  offer_letter: "Offer Letter",
  promotion_letter: "Promotion Letter",
  marksheet: "Marksheet",
  experience_letter: "Experience Letter",
  other: "Other",
};

const AdditionalDetailsReadOnly = ({ apiUrl, userSession, userId, isAuthority }) => {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  const [compDetails, setCompDetails] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${apiUrl}/employee/additional-details/${userId}`, {
          headers: { authorization: userSession.token }
        });
        setDetails(res.data.additionalDetails || []);
        setCompDetails(res.data.compensationDetails || null);
      } catch { setDetails([]); setCompDetails(null); }
      setLoading(false);
    };
    if (userId) fetch();
  }, [apiUrl, userSession, userId]);

  if (loading) return <CircularProgress size={24} sx={{ display: "block", mx: "auto", my: 3 }} />;
  if (loading) return <CircularProgress size={24} sx={{ display: "block", mx: "auto", my: 3 }} />;
  if (details.length === 0 && (!compDetails || !Object.values(compDetails).some(v => !!v))) return null;

  return (
    <Box>
      {compDetails && Object.values(compDetails).some(v => !!v) && (
        <Paper sx={{ p: 3, mt: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <AttachMoneyIcon color="success" /> Compensation & Incentives
          </Typography>
          <Grid container spacing={2}>
            {compDetails.ctc && <Grid item xs={6} md={4}><Typography variant="caption" color="text.secondary">CTC:</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{compDetails.ctc}</Typography></Grid>}
            {compDetails.basicSalary && <Grid item xs={6} md={4}><Typography variant="caption" color="text.secondary">Basic Salary:</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{compDetails.basicSalary}</Typography></Grid>}
            {compDetails.hra && <Grid item xs={6} md={4}><Typography variant="caption" color="text.secondary">HRA:</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{compDetails.hra}</Typography></Grid>}
            {compDetails.incentives && <Grid item xs={6} md={4}><Typography variant="caption" color="text.secondary">Incentives:</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{compDetails.incentives}</Typography></Grid>}
            {compDetails.otherAllowances && <Grid item xs={6} md={4}><Typography variant="caption" color="text.secondary">Other Allowances:</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{compDetails.otherAllowances}</Typography></Grid>}
            {compDetails.notes && <Grid item xs={12}><Typography variant="caption" color="text.secondary">Notes:</Typography><Typography variant="body2">{compDetails.notes}</Typography></Grid>}
          </Grid>
        </Paper>
      )}

      {details.length > 0 && (
        <Paper sx={{ p: 3, mt: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <InsertDriveFileIcon color="primary" /> Documents & Additional Details
          </Typography>
          <Stack spacing={1.5}>
            {details.map((d, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2, display: "flex", alignItems: "center", gap: 2 }}>
                <InsertDriveFileIcon sx={{ color: "#a855f7" }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {DOC_TYPE_LABELS_SUB[d.docType] || d.docType} • Added {new Date(d.addedAt).toLocaleDateString("en-IN")}
                    {d.addedByName && ` by ${d.addedByName}`}
                  </Typography>
                  {d.notes && <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>{d.notes}</Typography>}
                </Box>
                <Button size="small" variant="outlined" href={d.fileUrl} target="_blank">View</Button>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
};