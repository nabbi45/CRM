import React, { useEffect, useState } from "react";
import axios from "axios";
import { 
  User, Mail, Phone, UserCheck, Car as IdCard, ImageIcon, Loader2, AlertCircle,
  MapPin, Building, Briefcase, GraduationCap, Heart, Calendar, DollarSign,
  FileText, Edit3, Download, Copy, Check
} from "lucide-react";
import "./MyProfile.css";

export const MyProfile = ({ apiUrl, userSession }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userSession?.user_id || !userSession?.token) {
        setError("User session not found. Please login again.");
        setLoading(false);
        return;
      }

      if (!apiUrl) {
        setError("API URL not configured.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(
          `${apiUrl}/employee/profile/${userSession.user_id}`,
          {
            headers: {
              'Authorization': userSession.token,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        if (response.data && response.data.profile) {
          setProfile(response.data.profile);
        } else {
          setError("Profile data not found in response.");
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        
        if (err.code === 'ECONNABORTED') {
          setError("Request timeout. Please check your internet connection and try again.");
        } else if (err.response) {
          const status = err.response.status;
          const message = err.response.data?.message || err.response.statusText;
          
          switch (status) {
            case 401:
              setError("Unauthorized access. Please login again.");
              break;
            case 403:
              setError("Access forbidden. You don't have permission to view this profile.");
              break;
            case 404:
              setError("Profile not found. Please contact support.");
              break;
            case 500:
              setError("Server error. Please try again later.");
              break;
            default:
              setError(`Error ${status}: ${message}`);
          }
        } else if (err.request) {
          setError("Network error. Please check your internet connection and try again.");
        } else {
          setError("An unexpected error occurred. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [apiUrl, userSession]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  const copyToClipboard = async (text, fieldName) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const downloadProfile = () => {
    if (!profile) return;
    
    const profileData = `
EMPLOYEE PROFILE INFORMATION
============================

PERSONAL INFORMATION:
Name: ${profile.employeeFullName || 'N/A'}
Employee ID: ${profile.employeeId || 'N/A'}
Designation: ${profile.designation || 'N/A'}
Department: ${profile.department || 'N/A'}
Branch: ${profile.branch || 'N/A'}
Gender: ${profile.gender || 'N/A'}
Marital Status: ${profile.maritalStatus || 'N/A'}
Date of Birth: ${profile.dateOfBirth || 'N/A'}

CONTACT INFORMATION:
Personal Phone: ${profile.personalContactNumber || 'N/A'}
Personal Email: ${profile.personalEmailAddress || 'N/A'}
Work Phone: ${profile.workPhoneNumber || 'N/A'}
Work Email: ${profile.workEmail || 'N/A'}

ADDRESS:
Permanent Address: ${profile.permanentAddress || 'N/A'}
Current Address: ${profile.currentAddress || 'N/A'}

EMERGENCY CONTACT:
Name: ${profile.emergencyContactName || 'N/A'}
Phone: ${profile.emergencyContactNumber || 'N/A'}
Relationship: ${profile.emergencyContactRelationship || 'N/A'}

PROFESSIONAL INFORMATION:
Date of Joining: ${profile.dateOfJoining || 'N/A'}
Reporting Manager: ${profile.reportingManager || 'N/A'}
Date of Last Promotion: ${profile.dateOfLastPromotion || 'N/A'}

EDUCATION & EXPERIENCE:
Education: ${profile.educationQualification || 'N/A'}
Previous Employer: ${profile.previousEmployer || 'N/A'}
Total Experience: ${profile.totalWorkExperience || 'N/A'}

BANK DETAILS:
Account Number: ${profile.accountNumber || 'N/A'}
Bank Name: ${profile.bankName || 'N/A'}
IFSC Code: ${profile.ifscCode || 'N/A'}
PAN Number: ${profile.panNumber || 'N/A'}
Aadhar Number: ${profile.aadharNumber || 'N/A'}

Generated on: ${new Date().toLocaleString()}
    `;
    
    const blob = new Blob([profileData], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.employeeFullName?.replace(/\s+/g, '_') || 'Employee'}_Profile.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-state">
          <Loader2 size={48} className="loading-spinner" />
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="error-state">
          <AlertCircle size={48} className="error-icon" />
          <h3>Unable to Load Profile</h3>
          <p>{error}</p>
          <button 
            onClick={handleRetry}
            className="action-button"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container">
        <div className="error-state">
          <UserCheck size={48} className="error-icon" />
          <h3>Profile Not Found</h3>
          <p>We couldn't find your profile information. Please contact support.</p>
          <button 
            onClick={handleRetry}
            className="action-button"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const InfoField = ({ icon: Icon, label, value, copyable = false }) => (
    <div className="info-field">
      <div className="field-header">
        <Icon size={18} className="field-icon" />
        <span className="field-label">{label}</span>
        {copyable && value && (
          <button
            className="copy-button"
            onClick={() => copyToClipboard(value, label)}
            title="Copy to clipboard"
          >
            {copiedField === label ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>
      <span className="field-value">{value || 'Not provided'}</span>
    </div>
  );

  return (
    <div className="profile-container">
      <div className="profile-wrapper">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-banner">
            <div className="banner-gradient"></div>
          </div>
          <div className="profile-info">
            <div className="profile-avatar">
              <img 
                src={profile.employeePhoto} 
                alt="Employee Profile" 
                className="avatar-image"
                onError={(e) => {
                  e.target.src = "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400";
                }}
              />
              <div className="avatar-overlay">
                <ImageIcon size={24} />
              </div>
            </div>
            <div className="profile-details">
              <h1 className="profile-name">{profile.employeeFullName}</h1>
              <p className="profile-designation">{profile.designation}</p>
              <div className="profile-meta">
                <span className="employee-badge">ID: {profile.employeeId}</span>
                <span className="department-badge">{profile.department}</span>
                <span className="branch-badge">{profile.branch}</span>
              </div>
            </div>
            <div className="profile-actions">
              <button className="action-btn primary" onClick={downloadProfile}>
                <Download size={18} />
                Download
              </button>
              {/* <button className="action-btn secondary">
                <Edit3 size={18} />
                Edit
              </button> */}
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="profile-content">
          {/* Personal Information */}
          <div className="profile-section">
            <div className="section-header">
              <User className="section-icon" />
              <h2 className="section-title">Personal Information</h2>
            </div>
            <div className="section-content">
              <div className="info-grid">
                <InfoField icon={User} label="Full Name" value={profile.employeeFullName} />
                <InfoField icon={IdCard} label="Employee ID" value={profile.employeeId} copyable />
                <InfoField icon={Briefcase} label="Designation" value={profile.designation} />
                <InfoField icon={Building} label="Department" value={profile.department} />
                <InfoField icon={Building} label="Branch" value={profile.branch} />
                <InfoField icon={User} label="Gender" value={profile.gender} />
                <InfoField icon={Heart} label="Marital Status" value={profile.maritalStatus} />
                <InfoField icon={Calendar} label="Date of Birth" value={profile.dateOfBirth} />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="profile-section">
            <div className="section-header">
              <Phone className="section-icon" />
              <h2 className="section-title">Contact Information</h2>
            </div>
            <div className="section-content">
              <div className="info-grid">
                <InfoField icon={Phone} label="Personal Phone" value={profile.personalContactNumber} copyable />
                <InfoField icon={Mail} label="Personal Email" value={profile.personalEmailAddress} copyable />
                <InfoField icon={Phone} label="Work Phone" value={profile.workPhoneNumber} copyable />
                <InfoField icon={Mail} label="Work Email" value={profile.workEmail} copyable />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="profile-section">
            <div className="section-header">
              <MapPin className="section-icon" />
              <h2 className="section-title">Address Information</h2>
            </div>
            <div className="section-content">
              <div className="address-grid">
                <div className="address-card">
                  <h4>Permanent Address</h4>
                  <p>{profile.permanentAddress || 'Not provided'}</p>
                </div>
                <div className="address-card">
                  <h4>Current Address</h4>
                  <p>{profile.currentAddress || 'Not provided'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="profile-section">
            <div className="section-header">
              <Heart className="section-icon" />
              <h2 className="section-title">Emergency Contact</h2>
            </div>
            <div className="section-content">
              <div className="info-grid">
                <InfoField icon={User} label="Contact Name" value={profile.emergencyContactName} />
                <InfoField icon={Phone} label="Contact Number" value={profile.emergencyContactNumber} copyable />
                <InfoField icon={Heart} label="Relationship" value={profile.emergencyContactRelationship} />
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="profile-section">
            <div className="section-header">
              <Briefcase className="section-icon" />
              <h2 className="section-title">Professional Information</h2>
            </div>
            <div className="section-content">
              <div className="info-grid">
                <InfoField icon={Calendar} label="Date of Joining" value={profile.dateOfJoining} />
                <InfoField icon={User} label="Reporting Manager" value={profile.reportingManager} />
                <InfoField icon={Calendar} label="Last Promotion" value={profile.dateOfLastPromotion} />
              </div>
            </div>
          </div>

          {/* Education & Experience */}
          <div className="profile-section">
            <div className="section-header">
              <GraduationCap className="section-icon" />
              <h2 className="section-title">Education & Experience</h2>
            </div>
            <div className="section-content">
              <div className="education-grid">
                <div className="education-card">
                  <h4>Education Qualification</h4>
                  <p>{profile.educationQualification || 'Not provided'}</p>
                </div>
                <div className="experience-card">
                  <InfoField icon={Building} label="Previous Employer" value={profile.previousEmployer} />
                  <InfoField icon={Calendar} label="Total Experience" value={profile.totalWorkExperience} />
                </div>
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="profile-section sensitive">
            <div className="section-header">
              <DollarSign className="section-icon" />
              <h2 className="section-title">Bank Details</h2>
              <span className="sensitive-badge">Sensitive Information</span>
            </div>
            <div className="section-content">
              <div className="info-grid">
                <InfoField icon={DollarSign} label="Account Number" value={profile.accountNumber} copyable />
                <InfoField icon={Building} label="Bank Name" value={profile.bankName} />
                <InfoField icon={FileText} label="IFSC Code" value={profile.ifscCode} copyable />
                <InfoField icon={IdCard} label="PAN Number" value={profile.panNumber} copyable />
                <InfoField icon={IdCard} label="Aadhar Number" value={profile.aadharNumber} copyable />
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="profile-section">
            <div className="section-header">
              <FileText className="section-icon" />
              <h2 className="section-title">Documents</h2>
            </div>
            <div className="section-content">
              <div className="documents-grid">
                <div className="document-card">
                  <div className="document-header">
                    <ImageIcon size={20} />
                    <span>Profile Photo</span>
                  </div>
                  <div className="document-preview">
                    <img 
                      src={profile.employeePhoto} 
                      alt="Employee Profile" 
                      onError={(e) => {
                        e.target.src = "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400";
                      }}
                    />
                  </div>
                </div>

                <div className="document-card">
                  <div className="document-header">
                    <IdCard size={20} />
                    <span>Aadhaar Card</span>
                  </div>
                  <div className="document-preview">
                    <img 
                      src={profile.aadhaarCardPhoto} 
                      alt="Aadhaar Card" 
                      onError={(e) => {
                        e.target.src = "https://images.pexels.com/photos/8849295/pexels-photo-8849295.jpeg?auto=compress&cs=tinysrgb&w=400";
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};