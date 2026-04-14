import mongoose from "mongoose";

const dailyActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
    index: true
  },
  date: {
    type: String, // 'YYYY-MM-DD'
    required: true,
    index: true
  },
  firstOnline: { type: Date },
  lastOnline: { type: Date }
}, { timestamps: true });

dailyActivitySchema.index({ userId: 1, date: 1 }, { unique: true });

const DailyActivityModel = mongoose.model("DailyActivity", dailyActivitySchema);
export default DailyActivityModel;
