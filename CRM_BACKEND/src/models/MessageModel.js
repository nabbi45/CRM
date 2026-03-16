import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
    sender_id: { type: String, required: true },
    sender_name: { type: String, required: true },
    receiver_id: { type: String, default: null }, // null means global chat
    is_global: { type: Boolean, default: false },
    message: { type: String, required: false },
    attachment_url: { type: String, default: null },
    attachment_type: { type: String, default: null }, // e.g. "image", "video", "raw"
    read_by: [
        {
            user_id: { type: String },
            read_at: { type: Date, default: Date.now }
        }
    ],
}, { timestamps: true });

// Index for faster queries
MessageSchema.index({ sender_id: 1, receiver_id: 1 });
MessageSchema.index({ is_global: 1, createdAt: -1 });

export const MessageModel = mongoose.model("Message", MessageSchema);
