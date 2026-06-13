import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { BookingApprovalModel } from "../models/BookingApprovalModel.js";
import { BookingModel } from "../models/bookingModel.js";
import { NotificationModel } from "../models/NotificationModel.js";
import { ProjectionLeadModel } from "../models/ProjectionLeadModel.js";
import { UserModel } from "../models/UserModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { normalizeBookingPayload } from "../utils/textNormalize.js";
import { collectAffectedUserIds, isAdminRole, prepareBookingFinancials } from "../utils/revenueRules.js";

const BookingApprovalRoutes = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const getUserId = (req) => req.user?.userId || req.user?.user_id || "";
const getUserName = (req) => req.user?.name || req.headers["user-name"] || "Unknown";
const getUserRole = (req) => req.user?.user_role || req.headers["user-role"] || "";

const resolveUserName = async (req, fallbackName = "") => {
  const directName = getUserName(req);
  if (directName && directName !== "Unknown") return directName;

  const userId = getUserId(req);
  if (userId) {
    const user = await UserModel.findById(userId).select("name").lean();
    if (user?.name) return user.name;
  }

  return fallbackName || "Unknown";
};

const requiredBookingFields = [
  "branch_name",
  "company_name",
  "contact_person",
  "user_id",
  "bdm",
  "email",
  "services",
  "total_amount",
  "pan",
  "state",
  "date",
  "bank",
  "funddisbursement",
];

const parsePayload = (body = {}) => {
  const rawPayload = body.payload ? JSON.parse(body.payload) : body;
  return normalizeBookingPayload({
    ...rawPayload,
    total_amount: Number(rawPayload.total_amount || 0),
    term_1: Number(rawPayload.term_1 || 0),
    term_2: Number(rawPayload.term_2 || 0),
    term_3: Number(rawPayload.term_3 || 0),
  });
};

const validatePayload = (payload) => {
  const missing = requiredBookingFields.filter((field) => {
    const value = payload[field];
    if (field === "services") return !Array.isArray(value) || value.length === 0;
    return !value;
  });
  return missing;
};

const valuesEqual = (oldValue, newValue) => JSON.stringify(oldValue ?? "") === JSON.stringify(newValue ?? "");

const buildContinuationHistoryEntry = async (approval, oldBooking, nextBooking) => {
  const changedFields = {};
  Object.keys(nextBooking).forEach((key) => {
    if (!valuesEqual(oldBooking?.[key], nextBooking?.[key])) {
      changedFields[key] = {
        old: oldBooking?.[key] ?? "",
        new: nextBooking?.[key] ?? "",
      };
    }
  });

  return {
    updatedBy: approval.reviewed_by_name || "Unknown",
    updatedAt: new Date(),
    note: `${approval.payload?.continuation_term_label || "Continuation term"} approved from booking approval queue`,
    changes: changedFields,
  };
};

const uploadProofs = async (files = [], approvalId) => {
  if (!Array.isArray(files) || files.length === 0) return {};
  const uploadedProofs = [];

  for (const file of files) {
    const b64 = Buffer.from(file.buffer).toString("base64");
    const dataURI = `data:${file.mimetype};base64,${b64}`;
    const isImage = file.mimetype.startsWith("image/");
    const extension = file.originalname.split(".").pop();
    const result = await cloudinary.uploader.upload(dataURI, {
      resource_type: isImage ? "image" : "raw",
      folder: "booking_approval_proofs",
      public_id: `approval_${approvalId}_${Date.now()}_${uploadedProofs.length}${isImage ? "" : `.${extension}`}`,
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

const notifyApprovers = async (approval, type = "booking_approval_submitted") => {
  const approvers = await UserModel.find({ user_role: { $in: ["admin", "senior admin", "super admin", "director", "dev", "srdev", "sr dev"] } }).lean();
  const submitterName = approval.submitted_by_name && approval.submitted_by_name !== "Unknown"
    ? approval.submitted_by_name
    : approval.payload?.bdm || "A user";
  const notifications = approvers.map((user) => ({
    user_id: user._id.toString(),
    type,
    message: `${submitterName} submitted a booking for approval.`,
    reference_id: approval._id.toString(),
  }));
  if (notifications.length) await NotificationModel.insertMany(notifications);
};

BookingApprovalRoutes.post("/", authenticateUser, upload.array("paymentProofs", 10), async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).send({ message: "Payment proof is required." });
    }

    const payload = parsePayload(req.body);
    const missing = validatePayload(payload);
    if (missing.length) {
      return res.status(400).send({ message: `Missing required fields: ${missing.join(", ")}` });
    }

    const submittedByName = await resolveUserName(req, payload.bdm);
    const approval = await BookingApprovalModel.create({
      payload,
      submitted_by: getUserId(req) || payload.user_id,
      submitted_by_name: submittedByName,
      submitted_by_role: getUserRole(req),
      history: [{
        action: "submitted",
        by: getUserId(req),
        by_name: submittedByName,
        by_role: getUserRole(req),
      }],
    });

    if (req.files?.length) {
      const proof = await uploadProofs(req.files, approval._id.toString());
      await BookingApprovalModel.findByIdAndUpdate(approval._id, { $set: proof });
      Object.assign(approval, proof);
    }

    await notifyApprovers(approval);
    return res.status(201).send({ message: "Booking submitted for approval.", approval });
  } catch (err) {
    console.error("Booking approval submit error:", err);
    return res.status(500).send({ message: err.message });
  }
});

BookingApprovalRoutes.get("/", authenticateUser, async (req, res) => {
  try {
    const role = getUserRole(req);
    const query = isAdminRole(role) ? {} : { submitted_by: getUserId(req) };
    if (req.query.status) query.status = req.query.status;
    const approvals = await BookingApprovalModel.find(query).sort({ updatedAt: -1 }).lean();
    return res.status(200).send(approvals);
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
});

BookingApprovalRoutes.patch("/:id/approve", authenticateUser, async (req, res) => {
  if (!isAdminRole(getUserRole(req))) {
    return res.status(403).send({ message: "Only admin roles can approve bookings." });
  }

  try {
    const approval = await BookingApprovalModel.findById(req.params.id);
    if (!approval) return res.status(404).send({ message: "Approval request not found." });
    if (approval.status === "approved") {
      return res.status(400).send({ message: "This booking is already approved." });
    }

    const payload = normalizeBookingPayload(approval.payload || {});
    const isContinuationApproval = Boolean(payload.continuation_of_booking_id && payload.continuation_term_key);

    if (isContinuationApproval) {
      const existingBooking = await BookingModel.findById(payload.continuation_of_booking_id);
      if (!existingBooking) {
        return res.status(404).send({ message: "Original booking for continuation not found." });
      }

      const termKey = payload.continuation_term_key;
      if (!["term_2", "term_3"].includes(termKey)) {
        return res.status(400).send({ message: "Invalid continuation term." });
      }
      if (termKey === "term_2" && Number(existingBooking.term_2 || 0) > 0) {
        return res.status(400).send({ message: "Term 2 already exists for this booking." });
      }
      if (termKey === "term_3" && Number(existingBooking.term_3 || 0) > 0) {
        return res.status(400).send({ message: "Term 3 already exists for this booking." });
      }
      if (termKey === "term_3" && Number(existingBooking.term_2 || 0) <= 0) {
        return res.status(400).send({ message: "Term 2 must be completed before approving Term 3." });
      }

      const mergedBooking = {
        ...existingBooking.toObject(),
        payment_date: payload.payment_date,
        services: payload.services,
        total_amount: payload.total_amount,
        shared_with: payload.shared_with,
        term_shares: payload.term_shares,
        [termKey]: Number(payload[termKey] || 0),
        payment_proof_url: approval.payment_proof_url,
        payment_proof_file_name: approval.payment_proof_file_name,
        payment_proof_mime_type: approval.payment_proof_mime_type,
        payment_proofs: Array.isArray(approval.payment_proofs) ? approval.payment_proofs : [],
      };

      const historyEntry = await buildContinuationHistoryEntry(approval, existingBooking.toObject(), mergedBooking);
      const booking = await BookingModel.findByIdAndUpdate(
        existingBooking._id,
        {
          $set: mergedBooking,
          $push: { updatedhistory: historyEntry },
        },
        { new: true }
      );

      approval.status = "approved";
      approval.approved_booking_id = booking._id.toString();
      approval.reviewed_by = getUserId(req);
      approval.reviewed_by_name = getUserName(req);
      approval.reviewed_at = new Date();
      approval.history.push({
        action: "approved",
        comment: req.body.comment || "",
        by: getUserId(req),
        by_name: getUserName(req),
        by_role: getUserRole(req),
      });
      await approval.save();

      const notifications = [
        {
          user_id: approval.submitted_by,
          type: "booking_approval_approved",
          message: `Your ${payload.continuation_term_label || "continuation term"} for ${booking.company_name || booking.contact_person} was approved.`,
          reference_id: approval._id.toString(),
        },
        ...collectAffectedUserIds(booking)
          .filter((userId) => userId !== approval.submitted_by)
          .map((userId) => ({
            user_id: userId,
            type: "booking_shared",
            message: `${payload.bdm || booking.bdm || "A coworker"} shared an approved ${payload.continuation_term_label || "continuation term"} with you.`,
            reference_id: booking._id.toString(),
          })),
      ];
      await NotificationModel.insertMany(notifications);

      return res.status(200).send({ message: "Continuation term approved.", approval, booking });
    }

    const bookingPayload = {
      ...payload,
      after_disbursement: payload.after_disbursement || payload.funddisbursement,
      payment_proof_url: approval.payment_proof_url,
      payment_proof_file_name: approval.payment_proof_file_name,
      payment_proof_mime_type: approval.payment_proof_mime_type,
      payment_proofs: Array.isArray(approval.payment_proofs) ? approval.payment_proofs : [],
      approval_id: approval._id.toString(),
      ...(await prepareBookingFinancials(payload)),
    };
    delete bookingPayload.funddisbursement;
    delete bookingPayload.projectionLeadId;

    const booking = await BookingModel.create(bookingPayload);
    approval.status = "approved";
    approval.approved_booking_id = booking._id.toString();
    approval.reviewed_by = getUserId(req);
    approval.reviewed_by_name = getUserName(req);
    approval.reviewed_at = new Date();
    approval.history.push({
      action: "approved",
      comment: req.body.comment || "",
      by: getUserId(req),
      by_name: getUserName(req),
      by_role: getUserRole(req),
    });
    await approval.save();

    if (payload.projectionLeadId) {
      await ProjectionLeadModel.findByIdAndUpdate(payload.projectionLeadId, {
        payment_received: true,
        payment_received_at: new Date(),
        transferred_to_booking: true,
        transferred_booking_id: booking._id.toString(),
        transferred_at: new Date(),
      });
    }

    const notifications = [
      {
        user_id: approval.submitted_by,
        type: "booking_approval_approved",
        message: `Your booking for ${booking.company_name || booking.contact_person} was approved.`,
        reference_id: approval._id.toString(),
      },
      ...collectAffectedUserIds(booking)
        .filter((userId) => userId !== approval.submitted_by)
        .map((userId) => ({
          user_id: userId,
          type: "booking_shared",
          message: `${booking.bdm || "A coworker"} shared an approved booking with you.`,
          reference_id: booking._id.toString(),
        })),
    ];
    await NotificationModel.insertMany(notifications);

    return res.status(200).send({ message: "Booking approved.", approval, booking });
  } catch (err) {
    console.error("Booking approval approve error:", err);
    return res.status(500).send({ message: err.message });
  }
});

BookingApprovalRoutes.patch("/:id/reject", authenticateUser, async (req, res) => {
  if (!isAdminRole(getUserRole(req))) return res.status(403).send({ message: "Only admin roles can reject bookings." });

  try {
    const approval = await BookingApprovalModel.findById(req.params.id);
    if (!approval) return res.status(404).send({ message: "Approval request not found." });

    approval.status = "rejected";
    approval.admin_comment = req.body.comment || "";
    approval.reviewed_by = getUserId(req);
    approval.reviewed_by_name = getUserName(req);
    approval.reviewed_at = new Date();
    approval.history.push({ action: "rejected", comment: req.body.comment || "", by: getUserId(req), by_name: getUserName(req), by_role: getUserRole(req) });
    await approval.save();

    await NotificationModel.create({
      user_id: approval.submitted_by,
      type: "booking_approval_rejected",
      message: `Your booking approval was rejected${approval.admin_comment ? `: ${approval.admin_comment}` : "."}`,
      reference_id: approval._id.toString(),
    });

    return res.status(200).send({ message: "Booking approval rejected.", approval });
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
});

BookingApprovalRoutes.patch("/:id/send-back", authenticateUser, async (req, res) => {
  if (!isAdminRole(getUserRole(req))) return res.status(403).send({ message: "Only admin roles can send bookings back." });

  try {
    const approval = await BookingApprovalModel.findById(req.params.id);
    if (!approval) return res.status(404).send({ message: "Approval request not found." });

    approval.status = "sent_back";
    approval.admin_comment = req.body.comment || "";
    approval.reviewed_by = getUserId(req);
    approval.reviewed_by_name = getUserName(req);
    approval.reviewed_at = new Date();
    approval.history.push({ action: "sent_back", comment: req.body.comment || "", by: getUserId(req), by_name: getUserName(req), by_role: getUserRole(req) });
    await approval.save();

    await NotificationModel.create({
      user_id: approval.submitted_by,
      type: "booking_approval_sent_back",
      message: `Your booking approval needs changes${approval.admin_comment ? `: ${approval.admin_comment}` : "."}`,
      reference_id: approval._id.toString(),
    });

    return res.status(200).send({ message: "Booking sent back.", approval });
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
});

BookingApprovalRoutes.patch("/:id/resubmit", authenticateUser, upload.array("paymentProofs", 10), async (req, res) => {
  try {
    const approval = await BookingApprovalModel.findById(req.params.id);
    if (!approval) return res.status(404).send({ message: "Approval request not found." });
    if (approval.submitted_by !== getUserId(req)) {
      return res.status(403).send({ message: "You can resubmit only your own booking approval." });
    }
    if (approval.status !== "sent_back") {
      return res.status(400).send({ message: "Only sent-back bookings can be resubmitted." });
    }
    if ((!req.files || req.files.length === 0) && !approval.payment_proof_url) {
      return res.status(400).send({ message: "Payment proof is required." });
    }

    const payload = parsePayload(req.body);
    const missing = validatePayload(payload);
    if (missing.length) {
      return res.status(400).send({ message: `Missing required fields: ${missing.join(", ")}` });
    }

    const proof = req.files?.length ? await uploadProofs(req.files, approval._id.toString()) : {};
    approval.payload = payload;
    approval.status = "pending";
    approval.admin_comment = "";
    Object.assign(approval, proof);
    approval.history.push({
      action: "resubmitted",
      comment: req.body.comment || "",
      by: getUserId(req),
      by_name: getUserName(req),
      by_role: getUserRole(req),
    });
    await approval.save();
    await notifyApprovers(approval, "booking_approval_resubmitted");

    return res.status(200).send({ message: "Booking approval resubmitted.", approval });
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
});

export default BookingApprovalRoutes;
