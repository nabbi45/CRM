import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  date: {
    type: String, // Storing as 'YYYY-MM-DD' for easy querying
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: [
      "Present", 
      "Full Day Leave", 
      "Half Day Leave", 
      "WFH", 
      "Week Off", 
      "Holiday", 
      "EL Taken"
    ],
    required: true
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  notes: {
    type: String,
    default: ""
  }
}, { timestamps: true });

// Ensure one attendance per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

const AttendanceModel = mongoose.model("Attendance", attendanceSchema);
export default AttendanceModel;
