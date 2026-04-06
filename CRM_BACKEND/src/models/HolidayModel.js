import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema({
  date: {
    type: String, // 'YYYY-MM-DD'
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

const HolidayModel = mongoose.model("Holiday", holidaySchema);
export default HolidayModel;
