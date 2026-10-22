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
  department: { type: String, default: '' },
  location: { type: String, default: '' },
  holidayType: { type: String, default: 'Company' },
  description: { type: String, default: '' },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

const HolidayModel = mongoose.model("Holiday", holidaySchema);
export default HolidayModel;
