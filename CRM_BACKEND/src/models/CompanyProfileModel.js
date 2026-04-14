import mongoose from "mongoose";

const companyProfileSchema = mongoose.Schema(
    {
        company_name: { type: String, required: true },
        address: { type: String, required: true },
        contact_number: { type: String },
        email: { type: String },
        bank_name: { type: String },
        account_name: { type: String },
        account_number: { type: String },
        ifsc_code: { type: String },
        gst_number: { type: String },
        pan_number: { type: String },
        logo_url: { type: String },
        seal_url: { type: String },
        mail_host: { type: String },
        mail_port: { type: String },
        mail_user: { type: String },
        mail_password: { type: String },
        default_cc: { type: String },
        branches: { type: String },
        updatedBy: { type: String }
    },
    { versionKey: false, timestamps: true }
);

export const CompanyProfileModel = mongoose.model("CompanyProfile", companyProfileSchema);
