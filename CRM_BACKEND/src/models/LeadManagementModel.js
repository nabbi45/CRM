import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, min: 1, max: 5 },
    content: { type: String, required: true, trim: true, maxlength: 3000 },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const assignmentSchema = new mongoose.Schema(
  {
    assignedTo: { type: String, default: "" },
    assignedToName: { type: String, default: "" },
    assignedBy: { type: String, required: true },
    assignedByName: { type: String, required: true },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const statusHistorySchema = new mongoose.Schema(
  {
    from: { type: String, default: "new" },
    to: { type: String, required: true },
    changedBy: { type: String, required: true },
    changedByName: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const leadManagementSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    mobileNumber: { type: String, required: true, trim: true, maxlength: 30 },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    serviceRequirement: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    companyName: { type: String, default: "", trim: true, maxlength: 200 },
    customFields: { type: Map, of: String, default: {} },
    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "qualified",
        "prospect",
        "unqualified",
        "junk",
      ],
      default: "new",
      index: true,
    },
    noteEntries: { type: [noteSchema], default: [] },
    createdBy: { type: String, required: true, index: true },
    createdByName: { type: String, required: true },
    source: { type: String, enum: ["manual", "import"], default: "manual" },
    importedFileName: { type: String, default: "", maxlength: 255 },
    assignedTo: { type: String, default: "", index: true },
    assignedToName: { type: String, default: "" },
    assignedBy: { type: String, default: "", index: true },
    assignedByName: { type: String, default: "" },
    assignedAt: { type: Date, default: null },
    assignmentHistory: { type: [assignmentSchema], default: [] },
    statusHistory: { type: [statusHistorySchema], default: [] },
    lastUpdatedBy: { type: String, default: "" },
    lastUpdatedByName: { type: String, default: "" },
  },
  { timestamps: true },
);

leadManagementSchema.index({ assignedTo: 1, status: 1, updatedAt: -1 });
leadManagementSchema.index({ createdBy: 1, updatedAt: -1 });
// Keeps the default manager view fast even after the lead collection grows.
leadManagementSchema.index({ updatedAt: -1 });

const leadColumnSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, immutable: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    active: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true },
);

leadColumnSchema.index({ active: 1, label: 1 });

export const LeadManagementModel =
  mongoose.models.crm_lead || mongoose.model("crm_lead", leadManagementSchema);
export const LeadColumnModel =
  mongoose.models.crm_lead_column ||
  mongoose.model("crm_lead_column", leadColumnSchema);
