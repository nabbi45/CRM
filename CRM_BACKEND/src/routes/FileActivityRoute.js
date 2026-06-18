import express from "express";
import { FileActivityModel } from "../models/FileActivityModel.js";
import { BookingModel } from "../models/bookingModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const FileActivityRoutes = express.Router();

const adminRoles = ["admin", "senior admin", "super admin", "dev", "srdev", "director", "hr", "sr dev"];
const canAccessBooking = (booking, userId, userRole = "") => {
  const normalizedRole = String(userRole || "").trim().toLowerCase();
  if (adminRoles.includes(normalizedRole)) return true;
  const normalizedUserId = String(userId || "");
  if (!booking || !normalizedUserId) return false;
  if (String(booking.user_id || "") === normalizedUserId) return true;
  if ((booking.shared_with || []).some((item) => String(item?.user_id || "") === normalizedUserId)) return true;
  return ["term_1", "term_2", "term_3"].some((termKey) => {
    const termShare = booking?.term_shares?.[termKey] || {};
    if (String(termShare?.creator?.user_id || "") === normalizedUserId) return true;
    return (termShare?.shared_with || []).some((item) => String(item?.user_id || "") === normalizedUserId);
  });
};

// Helper to sync services from Booking to FileActivity
const syncServices = (activity, booking) => {
  const bookingServices = booking.services || [];
  
  // Sync Application services
  const existingAppServices = activity.application.map(a => a.serviceName);
  const newAppServices = bookingServices.filter(s => !existingAppServices.includes(s));
  newAppServices.forEach(s => {
    activity.application.push({ serviceName: s, status: "Pending", date: null });
  });

  // Sync Acknowledgement services
  const existingAckServices = activity.acknowledgement.map(a => a.serviceName);
  const newAckServices = bookingServices.filter(s => !existingAckServices.includes(s));
  newAckServices.forEach(s => {
    activity.acknowledgement.push({ serviceName: s, status: "Pending", date: null });
  });

  return activity;
};

// GET or CREATE file activity for a booking
FileActivityRoutes.get("/:bookingId", authenticateUser, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await BookingModel.findById(bookingId);
    
    if (!booking) {
      return res.status(404).send({ message: "Booking not found" });
    }

    if (!canAccessBooking(booking, req.user?.userId || req.user?.user_id, req.user?.user_role)) {
      return res.status(403).send({ message: "You do not have access to this booking." });
    }

    let activity = await FileActivityModel.findOne({ bookingId });
    
    if (!activity) {
      // Lazily create
      activity = new FileActivityModel({ bookingId });
    }

    // Always sync services dynamically
    activity = syncServices(activity, booking);
    await activity.save();

    return res.status(200).send(activity);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

// UPDATE file activity (stages and textboxes)
FileActivityRoutes.patch("/:bookingId", authenticateUser, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const updates = req.body; // Expects { stages, application, acknowledgement, anyUpdates, adminNotes }
    
    const userRole = (req.user?.user_role || req.headers["user-role"] || "").toString().trim().toLowerCase();
    
    if (!adminRoles.includes(userRole)) {
      return res.status(403).send({ message: "Only admins can edit file activity." });
    }

    let activity = await FileActivityModel.findOne({ bookingId });
    if (!activity) {
      return res.status(404).send({ message: "File activity not found." });
    }

    // Update basic textboxes
    if (updates.anyUpdates !== undefined) activity.anyUpdates = updates.anyUpdates;
    if (updates.adminNotes !== undefined) activity.adminNotes = updates.adminNotes;

    // Update specific stages (merging)
    if (updates.stages) {
      Object.keys(updates.stages).forEach(stageKey => {
        if (activity.stages[stageKey]) {
          if (updates.stages[stageKey].status) {
            activity.stages[stageKey].status = updates.stages[stageKey].status;
          }
          if (updates.stages[stageKey].date !== undefined) {
            activity.stages[stageKey].date = updates.stages[stageKey].date;
          }
        }
      });
    }

    // Update application array
    if (Array.isArray(updates.application)) {
      updates.application.forEach(updatedSvc => {
        const existingSvc = activity.application.find(s => s.serviceName === updatedSvc.serviceName);
        if (existingSvc) {
          existingSvc.status = updatedSvc.status || existingSvc.status;
          existingSvc.date = updatedSvc.date !== undefined ? updatedSvc.date : existingSvc.date;
        }
      });
    }

    // Update acknowledgement array
    if (Array.isArray(updates.acknowledgement)) {
      updates.acknowledgement.forEach(updatedSvc => {
        const existingSvc = activity.acknowledgement.find(s => s.serviceName === updatedSvc.serviceName);
        if (existingSvc) {
          existingSvc.status = updatedSvc.status || existingSvc.status;
          existingSvc.date = updatedSvc.date !== undefined ? updatedSvc.date : existingSvc.date;
        }
      });
    }

    await activity.save();
    return res.status(200).send({ message: "File activity updated successfully", activity });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

// GET all file activities (bulk endpoint for tables, optional)
FileActivityRoutes.post("/bulk", authenticateUser, async (req, res) => {
  try {
    const { bookingIds } = req.body;
    if (!Array.isArray(bookingIds)) {
      return res.status(400).send({ message: "bookingIds must be an array" });
    }
    const bookings = await BookingModel.find({ _id: { $in: bookingIds } }).select("_id user_id shared_with term_shares").lean();
    const accessibleBookingIds = bookings
      .filter((booking) => canAccessBooking(booking, req.user?.userId || req.user?.user_id, req.user?.user_role))
      .map((booking) => booking._id);
    const activities = await FileActivityModel.find({ bookingId: { $in: accessibleBookingIds } });
    return res.status(200).send(activities);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

export default FileActivityRoutes;
