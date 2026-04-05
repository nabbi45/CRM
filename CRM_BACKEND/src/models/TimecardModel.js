import mongoose from "mongoose";

const TimecardSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, index: true },
    user_name: { type: String, required: true },
    month: { type: String, required: true, index: true },
    present_days: { type: Number, default: 0, min: 0 },
    leave_days: { type: Number, default: 0, min: 0 },
    week_off: { type: Number, default: 0, min: 0 },
    holiday: { type: Number, default: 0, min: 0 },
    half_day: { type: Number, default: 0, min: 0 },
    wfh: { type: Number, default: 0, min: 0 },
    el_taken: { type: Number, default: 0, min: 0 },
    total_leave: { type: Number, default: 0, min: 0 },
    payable_days: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "" },
    marked_by: { type: String, default: "" },
    marker_role: { type: String, default: "" },
  },
  { timestamps: true }
);

TimecardSchema.index({ user_id: 1, month: 1 }, { unique: true });

export const TimecardModel = mongoose.model("Timecard", TimecardSchema);
