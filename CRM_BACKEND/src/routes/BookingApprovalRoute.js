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

const uploadProof = async (file, approvalId) => {
  if (!file) return {};
  const b64 = Buffer.from(file.buffer).toString("base64");
  const dataURI = `data:${file.mimetype};base64,${b64}`;
  const result = await cloudinary.uploader.upload(dataURI, {
    resource_type: "raw",
    folder: "booking_approval_proofs",
    public_id: `approval_${approvalId}_${Date.now()}`,
  });
  return {
    payment_proof_url: result.secure_url,
    payment_proof_file_name: file.originalname,
    payment_proof_mime_type: file.mimetype,
  };
};

const notifyApprovers = async (approval, type = "booking_approval_submitted") => {
  const approvers = await UserModel.find({ user_role: { $in: ["admin", "senior admin", "super admin", "director", "dev", "srdev", "sr dev"] } }).lean();
  const notifications = approvers.map((user) => ({
    user_id: user._id.toString(),
    type,
    message: `${approval.submitted_by_name} submitted a booking for approval.`,
    reference_id: approval._id.toString(),
  }));
  if (notifications.length) await NotificationModel.insertMany(notifications);
};

BookingApprovalRoutes.post("/", authenticateUser, upload.single("paymentProof"), async (req, res) => {
  try {
    const payload = parsePayload(req.body);
    const missing = validatePayload(payload);
    if (missing.length) {
      return res.status(400).send({ message: `Missing required fields: ${missing.join(", ")}` });
    }

    const approval = await BookingApprovalModel.create({
      payload,
      submitted_by: getUserId(req) || payload.user_id,
      submitted_by_name: getUserName(req) || payload.bdm,
      submitted_by_role: getUserRole(req),
      history: [{
        action: "submitted",
        by: getUserId(req),
        by_name: getUserName(req),
        by_role: getUserRole(req),
      }],
    });

    if (req.file) {
      const proof = await uploadProof(req.file, approval._id.toString());
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
    const bookingPayload = {
      ...payload,
      after_disbursement: payload.after_disbursement || payload.funddisbursement,
      payment_proof_url: approval.payment_proof_url,
      payment_proof_file_name: approval.payment_proof_file_name,
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

BookingApprovalRoutes.patch("/:id/resubmit", authenticateUser, upload.single("paymentProof"), async (req, res) => {
  try {
    const approval = await BookingApprovalModel.findById(req.params.id);
    if (!approval) return res.status(404).send({ message: "Approval request not found." });
    if (approval.submitted_by !== getUserId(req)) {
      return res.status(403).send({ message: "You can resubmit only your own booking approval." });
    }
    if (approval.status !== "sent_back") {
      return res.status(400).send({ message: "Only sent-back bookings can be resubmitted." });
    }

    const payload = parsePayload(req.body);
    const missing = validatePayload(payload);
    if (missing.length) {
      return res.status(400).send({ message: `Missing required fields: ${missing.join(", ")}` });
    }

    const proof = req.file ? await uploadProof(req.file, approval._id.toString()) : {};
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
