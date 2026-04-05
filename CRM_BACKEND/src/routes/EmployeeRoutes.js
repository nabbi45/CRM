import express from "express";
import { upload } from "../middlewares/upload.js";
import { EmployeeModel } from "../models/EmployeeProfile.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const router = express.Router();

const normalizeRole = (role = "") => role.toString().trim().toLowerCase();
const MANAGER_ROLES = ["hr", "admin", "super admin", "dev", "srdev", "senior admin"];

const canManageProfiles = (role) => MANAGER_ROLES.includes(normalizeRole(role));

/**
 * Authorization middleware - Allow profile owner or profile managers
 */
const authorizeSelfOrManager = (req, res, next) => {
  const requestedUserId = req.params.id;
  if (req.user.userId !== requestedUserId && !canManageProfiles(req.user.user_role)) {
    return res.status(403).json({ 
      message: "Access denied. You can only access your own profile or need manager privileges." 
    });
  }
  next();
};

/**
 * Manager-role authorization
 */
const authorizeManagerRoles = (req, res, next) => {
  if (!canManageProfiles(req.user.user_role)) {
    return res.status(403).json({ 
      message: "Access denied. Only HR/Admin/Super Admin/Dev can perform this action." 
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
    'reportingManager', 'offeredSalary', 'educationQualification', 'totalWorkExperience',
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
 * GET /all - List all employee profiles (viewable by all authenticated users)
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
 * GET /options - minimal employee profile list for dropdowns
 * Returns only users who have created profile records.
 */
router.get("/options", async (req, res) => {
  try {
    const profiles = await EmployeeModel.find({ isActive: true })
      .select("userId employeeFullName employeeId designation department dateOfJoining")
      .sort({ employeeFullName: 1 })
      .lean();

    const options = profiles.map((p) => ({
      user_id: p.userId,
      name: p.employeeFullName,
      employeeId: p.employeeId,
      designation: p.designation,
      department: p.department,
      dateOfJoining: p.dateOfJoining,
    }));

    res.json({ users: options });
  } catch (err) {
    console.error("GET /options error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

/**
 * GET /profile/:id - Get specific employee profile
 */
router.get("/profile/:id", authorizeSelfOrManager, async (req, res) => {
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
    { name: "aadhaarCardPhoto", maxCount: 1 },
    { name: "experienceLetter", maxCount: 1 },
    { name: "offerLetter", maxCount: 1 },
    { name: "joiningLetter", maxCount: 1 },
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

      const canEditRestrictedFields = canManageProfiles(req.user.user_role);

      let compensationDetails = { ctc: "", basicSalary: "", variablePay: "", currency: "INR" };
      if (req.body.compensationDetails) {
        try {
          const parsed = typeof req.body.compensationDetails === "string"
            ? JSON.parse(req.body.compensationDetails)
            : req.body.compensationDetails;
          if (parsed && typeof parsed === "object") {
            compensationDetails = {
              ctc: parsed.ctc || "",
              basicSalary: parsed.basicSalary || "",
              variablePay: parsed.variablePay || "",
              currency: parsed.currency || "INR",
            };
          }
        } catch (_) {}
      }

      // Create new profile
      const profileData = {
        userId: req.user.userId,
        ...req.body,
        dateOfJoining: canEditRestrictedFields && req.body.dateOfJoining
          ? req.body.dateOfJoining
          : new Date(),
        personalEmailAddress: req.body.personalEmailAddress.toLowerCase(),
        workEmail: req.body.workEmail.toLowerCase(),
        panNumber: req.body.panNumber.toUpperCase(),
        employeePhoto: req.files.employeePhoto[0].path,
        aadhaarCardPhoto: req.files.aadhaarCardPhoto[0].path,
        experienceLetter: req.files?.experienceLetter?.[0]?.path || "",
        offerLetter: req.files?.offerLetter?.[0]?.path || "",
        joiningLetter: req.files?.joiningLetter?.[0]?.path || "",
        compensationDetails: canEditRestrictedFields ? compensationDetails : { ctc: "", basicSalary: "", variablePay: "", currency: "INR" },
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
 * PUT /update/:id - Update employee profile (manager roles only)
 */
router.put("/update/:id",
  upload.fields([
    { name: "employeePhoto", maxCount: 1 },
    { name: "aadhaarCardPhoto", maxCount: 1 },
    { name: "experienceLetter", maxCount: 1 },
    { name: "offerLetter", maxCount: 1 },
    { name: "joiningLetter", maxCount: 1 },
  ]),
  authorizeManagerRoles,
  async (req, res) => {
  try {
    const profile = await EmployeeModel.findOne({ 
      userId: req.params.id,
      isActive: true 
    });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Track changes for audit
    const changes = new Map();
    const updatableFields = [
      'employeeFullName', 'designation', 'department', 'branch', 'gender',
      'maritalStatus', 'dateOfBirth', 'personalContactNumber', 'personalEmailAddress',
      'workEmail', 'workPhoneNumber', 'permanentAddress', 'currentAddress',
      'emergencyContactName', 'emergencyContactNumber', 'emergencyContactRelationship',
      'dateOfJoining', 'reportingManager', 'dateOfLastPromotion',
      'offeredSalary',
      'educationQualification', 'previousEmployer', 'totalWorkExperience',
      'accountNumber', 'bankName', 'ifscCode', 'panNumber', 'aadharNumber'
    ];

    // Build update object and track changes
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

    if (req.files?.employeePhoto) {
      changes.set('employeePhoto', {
        oldValue: profile.employeePhoto,
        newValue: req.files.employeePhoto[0].path
      });
      updates.employeePhoto = req.files.employeePhoto[0].path;
    }

    if (req.files?.aadhaarCardPhoto) {
      changes.set('aadhaarCardPhoto', {
        oldValue: profile.aadhaarCardPhoto,
        newValue: req.files.aadhaarCardPhoto[0].path
      });
      updates.aadhaarCardPhoto = req.files.aadhaarCardPhoto[0].path;
    }

    if (req.files?.experienceLetter) {
      changes.set('experienceLetter', {
        oldValue: profile.experienceLetter,
        newValue: req.files.experienceLetter[0].path
      });
      updates.experienceLetter = req.files.experienceLetter[0].path;
    }

    if (req.files?.offerLetter) {
      changes.set('offerLetter', {
        oldValue: profile.offerLetter,
        newValue: req.files.offerLetter[0].path
      });
      updates.offerLetter = req.files.offerLetter[0].path;
    }

    if (req.files?.joiningLetter) {
      changes.set('joiningLetter', {
        oldValue: profile.joiningLetter,
        newValue: req.files.joiningLetter[0].path
      });
      updates.joiningLetter = req.files.joiningLetter[0].path;
    }

    if (req.body.compensationDetails !== undefined) {
      let nextComp = profile.compensationDetails || { ctc: "", basicSalary: "", variablePay: "", currency: "INR" };
      if (typeof req.body.compensationDetails === 'string') {
        try {
          nextComp = JSON.parse(req.body.compensationDetails);
        } catch (_) {}
      } else if (typeof req.body.compensationDetails === 'object') {
        nextComp = req.body.compensationDetails;
      }

      changes.set('compensationDetails', {
        oldValue: profile.compensationDetails,
        newValue: nextComp
      });
      updates.compensationDetails = {
        ctc: nextComp?.ctc || "",
        basicSalary: nextComp?.basicSalary || "",
        variablePay: nextComp?.variablePay || "",
        currency: nextComp?.currency || "INR",
      };
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No changes detected" });
    }

    // Add audit trail
    updates.updatedBy = req.user.userId;
    updates.$push = {
      updateHistory: {
        updatedBy: req.user.userId,
        changes: changes,
        reason: req.body.updateReason || "Profile update"
      }
    };

    const updatedProfile = await EmployeeModel.findOneAndUpdate(
      { userId: req.params.id },
      updates,
      { new: true, runValidators: true }
    ).select('-updateHistory -__v');

    res.json({
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

    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
});

/**
 * DELETE /delete/:id - Soft delete employee profile (manager roles only)
 */
router.delete("/delete/:id", authorizeManagerRoles, async (req, res) => {
  try {
    const profile = await EmployeeModel.findOneAndUpdate(
      { userId: req.params.id, isActive: true },
      { 
        isActive: false,
        updatedBy: req.user.userId,
        $push: {
          updateHistory: {
            updatedBy: req.user.userId,
            changes: new Map([['isActive', { oldValue: true, newValue: false }]]),
            reason: req.body.reason || "Profile deactivated"
          }
        }
      },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({ 
      message: "Employee profile deactivated successfully",
      employeeId: profile.employeeId
    });

  } catch (err) {
    console.error("DELETE /delete/:id error:", err);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
});

/**
 * POST /approve/:id - Approve employee profile (manager roles only)
 */
router.post("/approve/:id", authorizeManagerRoles, async (req, res) => {
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
 * GET /stats - Get employee statistics (manager roles only)
 */
router.get("/stats", authorizeManagerRoles, async (req, res) => {
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
 * GET /export - Export employee data (manager roles only)
 */
router.get("/export", authorizeManagerRoles, async (req, res) => {
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