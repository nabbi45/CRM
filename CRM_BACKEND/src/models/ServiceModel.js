import mongoose from "mongoose";

const serviceSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    value: { type: String, required: true, unique: true },
    status: { type: Boolean, required: true },
    deduction: { type: Number, default: 0, min: 0 },
  },
  { 
    timestamps: false, 
    versionKey: false
  }
);


export const ServiceModel = mongoose.model("service", serviceSchema);
