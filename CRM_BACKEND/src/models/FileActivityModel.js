import mongoose from "mongoose";

const stageSchema = mongoose.Schema(
  {
    status: { type: String, enum: ["Pending", "In Progress", "Completed", "Sent", "Received"], default: "Pending" },
    date: { type: Date },
    // Files will be uploaded to BookingDocumentModel, linked via bookingId and documentType
  },
  { _id: false }
);

const serviceStageSchema = mongoose.Schema(
  {
    serviceName: { type: String, required: true },
    status: { type: String, enum: ["Pending", "In Progress", "Completed", "Sent", "Received"], default: "Pending" },
    date: { type: Date },
  },
  { _id: false }
);

const fileActivitySchema = mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "booking",
      required: true,
      unique: true,
      index: true,
    },
    stages: {
      agreementSent: { type: stageSchema, default: () => ({}) },
      agreementReceived: { type: stageSchema, default: () => ({}) },
      dprPitchDeckDataCollection: { type: stageSchema, default: () => ({}) },
      dpr: { type: stageSchema, default: () => ({}) },
      pitchDeck: { type: stageSchema, default: () => ({}) },
      applicationDetailsCoordination: { type: stageSchema, default: () => ({}) },
    },
    application: { type: [serviceStageSchema], default: [] },
    acknowledgement: { type: [serviceStageSchema], default: [] },
    anyUpdates: { type: String, default: "" }, // Visible to BDM
    adminNotes: { type: String, default: "" }, // Client ID & password, hidden from BDM
  },
  {
    timestamps: true,
  }
);

export const FileActivityModel = mongoose.model("FileActivity", fileActivitySchema);
