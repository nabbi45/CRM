import express from "express";
import { upload } from "../middlewares/upload.js";
import { EmployeeModel } from "../models/EmployeeProfile.js";
import { UserModel } from "../models/UserModel.js";
import { authenticateUser, authorizeFeature } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Higher authority roles
const HIGHER_ROLES = ["admin", "senior admin", "super admin", "hr", "dev", "srdev"];

/**
 * Check if user is a higher authority or has employee_profile feature permission
 */
const isHigherAuthority = (user) => {
  const role = (user?.user_role || "").trim().toLowerCase();
  const permissions = user?.feature_permissions || [];
  return HIGHER_ROLES.includes(role) || permissions.includes('employee_profile');
};

/**
 * Authorization - Allow profile owner or higher authority
 */
const authorizeSelfOrAuthority = (req, res, next) => {
  const requestedUserId = req.params.id;
  if (req.user.userId !== requestedUserId && !isHigherAuthority(req.user)) {
    return res.status(403).json({ 
      message: "Access denied. You can only access your own profile or need higher authority privileges." 
    });
  }
  next();
};

/**
 * Higher authority only authorization (uses employee_profile feature permission)
 */
const authorizeHigherAuthority = (req, res, next) => {
  if (!isHigherAuthority(req.user)) {
    return res.status(403).json({ 
      message: "Access denied. Only higher authorities can perform this action." 
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
    'dateOfJoining', 'reportingManager', 'educationQualification', 'totalWorkExperience',
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
 * GET /all - List all employee profiles (higher authority only)
 */
router.get("/all", authorizeHigherAuthority, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      department, 
      branch, 
      status,
      search 
    } = req.query;

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
        .select('-updateHistory -additionalDetails -compensationDetails -authorityNotes')
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
 * GET /pending-approvals - List profiles pending review (higher authority only)
 */
router.get("/pending-approvals", authorizeHigherAuthority, async (req, res) => {
  try {
    const pending = await EmployeeModel.find({ 
      profileCompletionStatus: "pending_review",
      isActive: true 
    })
      .select('-updateHistory -additionalDetails -compensationDetails -authorityNotes')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ profiles: pending, count: pending.length });
  } catch (err) {
    console.error("GET /pending-approvals error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

/**
 * GET /profile/:id - Get specific employee profile
 */
router.get("/profile/:id", authorizeSelfOrAuthority, async (req, res) => {
  try {
    const isAuthority = isHigherAuthority(req.user);
    const selectFields = isAuthority 
      ? '-updateHistory' 
      : '-updateHistory -compensationDetails -authorityNotes -offeredSalary';

    const profile = await EmployeeModel.findOne({ 
      userId: req.params.id,
      isActive: true 
    }).select(selectFields);

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({ profile, isAuthority });
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
      const existingProfile = await EmployeeModel.findOne({ 
        userId: req.user.userId 
      });
      
      if (existingProfile) {
        return res.status(400).json({ 
          error: "Profile already exists for this user" 
        });
      }

      if (!req.files?.employeePhoto || !req.files?.aadhaarCardPhoto) {
        return res.status(400).json({
          error: "Both employee photo and Aadhaar card photo are required"
        });
      }

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

      const profileData = {
        userId: req.user.userId,
        ...req.body,
        personalEmailAddress: req.body.personalEmailAddress.toLowerCase(),
        workEmail: req.body.workEmail.toLowerCase(),
        panNumber: req.body.panNumber.toUpperCase(),
        employeePhoto: req.files.employeePhoto[0].path,
        aadhaarCardPhoto: req.files.aadhaarCardPhoto[0].path,
        createdBy: req.user.userId,
        profileCompletionStatus: "pending_review"
      };

      const profile = new EmployeeModel(profileData);
      await profile.save();
      await UserModel.findByIdAndUpdate(req.user.userId, {
        $set: { profilePicture: profileData.employeePhoto }
      });

      const responseProfile = profile.toObject();
      delete responseProfile.updateHistory;

      res.status(201).json({
        message: "Employee profile created successfully. Pending approval from authorities.",
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
 * PUT /employee-update/:id - Employee self-update (goes back to pending_review)
 */
router.put("/employee-update/:id", authorizeSelfOrAuthority, async (req, res) => {
  try {
    const profile = await EmployeeModel.findOne({ 
      userId: req.params.id,
      isActive: true 
    });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const isSelf = req.user.userId === req.params.id;
    const authority = isHigherAuthority(req.user);

    // Track changes for audit
    const changes = new Map();
    const updatableFields = [
      'employeeFullName', 'designation', 'department', 'branch', 'gender',
      'maritalStatus', 'dateOfBirth', 'personalContactNumber', 'personalEmailAddress',
      'workEmail', 'workPhoneNumber', 'permanentAddress', 'currentAddress',
      'emergencyContactName', 'emergencyContactNumber', 'emergencyContactRelationship',
      'dateOfJoining', 'reportingManager', 'dateOfLastPromotion',
      'educationQualification', 'previousEmployer', 'totalWorkExperience',
      'accountNumber', 'bankName', 'ifscCode', 'panNumber', 'aadharNumber'
    ];

    // Authority-only fields
    if (authority) {
      updatableFields.push('offeredSalary');
    }

    const updates = {};
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined && String(req.body[field]) !== String(profile[field])) {
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

    // If self-update, set status back to pending_review
    if (isSelf && !authority) {
      updates.profileCompletionStatus = "pending_review";
    }

    updates.updatedBy = req.user.userId;
    updates.$push = {
      updateHistory: {
        updatedBy: req.user.userId,
        changes: changes,
        reason: req.body.updateReason || (isSelf ? "Self-update by employee" : "Updated by authority")
      }
    };

    const updatedProfile = await EmployeeModel.findOneAndUpdate(
      { userId: req.params.id },
      updates,
      { new: true, runValidators: true }
    ).select('-updateHistory');

    res.json({
      message: isSelf && !authority 
        ? "Profile updated. Sent for re-approval." 
        : "Profile updated successfully.",
      profile: updatedProfile,
      changesCount: changes.size
    });

  } catch (err) {
    console.error("PUT /employee-update/:id error:", err);
    
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
 * POST /approve/:id - Approve employee profile (higher authority only)
 */
router.post("/approve/:id", authorizeHigherAuthority, async (req, res) => {
  try {
    const profile = await EmployeeModel.findOneAndUpdate(
      { userId: req.params.id, isActive: true },
      {
        profileCompletionStatus: "approved",
        approvedBy: req.user.userId,
        approvedAt: new Date(),
        updatedBy: req.user.userId,
        rejectedBy: null,
        rejectedAt: null,
        rejectionRemark: null,
        $push: {
          updateHistory: {
            updatedBy: req.user.userId,
            changes: new Map([['profileCompletionStatus', { 
              oldValue: 'pending_review', 
              newValue: 'approved' 
            }]]),
            reason: "Profile approved by authority"
          }
        }
      },
      { new: true }
    ).select('-updateHistory');

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
 * POST /reject/:id - Reject employee profile (higher authority only)
 */
router.post("/reject/:id", authorizeHigherAuthority, async (req, res) => {
  try {
    const { remark } = req.body;
    if (!remark) {
      return res.status(400).json({ error: "Rejection remark is required" });
    }

    const profile = await EmployeeModel.findOneAndUpdate(
      { userId: req.params.id, isActive: true },
      {
        profileCompletionStatus: "rejected",
        rejectedBy: req.user.userId,
        rejectedAt: new Date(),
        rejectionRemark: remark,
        updatedBy: req.user.userId,
        $push: {
          updateHistory: {
            updatedBy: req.user.userId,
            changes: new Map([['profileCompletionStatus', { 
              oldValue: 'pending_review', 
              newValue: 'rejected'
            }]]),
            reason: `Rejected: ${remark}`
          }
        }
      },
      { new: true }
    ).select('-updateHistory');

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({
      message: "Employee profile rejected",
      profile
    });

  } catch (err) {
    console.error("POST /reject/:id error:", err);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
});

/**
 * POST /additional-details/:id - Add additional document/details (higher authority only)
 */
router.post("/additional-details/:id", 
  authorizeHigherAuthority,
  upload.single("file"),
  async (req, res) => {
    try {
      const { docType, title, notes } = req.body;

      if (!docType || !title) {
        return res.status(400).json({ error: "Document type and title are required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "File upload is required" });
      }

      const profile = await EmployeeModel.findOneAndUpdate(
        { userId: req.params.id, isActive: true },
        {
          $push: {
            additionalDetails: {
              docType,
              title,
              fileUrl: req.file.path,
              notes: notes || "",
              addedBy: req.user.userId,
              addedByName: req.user.name || "Authority"
            }
          }
        },
        { new: true }
      ).select('additionalDetails employeeFullName');

      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      res.json({
        message: "Additional details added successfully",
        additionalDetails: profile.additionalDetails
      });

    } catch (err) {
      console.error("POST /additional-details/:id error:", err);
      res.status(500).json({ error: "Server error", details: err.message });
    }
  }
);

/**
 * GET /additional-details/:id - Get additional details for a profile
 */
router.get("/additional-details/:id", authorizeSelfOrAuthority, async (req, res) => {
  try {
    const profile = await EmployeeModel.findOne({ 
      userId: req.params.id,
      isActive: true 
    }).select('additionalDetails compensationDetails authorityNotes employeeFullName');

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const response = {
      additionalDetails: profile.additionalDetails || [],
      employeeFullName: profile.employeeFullName,
      compensationDetails: profile.compensationDetails || {}
    };

    // Only include authority notes for authorities
    if (isHigherAuthority(req.user)) {
      response.authorityNotes = profile.authorityNotes || [];
    }

    res.json(response);
  } catch (err) {
    console.error("GET /additional-details/:id error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

/**
 * PUT /compensation/:id - Update compensation details (higher authority only)
 */
router.put("/compensation/:id", authorizeHigherAuthority, async (req, res) => {
  try {
    const { ctc, basicSalary, hra, incentives, otherAllowances, notes } = req.body;

    const profile = await EmployeeModel.findOneAndUpdate(
      { userId: req.params.id, isActive: true },
      {
        compensationDetails: { ctc, basicSalary, hra, incentives, otherAllowances, notes }
      },
      { new: true }
    ).select('compensationDetails employeeFullName');

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({
      message: "Compensation details updated",
      compensationDetails: profile.compensationDetails
    });

  } catch (err) {
    console.error("PUT /compensation/:id error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

/**
 * POST /authority-note/:id - Add authority note (higher authority only)
 */
router.post("/authority-note/:id", authorizeHigherAuthority, async (req, res) => {
  try {
    const { note } = req.body;
    if (!note) {
      return res.status(400).json({ error: "Note content is required" });
    }

    const profile = await EmployeeModel.findOneAndUpdate(
      { userId: req.params.id, isActive: true },
      {
        $push: {
          authorityNotes: {
            note,
            addedBy: req.user.userId,
            addedByName: req.user.name || "Authority"
          }
        }
      },
      { new: true }
    ).select('authorityNotes employeeFullName');

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json({
      message: "Note added successfully",
      authorityNotes: profile.authorityNotes
    });

  } catch (err) {
    console.error("POST /authority-note/:id error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

/**
 * DELETE /delete/:id - Soft delete employee profile (higher authority only)
 */
router.delete("/delete/:id", authorizeHigherAuthority, async (req, res) => {
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
 * GET /stats - Get employee statistics (higher authority only)
 */
router.get("/stats", authorizeHigherAuthority, async (req, res) => {
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

export default router;
