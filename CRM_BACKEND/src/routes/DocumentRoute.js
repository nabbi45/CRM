import express from "express";
import { DocumentModel } from "../models/DocumentModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const DocumentRoutes = express.Router();

// Save a newly generated document
DocumentRoutes.post("/save", authenticateUser, async (req, res) => {
    try {
        const { bookingId, title, type, htmlContent, invoiceData } = req.body;

        // Save to DB
        const newDoc = await DocumentModel.create({
            bookingId,
            title,
            type,
            htmlContent,
            invoiceData,
            generatedBy: req.user?.name || "Unknown"
        });

        return res.status(201).send({ message: "Document saved to database successfully", document: newDoc });
    } catch (error) {
        console.error("Error saving document:", error);
        return res.status(500).send({ message: error.message });
    }
});

// Fetch all documents or filter by bookingId
DocumentRoutes.get("/all", authenticateUser, async (req, res) => {
    try {
        const { bookingId } = req.query;
        const query = bookingId ? { bookingId } : {};

        // Fetch and populate booking so UI can show whose document it is
        const documents = await DocumentModel.find(query)
            .populate("bookingId", "company_name contact_person email contact_no bdm")
            .sort({ createdAt: -1 });

        return res.status(200).send({ message: "Documents fetched", documents });
    } catch (error) {
        console.error("Error fetching documents:", error);
        return res.status(500).send({ message: error.message });
    }
});

// View a single document
DocumentRoutes.get("/:id", authenticateUser, async (req, res) => {
    try {
        const document = await DocumentModel.findById(req.params.id).populate("bookingId");
        if (!document) {
            return res.status(404).send({ message: "Document not found" });
        }
        return res.status(200).send(document);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Delete a document
DocumentRoutes.delete("/:id", authenticateUser, async (req, res) => {
    try {
        const userRole = req.user?.user_role;
        const allowedRoles = ["admin", "srdev", "dev", "super admin", "senior admin"];
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).send({ message: "Not authorized to delete documents" });
        }

        await DocumentModel.findByIdAndDelete(req.params.id);
        return res.status(200).send({ message: "Document deleted" });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

export default DocumentRoutes;
