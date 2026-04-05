import React, { useEffect, useState } from "react";
import axios from "axios";
import { 
  Pencil, Trash2, Plus, Eye, Search, Download, Filter, Users, 
  Mail, Phone, Car as IdCard, Camera, FileText, X, Save, 
  Calendar, MapPin, Building, User, Upload, File, Image,
  Loader2, AlertCircle, ChevronDown, MoreVertical,
  Edit3
} from "lucide-react";
import "./EmployeeManagement.css";

export const EmployeeManagement = ({ apiUrl, userSession }) => {
  const normalizeRole = (role = "") => role.toString().trim().toLowerCase();
  const editorRoles = ["hr", "admin", "super admin", "dev", "srdev", "senior admin"];
  const isEditor = editorRoles.includes(normalizeRole(userSession?.user_role));

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  
  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [docForm, setDocForm] = useState({ title: "", category: "other", file: null });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const departments = ["Sales", "Digital", "Admin", "Legal", "Finance"];
  const branches = ["1206", "808", "1512", "Admin", "Digital", "407 AMD", "408 AMD", "906"];

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    console.log(userSession);
    
    if (!userSession || !userSession.token) {
      setError("User not authenticated.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get(`${apiUrl}/employee/all`, {
        headers: { authorization: userSession.token },
      });
      console.log(res);
      
      setEmployees(res.data.employees || []);
    } catch (err) {
      console.error("Error fetching employees:", err.response || err);
      setError("Failed to fetch employee data.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!isEditor) return;
    if (!window.confirm("Are you sure you want to delete this employee profile?")) return;
    try {
      await axios.delete(`${apiUrl}/employee/delete/${id}`, {
        headers: { authorization: userSession.token },
      });
      setEmployees(employees.filter((emp) => emp.userId !== id));

    } catch (err) {
      console.error(err);
      alert("Failed to delete profile.");
    }
  };

  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowViewModal(true);
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setEditFormData({ ...employee });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      const userSession = JSON.parse(localStorage.getItem('userSession'));

      if (!isEditor) {
        setShowEditModal(false);
        return;
      }
      
      await axios.put(`${apiUrl}/employee/update/${selectedEmployee.userId}`, editFormData, {
        headers: { Authorization: userSession.token },
      });

      await axios.put(
        `${apiUrl}/employee/employment/${selectedEmployee.userId}`,
        {
          dateOfJoining: editFormData.dateOfJoining,
          offeredSalary: editFormData.offeredSalary,
          compensationDetails: {
            fixedMonthly: editFormData?.compensationDetails?.fixedMonthly || 0,
            fixedAnnual: editFormData?.compensationDetails?.fixedAnnual || 0,
            variablePay: editFormData?.compensationDetails?.variablePay || 0,
            bonus: editFormData?.compensationDetails?.bonus || 0,
            remarks: editFormData?.compensationDetails?.remarks || "",
          },
        },
        { headers: { Authorization: userSession.token } }
      );
      
      setEmployees(employees.map(emp => 
        emp.userId === selectedEmployee.userId ? { ...emp, ...editFormData } : emp
      ));
      
      setShowEditModal(false);
      setSelectedEmployee(null);
      setEditFormData({});
      fetchEmployees();
    } catch (err) {
      console.error("Error updating employee:", err);
      alert("Failed to update employee.");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!isEditor || !selectedEmployee?.userId) return;
    if (!docForm.title.trim() || !docForm.file) {
      alert("Please provide document title and file.");
      return;
    }

    try {
      setUploadingDoc(true);
      const payload = new FormData();
      payload.append("title", docForm.title.trim());
      payload.append("category", docForm.category);
      payload.append("documentFile", docForm.file);

      const session = JSON.parse(localStorage.getItem("userSession")) || {};
      await axios.post(`${apiUrl}/employee/documents/${selectedEmployee.userId}`, payload, {
        headers: {
          Authorization: session.token || "",
          "Content-Type": "multipart/form-data",
        },
      });

      setDocForm({ title: "", category: "other", file: null });
      fetchEmployees();
      alert("Document uploaded successfully.");
    } catch (err) {
      console.error("Error uploading document:", err);
      alert("Failed to upload document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSelectEmployee = (employeeId) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filteredEmployees.map(emp => emp._id));
    }
  };

  const downloadEmployeeData = (employee) => {
    const data = `
EMPLOYEE INFORMATION
===================

PERSONAL DETAILS:
Name: ${employee.employeeFullName || 'N/A'}
Employee ID: ${employee.employeeId || 'N/A'}
Designation: ${employee.designation || 'N/A'}
Department: ${employee.department || 'N/A'}
Branch: ${employee.branch || 'N/A'}
Gender: ${employee.gender || 'N/A'}
Date of Birth: ${employee.dateOfBirth || 'N/A'}

CONTACT INFORMATION:
Personal Phone: ${employee.personalContactNumber || 'N/A'}
Personal Email: ${employee.personalEmailAddress || 'N/A'}
Work Phone: ${employee.workPhoneNumber || 'N/A'}
Work Email: ${employee.workEmail || 'N/A'}

ADDRESS:
Permanent: ${employee.permanentAddress || 'N/A'}
Current: ${employee.currentAddress || 'N/A'}

PROFESSIONAL:
Date of Joining: ${employee.dateOfJoining || 'N/A'}
Reporting Manager: ${employee.reportingManager || 'N/A'}
Education: ${employee.educationQualification || 'N/A'}
Experience: ${employee.totalWorkExperience || 'N/A'}

Generated: ${new Date().toLocaleString()}
    `;
    
    const blob = new Blob([data], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${employee.employeeFullName?.replace(/\s+/g, '_') || 'Employee'}_info.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadSelectedEmployees = () => {
    const selectedData = employees
      .filter(emp => selectedEmployees.includes(emp._id))
      .map(emp => 
        `${emp.employeeFullName || ''},${emp.personalEmailAddress || ''},${emp.personalContactNumber || ''},${emp.employeeId || ''},${emp.designation || ''},${emp.department || ''},${emp.branch || ''}`
      )
      .join('\n');
    
    const csvContent = `Name,Personal Email,Personal Phone,Employee ID,Designation,Department,Branch\n${selectedData}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `selected_employees_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.employeeFullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.personalEmailAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = 
      !filterDepartment || emp.department === filterDepartment;
    
    const matchesBranch = 
      !filterBranch || emp.branch === filterBranch;
    
    return matchesSearch && matchesDepartment && matchesBranch;
  }).sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'name':
        aValue = a.employeeFullName || '';
        bValue = b.employeeFullName || '';
        break;
      case 'designation':
        aValue = a.designation || '';
        bValue = b.designation || '';
        break;
      case 'department':
        aValue = a.department || '';
        bValue = b.department || '';
        break;
      case 'joiningDate':
        aValue = new Date(a.dateOfJoining || '1970-01-01');
        bValue = new Date(b.dateOfJoining || '1970-01-01');
        break;
      default:
        aValue = a.employeeFullName || '';
        bValue = b.employeeFullName || '';
    }
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const uniqueDepartments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];
  const uniqueBranches = [...new Set(employees.map(emp => emp.branch).filter(Boolean))];

  const EmployeeCard = ({ employee }) => (
    <div className={`employee-card ${selectedEmployees.includes(employee._id) ? 'selected' : ''}`}>
      <div className="card-header">
        <input
          type="checkbox"
          checked={selectedEmployees.includes(employee._id)}
          onChange={() => handleSelectEmployee(employee._id)}
          className="employee-checkbox"
        />
        <div className="employee-avatar">
          <img
            src={employee.employeePhoto}
            alt={employee.employeeFullName}
            className="avatar-image"
            onError={(e) => {
              e.target.src = "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400";
            }}
          />
          <div className="status-indicator online"></div>
        </div>
        <div className="dropdown">
          <button className="dropdown-toggle">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      <div className="card-content">
        <div className="employee-info">
          <h3 className="employee-name">{employee.employeeFullName}</h3>
          <p className="employee-designation">{employee.designation}</p>
          <div className="employee-meta">
            <span className="employee-id">ID: {employee.employeeId}</span>
            {employee.department && (
              <span className={`dept-badge dept-${employee.department.toLowerCase()}`}>
                {employee.department}
              </span>
            )}
          </div>
        </div>

        <div className="contact-info">
          <div className="contact-item">
            <Mail size={14} />
            <span className="contact-text">{employee.personalEmailAddress}</span>
          </div>
          <div className="contact-item">
            <Phone size={14} />
            <span className="contact-text">{employee.personalContactNumber}</span>
          </div>
          {employee.branch && (
            <div className="contact-item">
              <Building size={14} />
              <span className="contact-text">Branch: {employee.branch}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card-actions">
        <button 
          className="action-btn view-btn" 
          onClick={() => handleViewEmployee(employee)}
          title="View Profile"
        >
          <Eye size={16} />
        </button>
        {isEditor && (
          <button 
            className="action-btn edit-btn" 
            onClick={() => handleEditEmployee(employee)}
            title="Edit Employee"
          >
            <Pencil size={16} />
          </button>
        )}
        <button 
          className="action-btn download-btn" 
          onClick={() => downloadEmployeeData(employee)}
          title="Download Info"
        >
          <Download size={16} />
        </button>
        {isEditor && (
          <button 
            className="action-btn delete-btn" 
            onClick={() => handleDelete(employee.userId)}
            title="Delete Employee"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="employee-management-container">
        <div className="loading-state">
          <Loader2 size={48} className="loading-spinner" />
          <h3>Loading employees...</h3>
          <p>Please wait while we fetch the employee data.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="employee-management-container">
        <div className="error-state">
          <AlertCircle size={48} className="error-icon" />
          <h3>Unable to Load Employees</h3>
          <p>{error}</p>
          <button onClick={fetchEmployees} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-management-container">
      {/* Header Section */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-info">
            <div className="header-icon">
              <Users size={32} />
            </div>
            <div>
              <h1 className="page-title">Employee Directory</h1>
              <p className="page-subtitle">Employee Profiles, employment details and documents</p>
            </div>
          </div>
          
          <div className="header-stats">
            <div className="stat-card">
              <div className="stat-number">{employees.length}</div>
              <div className="stat-label">Total Employees</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{uniqueDepartments.length}</div>
              <div className="stat-label">Departments</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{uniqueBranches.length}</div>
              <div className="stat-label">Branches</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="controls-section">
        <div className="search-controls">
          <div className="search-wrapper">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search employees by name, email, ID, or designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="control-buttons">
            <button 
              className={`filter-btn ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={18} />
              Filters
              <ChevronDown size={16} className={`chevron ${showFilters ? 'rotated' : ''}`} />
            </button>

            <select 
              className="sort-select"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="designation-asc">Designation A-Z</option>
              <option value="designation-desc">Designation Z-A</option>
              <option value="department-asc">Department A-Z</option>
              <option value="department-desc">Department Z-A</option>
              <option value="joiningDate-desc">Newest First</option>
              <option value="joiningDate-asc">Oldest First</option>
            </select>
          </div>
        </div>

        <div className="action-controls">
          {selectedEmployees.length > 0 && (
            <button className="bulk-action-btn" onClick={downloadSelectedEmployees}>
              <Download size={18} />
              Download Selected ({selectedEmployees.length})
            </button>
          )}
          
          {isEditor && (
            <button className="add-btn" onClick={() => alert("Employee profiles are created from Create Profile")}> 
              <Plus size={20} />
              Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filters-content">
            <div className="filter-group">
              <label className="filter-label">Department</label>
              <select 
                value={filterDepartment} 
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="filter-select"
              >
                <option value="">All Departments</option>
                {uniqueDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Branch</label>
              <select 
                value={filterBranch} 
                onChange={(e) => setFilterBranch(e.target.value)}
                className="filter-select"
              >
                <option value="">All Branches</option>
                {uniqueBranches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>

            <div className="filter-actions">
              <button 
                className="clear-filters-btn"
                onClick={() => {
                  setFilterDepartment('');
                  setFilterBranch('');
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="results-section">
        <div className="results-header">
          <div className="results-info">
            <span className="results-count">
              Showing {filteredEmployees.length} of {employees.length} employees
            </span>
            {(searchTerm || filterDepartment || filterBranch) && (
              <span className="filter-indicator">
                {searchTerm && `Search: "${searchTerm}"`}
                {filterDepartment && ` • Department: ${filterDepartment}`}
                {filterBranch && ` • Branch: ${filterBranch}`}
              </span>
            )}
          </div>
          
          {filteredEmployees.length > 0 && (
            <div className="select-all-container">
              <input
                type="checkbox"
                checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                onChange={handleSelectAll}
                id="select-all"
                className="select-all-checkbox"
              />
              <label htmlFor="select-all" className="select-all-label">
                Select All
              </label>
            </div>
          )}
        </div>

        {/* Employee Grid */}
        {filteredEmployees.length > 0 ? (
          <div className="employee-grid">
            {filteredEmployees.map((employee) => (
              <EmployeeCard key={employee._id} employee={employee} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Users size={64} className="empty-icon" />
            <h3 className="empty-title">No employees found</h3>
            <p className="empty-description">
              {searchTerm || filterDepartment || filterBranch
                ? "Try adjusting your search criteria or filters."
                : "Start by adding your first employee to the directory."
              }
            </p>
            {isEditor && (
              <button className="add-first-btn" onClick={() => alert("Employee profiles are created from Create Profile")}>
                <Plus size={20} />
                Add First Employee
              </button>
            )}
          </div>
        )}
      </div>

      {/* View Modal */}
      {showViewModal && selectedEmployee && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowViewModal(false);
        }}>
          <div className="modal-container view-modal">
            <div className="modal-header">
              <h2>Employee Profile</h2>
              <button className="modal-close-btn" onClick={() => setShowViewModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="profile-summary">
                <div className="profile-photo">
                  <img
                    src={selectedEmployee.employeePhoto}
                    alt={selectedEmployee.employeeFullName}
                    onError={(e) => {
                      e.target.src = "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400";
                    }}
                  />
                </div>
                <div className="profile-details">
                  <h3>{selectedEmployee.employeeFullName}</h3>
                  <p className="designation">{selectedEmployee.designation}</p>
                  <div className="badges">
                    <span className="badge">ID: {selectedEmployee.employeeId}</span>
                    {selectedEmployee.department && (
                      <span className="badge department">{selectedEmployee.department}</span>
                    )}
                    {selectedEmployee.branch && (
                      <span className="badge branch">{selectedEmployee.branch}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="details-sections">
                <div className="detail-section">
                  <h4><Mail size={18} /> Contact Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="label">Personal Email:</span>
                      <span className="value">{selectedEmployee.personalEmailAddress || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Personal Phone:</span>
                      <span className="value">{selectedEmployee.personalContactNumber || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Work Email:</span>
                      <span className="value">{selectedEmployee.workEmail || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Work Phone:</span>
                      <span className="value">{selectedEmployee.workPhoneNumber || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4><Building size={18} /> Professional Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="label">Date of Joining:</span>
                      <span className="value">{selectedEmployee.dateOfJoining || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Reporting Manager:</span>
                      <span className="value">{selectedEmployee.reportingManager || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Education:</span>
                      <span className="value">{selectedEmployee.educationQualification || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Experience:</span>
                      <span className="value">{selectedEmployee.totalWorkExperience || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4><User size={18} /> Personal Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="label">Date of Birth:</span>
                      <span className="value">{selectedEmployee.dateOfBirth || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Gender:</span>
                      <span className="value">{selectedEmployee.gender || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Marital Status:</span>
                      <span className="value">{selectedEmployee.maritalStatus || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4><FileText size={18} /> Compensation Details</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="label">Offered Salary:</span>
                      <span className="value">{selectedEmployee.offeredSalary || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Fixed Monthly:</span>
                      <span className="value">{selectedEmployee?.compensationDetails?.fixedMonthly || 0}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Fixed Annual:</span>
                      <span className="value">{selectedEmployee?.compensationDetails?.fixedAnnual || 0}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Variable Pay:</span>
                      <span className="value">{selectedEmployee?.compensationDetails?.variablePay || 0}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Bonus:</span>
                      <span className="value">{selectedEmployee?.compensationDetails?.bonus || 0}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Remarks:</span>
                      <span className="value">{selectedEmployee?.compensationDetails?.remarks || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4><Upload size={18} /> Supporting Documents</h4>
                  <div className="detail-grid">
                    {(selectedEmployee.supportingDocuments || []).length === 0 ? (
                      <div className="detail-item"><span className="value">No documents uploaded.</span></div>
                    ) : (selectedEmployee.supportingDocuments || []).map((doc, idx) => (
                      <div className="detail-item" key={`${doc.fileUrl}-${idx}`}>
                        <span className="label">{doc.title} ({doc.category})</span>
                        <a className="value" href={doc.fileUrl} target="_blank" rel="noreferrer">Open</a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="modal-btn secondary"
                onClick={() => downloadEmployeeData(selectedEmployee)}
              >
                <Download size={18} />
                Download Profile
              </button>
              <button 
                className="modal-btn primary"
                onClick={() => {
                  setShowViewModal(false);
                  handleEditEmployee(selectedEmployee);
                }}
                disabled={!isEditor}
              >
                <Edit3 size={18} />
                {isEditor ? 'Edit Profile' : 'Read Only'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEmployee && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowEditModal(false);
        }}>
          <div className="modal-container edit-modal">
            <div className="modal-header">
              <h2>Edit Employee</h2>
              <button className="modal-close-btn" onClick={() => setShowEditModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-content">
              <form className="edit-form">
                <div className="form-sections">
                  <div className="form-section">
                    <h4>Basic Information</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Full Name</label>
                        <input
                          type="text"
                          value={editFormData.employeeFullName || ''}
                          onChange={(e) => setEditFormData({...editFormData, employeeFullName: e.target.value})}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label>Designation</label>
                        <input
                          type="text"
                          value={editFormData.designation || ''}
                          onChange={(e) => setEditFormData({...editFormData, designation: e.target.value})}
                        />
                      </div>

                      <div className="form-group">
                        <label>Department</label>
                        <select
                          value={editFormData.department || ''}
                          onChange={(e) => setEditFormData({...editFormData, department: e.target.value})}
                        >
                          <option value="">Select Department</option>
                          {departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Branch</label>
                        <select
                          value={editFormData.branch || ''}
                          onChange={(e) => setEditFormData({...editFormData, branch: e.target.value})}
                        >
                          <option value="">Select Branch</option>
                          {branches.map(branch => (
                            <option key={branch} value={branch}>{branch}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h4>Contact Information</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Personal Email</label>
                        <input
                          type="email"
                          value={editFormData.personalEmailAddress || ''}
                          onChange={(e) => setEditFormData({...editFormData, personalEmailAddress: e.target.value})}
                        />
                      </div>

                      <div className="form-group">
                        <label>Personal Phone</label>
                        <input
                          type="tel"
                          value={editFormData.personalContactNumber || ''}
                          onChange={(e) => setEditFormData({...editFormData, personalContactNumber: e.target.value})}
                        />
                      </div>

                      <div className="form-group">
                        <label>Work Email</label>
                        <input
                          type="email"
                          value={editFormData.workEmail || ''}
                          onChange={(e) => setEditFormData({...editFormData, workEmail: e.target.value})}
                        />
                      </div>

                      <div className="form-group">
                        <label>Work Phone</label>
                        <input
                          type="tel"
                          value={editFormData.workPhoneNumber || ''}
                          onChange={(e) => setEditFormData({...editFormData, workPhoneNumber: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h4>Professional Details</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Date of Joining</label>
                        <input
                          type="date"
                          value={editFormData.dateOfJoining ? String(editFormData.dateOfJoining).slice(0, 10) : ''}
                          onChange={(e) => setEditFormData({...editFormData, dateOfJoining: e.target.value})}
                          disabled={!isEditor}
                        />
                      </div>

                      <div className="form-group">
                        <label>Offered Salary</label>
                        <input
                          type="text"
                          value={editFormData.offeredSalary || ''}
                          onChange={(e) => setEditFormData({...editFormData, offeredSalary: e.target.value})}
                          disabled={!isEditor}
                        />
                      </div>

                      <div className="form-group">
                        <label>Reporting Manager</label>
                        <input
                          type="text"
                          value={editFormData.reportingManager || ''}
                          onChange={(e) => setEditFormData({...editFormData, reportingManager: e.target.value})}
                          disabled={!isEditor}
                        />
                      </div>

                      <div className="form-group full-width">
                        <label>Education Qualification</label>
                        <textarea
                          value={editFormData.educationQualification || ''}
                          onChange={(e) => setEditFormData({...editFormData, educationQualification: e.target.value})}
                          rows="3"
                          disabled={!isEditor}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h4>Compensation Details</h4>
                    <div className="form-grid">
                      {[
                        ["fixedMonthly", "Fixed Monthly"],
                        ["fixedAnnual", "Fixed Annual"],
                        ["variablePay", "Variable Pay"],
                        ["bonus", "Bonus"],
                      ].map(([key, label]) => (
                        <div className="form-group" key={key}>
                          <label>{label}</label>
                          <input
                            type="number"
                            value={editFormData?.compensationDetails?.[key] || 0}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              compensationDetails: {
                                ...(editFormData.compensationDetails || {}),
                                [key]: Number(e.target.value || 0),
                              },
                            })}
                            disabled={!isEditor}
                          />
                        </div>
                      ))}

                      <div className="form-group full-width">
                        <label>Compensation Remarks</label>
                        <textarea
                          rows="2"
                          value={editFormData?.compensationDetails?.remarks || ''}
                          onChange={(e) => setEditFormData({
                            ...editFormData,
                            compensationDetails: {
                              ...(editFormData.compensationDetails || {}),
                              remarks: e.target.value,
                            },
                          })}
                          disabled={!isEditor}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h4>Supporting Documents</h4>
                    <div className="detail-grid">
                      {(selectedEmployee.supportingDocuments || []).length === 0 ? (
                        <div className="detail-item"><span className="value">No documents uploaded yet.</span></div>
                      ) : (selectedEmployee.supportingDocuments || []).map((doc, idx) => (
                        <div className="detail-item" key={`${doc.fileUrl}-${idx}`}>
                          <span className="label">{doc.title} ({doc.category})</span>
                          <a className="value" href={doc.fileUrl} target="_blank" rel="noreferrer">Open</a>
                        </div>
                      ))}
                    </div>

                    {isEditor && (
                      <div className="form-grid" style={{ marginTop: 12 }}>
                        <div className="form-group">
                          <label>Document Title</label>
                          <input
                            type="text"
                            value={docForm.title}
                            onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Category</label>
                          <select
                            value={docForm.category}
                            onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                          >
                            <option value="experience_letter">Experience Letter</option>
                            <option value="offer_letter">Offer Letter</option>
                            <option value="salary_document">Salary Document</option>
                            <option value="id_document">ID Document</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Upload File</label>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
                          />
                        </div>
                        <div className="form-group">
                          <button type="button" className="modal-btn primary" onClick={handleUploadDocument} disabled={uploadingDoc}>
                            {uploadingDoc ? 'Uploading...' : 'Upload Document'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="modal-footer">
              <button 
                className="modal-btn secondary" 
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button 
                className="modal-btn primary"
                onClick={handleSaveEdit}
                disabled={saving || !isEditor}
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="spinning" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {isEditor ? 'Save Changes' : 'Read Only'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};