import mongoose from "mongoose";

const ipNetworkSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" },
    value: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    addedBy: { type: String, default: "" },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const securitySettingsSchema = new mongoose.Schema(
  {
    ipRestrictionEnabled: { type: Boolean, default: false },
    allowlist: { type: [ipNetworkSchema], default: [] },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

export const SecuritySettingsModel = mongoose.model("security_settings", securitySettingsSchema);
