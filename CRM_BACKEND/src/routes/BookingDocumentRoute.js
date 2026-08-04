import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { BookingDocumentModel } from "../models/BookingDocumentModel.js";
import { BookingModel } from "../models/bookingModel.js";
import { authenticateUser, authorizeFeature } from "../middlewares/authMiddleware.js";
import { getCloudinaryPublicExtension, prepareUploadFile } from "../utils/uploadCompression.js";

const BookingDocumentRoutes = express.Router();

// Memory storage for multer
const storage = multer.memoryStorage();
const MAX_DOCUMENT_FILE_SIZE = 100 * 1024 * 1024;
const upload = multer({
    storage,
    limits: { fileSize: MAX_DOCUMENT_FILE_SIZE } // Images are compressed before Cloudinary upload.
});

// Document types mapping
const DOCUMENT_TYPES = [
    "agreement", "pitch_deck", "dpr", "application", "aadhaar", "pan", "others",
    "fa_agreement_sent", "fa_agreement_received", "fa_dpr_data",
    "fa_dpr", "fa_pitch_deck", "fa_app_coordination",
    "fa_application_service", "fa_acknowledgement_service"
];

const adminRoles = ["admin", "senior admin", "super admin", "director", "dev", "srdev", "sr dev"];
const TERM_KEYS = Array.from({ length: 10 }, (_, index) => `term_${index + 1}`);
const bookingAccessConditions = (userId) => [
    { user_id: userId },
    { "shared_with.user_id": userId },
    ...TERM_KEYS.flatMap((termKey) => [
        { [`term_shares.${termKey}.creator.user_id`]: userId },
        { [`term_shares.${termKey}.shared_with.user_id`]: userId },
    ]),
];

const canAccessBooking = (booking, userId, isAdmin = false) => {
    if (isAdmin) return true;
    if (!booking || !userId) return false;
    const normalizedUserId = String(userId);
    if (String(booking.user_id || "") === normalizedUserId) return true;
    if ((booking.shared_with || []).some((item) => String(item?.user_id || "") === normalizedUserId)) return true;

    return TERM_KEYS.some((termKey) => {
        const termShare = booking?.term_shares?.[termKey] || {};
        if (String(termShare?.creator?.user_id || "") === normalizedUserId) return true;
        return (termShare?.shared_with || []).some((item) => String(item?.user_id || "") === normalizedUserId);
    });
};

const normalizeStatus = (value = "") => String(value || "").trim().toLowerCase();

const uploadBookingDocument = (file, options) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
        stream.end(file.buffer);
    });

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

        const userId = req.user?.userId || req.user?.user_id || "";
        const userRole = String(req.user?.user_role || "").trim().toLowerCase();
        const userName = req.user?.name || req.headers["user-name"] || "Unknown";
        if (!canAccessBooking(booking, userId, adminRoles.includes(userRole))) {
            return res.status(403).send({ message: "You do not have access to this booking." });
        }

        const uploadFile = await prepareUploadFile(req.file);
        const extension = getCloudinaryPublicExtension(uploadFile);

        // Stream the compressed buffer so larger PDFs/documents are not expanded into a base64 request.
        const result = await uploadBookingDocument(uploadFile, {
            resource_type: uploadFile.resourceType === "image" ? "image" : "raw",
            folder: "booking_documents",
            public_id: `booking_${bookingId}_${documentType}_${Date.now()}${uploadFile.resourceType !== "image" && extension ? `.${extension}` : ""}`
        });

        // Save document record
        const document = await BookingDocumentModel.create({
            bookingId,
            documentType,
            fileName: uploadFile.originalname,
            fileUrl: result.secure_url,
            fileSize: uploadFile.size,
            mimeType: uploadFile.mimetype,
            uploadedBy: userId,
            uploadedByName: userName,
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
        const userId = req.user?.userId || req.user?.user_id || "";
        const userRole = String(req.user?.user_role || "").trim().toLowerCase();
        const booking = await BookingModel.findById(bookingId).lean();

        if (!booking || booking.isDeleted) {
            return res.status(404).send({ message: "Booking not found" });
        }

        if (!canAccessBooking(booking, userId, adminRoles.includes(userRole))) {
            return res.status(403).send({ message: "You do not have access to this booking." });
        }

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
        const {
            search,
            limit = 20,
            page = 1,
            agreementSent = "",
            agreementReceived = "",
            dprPitchDeckDataCollection = "",
            dpr = "",
            pitchDeck = "",
            applicationDetailsCoordination = "",
            application = "",
            acknowledgement = "",
        } = req.query;
        const limitNumber = Math.max(parseInt(limit, 10) || 20, 1);
        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const userId = req.user?.userId || req.user?.user_id || "";
        const userRole = String(req.user?.user_role || "").trim().toLowerCase();
        const isAdmin = adminRoles.includes(userRole);

        let bookingQuery = { isDeleted: false };
        if (!isAdmin) {
            bookingQuery.$or = bookingAccessConditions(userId);
        }
        
        if (search) {
            const searchRegex = new RegExp(search, "i");
            const numericSearch = String(search).replace(/\D/g, "");
            const textConditions = [
                { company_name: searchRegex },
                { contact_person: searchRegex },
                { email: searchRegex },
                { bdm: searchRegex },
                { services: searchRegex }
            ];
            if (numericSearch) {
                textConditions.push({ contact_no: Number(numericSearch) });
            }
            if (bookingQuery.$or) {
                bookingQuery = {
                    ...bookingQuery,
                    $and: [
                        { $or: bookingQuery.$or },
                        { $or: textConditions },
                    ]
                };
                delete bookingQuery.$or;
            } else {
                bookingQuery.$or = textConditions;
            }
        }

        const stageFilters = {
            agreementSent,
            agreementReceived,
            dprPitchDeckDataCollection,
            dpr,
            pitchDeck,
            applicationDetailsCoordination,
            application,
            acknowledgement,
        };
        const hasStageFilter = Object.values(stageFilters).some(Boolean);

        const allMatchingBookings = await BookingModel.find(bookingQuery)
            .select(`_id company_name contact_person contact_no services bdm date status total_amount ${TERM_KEYS.join(" ")}`)
            .sort({ createdAt: -1 })
            .lean();

        let filteredBookings = allMatchingBookings;
        if (hasStageFilter) {
            const bookingIds = allMatchingBookings.map((booking) => booking._id.toString());
            const { FileActivityModel } = await import("../models/FileActivityModel.js");
            const activities = await FileActivityModel.find({ bookingId: { $in: bookingIds } }).lean();
            const activityByBooking = activities.reduce((acc, activity) => {
                acc[String(activity.bookingId)] = activity;
                return acc;
            }, {});

            filteredBookings = allMatchingBookings.filter((booking) => {
                const activity = activityByBooking[String(booking._id)] || {};
                const stages = activity.stages || {};
                const applicationStatuses = Array.isArray(activity.application) ? activity.application.map((row) => row?.status).filter(Boolean) : [];
                const acknowledgementStatuses = Array.isArray(activity.acknowledgement) ? activity.acknowledgement.map((row) => row?.status).filter(Boolean) : [];

                if (agreementSent && normalizeStatus(stages.agreementSent?.status) !== normalizeStatus(agreementSent)) return false;
                if (agreementReceived && normalizeStatus(stages.agreementReceived?.status) !== normalizeStatus(agreementReceived)) return false;
                if (dprPitchDeckDataCollection && normalizeStatus(stages.dprPitchDeckDataCollection?.status) !== normalizeStatus(dprPitchDeckDataCollection)) return false;
                if (dpr && normalizeStatus(stages.dpr?.status) !== normalizeStatus(dpr)) return false;
                if (pitchDeck && normalizeStatus(stages.pitchDeck?.status) !== normalizeStatus(pitchDeck)) return false;
                if (applicationDetailsCoordination && normalizeStatus(stages.applicationDetailsCoordination?.status) !== normalizeStatus(applicationDetailsCoordination)) return false;
                if (application && !applicationStatuses.some((status) => normalizeStatus(status) === normalizeStatus(application))) return false;
                if (acknowledgement && !acknowledgementStatuses.some((status) => normalizeStatus(status) === normalizeStatus(acknowledgement))) return false;
                return true;
            });
        }

        const totalCount = filteredBookings.length;
        const bookings = filteredBookings
            .slice((pageNumber - 1) * limitNumber, pageNumber * limitNumber);

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
        const userId = req.user?.userId || req.user?.user_id || "";
        const userRole = String(req.user?.user_role || "").trim().toLowerCase();
        const isAdmin = adminRoles.includes(userRole);

        let accessibleBookingIds = null;
        if (!isAdmin) {
            const bookings = await BookingModel.find({
                isDeleted: false,
                $or: bookingAccessConditions(userId),
            }).select("_id").lean();
            accessibleBookingIds = bookings.map((booking) => booking._id);
        }

        const statsMatch = { isDeleted: false };
        if (accessibleBookingIds) {
            statsMatch.bookingId = { $in: accessibleBookingIds };
        }

        const stats = await BookingDocumentModel.aggregate([
            { $match: statsMatch },
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
        const totalBookings = isAdmin
            ? await BookingModel.countDocuments({ isDeleted: false })
            : await BookingModel.countDocuments({ isDeleted: false, $or: bookingAccessConditions(userId) });

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

        const booking = await BookingModel.findById(document.bookingId).lean();
        const userId = req.user?.userId || req.user?.user_id || "";
        const userRole = String(req.user?.user_role || "").trim().toLowerCase();
        if (!booking || booking.isDeleted) {
            return res.status(404).send({ message: "Booking not found" });
        }
        if (!canAccessBooking(booking, userId, adminRoles.includes(userRole))) {
            return res.status(403).send({ message: "You do not have access to this document." });
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
        const userRole = String(req.user?.user_role || "").trim().toLowerCase();
        const userPermissions = req.user?.feature_permissions || [];
        const allowedRoles = ["admin", "srdev", "dev", "super admin", "senior admin", "director", "sr dev"];
        
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
