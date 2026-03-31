import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Pencil, Trash2, Plus, Eye, Search, Users, Mail, Phone, X, Save, Loader2, AlertCircle } from "lucide-react";
import "./EmployeeManagement.css";
import { CreateProfile } from "./EmployeeProfileForm";

export const EmployeeManagement = ({ apiUrl, userSession }) => {
  const [employees, setEmployees] = useState([]);
  const [totals, setTotals] = useState({ totalEmployees: 0, totalSales: 0, totalBookings: 0, totalBaseSalary: 0, totalBonus: 0, totalIncentives: 0 });
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchEmployees = async () => {
    if (!userSession?.token) {
      setError("User not authenticated.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const [listRes, overviewRes] = await Promise.all([
        axios.get(`${apiUrl}/employee/all`, { headers: { authorization: userSession.token } }),
        axios.get(`${apiUrl}/employee/overview`, { headers: { authorization: userSession.token } }),
      ]);

      const overviewEmployees = overviewRes.data?.employees || [];
      const metricMap = overviewEmployees.reduce((acc, emp) => {
        acc[emp.userId] = emp;
        return acc;
      }, {});

      setEmployees(listRes.data?.employees || []);
      setMetrics(metricMap);
      setTotals(overviewRes.data?.totals || {});
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch employee data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter((emp) =>
      (emp.employeeFullName || "").toLowerCase().includes(term) ||
      (emp.employeeId || "").toLowerCase().includes(term) ||
      (emp.personalEmailAddress || "").toLowerCase().includes(term) ||
      (emp.designation || "").toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  const openEdit = (emp) => {
    const m = metrics[emp.userId] || {};
    setSelectedEmployee(emp);
    setEditFormData({
      ...emp,
      baseSalary: Number(emp.baseSalary ?? m.baseSalary ?? 0),
      monthlyBonus: Number(emp.monthlyBonus ?? m.monthlyBonus ?? 0),
      incentives: Number(emp.incentives ?? m.incentives ?? 0),
      leaveBalance: Number(emp.leaveBalance ?? m.leaveBalance ?? 0),
      leavesTaken: Number(emp.leavesTaken ?? m.leavesTaken ?? 0),
      offeredSalary: emp.offeredSalary || "",
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      await axios.put(
        `${apiUrl}/employee/update/${selectedEmployee.userId || selectedEmployee._id}`,
        {
          employeeFullName: editFormData.employeeFullName,
          designation: editFormData.designation,
          department: editFormData.department,
          branch: editFormData.branch,
          personalEmailAddress: editFormData.personalEmailAddress,
          personalContactNumber: editFormData.personalContactNumber,
          workEmail: editFormData.workEmail,
          workPhoneNumber: editFormData.workPhoneNumber,
          reportingManager: editFormData.reportingManager,
          offeredSalary: editFormData.offeredSalary,
          baseSalary: Number(editFormData.baseSalary || 0),
          monthlyBonus: Number(editFormData.monthlyBonus || 0),
          incentives: Number(editFormData.incentives || 0),
          leaveBalance: Number(editFormData.leaveBalance || 0),
          leavesTaken: Number(editFormData.leavesTaken || 0),
        },
        { headers: { authorization: userSession.token } }
      );

      setShowEditModal(false);
      await fetchEmployees();
    } catch {
      alert("Failed to update employee.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this employee profile?")) return;
    await axios.delete(`${apiUrl}/employee/delete/${id}`, { headers: { authorization: userSession.token } });
    await fetchEmployees();
  };

  if (loading) {
    return <div className="employee-management-container"><div className="loading-state"><Loader2 size={44} className="loading-spinner" /><h3>Loading employees...</h3></div></div>;
  }

  if (error) {
    return <div className="employee-management-container"><div className="error-state"><AlertCircle size={44} className="error-icon" /><h3>Unable to Load Employees</h3><p>{error}</p><button onClick={fetchEmployees} className="retry-button">Try Again</button></div></div>;
  }

  return (
    <div className="employee-management-container">
      <div className="page-header">
        <div className="header-content">
          <div className="header-info">
            <div className="header-icon"><Users size={32} /></div>
            <div><h1 className="page-title">Manage Employees</h1><p className="page-subtitle">Profiles, analytics, bookings and compensation</p></div>
          </div>
          <div className="header-stats">
            <div className="stat-card"><div className="stat-number">{totals.totalEmployees || employees.length}</div><div className="stat-label">Employees</div></div>
            <div className="stat-card"><div className="stat-number">₹{Number(totals.totalSales || 0).toLocaleString()}</div><div className="stat-label">Overall Sales</div></div>
            <div className="stat-card"><div className="stat-number">{totals.totalBookings || 0}</div><div className="stat-label">Bookings</div></div>
            <div className="stat-card"><div className="stat-number">₹{Number((totals.totalBaseSalary || 0) + (totals.totalBonus || 0) + (totals.totalIncentives || 0)).toLocaleString()}</div><div className="stat-label">Compensation</div></div>
          </div>
        </div>
      </div>

      <div className="controls-section">
        <div className="search-controls">
          <div className="search-wrapper"><Search className="search-icon" size={20} /><input type="text" placeholder="Search by name, email, ID, designation..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" /></div>
        </div>
        <div className="action-controls">
          <button className="add-btn" onClick={() => setShowCreateProfile((prev) => !prev)}><Plus size={18} />{showCreateProfile ? "Hide Create Profile" : "Create New Employee Profile"}</button>
        </div>
      </div>

      {showCreateProfile && (
        <div className="controls-section" style={{ marginTop: -8 }}>
          <div style={{ width: "100%" }}>
            <h3 style={{ marginBottom: 10 }}>Create New Employee Profile</h3>
            <CreateProfile apiUrl={apiUrl} userSession={userSession} />
          </div>
        </div>
      )}

      <div className="employee-grid">
        {filteredEmployees.map((emp) => {
          const m = metrics[emp.userId] || {};
          return (
            <div className="employee-card" key={emp.userId || emp._id}>
              <div className="card-content">
                <div className="employee-info">
                  <h3 className="employee-name">{emp.employeeFullName}</h3>
                  <p className="employee-designation">{emp.designation}</p>
                  <div className="employee-meta"><span className="employee-id">{emp.employeeId}</span></div>
                </div>
                <div className="contact-info">
                  <div className="contact-item"><Mail size={14} /><span className="contact-text">{emp.personalEmailAddress}</span></div>
                  <div className="contact-item"><Phone size={14} /><span className="contact-text">{emp.personalContactNumber}</span></div>
                  <div className="contact-item"><span className="contact-text">Sales: ₹{Number(m.totalSales || 0).toLocaleString()}</span></div>
                  <div className="contact-item"><span className="contact-text">Bookings: {Number(m.totalBookings || 0)}</span></div>
                  <div className="contact-item"><span className="contact-text">Salary+Bonus+Incentive: ₹{Number((m.baseSalary || 0) + (m.monthlyBonus || 0) + (m.incentives || 0)).toLocaleString()}</span></div>
                </div>
              </div>
              <div className="card-actions">
                <button className="action-btn view-btn" onClick={() => { setSelectedEmployee(emp); setShowViewModal(true); }}><Eye size={16} /></button>
                <button className="action-btn edit-btn" onClick={() => openEdit(emp)}><Pencil size={16} /></button>
                <button className="action-btn delete-btn" onClick={() => handleDelete(emp.userId || emp._id)}><Trash2 size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {showViewModal && selectedEmployee && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowViewModal(false)}>
          <div className="modal-container view-modal">
            <div className="modal-header"><h2>Employee Profile</h2><button className="modal-close-btn" onClick={() => setShowViewModal(false)}><X size={20} /></button></div>
            <div className="modal-content">
              <div className="detail-grid">
                <div className="detail-item"><span className="label">Name</span><span className="value">{selectedEmployee.employeeFullName}</span></div>
                <div className="detail-item"><span className="label">Designation</span><span className="value">{selectedEmployee.designation}</span></div>
                <div className="detail-item"><span className="label">Department</span><span className="value">{selectedEmployee.department}</span></div>
                <div className="detail-item"><span className="label">Branch</span><span className="value">{selectedEmployee.branch}</span></div>
                <div className="detail-item"><span className="label">Sales</span><span className="value">₹{Number(metrics[selectedEmployee.userId]?.totalSales || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="label">Bookings</span><span className="value">{Number(metrics[selectedEmployee.userId]?.totalBookings || 0)}</span></div>
                <div className="detail-item"><span className="label">Base Salary</span><span className="value">₹{Number(metrics[selectedEmployee.userId]?.baseSalary || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="label">Bonus</span><span className="value">₹{Number(metrics[selectedEmployee.userId]?.monthlyBonus || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="label">Incentives</span><span className="value">₹{Number(metrics[selectedEmployee.userId]?.incentives || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="label">Leave Balance</span><span className="value">{Number(metrics[selectedEmployee.userId]?.leaveBalance || 0)}</span></div>
                <div className="detail-item"><span className="label">Leaves Taken</span><span className="value">{Number(metrics[selectedEmployee.userId]?.leavesTaken || 0)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedEmployee && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="modal-container edit-modal">
            <div className="modal-header"><h2>Edit Employee</h2><button className="modal-close-btn" onClick={() => setShowEditModal(false)}><X size={20} /></button></div>
            <div className="modal-content">
              <div className="form-grid">
                <div className="form-group"><label>Full Name</label><input value={editFormData.employeeFullName || ""} onChange={(e) => setEditFormData((p) => ({ ...p, employeeFullName: e.target.value }))} /></div>
                <div className="form-group"><label>Designation</label><input value={editFormData.designation || ""} onChange={(e) => setEditFormData((p) => ({ ...p, designation: e.target.value }))} /></div>
                <div className="form-group"><label>Base Salary</label><input type="number" value={editFormData.baseSalary || 0} onChange={(e) => setEditFormData((p) => ({ ...p, baseSalary: e.target.value }))} /></div>
                <div className="form-group"><label>Monthly Bonus</label><input type="number" value={editFormData.monthlyBonus || 0} onChange={(e) => setEditFormData((p) => ({ ...p, monthlyBonus: e.target.value }))} /></div>
                <div className="form-group"><label>Incentives</label><input type="number" value={editFormData.incentives || 0} onChange={(e) => setEditFormData((p) => ({ ...p, incentives: e.target.value }))} /></div>
                <div className="form-group"><label>Leave Balance</label><input type="number" value={editFormData.leaveBalance || 0} onChange={(e) => setEditFormData((p) => ({ ...p, leaveBalance: e.target.value }))} /></div>
                <div className="form-group"><label>Leaves Taken</label><input type="number" value={editFormData.leavesTaken || 0} onChange={(e) => setEditFormData((p) => ({ ...p, leavesTaken: e.target.value }))} /></div>
                <div className="form-group"><label>Offered Salary</label><input value={editFormData.offeredSalary || ""} onChange={(e) => setEditFormData((p) => ({ ...p, offeredSalary: e.target.value }))} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="modal-btn primary" onClick={handleSaveEdit} disabled={saving}>{saving ? <><Loader2 size={16} className="spinning" /> Saving...</> : <><Save size={16} /> Save Changes</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};