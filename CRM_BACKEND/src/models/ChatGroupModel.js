import mongoose from "mongoose";

const chatGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    created_by: { type: String, required: true },
    created_by_name: { type: String, default: "" },
    members: [
      {
        user_id: { type: String, required: true },
        user_name: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true, versionKey: false }
);

chatGroupSchema.index({ "members.user_id": 1, updatedAt: -1 });

export const ChatGroupModel = mongoose.model("ChatGroup", chatGroupSchema);
