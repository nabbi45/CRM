import express from "express";
import { UserModel } from "../models/UserModel.js";
import { BookingModel } from "../models/bookingModel.js";
import DailyActivityModel from "../models/DailyActivityModel.js";
import crypto from 'crypto';  // Used to generate random tokens
import nodemailer from 'nodemailer';  // Used to send emails
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateUser, authorizeDevRole, authorizeFeature } from '../middlewares/authMiddleware.js';
import { toLowerEmail, toUpperText } from '../utils/textNormalize.js';
import { canManageSecurity, getClientIp, isIpAllowed } from '../utils/ipAccess.js';
import { EmployeeModel } from '../models/EmployeeProfile.js';
import { prepareUploadFile, toDataUri } from '../utils/uploadCompression.js';
dotenv.config()
const saltRounds = 5;
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const FEATURE_KEYS = [
  'dashboard_overview',
  'new_booking',
  'projection_leads',
  'projection_leads_all',
  'all_bookings',
  'proforma_invoice',
  'agreements_generator',
  'generated_documents',
  'client_documents',
  'manage_users',
  'manage_services',
  'company_profile',
  'employee_profile',
  'timecard',
  'timecard_edit',
  'communication',
  'trash',
  'manage_documents',
  'edit_documents',
  'security',
];

const normalizeRole = (role = '') => role.toString().trim().toLowerCase();

const DEFAULT_ROLE_PERMISSIONS = {
  dev: FEATURE_KEYS,
  srdev: FEATURE_KEYS,
  'super admin': FEATURE_KEYS,
  admin: [
    'dashboard_overview',
    'new_booking',
    'projection_leads',
    'projection_leads_all',
    'all_bookings',
    'proforma_invoice',
    'agreements_generator',
    'generated_documents',
    'client_documents',
    'manage_documents',
    'edit_documents',
    'manage_users',
    'manage_services',
    'company_profile',
    'timecard',
    'timecard_edit',
    'communication',
    'employee_profile',
    'security',
  ],
  'senior admin': [
    'dashboard_overview',
    'new_booking',
    'projection_leads',
    'projection_leads_all',
    'all_bookings',
    'proforma_invoice',
    'agreements_generator',
    'generated_documents',
    'client_documents',
    'manage_documents',
    'edit_documents',
    'manage_users',
    'manage_services',
    'company_profile',
    'timecard',
    'timecard_edit',
    'communication',
    'employee_profile',
    'security',
  ],
  hr: ['timecard', 'timecard_edit', 'communication', 'employee_profile'],
  bdm: [
    'dashboard_overview',
    'new_booking',
    'projection_leads',
    'all_bookings',
    'proforma_invoice',
    'generated_documents',
    'timecard',
    'communication',
    'employee_profile',
  ],
};

const sanitizeFeaturePermissions = (permissions = []) => {
  if (!Array.isArray(permissions)) return [];
  let list = [...permissions];
  // Migrate old keys
  if (list.includes('my_profile') || list.includes('create_profile') || list.includes('manage_employees')) {
    list.push('employee_profile');
  }
  if (list.includes('leave_management')) list.push('timecard');
  return [...new Set(list.filter((key) => FEATURE_KEYS.includes(key)))];
};

const getDefaultFeaturePermissionsForRole = (role) => {
  const normalized = normalizeRole(role);
  const defaults = DEFAULT_ROLE_PERMISSIONS[normalized];
  if (defaults?.length) return defaults;
  return ['dashboard_overview', 'timecard', 'communication', 'employee_profile'];
};

const bookingAccessConditions = (userId) => [
  { user_id: userId },
  { "shared_with.user_id": userId },
  { "term_shares.term_1.creator.user_id": userId },
  { "term_shares.term_1.shared_with.user_id": userId },
  { "term_shares.term_2.creator.user_id": userId },
  { "term_shares.term_2.shared_with.user_id": userId },
  { "term_shares.term_3.creator.user_id": userId },
  { "term_shares.term_3.shared_with.user_id": userId },
];

const withResolvedProfilePictures = async (users = []) => {
  const plainUsers = Array.isArray(users)
    ? users.map((user) => (typeof user?.toObject === "function" ? user.toObject() : { ...user }))
    : [];

  const missingIds = plainUsers
    .filter((user) => !user.profilePicture)
    .map((user) => String(user._id || ""))
    .filter(Boolean);

  if (!missingIds.length) return plainUsers;

  const employeeProfiles = await EmployeeModel.find({ userId: { $in: missingIds } })
    .select("userId employeePhoto")
    .lean();

  const photoMap = new Map(
    employeeProfiles
      .filter((profile) => profile?.userId && profile?.employeePhoto)
      .map((profile) => [String(profile.userId), profile.employeePhoto])
  );

  return plainUsers.map((user) => ({
    ...user,
    profilePicture: user.profilePicture || photoMap.get(String(user._id || "")) || "",
  }));
};

const UserRoutes = express.Router();

//Creating User
UserRoutes.post("/adduser", authenticateUser, authorizeFeature('manage_users'), async (req, res) => {
  try {
    const { name, email, password, user_role, feature_permissions } = req.body;

    // Check if all required fields are provided
    if (!name || !email || !password) {
      return res.status(400).send({
        message: "send all required fields: name, email, password",
      });
    }

    // Convert email to lowercase
    const normalizedEmail = toLowerEmail(email);

    // Check if the email is already registered
    const existingUser = await UserModel.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).send({ message: "Email is already registered" });
    }

    // Hash the password before saving the user
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user with hashed password
    const new_user = {
      name: toUpperText(name),
      email: normalizedEmail,
      password: hashedPassword,
      user_role,
      feature_permissions: sanitizeFeaturePermissions(feature_permissions).length
        ? sanitizeFeaturePermissions(feature_permissions)
        : getDefaultFeaturePermissionsForRole(user_role),
    };

    const User = await UserModel.create(new_user);
    return res.status(201).send(User);

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});

//edit user (requires manage_users permission)
UserRoutes.patch('/edituser/:id', authenticateUser, authorizeFeature('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Ensure there are fields to update
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).send({ message: 'No fields provided for update' });
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'feature_permissions')) {
      updates.feature_permissions = sanitizeFeaturePermissions(updates.feature_permissions);
    }

    if (updates.name) {
      updates.name = toUpperText(updates.name);
    }

    if (updates.user_role && !Object.prototype.hasOwnProperty.call(updates, 'feature_permissions')) {
      updates.feature_permissions = getDefaultFeaturePermissionsForRole(updates.user_role);
    }

    // Normalize email if it's being updated
    if (updates.email) {
      updates.email = toLowerEmail(updates.email);

      // Check if the new email is already registered
      const existingUser = await UserModel.findOne({ email: updates.email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(409).send({ message: 'Email is already registered' });
      }
    }

    // Hash the password if it's being updated
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, saltRounds);
    }

    // Update user by ID
    const updatedUser = await UserModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true } // Return updated user and validate fields
    );

    if (!updatedUser) {
      return res.status(404).send({ message: 'User not found' });
    }

    return res.status(200).send({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error(error.message);
    return res.status(500).send({ message: error.message });
  }
});

// User Self Update Profile Route
UserRoutes.put('/update-profile', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, email, profilePicture, password } = req.body;

    const updates = {};
    if (name) updates.name = toUpperText(name);
    if (profilePicture) updates.profilePicture = profilePicture;

    if (email) {
      updates.email = toLowerEmail(email);
      // Check if another user has this email
      const existingUser = await UserModel.findOne({ email: updates.email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(409).send({ message: 'Email is already registered by another user' });
      }
    }

    if (password) {
      if (password.toString().trim().length < 6) {
        return res.status(400).send({ message: 'Password must be at least 6 characters long' });
      }
      updates.password = await bcrypt.hash(password.toString().trim(), saltRounds);
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    ).select('-password'); // Exclude password from response

    if (!updatedUser) {
      return res.status(404).send({ message: 'User not found' });
    }

    return res.status(200).send({ 
       message: 'Profile updated successfully', 
       user: updatedUser 
    });

  } catch (error) {
    console.error(error.message);
    return res.status(500).send({ message: error.message });
  }
});

UserRoutes.post('/profile-picture', authenticateUser, memoryUpload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'Profile picture file is required' });
    }

    const uploadFile = await prepareUploadFile(req.file);
    const dataURI = toDataUri(uploadFile);
    const result = await cloudinary.uploader.upload(dataURI, {
      resource_type: 'image',
      folder: 'user_profile_pictures',
      public_id: `user_${req.user.userId}_${Date.now()}`,
    });

    const updatedUser = await UserModel.findByIdAndUpdate(
      req.user.userId,
      { $set: { profilePicture: result.secure_url } },
      { new: true }
    ).select('-password');

    await EmployeeModel.findOneAndUpdate(
      { userId: req.user.userId, isActive: true },
      { $set: { employeePhoto: result.secure_url } }
    );

    return res.status(200).send({ message: 'Profile picture updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    return res.status(500).send({ message: error.message || 'Failed to upload profile picture' });
  }
});

UserRoutes.delete('/profile-picture', authenticateUser, async (req, res) => {
  try {
    const updatedUser = await UserModel.findByIdAndUpdate(
      req.user.userId,
      { $unset: { profilePicture: "" } },
      { new: true }
    ).select('-password');

    await EmployeeModel.findOneAndUpdate(
      { userId: req.user.userId, isActive: true },
      { $unset: { employeePhoto: "" } }
    );

    return res.status(200).send({ message: 'Profile picture deleted successfully', user: updatedUser });
  } catch (error) {
    console.error('Profile picture delete error:', error);
    return res.status(500).send({ message: error.message || 'Failed to delete profile picture' });
  }
});


// Deleting User (requires manage_users permission)
UserRoutes.delete("/deleteuser/:id", authenticateUser, authorizeFeature('manage_users'), async (req, res) => {
  try {
    const { id } = req.params; // Assuming you are using a unique ID for the user

    // Check if the user exists
    const existingUser = await UserModel.findById(id);
    if (!existingUser) {
      return res.status(404).send({ message: "User not found" });
    }

    // Delete the user
    await UserModel.findByIdAndDelete(id);

    return res.status(200).send({ message: "User deleted successfully" });
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});
//listing all users (requires manage_users permission)
UserRoutes.get('/all', authenticateUser, authorizeFeature('manage_users'), async (req, res) => {
  try {
    const userDocs = await UserModel.find({}).select("-password");
    const Users = await withResolvedProfilePictures(userDocs);
    if (Users.length === 0) {
      return res.status(404).send({
        message: "No Users found",
      });
    }
    const no_of_users = Users.length;
    // console.log(no_of_users);

    res.status(200).send({ Users })
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
})

// Sanitized user list for dropdowns/share selectors
UserRoutes.get('/options', authenticateUser, async (req, res) => {
  try {
    const userDocs = await UserModel.find({}, 'name user_role profilePicture').sort({ name: 1 }).lean();
    const users = await withResolvedProfilePictures(userDocs);
    return res.status(200).send({ users });
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});

// Assuming you already have the user object after login
export const generateToken = (user) => {
  return jwt.sign({
    userId: user._id,
    user_role: user.user_role,
    feature_permissions: user.feature_permissions || []
  }, process.env.JWT_SECRET, {
    expiresIn: '24h', // Set token expiration time
  });
};
//login
UserRoutes.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).send({
        message: "Please provide both email and password.",
      });
    }

    const normalizedEmail = toLowerEmail(email);
    const submittedPassword = password.toString();

    // Find the user by email
    const user = await UserModel.findOne({ email: normalizedEmail });


    if (!user) {
      return res.status(404).send({
        message: "User not found.",
      });
    }

    let isPasswordValid = false;
    if (typeof user.password === "string" && user.password) {
      try {
        isPasswordValid = await bcrypt.compare(submittedPassword, user.password);
      } catch (error) {
        isPasswordValid = false;
      }

      // Backward compatibility for any legacy/plain-text passwords already stored in DB.
      if (!isPasswordValid && submittedPassword === user.password) {
        isPasswordValid = true;
        user.password = await bcrypt.hash(submittedPassword, saltRounds);
      }
    }

    if (!isPasswordValid) {
      return res.status(401).send({
        message: "Invalid email or password.",
      });
    }

    user.isActive = true;
    await user.save();

    if (!canManageSecurity(user.user_role)) {
      const clientIp = getClientIp(req);
      const { allowed } = await isIpAllowed(clientIp);
      if (!allowed) {
        return res.status(403).send({
          message: "Access blocked from this network. Please connect from an approved office IP or contact an administrator.",
          code: "IP_RESTRICTED",
          clientIp,
        });
      }
    }

    const token = generateToken(user); // Generate JWT token

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    await DailyActivityModel.findOneAndUpdate(
      { userId: user._id, date: today },
      { 
        $setOnInsert: { firstOnline: now },
        $set: { lastOnline: now } 
      },
      { upsert: true, new: true }
    );

    // If credentials are valid, send a success response
    res.status(200).send({
      token, user
    });

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});

//logout
UserRoutes.patch('/logout/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await UserModel.findByIdAndUpdate(id, { isActive: false });

    if (!user) {
      return res.status(404).send({
        message: "User not found.",
      });
    }

    const today = new Date().toISOString().split('T')[0];
    await DailyActivityModel.findOneAndUpdate(
      { userId: id, date: today },
      { $set: { lastOnline: new Date() } }
    );

    res.send(user);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

// Ping activity endpoint
UserRoutes.post('/ping', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    await DailyActivityModel.findOneAndUpdate(
      { userId: userId, date: today },
      { 
        $setOnInsert: { firstOnline: now },
        $set: { lastOnline: now } 
      },
      { upsert: true, new: true }
    );
    res.status(200).send({ message: "Ping successful" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});


// Get daily activities for a given date
UserRoutes.get('/activities/:date', authenticateUser, authorizeFeature('timecard'), async (req, res) => {
  try {
    const { date } = req.params;
    const activities = await DailyActivityModel.find({ date });
    res.status(200).send({ activities });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

//getting all the bookings for specific user

UserRoutes.get('/bookings/:id', authenticateUser, async (req, res) => {
  const id = req.params.id;
  try {
    if (!req.params.id) {
      return res.status(400).send({
        message: "Not A VALID USER",
      });
    }
    const Bookings = await BookingModel.find({
      isDeleted: { $ne: true },
      $or: bookingAccessConditions(id),
    });
    //  console.log(Bookings)
    if (Bookings.length === 0) {
      return res.status(404).send({
        message: "No bookings found for this user",
      });
    }
    res.status(200).send(Bookings)

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
})

//unified search 
UserRoutes.get('/:id?', authenticateUser, async (req, res) => {
  const booking_id = req.params.id; // This may be undefined if no id is provided
  const searchPattern = req.query.pattern; // Search pattern from the query parameter
  const userRole = normalizeRole(req.query.userRole || req.user?.user_role || ""); // Assuming user's role is stored in req.user
  const userId = req.query.userId || req.user?.userId || req.user?.user_id; // Assuming user's ID is stored in req.user
  // console.log(userRole,userId);
  let contactNo = parseInt(searchPattern)
  const privilegedRoles = ['dev', 'admin', 'senior admin', 'srdev', 'sr dev', 'super admin', 'director'];

  try {
    let Booking;

    if (booking_id) {
      // If an ID is provided, search by the booking ID
      if (privilegedRoles.includes(userRole)) {
        Booking = await BookingModel.find({ _id: booking_id });
      } else {
        // If the user is not dev, admin, or senior admin, search only within their bookings
        Booking = await BookingModel.find({
          _id: booking_id,
          $or: bookingAccessConditions(userId),
        });
      }

      if (Booking.length === 0) {
        return res.status(404).send({
          message: "No bookings found with this id",
        });
      }
    } else if (searchPattern) {
      // Combine search for both company_name and contact_person under the same pattern
      const searchQuery = {
        isDeleted: false, // Ensure we do not return trashed bookings
        $or: [
          { company_name: { $regex: searchPattern, $options: 'i' } },
          { contact_person: { $regex: searchPattern, $options: 'i' } },
          { email: { $regex: searchPattern, $options: 'i' } },
          { pan: { $regex: searchPattern, $options: 'i' } },
          { gst: { $regex: searchPattern, $options: 'i' } },
          { services: { $regex: searchPattern, $options: 'i' } },
          { status: { $regex: searchPattern, $options: 'i' } }, // Replaces status filter
          { bank: { $regex: searchPattern, $options: 'i' } }, // Replaces paymentmode filter
          { bdm: { $regex: searchPattern, $options: 'i' } }, // Replaces bdm filter
          { $expr: { $regexMatch: { input: { $toString: "$contact_no" }, regex: searchPattern } } },
          { $expr: { $regexMatch: { input: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, regex: searchPattern } } }, // Replaces booking date filter
          { $expr: { $regexMatch: { input: { $dateToString: { format: "%Y-%m-%d", date: "$payment_date" } }, regex: searchPattern } } } // Replaces payment date filter
        ]
      };

      if (privilegedRoles.includes(userRole)) {
        Booking = await BookingModel.find(searchQuery).sort({ createdAt: -1 });
      } else {
        // Search within user's bookings only if not dev, admin, or senior admin
        Booking = await BookingModel.find({
          isDeleted: false,
          $and: [
            { $or: searchQuery.$or },
            { $or: bookingAccessConditions(userId) },
          ],
        }).sort({ createdAt: -1 });
      }

      if (Booking.length === 0) {
        return res.status(200).send([]);
      }
    } else {
      // If neither an ID nor a search pattern is provided, return an error
      return res.status(400).send({
        message: "Either id or pattern query parameter is required",
      });
    }
    res.status(200).send(Booking);

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});

//check user is a valid or not 
UserRoutes.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    if (!req.params.id) {
      return res.status(400).send({
        message: "Not A VALID USER",
      });
    }
    const User = await UserModel.find({ _id: id });
    //  console.log(Bookings)
    if (User.length === 0) {
      return res.status(404).send({
        message: "No User found with this id",
        status: false
      });
    }
    res.status(200).send({ message: "VALID USER", status: true })

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
})

//
UserRoutes.put('/password-reset', async (req, res) => {
  const { password, email } = req.body;

  // Validate if email and password are provided
  if (!email || !password) {
    return res.status(400).send({
      message: "Please provide both email and new password",
    });
  }

  // Convert email to lowercase
  const normalizedEmail = email.toLowerCase();

  try {
    // Find the user by email
    const user = await UserModel.findOne({ email: normalizedEmail });

    // If no user is found, send an error response
    if (!user) {
      return res.status(404).send({ message: "User not found with this email" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update the user's password
    user.password = hashedPassword;
    await user.save();

    // Send success response
    return res.status(200).send({ message: "Password updated successfully" });

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});

// Route to request password reset
UserRoutes.post('/request-reset-password', async (req, res) => {
  const { email } = req.body;

  try {
    // Find the user by email
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // console.log(user);

    // Generate a reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Token expires in 1 hour
    const resetPasswordExpires = Date.now() + 3600000;

    // Save the token and expiration to the user's document
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetPasswordExpires;
    await user.save();

    // Create a reset URL with the token
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    // Send an email with the reset link (setup `nodemailer` transport)
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || "smtp.hostinger.com",
      port: process.env.MAIL_PORT || 465,
      secure: true, 
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const mailOptions = {
      to: user.email,
      from: process.env.MAIL_USER,
      subject: 'Password Reset Request',
      text: `You are receiving this email because you (or someone else) have requested to reset the password for your account.\n\n
      Please click the following link, or paste it into your browser to complete the process:\n\n
      ${resetUrl}\n\n
      If you did not request this, please ignore this email and your password will remain unchanged.`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

//password reset route
UserRoutes.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    // Find the user by reset token and check if the token is still valid
    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }  // Check if token has not expired
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(5);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Save the new password and clear the reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default UserRoutes;
