import mongoose from "mongoose";

const LeaveSchema = new mongoose.Schema({
    user_id: { type: String, required: true },
    user_name: { type: String, required: true },
    leave_type: {
        type: String,
        enum: ["sick", "casual", "earned", "unpaid", "other"],
        required: true
    },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    reason: { type: String, required: true },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
    },
    approved_by: { type: String, default: "" },
    approver_role: { type: String, default: "" },
    notes: { type: String, default: "" },
    supporting_document_url: { type: String, default: "" },
    supporting_document_file_name: { type: String, default: "" },
    supporting_document_mime_type: { type: String, default: "" },
}, { timestamps: true });

export const LeaveModel = mongoose.model("Leave", LeaveSchema);
