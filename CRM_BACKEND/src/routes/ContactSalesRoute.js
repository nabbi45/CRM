import express from "express";
import { ContactSalesModel } from "../models/ContactSalesModel.js";

const ContactSalesRoute = express.Router();

// Public route to submit a new sales inquiry
ContactSalesRoute.post("/", async (req, res) => {
    try {
        const { name, mobile, email, address, companyName, location, noOfEmails, companyDomain } = req.body;

        // Basic validation
        if (!name || !email || !mobile || !companyName) {
            return res.status(400).send({ message: "Name, email, mobile, and company name are required fields" });
        }

        const newInquiry = new ContactSalesModel({
            name,
            mobile,
            email,
            address,
            companyName,
            location,
            noOfEmails,
            companyDomain
        });

        await newInquiry.save();

        return res.status(200).send({ message: "Sales inquiry saved successfully. We'll be in touch!", result: newInquiry });

    } catch (error) {
        return res.status(500).send({ message: "Failed to submit sales inquiry", error: error.message });
    }
});

export default ContactSalesRoute;
