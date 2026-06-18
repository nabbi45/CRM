import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { prepareUploadFile, toDataUri } from "../utils/uploadCompression.js";

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

        const uploadFile = await prepareUploadFile(req.file);
        const dataURI = toDataUri(uploadFile);

        // Determine Cloudinary resource type
        const resourceType = uploadFile.resourceType || "raw";

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
