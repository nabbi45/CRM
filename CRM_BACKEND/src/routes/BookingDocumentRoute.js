import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { BookingDocumentModel } from "../models/BookingDocumentModel.js";
import { BookingModel } from "../models/bookingModel.js";
import { authenticateUser, authorizeFeature } from "../middlewares/authMiddleware.js";

const BookingDocumentRoutes = express.Router();

// Memory storage for multer
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit for documents
});

// Document types mapping
const DOCUMENT_TYPES = [
    "agreement", "pitch_deck", "dpr", "application", "aadhaar", "pan", "others",
    "fa_agreement_sent", "fa_agreement_received", "fa_dpr_data",
    "fa_dpr", "fa_pitch_deck", "fa_app_coordination",
    "fa_application_service", "fa_acknowledgement_service"
];

/**
 * Upload a document for a booking
 * POST /api/booking-documents/upload
 */
BookingDocumentRoutes.post("/upload", authenticateUser, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: "No file provided" });
        }

        const { bookingId, documentType, notes } = req.body;

        if (!bookingId || !documentType) {
            return res.status(400).send({ message: "Booking ID and document type are required" });
        }

        if (!DOCUMENT_TYPES.includes(documentType)) {
            return res.status(400).send({ message: `Invalid document type. Must be one of: ${DOCUMENT_TYPES.join(", ")}` });
        }

        // Verify booking exists
        const booking = await BookingModel.findById(bookingId);
        if (!booking) {
            return res.status(404).send({ message: "Booking not found" });
        }

        // Upload to Cloudinary
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        const result = await cloudinary.uploader.upload(dataURI, {
            resource_type: "raw",
            folder: "booking_documents",
            public_id: `booking_${bookingId}_${documentType}_${Date.now()}`
        });

        // Save document record
        const document = await BookingDocumentModel.create({
            bookingId,
            documentType,
            fileName: req.file.originalname,
            fileUrl: result.secure_url,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedBy: req.user.userId,
            uploadedByName: req.user.name || "Unknown",
            notes: notes || ""
        });

        return res.status(201).send({
            message: "Document uploaded successfully",
            document
        });
    } catch (error) {
        console.error("Document upload error:", error);
        return res.status(500).send({ message: error.message || "Failed to upload document" });
    }
});

/**
 * Get documents for a specific booking
 * GET /api/booking-documents/booking/:bookingId
 */
BookingDocumentRoutes.get("/booking/:bookingId", authenticateUser, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { documentType } = req.query;

        const query = { bookingId, isDeleted: false };
        if (documentType) {
            query.documentType = documentType;
        }

        const documents = await BookingDocumentModel.find(query)
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).send(documents);
    } catch (error) {
        console.error("Error fetching booking documents:", error);
        return res.status(500).send({ message: error.message });
    }
});

/**
 * Get all documents with booking info (for Client Documents page)
 * GET /api/booking-documents/all
 */
BookingDocumentRoutes.get("/all", authenticateUser, async (req, res) => {
    try {
        const { search, limit = 20, page = 1 } = req.query;
        const limitNumber = Math.max(parseInt(limit, 10) || 20, 1);
        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);

        let bookingQuery = { isDeleted: false };
        
        if (search) {
            const searchRegex = new RegExp(search, "i");
            bookingQuery.$or = [
                { company_name: searchRegex },
                { contact_person: searchRegex },
                { bdm: searchRegex }
            ];
        }

        const totalCount = await BookingModel.countDocuments(bookingQuery);

        const bookings = await BookingModel.find(bookingQuery)
            .select("_id company_name contact_person contact_no services bdm date status total_amount term_1 term_2 term_3")
            .sort({ createdAt: -1 })
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber)
            .lean();

        const bookingIds = bookings.map(b => b._id.toString());

        // Get documents for these bookings
        const documents = await BookingDocumentModel.find({
            bookingId: { $in: bookingIds },
            isDeleted: false
        }).lean();

        // Group documents by booking
        const documentsByBooking = documents.reduce((acc, doc) => {
            const bookingId = doc.bookingId.toString();
            if (!acc[bookingId]) acc[bookingId] = {};
            if (!acc[bookingId][doc.documentType]) acc[bookingId][doc.documentType] = [];
            acc[bookingId][doc.documentType].push(doc);
            return acc;
        }, {});

        // Combine bookings with document counts
        const result = bookings.map(booking => {
            const bookingDocs = documentsByBooking[booking._id.toString()] || {};
            return {
                ...booking,
                documents: bookingDocs,
                documentCounts: {
                    agreement: (bookingDocs.agreement || []).length,
                    pitch_deck: (bookingDocs.pitch_deck || []).length,
                    dpr: (bookingDocs.dpr || []).length,
            application: (bookingDocs.application || []).length,
            aadhaar: (bookingDocs.aadhaar || []).length,
            pan: (bookingDocs.pan || []).length,
            others: (bookingDocs.others || []).length
                }
            };
        });

        return res.status(200).send({
            bookings: result,
            pagination: {
                totalCount,
                totalPages: Math.max(Math.ceil(totalCount / limitNumber), 1),
                currentPage: pageNumber,
                limit: limitNumber,
                hasNextPage: pageNumber * limitNumber < totalCount,
                hasPrevPage: pageNumber > 1,
            }
        });
    } catch (error) {
        console.error("Error fetching all documents:", error);
        return res.status(500).send({ message: error.message });
    }
});

/**
 * Get document statistics
 * GET /api/booking-documents/stats
 */
BookingDocumentRoutes.get("/stats", authenticateUser, async (req, res) => {
    try {
        const stats = await BookingDocumentModel.aggregate([
            { $match: { isDeleted: false } },
            {
                $group: {
                    _id: "$documentType",
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            agreement: 0,
            pitch_deck: 0,
            dpr: 0,
            application: 0,
            aadhaar: 0,
            pan: 0,
            others: 0
        };

        stats.forEach(stat => {
            result[stat._id] = stat.count;
        });

        // Get total bookings count
        const totalBookings = await BookingModel.countDocuments({ isDeleted: false });

        return res.status(200).send({
            ...result,
            totalBookings
        });
    } catch (error) {
        console.error("Error fetching document stats:", error);
        return res.status(500).send({ message: error.message });
    }
});

/**
 * Get a single document
 * GET /api/booking-documents/:id
 */
BookingDocumentRoutes.get("/:id", authenticateUser, async (req, res) => {
    try {
        const document = await BookingDocumentModel.findById(req.params.id);
        if (!document || document.isDeleted) {
            return res.status(404).send({ message: "Document not found" });
        }
        return res.status(200).send(document);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

/**
 * Update document notes
 * PATCH /api/booking-documents/:id/notes
 */
BookingDocumentRoutes.patch("/:id/notes", authenticateUser, async (req, res) => {
    try {
        const { notes } = req.body;
        
        const document = await BookingDocumentModel.findByIdAndUpdate(
            req.params.id,
            { notes },
            { new: true }
        );

        if (!document) {
            return res.status(404).send({ message: "Document not found" });
        }

        return res.status(200).send({ message: "Notes updated", document });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

/**
 * Soft delete a document (admin/higher authority or users with manage_documents permission)
 * DELETE /api/booking-documents/:id
 */
BookingDocumentRoutes.delete("/:id", authenticateUser, async (req, res) => {
    try {
        const userRole = req.user?.user_role;
        const userPermissions = req.user?.feature_permissions || [];
        const allowedRoles = ["admin", "srdev", "dev", "super admin", "senior admin"];
        
        // Check if user has permission to delete
        const canDelete = allowedRoles.includes(userRole) || 
                         userPermissions.includes('manage_documents') ||
                         userPermissions.includes('edit_documents');

        if (!canDelete) {
            return res.status(403).send({ message: "Not authorized to delete documents" });
        }

        const document = await BookingDocumentModel.findByIdAndUpdate(
            req.params.id,
            { isDeleted: true },
            { new: true }
        );

        if (!document) {
            return res.status(404).send({ message: "Document not found" });
        }

        return res.status(200).send({ message: "Document deleted successfully" });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

export default BookingDocumentRoutes;
