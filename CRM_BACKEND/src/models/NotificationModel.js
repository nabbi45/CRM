import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
    user_id: { type: String, required: true },
    type: {
        type: String,
        enum: [
            "leave_submitted",
            "leave_approved",
            "leave_rejected",
            "leave_note",
            "booking_shared",
            "booking_approval_submitted",
            "booking_approval_resubmitted",
            "booking_approval_approved",
            "booking_approval_rejected",
            "booking_approval_sent_back",
            "booking_refund_created",
        ],
        default: "leave_submitted"
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    reference_id: { type: String, default: "" },
}, { timestamps: true });

export const NotificationModel = mongoose.model("Notification", NotificationSchema);
