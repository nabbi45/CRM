import express from "express";
import { BookingModel } from "../models/bookingModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

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
    contact_person,
    user_id,
    bdm,
    email,
    services,
    total_amount,
    pan,
    state,
    date,
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
    const new_booking = {
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
    };

    const booking = await BookingModel.create(new_booking);
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

  const user_role = req.headers["user-role"];
  if (!user_role) {
    return res.status(400).send({ message: "User role is required" });
  }

  const { updatedBy, note } = updates;
  delete updates.updatedBy;
  delete updates.note;

  try {
    const oldBooking = await BookingModel.findById(id);
    if (!oldBooking) {
      return res.status(404).send("Booking not found");
    }

    const rolesWithFullAccess = ["dev", "senior admin", "srdev"];

    if (user_role === "admin") {
      const { services, ...allowedUpdates } = updates;
      updates = allowedUpdates;
    }

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

  if (!userRole || !["srdev", "dev"].includes(userRole)) {
    return res.status(403).send({ message: "Only dev or srdev can move bookings to trash." });
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

  if (!userRole || !["srdev", "dev"].includes(userRole)) {
    return res.status(403).send({ message: "Only srdev or dev can view trash." });
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

  if (!userRole || !["srdev", "dev"].includes(userRole)) {
    return res.status(403).send({ message: "Only srdev or dev can restore trashed bookings." });
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



//Delete Booking
BookingRoutes.delete("/deletebooking/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers["user-role"];

  if (userRole !== "srdev") {
    return res.status(403).send({ message: "Only srdev can permanently delete bookings." });
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
      query.user_id = userId;
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



export default BookingRoutes;
