import mongoose from "mongoose";


const bookingSchema = mongoose.Schema(
  {
    user_id: { type: String, required: true },
    bdm: { type: String, required: true },
    branch_name: { type: String, required: true },
    company_name: { type: String },
    contact_person: { type: String, required: true },
    email: { type: String, required: true },
    contact_no: { type: Number, required: true },
    // services:{type:String,required:true},
    services: { type: [String], required: true },
    closed_by: { type: String },
    total_amount: { type: Number, required: true },
    term_1: { type: Number },
    term_2: { type: Number },
    term_3: { type: Number },
    payment_date: { type: Date },
    pan: { type: String },
    gst: { type: String },
    remark: { type: String },
    date: { type: Date, required: true },
    after_disbursement: { type: String },
    bank: { type: String },
    state: { type: String, required: true },
    status: { type: String },
    shared_with: [{
      user_id: { type: String },
      percentage: { type: Number }
    }],
    updatedhistory: [
      {
        updatedBy: String,
        updatedAt: { type: Date, default: Date.now },
        note: String,
        changes: {
          type: Map,
          of: new mongoose.Schema(
            {
              old: mongoose.Schema.Types.Mixed,
              new: mongoose.Schema.Types.Mixed,
            },
            { _id: false }
          )
        }
      }
    ],
    // New fields for Trash system
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: {
      type: String,
      default: null,
    }



  },
  {
    versionKey: false,
    timestamps: true
  }
);
export const BookingModel = mongoose.model("booking", bookingSchema);
