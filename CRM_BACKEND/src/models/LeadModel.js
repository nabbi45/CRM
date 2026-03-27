import mongoose from "mongoose";

const leadSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, default: "" },
    companyName: { type: String, default: "" },
    location: { type: String, default: "" },
    numberOfEmployees: { type: String, default: "" },
    companyDomain: { type: String, default: "" },
    status: { type: String, default: "new" }, // new, contacted, converted
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const LeadModel = mongoose.model("Lead", leadSchema);
