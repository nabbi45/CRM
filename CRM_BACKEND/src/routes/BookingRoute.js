import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { BookingModel } from "../models/bookingModel.js";
import { UserModel } from "../models/UserModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { NotificationModel } from "../models/NotificationModel.js";
import { normalizeBookingPayload } from "../utils/textNormalize.js";
import { getCloudinaryPublicExtension, prepareUploadFiles, toDataUri } from "../utils/uploadCompression.js";
import {
  amountExcludingGst,
  buildGstMetadata,
  collectAffectedUserIds,
  gstComponent,
  isCashPayment,
  isAdminRole,
  prepareBookingFinancials,
  TERM_KEYS,
} from "../utils/revenueRules.js";

const BookingRoutes = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const uploadPaymentProofs = async (files = [], bookingId) => {
  if (!Array.isArray(files) || files.length === 0) return {};

  const preparedFiles = await prepareUploadFiles(files);
  const uploadedProofs = [];
  for (const file of preparedFiles) {
    const dataURI = toDataUri(file);
    const isImage = file.resourceType === "image";
    const extension = getCloudinaryPublicExtension(file);
    const result = await cloudinary.uploader.upload(dataURI, {
      resource_type: isImage ? "image" : "raw",
      folder: "booking_payment_proofs",
      public_id: `booking_${bookingId}_${Date.now()}_${uploadedProofs.length}${!isImage && extension ? `.${extension}` : ""}`,
    });
    uploadedProofs.push({
      url: result.secure_url,
      file_name: file.originalname,
      mime_type: file.mimetype,
    });
  }

  const primaryProof = uploadedProofs[0] || {};
  return {
    payment_proof_url: primaryProof.url || "",
    payment_proof_file_name: primaryProof.file_name || "",
    payment_proof_mime_type: primaryProof.mime_type || "",
    payment_proofs: uploadedProofs,
  };
};

const stripMongoMeta = (value) => {
  if (Array.isArray(value)) return value.map(stripMongoMeta);
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const plain = typeof value.toObject === "function" ? value.toObject() : value;
    return Object.keys(plain)
      .filter((key) => key !== "_id")
      .sort()
      .reduce((acc, key) => {
        const nested = stripMongoMeta(plain[key]);
        if (nested !== undefined) acc[key] = nested;
        return acc;
      }, {});
  }
  return value;
};

const normalizeForHistory = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    const parsedDate = new Date(trimmed);
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) && !Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().slice(0, 10);
    }
    return trimmed;
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return stripMongoMeta(value);
};

const valuesEqualForHistory = (oldValue, newValue) =>
  JSON.stringify(normalizeForHistory(oldValue)) === JSON.stringify(normalizeForHistory(newValue));

const CONTINUATION_EDIT_FIELDS = new Set([
  "payment_date",
  "services",
  "total_amount",
  "shared_with",
  "term_shares",
  ...TERM_KEYS.slice(1),
]);

const getBookingAccessUserIds = (booking) => {
  const accessIds = new Set();
  if (booking?.user_id) accessIds.add(String(booking.user_id));
  (Array.isArray(booking?.shared_with) ? booking.shared_with : []).forEach((share) => {
    if (share?.user_id) accessIds.add(String(share.user_id));
  });

  Object.values(booking?.term_shares || {}).forEach((termShare) => {
    if (termShare?.creator?.user_id) accessIds.add(String(termShare.creator.user_id));
    (Array.isArray(termShare?.shared_with) ? termShare.shared_with : []).forEach((share) => {
      if (share?.user_id) accessIds.add(String(share.user_id));
    });
  });

  return accessIds;
};

const isContinuationEditPayload = (updates = {}) => {
  const keys = Object.keys(updates || {});
  if (!keys.length) return false;
  if (!keys.every((key) => CONTINUATION_EDIT_FIELDS.has(key))) return false;

  const hasTermAmount = TERM_KEYS.slice(1).some((termKey) =>
    Object.prototype.hasOwnProperty.call(updates, termKey)
  );

  return hasTermAmount && Object.prototype.hasOwnProperty.call(updates, "term_shares");
};

const resolveEditorName = async (req, fallback = "") => {
  const directName = req.user?.name || req.headers["user-name"];
  if (directName && directName !== "Unknown") return directName;

  const userId = req.user?.userId || req.user?.user_id;
  if (userId) {
    const user = await UserModel.findById(userId).select("name").lean();
    if (user?.name) return user.name;
  }

  return fallback && fallback !== "Unknown" ? fallback : "Unknown";
};

//Addbooking
BookingRoutes.post("/addbooking", authenticateUser, upload.array("paymentProofs", 10), async (req, res) => {
  const requestBody = req.body.payload ? JSON.parse(req.body.payload) : req.body;
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
    term_shares,
    is_refundable,
    refundable_percentage,
    is_approval_refundable,
    approval_refundable_percentage,
  } = requestBody;

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
    const requesterRole = req.user?.user_role || req.headers["user-role"];
    if (!isAdminRole(requesterRole)) {
      return res.status(403).send({
        message: "Employee bookings must be submitted through the booking approval queue.",
      });
    }
    if ((!req.files || req.files.length === 0) && !requestBody.payment_proof_url) {
      return res.status(400).send({ message: "Payment proof is required." });
    }

    const basePayload = normalizeBookingPayload({
      user_id,
      bdm,
      branch_name,
      company_name: company_name || "",
      contact_person,
      email,
      contact_no,
      closed_by,
      services,
      total_amount: Number(total_amount || 0),
      term_1: Number(term_1 || 0),
      term_2: Number(term_2 || 0),
      term_3: Number(term_3 || 0),
      term_4: Number(requestBody.term_4 || 0),
      term_5: Number(requestBody.term_5 || 0),
      term_6: Number(requestBody.term_6 || 0),
      term_7: Number(requestBody.term_7 || 0),
      term_8: Number(requestBody.term_8 || 0),
      term_9: Number(requestBody.term_9 || 0),
      term_10: Number(requestBody.term_10 || 0),
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
      term_shares: term_shares || {
        term_1: {
          creator: { user_id, user_name: bdm },
          payment_date,
          payment_mode: bank,
          shared_with: Array.isArray(shared_with) ? shared_with : [],
        },
      },
      is_refundable,
      refundable_percentage,
      is_approval_refundable,
      approval_refundable_percentage,
    });
    const new_booking = {
      ...basePayload,
      ...(await prepareBookingFinancials(basePayload)),
    };

    const booking = await BookingModel.create(new_booking);
    if (req.files?.length) {
      const proof = await uploadPaymentProofs(req.files, booking._id.toString());
      Object.assign(booking, proof);
      await booking.save();
    }

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

    const requesterUserId = String(req.user?.userId || req.user?.user_id || "");
    const continuationEdit = isContinuationEditPayload(updates);

    if (
      TERM_KEYS.some((termKey) => Object.prototype.hasOwnProperty.call(updates, termKey)) ||
      Object.prototype.hasOwnProperty.call(updates, "total_amount") ||
      Object.prototype.hasOwnProperty.call(updates, "bank")
    ) {
      const mergedBooking = {
        ...oldBooking.toObject(),
        ...updates,
      };
      updates = {
        ...updates,
        ...buildGstMetadata(mergedBooking),
      };
    }

    delete updates.service_deductions_snapshot;
    delete updates.refund_adjustments;
    updates.is_refundable = oldBooking.is_refundable;
    updates.refundable_percentage = oldBooking.refundable_percentage || 0;
    updates.is_approval_refundable = oldBooking.is_approval_refundable || false;
    updates.approval_refundable_percentage = oldBooking.approval_refundable_percentage || 0;

    if (Object.prototype.hasOwnProperty.call(updates, "payment_date") && !continuationEdit) {
      const selectedTermKey =
        TERM_KEYS.find((termKey) => Object.prototype.hasOwnProperty.call(updates, termKey) && Number(updates[termKey] || 0) > 0) ||
        TERM_KEYS.find((termKey) => Number(oldBooking[termKey] || 0) > 0) ||
        "term_1";
      updates.term_shares = {
        ...(oldBooking.term_shares || {}),
        ...(updates.term_shares || {}),
        [selectedTermKey]: {
          ...(oldBooking.term_shares?.[selectedTermKey] || {}),
          ...(updates.term_shares?.[selectedTermKey] || {}),
          creator: updates.term_shares?.[selectedTermKey]?.creator || oldBooking.term_shares?.[selectedTermKey]?.creator || {
            user_id: oldBooking.user_id,
            user_name: oldBooking.bdm,
          },
          payment_date: updates.payment_date,
          payment_mode: updates.bank || oldBooking.term_shares?.[selectedTermKey]?.payment_mode || oldBooking.bank || "",
          shared_with: Array.isArray(updates.term_shares?.[selectedTermKey]?.shared_with)
            ? updates.term_shares[selectedTermKey].shared_with
            : Array.isArray(oldBooking.term_shares?.[selectedTermKey]?.shared_with)
              ? oldBooking.term_shares[selectedTermKey].shared_with
              : [],
        },
      };
    }

    if (!isAdminRole(user_role)) {
      if (continuationEdit) {
        const accessIds = getBookingAccessUserIds(oldBooking);
        if (!requesterUserId || !accessIds.has(requesterUserId)) {
          return res.status(403).send({
            message: "Only the booking owner or shared employees can add continuation terms.",
          });
        }
      } else {
        return res.status(403).send({
          message: "Only admins and higher roles can edit bookings.",
        });
      }
    }

    if (continuationEdit) {
      const targetTermKey = TERM_KEYS.slice(1).find((termKey) => Object.prototype.hasOwnProperty.call(updates, termKey)) || "";
      const targetTermShare = updates.term_shares?.[targetTermKey];

      if (
        !targetTermKey ||
        !targetTermShare?.creator?.user_id ||
        !targetTermShare?.payment_date
      ) {
        return res.status(400).send({
          message: "Continuation flow can only add one new term at a time.",
        });
      }

      if (targetTermKey && Number(oldBooking[targetTermKey] || 0) > 0) {
        return res.status(400).send({ message: `${targetTermKey.replace("_", " ").toUpperCase()} already exists for this booking.` });
      }

      const targetIndex = TERM_KEYS.indexOf(targetTermKey);
      if (targetIndex > 0) {
        const previousTermKey = TERM_KEYS[targetIndex - 1];
        if (Number(oldBooking[previousTermKey] || 0) <= 0) {
          return res.status(400).send({ message: `${previousTermKey.replace("_", " ").toUpperCase()} must be completed before ${targetTermKey.replace("_", " ").toUpperCase()}.` });
        }
      }

      updates.term_shares = {
        ...(oldBooking.term_shares || {}),
        ...(updates.term_shares || {}),
      };
    }

    if (!isAdminRole(user_role) && !continuationEdit) {
      return res.status(403).send({
        message: "Only admins and higher roles can edit bookings.",
      });
    }

    const oldBookingPlain = oldBooking.toObject();

    // Detect changed fields
    const changedFields = {};
    for (let key in updates) {
      const oldValue = oldBookingPlain[key];
      const newValue = updates[key];

      if (!valuesEqualForHistory(oldValue, newValue)) {
        changedFields[key] = {
          old: normalizeForHistory(oldValue),
          new: normalizeForHistory(newValue),
        };
      }
    }

    // If nothing changed, exit early
    if (Object.keys(changedFields).length === 0) {
      return res.status(400).send({ message: "No changes detected" });
    }

    // Create updated history entry
    const historyEntry = {
      updatedBy: await resolveEditorName(req, updatedBy),
      updatedAt: new Date(),
      note: note || "",
      changes: changedFields,
    };

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
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
});


// Remove a received continuation term without deleting the booking contract itself.
// The newest term must be removed first so the payment history remains sequential.
BookingRoutes.delete("/editbooking/:id/terms/:termKey", authenticateUser, async (req, res) => {
  const requesterRole = String(req.user?.user_role || req.headers["user-role"] || "").trim().toLowerCase();
  const allowedRoles = ["director", "dev", "developer", "srdev", "sr dev", "sr developer"];
  const { termKey } = req.params;

  if (!allowedRoles.includes(requesterRole)) {
    return res.status(403).send({ message: "Only director and dev roles can delete a booking term." });
  }

  if (!TERM_KEYS.slice(1).includes(termKey)) {
    return res.status(400).send({ message: "Only continuation terms can be deleted. Term 1 belongs to the booking itself." });
  }

  try {
    const booking = await BookingModel.findById(req.params.id);
    if (!booking || booking.isDeleted) {
      return res.status(404).send({ message: "Booking not found." });
    }

    if (Number(booking[termKey] || 0) <= 0) {
      return res.status(404).send({ message: `${termKey.replace("_", " ").toUpperCase()} does not exist for this booking.` });
    }

    const termIndex = TERM_KEYS.indexOf(termKey);
    if (TERM_KEYS.slice(termIndex + 1).some((key) => Number(booking[key] || 0) > 0)) {
      return res.status(400).send({
        message: "Delete the latest continuation term first. Later terms cannot remain after an earlier term is removed.",
      });
    }

    const oldAmount = Number(booking[termKey] || 0);
    booking[termKey] = 0;
    if (booking.term_shares) {
      booking.term_shares[termKey] = undefined;
      booking.markModified("term_shares");
    }
    Object.assign(booking, buildGstMetadata(booking.toObject()));
    booking.updatedhistory.push({
      updatedBy: await resolveEditorName(req),
      updatedAt: new Date(),
      note: `${termKey.replace("_", " ").toUpperCase()} deleted`,
      changes: {
        [termKey]: { old: oldAmount, new: 0 },
        [`term_shares.${termKey}`]: { old: "Payment term removed", new: "" },
      },
    });

    await booking.save();
    return res.status(200).send({ message: `${termKey.replace("_", " ").toUpperCase()} deleted successfully.`, booking });
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
    const normalizedRole = String(userRole || req.user?.user_role || "").trim().toLowerCase();
    const normalizedUserId = userId || req.user?.userId || req.user?.user_id || "";

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
    const validRoles = ["dev", "admin", "senior admin", "srdev", "sr dev", "super admin", "director"];
    if (!normalizedRole || !validRoles.includes(normalizedRole)) {
      if (!normalizedUserId) {
        return res.status(403).send({
          message: "Access forbidden. No valid role or user ID provided.",
        });
      }
      query.$or = [
        { user_id: normalizedUserId },
        { "shared_with.user_id": normalizedUserId },
        { "term_shares.term_1.creator.user_id": normalizedUserId },
        { "term_shares.term_1.shared_with.user_id": normalizedUserId },
        { "term_shares.term_2.creator.user_id": normalizedUserId },
        { "term_shares.term_2.shared_with.user_id": normalizedUserId },
        { "term_shares.term_3.creator.user_id": normalizedUserId },
        { "term_shares.term_3.shared_with.user_id": normalizedUserId },
      ];
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
      query.$or = [
        { user_id: userId },
        { "shared_with.user_id": userId },
        { "term_shares.term_1.creator.user_id": userId },
        { "term_shares.term_1.shared_with.user_id": userId },
        { "term_shares.term_2.creator.user_id": userId },
        { "term_shares.term_2.shared_with.user_id": userId },
        { "term_shares.term_3.creator.user_id": userId },
        { "term_shares.term_3.shared_with.user_id": userId },
      ];
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

BookingRoutes.post("/:id/refunds", authenticateUser, async (req, res) => {
  const requesterRole = req.user?.user_role || req.headers["user-role"];
  if (!isAdminRole(requesterRole)) {
    return res.status(403).send({ message: "Only admin roles can add refund adjustments." });
  }

  try {
    const { id } = req.params;
    const { amount, refund_date, note } = req.body;
    const refundAmount = Number(amount || 0);

    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).send({ message: "Refund amount must be greater than 0." });
    }

    const booking = await BookingModel.findById(id);
    if (!booking || booking.isDeleted) {
      return res.status(404).send({ message: "Booking not found." });
    }

    const gstIncluded =
      typeof booking.gst_included === "boolean"
        ? booking.gst_included
        : typeof booking.gst_applied === "boolean"
          ? booking.gst_applied
          : !isCashPayment(booking.bank);
    const refundEntry = {
      amount: refundAmount,
      amount_excluding_gst: amountExcludingGst(refundAmount, gstIncluded),
      gst_amount: gstComponent(refundAmount, gstIncluded),
      refund_date: refund_date ? new Date(refund_date) : new Date(),
      note: note || "",
      created_by: req.user?.userId || req.user?.user_id || "",
      created_by_name: req.user?.name || req.headers["user-name"] || "Unknown",
      created_at: new Date(),
    };

    booking.refund_adjustments = [...(booking.refund_adjustments || []), refundEntry];
    await booking.save();

    const affectedUserIds = collectAffectedUserIds(booking);
    if (affectedUserIds.length) {
      await NotificationModel.insertMany(
        affectedUserIds.map((userId) => ({
          user_id: userId,
          type: "booking_refund_created",
          message: `Refund adjustment added for ${booking.company_name || booking.contact_person || "a booking"}.`,
          reference_id: booking._id.toString(),
        }))
      );
    }

    return res.status(201).send({
      message: "Refund adjustment added successfully.",
      refund: refundEntry,
      booking,
    });
  } catch (err) {
    console.error("Refund adjustment error:", err);
    return res.status(500).send({ message: err.message });
  }
});

BookingRoutes.patch("/:id/refunds/:refundId", authenticateUser, async (req, res) => {
  const requesterRole = String(req.user?.user_role || req.headers["user-role"] || "").trim().toLowerCase();
  if (!["director", "dev", "srdev", "sr dev"].includes(requesterRole)) {
    return res.status(403).send({ message: "Only director and dev roles can edit refund adjustments." });
  }

  try {
    const booking = await BookingModel.findById(req.params.id);
    if (!booking || booking.isDeleted) {
      return res.status(404).send({ message: "Booking not found." });
    }

    const refund = (booking.refund_adjustments || []).id(req.params.refundId);
    if (!refund) {
      return res.status(404).send({ message: "Refund adjustment not found." });
    }

    const refundAmount = Number(req.body.amount || 0);
    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).send({ message: "Refund amount must be greater than 0." });
    }

    const gstIncluded =
      typeof booking.gst_included === "boolean"
        ? booking.gst_included
        : typeof booking.gst_applied === "boolean"
          ? booking.gst_applied
          : !isCashPayment(booking.bank);

    refund.amount = refundAmount;
    refund.amount_excluding_gst = amountExcludingGst(refundAmount, gstIncluded);
    refund.gst_amount = gstComponent(refundAmount, gstIncluded);
    refund.refund_date = req.body.refund_date ? new Date(req.body.refund_date) : refund.refund_date;
    refund.note = typeof req.body.note === "string" ? req.body.note : refund.note;
    await booking.save();

    return res.status(200).send({ message: "Refund adjustment updated successfully.", refund, booking });
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
});

BookingRoutes.delete("/:id/refunds/:refundId", authenticateUser, async (req, res) => {
  const requesterRole = String(req.user?.user_role || req.headers["user-role"] || "").trim().toLowerCase();
  if (!["director", "dev", "srdev", "sr dev"].includes(requesterRole)) {
    return res.status(403).send({ message: "Only director and dev roles can delete refund adjustments." });
  }

  try {
    const booking = await BookingModel.findById(req.params.id);
    if (!booking || booking.isDeleted) {
      return res.status(404).send({ message: "Booking not found." });
    }

    booking.refund_adjustments = (booking.refund_adjustments || []).filter(
      (entry) => String(entry._id) !== String(req.params.refundId)
    );
    await booking.save();

    return res.status(200).send({ message: "Refund adjustment deleted successfully.", booking });
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
});

export default BookingRoutes;
