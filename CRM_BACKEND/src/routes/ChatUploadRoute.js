import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const ChatUploadRoutes = express.Router();

// Memory storage for multer
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20 MB limit
});

ChatUploadRoutes.post("/", authenticateUser, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: "No file provided" });
        }

        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        // Determine Cloudinary resource type
        let resourceType = "raw"; // default for docs/pdfs
        if (req.file.mimetype.startsWith("image/")) {
            resourceType = "image";
        } else if (req.file.mimetype.startsWith("video/")) {
            resourceType = "video";
        }

        const result = await cloudinary.uploader.upload(dataURI, {
            resource_type: resourceType,
            folder: "chat_attachments"
        });

        res.status(200).send({
            attachment_url: result.secure_url,
            attachment_type: resourceType
        });
    } catch (e) {
        console.error("Chat Attachment Upload Error:", e);
        res.status(500).send({ message: e.message || "Failed to upload file" });
    }
});

export default ChatUploadRoutes;
