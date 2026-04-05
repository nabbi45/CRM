import mongoose from "mongoose";

const projectionLeadSchema = mongoose.Schema(
  {
    date: { type: Date, required: true },
    name: { type: String, required: true, trim: true },
    phone_number: { type: String, required: true, trim: true },
    company_name: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    turnover: { type: String, default: "", trim: true },
    requirement: { type: String, default: "", trim: true },
    pitched: { type: String, default: "", trim: true },
    given_lead_to: { type: String, default: "", trim: true },
    notes_update: { type: String, default: "", trim: true },
    payment_received: { type: Boolean, default: false },
    payment_received_at: { type: Date, default: null },
    created_by: { type: String, required: true },
    created_by_name: { type: String, required: true },
    transferred_to_booking: { type: Boolean, default: false },
    transferred_booking_id: { type: String, default: "" },
    transferred_at: { type: Date, default: null },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

export const ProjectionLeadModel = mongoose.model("projection_lead", projectionLeadSchema);
