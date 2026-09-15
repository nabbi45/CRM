import mongoose from "mongoose";

const meetingNoteSchema = mongoose.Schema(
  {
    note: { type: String, default: "" },
    updatedAt: { type: Date, default: null },
    updatedBy: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
  },
  { _id: false }
);

const meetingUpdateSchema = mongoose.Schema(
  {
    // This is a normalized company name, making one meeting timeline serve all client bookings.
    clientKey: { type: String, required: true, unique: true, index: true },
    companyName: { type: String, required: true },
    bookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "booking" }],
    meetings: {
      meeting_1: { type: meetingNoteSchema, default: () => ({}) },
      meeting_2: { type: meetingNoteSchema, default: () => ({}) },
      meeting_3: { type: meetingNoteSchema, default: () => ({}) },
    },
  },
  { timestamps: true, versionKey: false }
);

export const MeetingUpdateModel = mongoose.model("MeetingUpdate", meetingUpdateSchema);
