import mongoose from "mongoose";

const ContactSalesSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    companyName: { type: String, required: true },
    location: { type: String, required: true },
    noOfEmails: { type: Number, required: true },
    companyDomain: { type: String, required: true },
    status: { type: String, default: 'New' }
}, {
    timestamps: true
});

export const ContactSalesModel = mongoose.model("ContactSales", ContactSalesSchema);
