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
    total_amount_before_gst: { type: Number },
    gst_amount: { type: Number, default: 0 },
    gst_rate: { type: Number, default: 0 },
    gst_applied: { type: Boolean, default: false },
    gst_included: { type: Boolean, default: false },
    gst_excluded_amounts: {
      total_amount: { type: Number, default: 0 },
      term_1: { type: Number, default: 0 },
      term_2: { type: Number, default: 0 },
      term_3: { type: Number, default: 0 },
    },
    service_deductions_snapshot: [{
      service_name: { type: String },
      deduction: { type: Number, default: 0 },
    }],
    is_refundable: { type: Boolean, default: false },
    refundable_percentage: { type: Number, default: 0 },
    is_approval_refundable: { type: Boolean, default: false },
    approval_refundable_percentage: { type: Number, default: 0 },
    refund_adjustments: [{
      amount: { type: Number, required: true },
      amount_excluding_gst: { type: Number, required: true },
      gst_amount: { type: Number, default: 0 },
      refund_date: { type: Date, required: true },
      note: { type: String, default: "" },
      created_by: { type: String, default: "" },
      created_by_name: { type: String, default: "" },
      created_at: { type: Date, default: Date.now },
    }],
    approval_id: { type: String, default: "" },
    payment_proof_url: { type: String, default: "" },
    payment_proof_file_name: { type: String, default: "" },
    payment_proof_mime_type: { type: String, default: "" },
    payment_proofs: [{
      url: { type: String, default: "" },
      file_name: { type: String, default: "" },
      mime_type: { type: String, default: "" },
    }],
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
      user_name: { type: String },
      percentage: { type: Number }
    }],
    term_shares: {
      term_1: {
        creator: {
          user_id: { type: String },
          user_name: { type: String },
        },
        payment_date: { type: Date },
        payment_mode: { type: String, default: "" },
        shared_with: [{
          user_id: { type: String },
          user_name: { type: String },
          percentage: { type: Number }
        }]
      },
      term_2: {
        creator: {
          user_id: { type: String },
          user_name: { type: String },
        },
        payment_date: { type: Date },
        payment_mode: { type: String, default: "" },
        shared_with: [{
          user_id: { type: String },
          user_name: { type: String },
          percentage: { type: Number }
        }]
      },
      term_3: {
        creator: {
          user_id: { type: String },
          user_name: { type: String },
        },
        payment_date: { type: Date },
        payment_mode: { type: String, default: "" },
        shared_with: [{
          user_id: { type: String },
          user_name: { type: String },
          percentage: { type: Number }
        }]
      },
    },
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
