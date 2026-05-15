import express from "express";
import { BookingModel } from "../models/bookingModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { NotificationModel } from "../models/NotificationModel.js";
import { normalizeBookingPayload } from "../utils/textNormalize.js";

const BookingRoutes = express.Router();
//Addbooking
BookingRoutes.post("/addbooking", authenticateUser, async (req, res) => {
  const {
    user_id,
    bdm,
    branch_name,
    company_name,
    contact_person,
    email,
    contact_no,
    services,
    total_amount,
    term_1,
    term_2,
    term_3,
    payment_date, // 👈 New
    closed_by,
    pan,
    gst,
    remark,
    date,
    status,
    bank,
    funddisbursement,
    state,
    shared_with,
  } = req.body;

  const requiredFields = {
    branch_name,
    company_name,
    contact_person,
    user_id,
    bdm,
    email,
    services,
    total_amount,
    pan,
    state,
    date,
    bank,
    funddisbursement,
  };

  const missingFields = Object.entries(requiredFields)
    .filter(
      ([key, value]) =>
        !value ||
        (key === "services" && (!Array.isArray(value) || value.length === 0))
    )
    .map(([key]) => key);

  if (missingFields.length > 0) {
    return res.status(400).send({
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  try {
    const new_booking = normalizeBookingPayload({
      user_id,
      bdm,
      branch_name,
      company_name: company_name || "",
      contact_person,
      email,
      contact_no,
      closed_by,
      services,
      total_amount,
      term_1,
      term_2,
      term_3,
      payment_date, // 👈 Set here
      pan,
      gst: gst || "N/A",
      remark,
      date: date || new Date(),
      status,
      bank,
      state,
      after_disbursement: funddisbursement,
      shared_with: Array.isArray(shared_with) ? shared_with : [],
    });

    const booking = await BookingModel.create(new_booking);

    if (new_booking.shared_with && new_booking.shared_with.length > 0) {
      try {
        const notifications = new_booking.shared_with.map(sw => ({
          user_id: sw.user_id,
          type: "booking_shared",
          message: `${bdm || "A coworker"} shared a booking with you.`,
          reference_id: booking._id.toString()
        }));
        await NotificationModel.insertMany(notifications);
      } catch (notifErr) {
        console.error("Error creating notifications:", notifErr);
      }
    }

    return res.status(201).send({
      Message: "Booking Created Successfully",
      booking_id: booking._id,
      booking,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: error.message });
  }
});

//Edit booking

BookingRoutes.patch("/editbooking/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;
  let updates = req.body;

  const user_role = (req.headers["user-role"] || "").toString().trim().toLowerCase();
  if (!user_role) {
    return res.status(400).send({ message: "User role is required" });
  }

  const { updatedBy, note } = updates;
  delete updates.updatedBy;
  delete updates.note;
  updates = normalizeBookingPayload(updates);

  try {
    const oldBooking = await BookingModel.findById(id);
    if (!oldBooking) {
      return res.status(404).send("Booking not found");
    }

    const rolesWithFullAccess = ["dev", "senior admin", "super admin", "director", "srdev", "sr dev"];
    const requesterId = req.user?.userId || req.user?.user_id;

    // Detect changed fields
    const changedFields = {};
    for (let key in updates) {
      const oldValue = oldBooking[key];
      const newValue = updates[key];

      // Deep compare for arrays or primitive values
      if (Array.isArray(oldValue)) {
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changedFields[key] = { old: oldValue, new: newValue };
        }
      } else if (oldValue !== newValue) {
        changedFields[key] = { old: oldValue, new: newValue };
      }
    }

    // If nothing changed, exit early
    if (Object.keys(changedFields).length === 0) {
      return res.status(400).send({ message: "No changes detected" });
    }

    // Create updated history entry
    const historyEntry = {
      updatedBy: updatedBy || "Unknown",
      updatedAt: new Date(),
      note: note || "",
      changes: changedFields,
    };

    if (rolesWithFullAccess.includes(user_role) || user_role === "admin") {
      const updatedBooking = await BookingModel.findByIdAndUpdate(
        id,
        {
          $set: updates,
          $push: { updatedhistory: historyEntry },
        },
        { new: true }
      );

      // Check for newly added shared_with users and notify them
      if (updates.shared_with && Array.isArray(updates.shared_with)) {
        const oldSharedIds = (oldBooking.shared_with || []).map(sw => String(sw.user_id));
        const newSharedUsers = updates.shared_with.filter(sw => !oldSharedIds.includes(String(sw.user_id)));
        
        if (newSharedUsers.length > 0) {
          try {
            const notifications = newSharedUsers.map(sw => ({
              user_id: sw.user_id,
              type: "booking_shared",
              message: `${oldBooking.bdm || "A coworker"} shared a booking with you.`,
              reference_id: updatedBooking._id.toString()
            }));
            await NotificationModel.insertMany(notifications);
          } catch (notifErr) {
            console.error("Error creating notifications on edit:", notifErr);
          }
        }
      }

      return res.status(200).send({
        message: "Booking Updated Successfully",
        updatedBooking,
      });
    }

    const continuationAllowedKeys = ["term_2", "term_3", "payment_date", "services", "total_amount"];
    const updateKeys = Object.keys(updates);
    const isOwner = String(oldBooking.user_id || "") === String(requesterId || "");
    const isSharedUser = oldBooking.shared_with && oldBooking.shared_with.some(sw => String(sw.user_id) === String(requesterId || ""));
    const isContinuationUpdate =
      updateKeys.length > 0 &&
      updateKeys.every((key) => continuationAllowedKeys.includes(key));

    if ((isOwner || isSharedUser) && isContinuationUpdate) {
      const updatedBooking = await BookingModel.findByIdAndUpdate(
        id,
        {
          $set: updates,
          $push: { updatedhistory: historyEntry },
        },
        { new: true }
      );

      return res.status(200).send({
        message: "Booking Updated Successfully",
        updatedBooking,
      });
    }

    return res.status(403).send({
      message: "You do not have permission to edit this booking",
    });
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
});


//trash
BookingRoutes.patch("/trash/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers["user-role"];
  const deletedBy = req.headers["user-name"];

  if (!userRole || !["srdev", "dev", "senior admin", "admin"].includes(userRole)) {
    return res.status(403).send({ message: "Only admins or devs can move bookings to trash." });
  }

  try {
    const trashedBooking = await BookingModel.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date(), deletedBy: deletedBy || "Unknown" },
      { new: true }
    );

    if (!trashedBooking) {
      return res.status(404).send({ message: "Booking not found" });
    }

    res.status(200).send({ message: "Booking moved to trash", trashedBooking });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});


// to fetch from the trash
BookingRoutes.get("/trash", authenticateUser, async (req, res) => {
  const userRole = req.headers["user-role"];

  if (!userRole || !["srdev", "dev", "senior admin", "admin"].includes(userRole)) {
    return res.status(403).send({ message: "Only admins or devs can view trash." });
  }

  try {
    const trashedBookings = await BookingModel.find({ isDeleted: true }).sort({ deletedAt: -1 });
    res.status(200).send(trashedBookings);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// to restore
BookingRoutes.patch("/restore/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers["user-role"];

  if (!userRole || !["srdev", "dev", "senior admin", "admin"].includes(userRole)) {
    return res.status(403).send({ message: "Only admins or devs can restore trashed bookings." });
  }

  try {
    const restoredBooking = await BookingModel.findByIdAndUpdate(
      id,
      { isDeleted: false, deletedAt: null },
      { new: true }
    );

    if (!restoredBooking) {
      return res.status(404).send({ message: "Booking not found" });
    }

    res.status(200).send({ message: "Booking restored successfully", restoredBooking });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});



//Delete Booking Permanently
BookingRoutes.delete("/deletebooking/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers["user-role"];

  // Allow admins and devs to permanently delete
  if (!["srdev", "dev", "senior admin", "admin"].includes(userRole)) {
    return res.status(403).send({ message: "Insufficient permissions to permanently delete bookings." });
  }

  const booking = await BookingModel.findById(id);

  if (!booking) {
    return res.status(404).send({ message: "Booking not found" });
  }

  if (!booking.isDeleted) {
    return res.status(400).send({ message: "You must move this booking to trash before deleting." });
  }

  try {
    await BookingModel.findByIdAndDelete(id);
    return res.status(200).send({ message: "Booking permanently deleted." });
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
});

//Empty Trash (Bulk Delete)
BookingRoutes.delete("/emptytrash", authenticateUser, async (req, res) => {
  const userRole = req.headers["user-role"];

  // Allow admins and devs to permanently delete
  if (!["srdev", "dev", "senior admin", "admin"].includes(userRole)) {
    return res.status(403).send({ message: "Insufficient permissions to empty trash." });
  }

  try {
    await BookingModel.deleteMany({ isDeleted: true });
    return res.status(200).send({ message: "Trash emptied successfully." });
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
});



//Getting all bookings
BookingRoutes.get("/all", authenticateUser, async (req, res) => {
  try {
    const Allbookings = await BookingModel.find({ isDeleted: false }).sort({ createdAt: -1 });

    if (!Allbookings.length) {
      return res.status(200).send({ message: "No Bookings Found", Allbookings: [] });
    }

    return res.status(200).send({
      message: "All Bookings Fetched Successfully",
      Allbookings,
    });
  } catch (err) {
    console.error("Error in /all:", err.message);
    return res.status(500).send({ message: err.message });
  }
});

// BookingRoutes.get("/all", authenticateUser, async (req, res) => {
//   const limit = req.query.limit;
//   const Allbookings = await BookingModel.find({ isDeleted: false })
//     .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order (latest first)
//     .limit(limit); // Limit the results to the latest 100
//   if (Allbookings.length != 0) {
//     return res
//       .status(200)
//       .send({ message: "All Bookings Fetched Successfully", Allbookings });
//   }
//   return res.status(404).send({ message: "No Bookings To Show" });
// });

// Combined filter route
BookingRoutes.get("/bookings/filter", authenticateUser, async (req, res) => {
  const {
    startDate,
    endDate,
    status,
    service,
    userId,
    userRole,
    bdmName,
    paymentmode,
    paymentStartDate,
    paymentEndDate,
    page = 1,
    limit = 100,
  } = req.query;

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  try {
    const query = {};

    // Booking date filter (if no payment date is applied)
    if (startDate && endDate && !paymentStartDate && !paymentEndDate) {
      const parsedStartDate = new Date(startDate);
      const parsedEndDate = new Date(endDate);
      if (isNaN(parsedStartDate) || isNaN(parsedEndDate)) {
        return res.status(400).send({ message: "Invalid booking date format" });
      }
      parsedEndDate.setHours(23, 59, 59, 999);
      query.date = { $gte: parsedStartDate, $lte: parsedEndDate };
    }

    // Payment date filter (only if provided)
    if (paymentStartDate && paymentEndDate) {
      const parsedPaymentStart = new Date(paymentStartDate);
      const parsedPaymentEnd = new Date(paymentEndDate);
      if (isNaN(parsedPaymentStart) || isNaN(parsedPaymentEnd)) {
        return res.status(400).send({ message: "Invalid payment date format" });
      }
      parsedPaymentEnd.setHours(23, 59, 59, 999);
      query.payment_date = { $gte: parsedPaymentStart, $lte: parsedPaymentEnd };
    }

    // Status filter
    if (status) {
      const validStatuses = ["Pending", "In Progress", "Completed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).send({ message: "Invalid status value" });
      }
      query.status = new RegExp(`^${status.trim()}$`, "i");
    }

    // Service filter
    if (service) {
      query.services = { $in: [service] };
    }

    // Payment mode filter
    if (paymentmode) {
      const validPaymentModes = [
        "Axis Bank",
        "IDFC BANK",
        "IDFC Bank",
        "Razor Pay",
        "Cashfree",
        "Cheque IDFC Bank",
        "Cheque Axis Bank",
        "Kotak Mahindra Bank",
        "HDFC Bank",
        "Razorpay",
        "HDFC Gateway",
        "CashFree Gateway",
        "Phonepe Gateway",
        "Enego Projects",
        "Cash",
      ];
      if (!validPaymentModes.includes(paymentmode)) {
        return res.status(400).send({ message: "Invalid payment mode" });
      }
      query.bank = paymentmode;
    }

    // BDM name filter
    if (bdmName) {
      query.bdm = { $regex: new RegExp(bdmName, "i") };
    }

    // Role-based access check
    const validRoles = ["dev", "admin", "senior admin", "srdev"];
    if (!userRole || !validRoles.includes(userRole)) {
      if (!userId) {
        return res.status(403).send({
          message: "Access forbidden. No valid role or user ID provided.",
        });
      }
      query.$or = [{ user_id: userId }, { "shared_with.user_id": userId }];
    }

    // Exclude trashed bookings
    query.isDeleted = false;

    const totalCount = await BookingModel.countDocuments(query);

    const bookings = await BookingModel.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    if (!bookings.length) {
      return res.status(200).send([]);
    }

    res.status(200).send({
      bookings,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNumber),
      currentPage: pageNumber,
    });
  } catch (err) {
    console.error("Error in /bookings/filter:", err.message);
    res.status(500).send({ message: err.message });
  }
});



// Payment Reminders - Get bookings with pending payments
BookingRoutes.get("/payment-reminders", authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const userRole = (req.user?.user_role || '').toString().trim().toLowerCase();
    
    // Admin roles can see all pending payments
    const adminRoles = ['admin', 'senior admin', 'super admin', 'srdev', 'dev'];
    const isAdmin = adminRoles.includes(userRole);
    
    // Build query to find bookings with pending payments
    const query = {
      isDeleted: { $ne: true },
      $expr: {
        $lt: [
          { $add: [{ $ifNull: ["$term_1", 0] }, { $ifNull: ["$term_2", 0] }, { $ifNull: ["$term_3", 0] }] },
          { $ifNull: ["$total_amount", 0] }
        ]
      }
    };
    
    // Non-admin users only see their own bookings or those shared with them
    if (!isAdmin) {
      query.$or = [{ user_id: userId }, { "shared_with.user_id": userId }];
    }
    
    const bookings = await BookingModel.find(query).sort({ date: 1 }); // Oldest first
    
    // Process bookings to add calculated fields
    const processedBookings = bookings.map(booking => {
      const totalReceived = (booking.term_1 || 0) + (booking.term_2 || 0) + (booking.term_3 || 0);
      const pendingAmount = (booking.total_amount || 0) - totalReceived;
      const bookingDate = new Date(booking.date || booking.createdAt);
      const daysWaiting = Math.floor((Date.now() - bookingDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Determine urgency level
      let urgency = 'normal';
      let alertMessage = '';
      if (daysWaiting >= 180) {
        urgency = 'critical';
        alertMessage = `🚨 Red alert! ${daysWaiting} days overdue. Let's close this deal!`;
      } else if (daysWaiting >= 90) {
        urgency = 'high';
        alertMessage = `🚨 Alert! ${daysWaiting} days waiting. Money doesn't grow on trees!`;
      } else if (daysWaiting >= 30) {
        urgency = 'medium';
        alertMessage = `⚠️ ${daysWaiting} days pending. Follow up needed!`;
      } else {
        alertMessage = `⏳ ${daysWaiting} days pending`;
      }
      
      return {
        _id: booking._id,
        company_name: booking.company_name,
        contact_person: booking.contact_person,
        services: booking.services,
        total_amount: booking.total_amount,
        received_amount: totalReceived,
        pending_amount: pendingAmount,
        booking_date: booking.date,
        payment_date: booking.payment_date,
        days_waiting: daysWaiting,
        urgency: urgency,
        alert_message: alertMessage,
        bdm: booking.bdm,
        status: booking.status
      };
    });
    
    // Sort by days waiting (longest first)
    processedBookings.sort((a, b) => b.days_waiting - a.days_waiting);
    
    res.status(200).send({
      count: processedBookings.length,
      bookings: processedBookings
    });
  } catch (err) {
    console.error("Error in /payment-reminders:", err.message);
    res.status(500).send({ message: err.message });
  }
});

export default BookingRoutes;
