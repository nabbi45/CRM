import mongoose from "mongoose";

const documentSchema = mongoose.Schema(
    {
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "booking" },
        title: { type: String, required: true },
        type: { type: String, enum: ["Invoice", "Agreement"], required: true },
        htmlContent: { type: String }, // Used for agreements
        invoiceData: { type: mongoose.Schema.Types.Mixed }, // Used for invoices
        generatedBy: { type: String }
    },
    { timestamps: true }
);

export const DocumentModel = mongoose.model("Document", documentSchema);
