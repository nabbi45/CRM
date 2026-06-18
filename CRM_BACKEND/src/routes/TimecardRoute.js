import express from "express";
import AttendanceModel from "../models/AttendanceModel.js";
import HolidayModel from "../models/HolidayModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { UserModel } from "../models/UserModel.js";
import { EmployeeModel } from "../models/EmployeeProfile.js";

const router = express.Router();

router.use(authenticateUser);

const isTimecardAdmin = (userSession) => {
  const permissions = userSession.feature_permissions || [];
  const role = (userSession.user_role || '').toLowerCase().trim();
  if (permissions.length === 0) {
    return ["admin", "senior admin", "super admin", "director", "dev", "srdev", "sr dev", "hr"].includes(role);
  }

  return (
    permissions.includes("timecard_edit") ||
    role === "super admin" ||
    role === "director" ||
    role === "dev" ||
    role === "srdev" ||
    role === "sr dev"
  );
};

// =================== HOLIDAYS ===================

router.get("/holidays", async (req, res) => {
  try {
    const holidays = await HolidayModel.find().sort({ date: 1 });
    res.json({ holidays });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch holidays" });
  }
});

router.post("/holidays", async (req, res) => {
  if (!isTimecardAdmin(req.user)) {
    return res.status(403).json({ error: "Unauthorized to add holidays" });
  }
  try {
    const { date, name } = req.body;
    if (!date || !name) return res.status(400).json({ error: "Date and name required" });
    
    // Check if exists
    const existing = await HolidayModel.findOne({ date });
    if (existing) {
      existing.name = name;
      existing.addedBy = req.user.userId;
      await existing.save();
      return res.json({ message: "Holiday updated", holiday: existing });
    }

    const newHoliday = new HolidayModel({ date, name, addedBy: req.user.userId });
    await newHoliday.save();
    res.status(201).json({ message: "Holiday added", holiday: newHoliday });
  } catch (error) {
    res.status(500).json({ error: "Failed to add holiday" });
  }
});

router.delete("/holidays/:id", async (req, res) => {
  if (!isTimecardAdmin(req.user)) {
    return res.status(403).json({ error: "Unauthorized to delete holidays" });
  }
  try {
    await HolidayModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Holiday deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete holiday" });
  }
});

// =================== ATTENDANCE ===================

// Mark attendance (Admin/HR only)
router.post("/attendance/mark", async (req, res) => {
  if (!isTimecardAdmin(req.user)) {
    return res.status(403).json({ error: "Unauthorized to mark attendance" });
  }
  try {
    const { userId, date, status, notes } = req.body;
    if (!userId || !date || !status) {
      return res.status(400).json({ error: "userId, date, and status are required" });
    }

    const existing = await AttendanceModel.findOne({ userId, date });
    if (existing) {
      existing.status = status;
      if (notes !== undefined) existing.notes = notes;
      existing.markedBy = req.user.userId;
      await existing.save();
      return res.json({ message: "Attendance updated", attendance: existing });
    }

    const newAtt = new AttendanceModel({
      userId,
      date,
      status,
      notes: notes || "",
      markedBy: req.user.userId
    });
    await newAtt.save();
    res.json({ message: "Attendance marked", attendance: newAtt });
  } catch (error) {
    console.error("Mark attendance error:", error);
    res.status(500).json({ error: "Failed to mark attendance" });
  }
});

// Get attendance for a specific date (For Admin/HR to view daily sheet)
router.get("/attendance/daily/:date", async (req, res) => {
  if (!isTimecardAdmin(req.user)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const date = req.params.date;
    const records = await AttendanceModel.find({ date }).populate("userId", "name email");
    res.json({ records });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch daily attendance" });
  }
});

// Get My Attendance (for a month) Map of date -> status
router.get("/attendance/my-month/:month", async (req, res) => {
  try {
    const monthPrefix = req.params.month; // e.g., '2023-10'
    const records = await AttendanceModel.find({
      userId: req.user.userId,
      date: { $regex: `^${monthPrefix}` }
    });
    res.json({ records });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// Get User Attendance (for HR to view an employee's month)
router.get("/attendance/user-month/:userId/:month", async (req, res) => {
  if (!isTimecardAdmin(req.user)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const monthPrefix = req.params.month;
    const records = await AttendanceModel.find({
      userId: req.params.userId,
      date: { $regex: `^${monthPrefix}` }
    });
    res.json({ records });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// Get all users for the daily attendance marking view
router.get("/employees", async (req, res) => {
  if (!isTimecardAdmin(req.user)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const users = await UserModel.find().select("name email user_role profilePicture").lean();
    const missingIds = users
      .filter((user) => !user.profilePicture)
      .map((user) => String(user._id || ""))
      .filter(Boolean);

    let photoMap = new Map();
    if (missingIds.length) {
      const employeeProfiles = await EmployeeModel.find({ userId: { $in: missingIds } })
        .select("userId employeePhoto")
        .lean();
      photoMap = new Map(
        employeeProfiles
          .filter((profile) => profile?.userId && profile?.employeePhoto)
          .map((profile) => [String(profile.userId), profile.employeePhoto])
      );
    }

    const normalizedUsers = users.map((user) => ({
      ...user,
      profilePicture: user.profilePicture || photoMap.get(String(user._id || "")) || "",
    }));
    res.json({ users: normalizedUsers });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

export default router;
