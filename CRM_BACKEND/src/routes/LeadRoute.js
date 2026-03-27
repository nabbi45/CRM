import express from "express";
import { LeadModel } from "../models/LeadModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const LeadRoutes = express.Router();

// PUBLIC — Submit a sales inquiry (no auth required)
LeadRoutes.post("/inquiry", async (req, res) => {
  try {
    const { name, mobile, email, address, companyName, location, numberOfEmployees, companyDomain } = req.body;

    if (!name || !mobile || !email) {
      return res.status(400).send({ message: "Name, mobile, and email are required." });
    }

    const lead = new LeadModel({
      name,
      mobile,
      email: email.toLowerCase(),
      address,
      companyName,
      location,
      numberOfEmployees,
      companyDomain,
    });

    await lead.save();
    return res.status(201).send({ message: "Thank you! Our team will reach out to you shortly." });
  } catch (error) {
    console.error("Lead inquiry error:", error.message);
    return res.status(500).send({ message: "Something went wrong. Please try again." });
  }
});

// PROTECTED — Get all leads (admin/dev only)
LeadRoutes.get("/all", authenticateUser, async (req, res) => {
  try {
    const role = req.user?.user_role;
    if (!["admin", "senior admin", "dev", "srdev"].includes(role)) {
      return res.status(403).send({ message: "Access denied." });
    }

    const leads = await LeadModel.find().sort({ createdAt: -1 }).lean();
    return res.status(200).send(leads);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

export default LeadRoutes;
