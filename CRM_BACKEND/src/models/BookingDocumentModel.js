import mongoose from "mongoose";

const bookingDocumentSchema = mongoose.Schema(
  {
    bookingId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "booking", 
      required: true,
      index: true
    },
    documentType: { 
      type: String, 
      enum: [
        "agreement", "pitch_deck", "dpr", "application", "others",
        "fa_agreement_sent", "fa_agreement_received", "fa_dpr_data", 
        "fa_dpr", "fa_pitch_deck", "fa_app_coordination", 
        "fa_application_service", "fa_acknowledgement_service"
      ],
      required: true 
    },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true 
    },
    uploadedByName: { type: String },
    notes: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Compound index for efficient querying
bookingDocumentSchema.index({ bookingId: 1, documentType: 1 });

export const BookingDocumentModel = mongoose.model("BookingDocument", bookingDocumentSchema);
