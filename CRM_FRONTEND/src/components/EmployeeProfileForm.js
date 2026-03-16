import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  User,
  Upload,
  Camera,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  UserCheck,
  MapPin,
  Building,
  Briefcase,
  GraduationCap,
  Heart,
  Calendar,
  DollarSign,
  FileText
} from "lucide-react";
import './CreateProfile.css';





export const CreateProfile = ({ apiUrl, userSession }) => {
  const [profileExists, setProfileExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    // Personal Information
    employeeFullName: "",
    designation: "",
    department: "",
    branch: "",
    gender: "",
    maritalStatus: "",
    dateOfBirth: "",

    // Contact Information
    personalContactNumber: "",
    personalEmailAddress: "",
    workEmail: "",
    workPhoneNumber: "",

    // Address Information
    permanentAddress: "",
    currentAddress: "",

    // Emergency Contact
    emergencyContactName: "",
    emergencyContactNumber: "",
    emergencyContactRelationship: "",

    // Professional Information
    dateOfJoining: "",
    offeredSalary: "",
    reportingManager: "",

    // Education & Experience
    educationQualification: "",
    previousEmployer: "",
    totalWorkExperience: "",

    // Bank Details
    accountNumber: "",
    bankName: "",
    ifscCode: "",
    panNumber: "",
    aadharNumber: "",

    // Other
    dateOfLastPromotion: ""
  });
  const [photo, setPhoto] = useState(null);
  const [aadhaar, setAadhaar] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [aadhaarPreview, setAadhaarPreview] = useState(null);
  const [errors, setErrors] = useState({});

  const departments = ["Sales", "Digital", "Admin", "Legal", "Finance"];
  const branches = ["1206", "808", "1512", "Admin", "Digital", "407 AMD", "408 AMD", "906"];
  const maritalStatuses = ["Single", "Married", "Divorced", "Widowed"];
  const relationships = ["Father", "Mother", "Spouse", "Brother", "Sister", "Friend", "Other"];

  const steps = [
    { title: "Personal Info", icon: User },
    { title: "Contact Details", icon: Phone },
    { title: "Address", icon: MapPin },
    { title: "Emergency Contact", icon: Heart },
    { title: "Professional", icon: Briefcase },
    { title: "Education", icon: GraduationCap },
    { title: "Bank Details", icon: DollarSign },
    { title: "Documents", icon: Upload }
  ];

  

  // Check if profile already exists
  useEffect(() => {
    if (userSession?.user_id && userSession?.token) {
      axios
        .get(`${apiUrl}/employee/profile/${userSession.user_id}`, {
          headers: { authorization: userSession.token },
        })
        .then((res) => {
          setProfileExists(!!res.data.profile);
          setLoading(false);
        })
        .catch(() => {
          setProfileExists(false);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [apiUrl, userSession]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, [type]: "File must be less than 5MB" });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors({ ...errors, [type]: "Please select an image file" });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (type === 'photo') {
        setPhotoPreview(result);
        setPhoto(file);
      } else {
        setAadhaarPreview(result);
        setAadhaar(file);
      }
    };
    reader.readAsDataURL(file);

    // Clear error
    if (errors[type]) {
      setErrors({ ...errors, [type]: "" });
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 0: // Personal Info
        if (!formData.employeeFullName.trim()) newErrors.employeeFullName = "Full name is required";
        if (!formData.designation.trim()) newErrors.designation = "Designation is required";
        if (!formData.department) newErrors.department = "Department is required";
        if (!formData.branch) newErrors.branch = "Branch is required";
        if (!formData.gender) newErrors.gender = "Gender is required";
        if (!formData.maritalStatus) newErrors.maritalStatus = "Marital status is required";
        if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
        break;

      case 1: // Contact Details
        if (!formData.personalContactNumber.trim()) newErrors.personalContactNumber = "Personal contact is required";
        if (!formData.personalEmailAddress.trim()) newErrors.personalEmailAddress = "Personal email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personalEmailAddress)) {
          newErrors.personalEmailAddress = "Invalid email format";
        }
        if (!formData.workEmail.trim()) newErrors.workEmail = "Work email is required";
        if (!formData.workPhoneNumber.trim()) newErrors.workPhoneNumber = "Work phone is required";
        break;

      case 2: // Address
        if (!formData.permanentAddress.trim()) newErrors.permanentAddress = "Permanent address is required";
        if (!formData.currentAddress.trim()) newErrors.currentAddress = "Current address is required";
        break;

      case 3: // Emergency Contact
        if (!formData.emergencyContactName.trim()) newErrors.emergencyContactName = "Emergency contact name is required";
        if (!formData.emergencyContactNumber.trim()) newErrors.emergencyContactNumber = "Emergency contact number is required";
        if (!formData.emergencyContactRelationship) newErrors.emergencyContactRelationship = "Relationship is required";
        break;

      case 4: // Professional
        if (!formData.dateOfJoining) newErrors.dateOfJoining = "Date of joining is required";
        if (!formData.reportingManager.trim()) newErrors.reportingManager = "Reporting manager is required";
        if (!formData.offeredSalary) newErrors.offeredSalary = "Offered Salary is required";
        break;

      case 5: // Education
        if (!formData.educationQualification.trim()) newErrors.educationQualification = "Education qualification is required";
        if (!formData.totalWorkExperience.trim()) newErrors.totalWorkExperience = "Work experience is required";
        break;

      case 6: // Bank Details
        if (!formData.accountNumber.trim()) newErrors.accountNumber = "Account number is required";
        if (!formData.bankName.trim()) newErrors.bankName = "Bank name is required";
        if (!formData.ifscCode.trim()) newErrors.ifscCode = "IFSC code is required";
        if (!formData.panNumber.trim()) newErrors.panNumber = "PAN number is required";
        if (!formData.aadharNumber.trim()) newErrors.aadharNumber = "Aadhar number is required";
        break;

      case 7: // Documents
        if (!photo) newErrors.photo = "Employee photo is required";
        if (!aadhaar) newErrors.aadhaar = "Aadhaar card photo is required";
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep(currentStep)) {
      return;
    }

    setSubmitting(true);

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => data.append(key, value));
    data.append("employeePhoto", photo);
    data.append("aadhaarCardPhoto", aadhaar);

    try {
      const response = await axios.post(`${apiUrl}/employee/profile`, data, {
        headers: {
          authorization: userSession?.token || "",
          "Content-Type": "multipart/form-data",
        },
      });

      setProfileExists(true);
    } catch (err) {
      console.error("Error creating profile:", err);
      setErrors({
        submit: err?.response?.data?.error || "Failed to create profile. Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-card">
          <Loader2 className="loading-spinner" />
          <p className="loading-text">Checking profile status...</p>
        </div>
      </div>
    );
  }

  if (profileExists) {
    return (
      <div className="success-container">
        <div className="success-card">
          <CheckCircle className="success-icon" />
          <h2 className="success-title">Profile Exists</h2>
          <p className="success-text">Your profile has already been created successfully.</p>
           <button
            className="success-button"
          >
            Refresh Your CRM
          </button>
        </div>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="step-content">
            <h3 className="step-title">
              <User className="step-icon" />
              Personal Information
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  name="employeeFullName"
                  value={formData.employeeFullName}
                  onChange={handleChange}
                  className={`form-input ${errors.employeeFullName ? 'error' : ''}`}
                  placeholder="Enter your full name"
                />
                {errors.employeeFullName && <span className="error-message">{errors.employeeFullName}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Designation *</label>
                <input
                  type="text"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  className={`form-input ${errors.designation ? 'error' : ''}`}
                  placeholder="Enter your designation"
                />
                {errors.designation && <span className="error-message">{errors.designation}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Department *</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className={`form-select ${errors.department ? 'error' : ''}`}
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {errors.department && <span className="error-message">{errors.department}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Branch *</label>
                <select
                  name="branch"
                  value={formData.branch}
                  onChange={handleChange}
                  className={`form-select ${errors.branch ? 'error' : ''}`}
                >
                  <option value="">Select Branch</option>
                  {branches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
                {errors.branch && <span className="error-message">{errors.branch}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className={`form-select ${errors.gender ? 'error' : ''}`}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.gender && <span className="error-message">{errors.gender}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Marital Status *</label>
                <select
                  name="maritalStatus"
                  value={formData.maritalStatus}
                  onChange={handleChange}
                  className={`form-select ${errors.maritalStatus ? 'error' : ''}`}
                >
                  <option value="">Select Marital Status</option>
                  {maritalStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                {errors.maritalStatus && <span className="error-message">{errors.maritalStatus}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth *</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className={`form-input ${errors.dateOfBirth ? 'error' : ''}`}
                />
                {errors.dateOfBirth && <span className="error-message">{errors.dateOfBirth}</span>}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="step-content">
            <h3 className="step-title">
              <Phone className="step-icon" />
              Contact Information
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Personal Contact Number *</label>
                <input
                  type="tel"
                  name="personalContactNumber"
                  value={formData.personalContactNumber}
                  onChange={handleChange}
                  className={`form-input ${errors.personalContactNumber ? 'error' : ''}`}
                  placeholder="Enter personal phone number"
                />
                {errors.personalContactNumber && <span className="error-message">{errors.personalContactNumber}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Personal Email Address *</label>
                <input
                  type="email"
                  name="personalEmailAddress"
                  value={formData.personalEmailAddress}
                  onChange={handleChange}
                  className={`form-input ${errors.personalEmailAddress ? 'error' : ''}`}
                  placeholder="Enter personal email"
                />
                {errors.personalEmailAddress && <span className="error-message">{errors.personalEmailAddress}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Work Email *</label>
                <input
                  type="email"
                  name="workEmail"
                  value={formData.workEmail}
                  onChange={handleChange}
                  className={`form-input ${errors.workEmail ? 'error' : ''}`}
                  placeholder="Enter work email"
                />
                {errors.workEmail && <span className="error-message">{errors.workEmail}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Work Phone Number *</label>
                <input
                  type="tel"
                  name="workPhoneNumber"
                  value={formData.workPhoneNumber}
                  onChange={handleChange}
                  className={`form-input ${errors.workPhoneNumber ? 'error' : ''}`}
                  placeholder="Enter work phone number"
                />
                {errors.workPhoneNumber && <span className="error-message">{errors.workPhoneNumber}</span>}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h3 className="step-title">
              <MapPin className="step-icon" />
              Address Information
            </h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Permanent Address *</label>
                <textarea
                  name="permanentAddress"
                  value={formData.permanentAddress}
                  onChange={handleChange}
                  className={`form-textarea ${errors.permanentAddress ? 'error' : ''}`}
                  placeholder="Enter permanent address"
                  rows="4"
                />
                {errors.permanentAddress && <span className="error-message">{errors.permanentAddress}</span>}
              </div>

              <div className="form-group full-width">
                <label className="form-label">Current Address *</label>
                <textarea
                  name="currentAddress"
                  value={formData.currentAddress}
                  onChange={handleChange}
                  className={`form-textarea ${errors.currentAddress ? 'error' : ''}`}
                  placeholder="Enter current address"
                  rows="4"
                />
                {errors.currentAddress && <span className="error-message">{errors.currentAddress}</span>}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <h3 className="step-title">
              <Heart className="step-icon" />
              Emergency Contact
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Emergency Contact Name *</label>
                <input
                  type="text"
                  name="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={handleChange}
                  className={`form-input ${errors.emergencyContactName ? 'error' : ''}`}
                  placeholder="Enter emergency contact name"
                />
                {errors.emergencyContactName && <span className="error-message">{errors.emergencyContactName}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Emergency Contact Number *</label>
                <input
                  type="tel"
                  name="emergencyContactNumber"
                  value={formData.emergencyContactNumber}
                  onChange={handleChange}
                  className={`form-input ${errors.emergencyContactNumber ? 'error' : ''}`}
                  placeholder="Enter emergency contact number"
                />
                {errors.emergencyContactNumber && <span className="error-message">{errors.emergencyContactNumber}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Relationship *</label>
                <select
                  name="emergencyContactRelationship"
                  value={formData.emergencyContactRelationship}
                  onChange={handleChange}
                  className={`form-select ${errors.emergencyContactRelationship ? 'error' : ''}`}
                >
                  <option value="">Select Relationship</option>
                  {relationships.map(relation => (
                    <option key={relation} value={relation}>{relation}</option>
                  ))}
                </select>
                {errors.emergencyContactRelationship && <span className="error-message">{errors.emergencyContactRelationship}</span>}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <h3 className="step-title">
              <Briefcase className="step-icon" />
              Professional Information
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Date of Joining *</label>
                <input
                  type="date"
                  name="dateOfJoining"
                  value={formData.dateOfJoining}
                  onChange={handleChange}
                  className={`form-input ${errors.dateOfJoining ? 'error' : ''}`}
                />
                {errors.dateOfJoining && <span className="error-message">{errors.dateOfJoining}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Reporting Manager *</label>
                <input
                  type="text"
                  name="reportingManager"
                  value={formData.reportingManager}
                  onChange={handleChange}
                  className={`form-input ${errors.reportingManager ? 'error' : ''}`}
                  placeholder="Enter reporting manager name"
                />
                {errors.reportingManager && <span className="error-message">{errors.reportingManager}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Offered Salary *</label>
                <input
                  type="text"
                  name="offeredSalary"
                  value={formData.offeredSalary}
                  onChange={handleChange}
                  className={`form-input ${errors.offeredSalary ? 'error' : ''}`}
                  placeholder="e.g., ₹30,000 per month"
                />
                {errors.offeredSalary && <span className="error-message">{errors.offeredSalary}</span>}
              </div>


              <div className="form-group">
                <label className="form-label">Date of Last Promotion</label>
                <input
                  type="date"
                  name="dateOfLastPromotion"
                  value={formData.dateOfLastPromotion}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="step-content">
            <h3 className="step-title">
              <GraduationCap className="step-icon" />
              Education & Experience
            </h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">Education Qualification *</label>
                <textarea
                  name="educationQualification"
                  value={formData.educationQualification}
                  onChange={handleChange}
                  className={`form-textarea ${errors.educationQualification ? 'error' : ''}`}
                  placeholder="Enter your education qualifications"
                  rows="3"
                />
                {errors.educationQualification && <span className="error-message">{errors.educationQualification}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Previous Employer</label>
                <input
                  type="text"
                  name="previousEmployer"
                  value={formData.previousEmployer}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter previous employer name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Total Work Experience *</label>
                <input
                  type="text"
                  name="totalWorkExperience"
                  value={formData.totalWorkExperience}
                  onChange={handleChange}
                  className={`form-input ${errors.totalWorkExperience ? 'error' : ''}`}
                  placeholder="e.g., 5 years 3 months"
                />
                {errors.totalWorkExperience && <span className="error-message">{errors.totalWorkExperience}</span>}
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="step-content">
            <h3 className="step-title">
              <DollarSign className="step-icon" />
              Bank Details
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Account Number *</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleChange}
                  className={`form-input ${errors.accountNumber ? 'error' : ''}`}
                  placeholder="Enter account number"
                />
                {errors.accountNumber && <span className="error-message">{errors.accountNumber}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Bank Name *</label>
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  className={`form-input ${errors.bankName ? 'error' : ''}`}
                  placeholder="Enter bank name"
                />
                {errors.bankName && <span className="error-message">{errors.bankName}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">IFSC Code *</label>
                <input
                  type="text"
                  name="ifscCode"
                  value={formData.ifscCode}
                  onChange={handleChange}
                  className={`form-input ${errors.ifscCode ? 'error' : ''}`}
                  placeholder="Enter IFSC code"
                />
                {errors.ifscCode && <span className="error-message">{errors.ifscCode}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">PAN Number *</label>
                <input
                  type="text"
                  name="panNumber"
                  value={formData.panNumber}
                  onChange={handleChange}
                  className={`form-input ${errors.panNumber ? 'error' : ''}`}
                  placeholder="Enter PAN number"
                />
                {errors.panNumber && <span className="error-message">{errors.panNumber}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Aadhar Number *</label>
                <input
                  type="text"
                  name="aadharNumber"
                  value={formData.aadharNumber}
                  onChange={handleChange}
                  className={`form-input ${errors.aadharNumber ? 'error' : ''}`}
                  placeholder="Enter Aadhar number"
                />
                {errors.aadharNumber && <span className="error-message">{errors.aadharNumber}</span>}
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="step-content">
            <h3 className="step-title">
              <Upload className="step-icon" />
              Document Upload
            </h3>
            <div className="upload-grid">
              <div className="upload-group">
                <label className="upload-label">
                  <Camera className="label-icon" />
                  Employee Photo * (Max 5MB)
                </label>
                <div className={`upload-area ${errors.photo ? 'error' : ''}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'photo')}
                    className="upload-input"
                  />
                  {photoPreview ? (
                    <div className="upload-preview">
                      <img
                        src={photoPreview}
                        alt="Employee preview"
                        className="preview-image"
                      />
                      <p className="preview-text">Click to change photo</p>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <Camera className="upload-icon" />
                      <div>
                        <p className="upload-title">Upload Employee Photo</p>
                        <p className="upload-subtitle">PNG, JPG up to 5MB</p>
                      </div>
                    </div>
                  )}
                </div>
                {errors.photo && <span className="error-message">{errors.photo}</span>}
              </div>

              <div className="upload-group">
                <label className="upload-label">
                  <CreditCard className="label-icon" />
                  Aadhaar Card Photo * (Max 5MB)
                </label>
                <div className={`upload-area ${errors.aadhaar ? 'error' : ''}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'aadhaar')}
                    className="upload-input"
                  />
                  {aadhaarPreview ? (
                    <div className="upload-preview">
                      <img
                        src={aadhaarPreview}
                        alt="Aadhaar preview"
                        className="preview-image"
                      />
                      <p className="preview-text">Click to change photo</p>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <CreditCard className="upload-icon" />
                      <div>
                        <p className="upload-title">Upload Aadhaar Card</p>
                        <p className="upload-subtitle">PNG, JPG up to 5MB</p>
                      </div>
                    </div>
                  )}
                </div>
                {errors.aadhaar && <span className="error-message">{errors.aadhaar}</span>}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="create-profile-container">
      <div className="create-profile-wrapper">
        <div className="profile-header">
          <div className="header-content">
            <UserCheck className="header-icon" />
            <h1 className="header-title">Create Employee Profile</h1>
            <p className="header-description">Complete your comprehensive employee profile</p>
          </div>
        </div>

        <div className="stepper">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className={`step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
              >
                <div className="step-indicator">
                  <Icon size={20} />
                </div>
                <span className="step-label">{step.title}</span>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          {renderStepContent()}

          <div className="form-navigation">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={prevStep}
                className="nav-button prev-button"
              >
                Previous
              </button>
            )}

            <div className="nav-spacer" />

            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={nextStep}
                className="nav-button next-button"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className={`nav-button submit-button ${submitting ? 'loading' : ''}`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="button-spinner" />
                    Creating Profile...
                  </>
                ) : (
                  <>
                    <CheckCircle className="button-icon" />
                    Create Profile
                  </>
                )}
              </button>
            )}
          </div>

          {errors.submit && (
            <div className="submit-error">
              <AlertCircle className="error-icon" />
              <span>{errors.submit}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};