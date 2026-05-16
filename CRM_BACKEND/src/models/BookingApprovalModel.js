import mongoose from "mongoose";

const approvalHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    comment: { type: String, default: "" },
    by: { type: String, default: "" },
    by_name: { type: String, default: "" },
    by_role: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const BookingApprovalSchema = new mongoose.Schema(
  {
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    submitted_by: { type: String, required: true },
    submitted_by_name: { type: String, required: true },
    submitted_by_role: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "sent_back", "rejected", "approved"],
      default: "pending",
    },
    admin_comment: { type: String, default: "" },
    payment_proof_url: { type: String, default: "" },
    payment_proof_file_name: { type: String, default: "" },
    payment_proof_mime_type: { type: String, default: "" },
    history: { type: [approvalHistorySchema], default: [] },
    approved_booking_id: { type: String, default: "" },
    reviewed_by: { type: String, default: "" },
    reviewed_by_name: { type: String, default: "" },
    reviewed_at: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

export const BookingApprovalModel = mongoose.model("booking_approval", BookingApprovalSchema);
