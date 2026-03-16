import mongoose from "mongoose";

const BroadcastSchema = new mongoose.Schema({
    sender_id: { type: String, required: true },
    sender_name: { type: String, required: true },
    sender_role: { type: String, required: true },
    message: { type: String, required: true },
    read_by: [{
        user_id: String,
        read_at: { type: Date, default: Date.now }
    }],
}, { timestamps: true });

export const BroadcastModel = mongoose.model("Broadcast", BroadcastSchema);
