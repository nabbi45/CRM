import express from "express";
import { upload } from "../middlewares/upload.js";
import { EmployeeModel } from "../models/EmployeeProfile.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

const normalizeRole = (role = "") => role.toString().trim().toLowerCase();
const PROFILE_EDITOR_ROLES = ["hr", "admin", "super admin", "dev", "srdev", "senior admin"];

const canEditProfiles = (role) => PROFILE_EDITOR_ROLES.includes(normalizeRole(role));

/**
 * Authorization middleware - Allow profile owner or HR
 */
const authorizeSelfOrHR = (req, res, next) => next();

/**
 * HR-only authorization
 */
const authorizeHROnly = (req, res, next) => {
  if (!canEditProfiles(req.user?.user_role)) {
    return res.status(403).json({
      message: "Access denied. Only HR/Admin/Super Admin/Dev roles can perform this action."
    });
  }
  next();
};

/**
 * Validation middleware for profile data
 */
const validateProfileData = (req, res, next) => {
  const requiredFields = [
    'employeeFullName', 'designation', 'department', 'branch', 'gender', 
    'maritalStatus', 'dateOfBirth', 'personalContactNumber', 'personalEmailAddress',
    'workEmail', 'workPhoneNumber', 'permanentAddress', 'currentAddress',
    'emergencyContactName', 'emergencyContactNumber', 'emergencyContactRelationship',
    'dateOfJoining', 'reportingManager', 'offeredSalary', 'educationQualification', 'totalWorkExperience',
    'accountNumber', 'bankName', 'ifscCode', 'panNumber', 'aadharNumber'
  ];

  const missingFields = requiredFields.filter(field => !req.body[field]);
  
  if (missingFields.length > 0) {
    return res.status(400).json({
      error: "Missing required fields",
      missingFields
    });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(req.body.personalEmailAddress) || !emailRegex.test(req.body.workEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  // Phone validation
  const phoneRegex = /^\d{10}$/;
  if (!phoneRegex.test(req.body.personalContactNumber.replace(/\D/g, '')) || 
      !phoneRegex.test(req.body.workPhoneNumber.replace(/\D/g, ''))) {
    return res.status(400).json({ error: "Invalid phone number format" });
  }

  // PAN validation
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(req.body.panNumber.toUpperCase())) {
    return res.status(400).json({ error: "Invalid PAN number format" });
  }

  // Aadhar validation
  const aadharRegex = /^\d{12}$/;
  if (!aadharRegex.test(req.body.aadharNumber.replace(/\D/g, ''))) {
    return res.status(400).json({ error: "Invalid Aadhar number format" });
  }

  next();
};

// Apply authentication to all routes
router.use(authenticateUser);

/**
 * GET /all - List all employee profiles (all authenticated users)
 */
router.get("/all", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      department, 
      branch, 
      status,
      search 
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    
    if (department) filter.department = department;
    if (branch) filter.branch = branch;
    if (status) filter.profileCompletionStatus = status;
    
    if (search) {
      filter.$or = [
        { employeeFullName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { personalEmailAddress: { $regex: search, $options: 'i' } },
        { workEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [employees, total] = await Promise.all([
      EmployeeModel.find(filter)
        .select('-updateHistory -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      EmployeeModel.countDocuments(filter)
    ]);

    res.json({
      employees,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalEmployees: total,
        hasNext: skip + employees.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (err) {
    console.error("GET /all error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

/**
 * GET /options - Lightweight employee profile options for dropdowns
 */
router.get("/options", async (req, res) => {
  try {
    const profiles = await EmployeeModel.find({ isActive: true })
      .select("userId employeeFullName employeeId designation department")
      .sort({ employeeFullName: 1 })
      .lean();

    const employees = profiles.map((profile) => ({
      user_id: profile.userId,
      name: profile.employeeFullName,
      employeeId: profile.employeeId,
      designation: profile.designation,
      department: profile.department,
    }));

    res.json({ employees });
  } catch (err) {
    console.error("GET /options error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

/**
 * GET /profile/:id - Get specific employee profile (all authenticated users)
 */
router.get("/profile/:id", async (req, res) => {
  try {
    const profile = await EmployeeModel.findOne({ 
      userId: req.params.id,
      isActive: true 
    }).select('-updateHistory -__v');

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({ profile });
  } catch (err) {
    console.error("GET /profile/:id error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

/**
 * POST /profile - Create new employee profile
 */
router.post("/profile", 
  upload.fields([
    { name: "employeePhoto", maxCount: 1 },
    { name: "aadhaarCardPhoto", maxCount: 1 }
  ]),
  validateProfileData,
  async (req, res) => {
    try {
      // Check if profile already exists
      const existingProfile = await EmployeeModel.findOne({ 
        userId: req.user.userId 
      });
      
      if (existingProfile) {
        return res.status(400).json({ 
          error: "Profile already exists for this user" 
        });
      }

      // Check for required files
      if (!req.files?.employeePhoto || !req.files?.aadhaarCardPhoto) {
        return res.status(400).json({
          error: "Both employee photo and Aadhaar card photo are required"
        });
      }

      // Check for duplicate email addresses
      const emailExists = await EmployeeModel.findOne({
        $or: [
          { personalEmailAddress: req.body.personalEmailAddress.toLowerCase() },
          { workEmail: req.body.workEmail.toLowerCase() }
        ]
      });

      if (emailExists) {
        return res.status(400).json({
          error: "Email address already exists in the system"
        });
      }

      // Create new profile
      const profileData = {
        userId: req.user.userId,
        ...req.body,
        dateOfJoining: req.body.dateOfJoining || new Date(),
        personalEmailAddress: req.body.personalEmailAddress.toLowerCase(),
        workEmail: req.body.workEmail.toLowerCase(),
        panNumber: req.body.panNumber.toUpperCase(),
        employeePhoto: req.files.employeePhoto[0].path,
        aadhaarCardPhoto: req.files.aadhaarCardPhoto[0].path,
        createdBy: req.user.userId
      };

      const profile = new EmployeeModel(profileData);
      await profile.save();

      // Remove sensitive data from response
      const responseProfile = profile.toObject();
      delete responseProfile.updateHistory;

      res.status(201).json({
        message: "Employee profile created successfully",
        profile: responseProfile
      });

    } catch (err) {
      console.error("POST /profile error:", err);
      
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
          error: `${field} already exists in the system`
        });
      }

      res.status(500).json({ 
        error: "Server error", 
        details: err.message 
      });
    }
  }
);

/**
 * PUT /update/:id - Update employee profile (partial update)
 */
/**
 * PUT /update/:id - Update employee profile (HR only)
 */
router.put("/update/:id", authorizeHROnly, async (req, res) => {
  try {
    const profile = await EmployeeModel.findOne({ 
      userId: req.params.id,
      isActive: true 
    });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const changes = new Map();
    const updatableFields = [
      'employeeFullName', 'designation', 'department', 'branch', 'gender',
      'maritalStatus', 'dateOfBirth', 'personalContactNumber', 'personalEmailAddress',
      'workEmail', 'workPhoneNumber', 'permanentAddress', 'currentAddress',
      'emergencyContactName', 'emergencyContactNumber', 'emergencyContactRelationship',
      'dateOfJoining', 'reportingManager', 'dateOfLastPromotion', 'offeredSalary',
      'educationQualification', 'previousEmployer', 'totalWorkExperience',
      'accountNumber', 'bankName', 'ifscCode', 'panNumber', 'aadharNumber'
    ];

    const updates = {};
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== profile[field]) {
        changes.set(field, {
          oldValue: profile[field],
          newValue: req.body[field]
        });
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No changes detected" });
    }

    updates.updatedBy = req.user.userId;
    updates.$push = {
      updateHistory: {
        updatedBy: req.user.userId,
        changes: changes,
        reason: req.body.updateReason || "Profile update"
      }
    };

    const updatedProfile = await EmployeeModel.findOneAndUpdate(
      { userId: req.params.id, isActive: true },
      updates,
      { new: true, runValidators: true }
    ).select('-updateHistory -__v');

    return res.json({
      message: "Profile updated successfully",
      profile: updatedProfile,
      changesCount: changes.size
    });
  } catch (err) {
    console.error("PUT /update/:id error:", err);

    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        error: `${field} already exists in the system`
      });
    }

    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

/**
 * PUT /employment/:id - Update employment details (editor roles only)
 */
router.put("/employment/:id", authorizeHROnly, async (req, res) => {
  try {
    const profile = await EmployeeModel.findOne({ userId: req.params.id, isActive: true });
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const updates = {};
    if (req.body.dateOfJoining) updates.dateOfJoining = req.body.dateOfJoining;
    if (req.body.offeredSalary !== undefined) updates.offeredSalary = req.body.offeredSalary;

    const incomingCompensation = req.body.compensationDetails || {};
    updates.compensationDetails = {
      fixedMonthly: Number(incomingCompensation.fixedMonthly || 0),
      fixedAnnual: Number(incomingCompensation.fixedAnnual || 0),
      variablePay: Number(incomingCompensation.variablePay || 0),
      bonus: Number(incomingCompensation.bonus || 0),
      remarks: incomingCompensation.remarks || "",
    };

    updates.updatedBy = req.user.userId;

    const updatedProfile = await EmployeeModel.findOneAndUpdate(
      { userId: req.params.id, isActive: true },
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-updateHistory -__v");

    return res.json({ message: "Employment details updated successfully", profile: updatedProfile });
  } catch (err) {
    console.error("PUT /employment/:id error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

/**
 * POST /documents/:id - Upload supporting document against employee profile
 */
router.post(
  "/documents/:id",
  authorizeHROnly,
  upload.single("documentFile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "documentFile is required" });
      }

      const title = (req.body.title || "").trim();
      if (!title) {
        return res.status(400).json({ error: "Document title is required" });
      }

      const category = req.body.category || "other";

      const updated = await EmployeeModel.findOneAndUpdate(
        { userId: req.params.id, isActive: true },
        {
          $push: {
            supportingDocuments: {
              title,
              category,
              fileUrl: req.file.path,
              uploadedBy: req.user.userId,
              uploadedAt: new Date(),
            },
          },
          $set: { updatedBy: req.user.userId },
        },
        { new: true }
      ).select("supportingDocuments userId employeeFullName");

      if (!updated) {
        return res.status(404).json({ error: "Profile not found" });
      }

      return res.status(201).json({ message: "Document uploaded successfully", profile: updated });
    } catch (err) {
      console.error("POST /documents/:id error:", err);
      return res.status(500).json({ error: "Server error", details: err.message });
    }
  }
);

/**
 * DELETE /delete/:id - Soft delete employee profile (editor roles only)
 */
router.delete("/delete/:id", authorizeHROnly, async (req, res) => {
  try {
    const profile = await EmployeeModel.findOneAndUpdate(
      { userId: req.params.id, isActive: true },
      {
        isActive: false,
        updatedBy: req.user.userId,
        $push: {
          updateHistory: {
            updatedBy: req.user.userId,
            changes: new Map([["isActive", { oldValue: true, newValue: false }]]),
            reason: req.body.reason || "Profile deactivated",
          },
        },
      },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json({
      message: "Employee profile deactivated successfully",
      employeeId: profile.employeeId,
    });
  } catch (err) {
    console.error("DELETE /delete/:id error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

/**
 * POST /approve/:id - Approve employee profile (HR only)
 */
router.post("/approve/:id", authorizeHROnly, async (req, res) => {
  try {
    const profile = await EmployeeModel.findOneAndUpdate(
      { userId: req.params.id, isActive: true },
      {
        profileCompletionStatus: "approved",
        approvedBy: req.user.userId,
        approvedAt: new Date(),
        updatedBy: req.user.userId,
        $push: {
          updateHistory: {
            updatedBy: req.user.userId,
            changes: new Map([['profileCompletionStatus', { 
              oldValue: 'pending_review', 
              newValue: 'approved' 
            }]]),
            reason: "Profile approved by HR"
          }
        }
      },
      { new: true }
    ).select('-updateHistory -__v');

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({
      message: "Employee profile approved successfully",
      profile
    });

  } catch (err) {
    console.error("POST /approve/:id error:", err);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
});

/**
 * GET /stats - Get employee statistics (HR only)
 */
router.get("/stats", authorizeHROnly, async (req, res) => {
  try {
    const [
      totalEmployees,
      departmentStats,
      branchStats,
      statusStats,
      recentJoinees
    ] = await Promise.all([
      EmployeeModel.countDocuments({ isActive: true }),
      
      EmployeeModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$department", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      EmployeeModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$branch", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      EmployeeModel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$profileCompletionStatus", count: { $sum: 1 } } }
      ]),
      
      EmployeeModel.find({ isActive: true })
        .sort({ dateOfJoining: -1 })
        .limit(5)
        .select('employeeFullName employeeId department dateOfJoining')
    ]);

    res.json({
      totalEmployees,
      departmentStats,
      branchStats,
      statusStats,
      recentJoinees
    });

  } catch (err) {
    console.error("GET /stats error:", err);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
});

/**
 * GET /export - Export employee data (HR only)
 */
router.get("/export", authorizeHROnly, async (req, res) => {
  try {
    const { format = 'json', department, branch } = req.query;
    
    const filter = { isActive: true };
    if (department) filter.department = department;
    if (branch) filter.branch = branch;

    const employees = await EmployeeModel.find(filter)
      .select('-updateHistory -__v -employeePhoto -aadhaarCardPhoto')
      .sort({ employeeId: 1 });

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'Employee ID', 'Full Name', 'Designation', 'Department', 'Branch',
        'Personal Email', 'Work Email', 'Personal Phone', 'Work Phone',
        'Date of Joining', 'Reporting Manager'
      ].join(',');

      const csvData = employees.map(emp => [
        emp.employeeId,
        emp.employeeFullName,
        emp.designation,
        emp.department,
        emp.branch,
        emp.personalEmailAddress,
        emp.workEmail,
        emp.personalContactNumber,
        emp.workPhoneNumber,
        emp.dateOfJoining?.toISOString().split('T')[0] || '',
        emp.reportingManager
      ].join(',')).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=employees.csv');
      res.send(csvHeaders + '\n' + csvData);
    } else {
      res.json({ employees, count: employees.length });
    }

  } catch (err) {
    console.error("GET /export error:", err);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
});

export default router;