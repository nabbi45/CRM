import express from "express";
import { BroadcastModel } from "../models/BroadcastModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { UserModel } from "../models/UserModel.js";
import { getUserJoinDate } from "../utils/userJoinDate.js";

const BroadcastRoutes = express.Router();

// Create broadcast (admin/dev/HR only)
BroadcastRoutes.post("/", authenticateUser, async (req, res) => {
    try {
        const allowedRoles = ["admin", "dev", "srdev", "senior admin", "HR"];
        if (!allowedRoles.includes(req.user?.user_role)) {
            return res.status(403).send({ message: "Not authorized to send broadcasts." });
        }

        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).send({ message: "Message is required." });
        }

        // Fetch sender name from DB since JWT only has userId and user_role
        const sender = await UserModel.findById(req.user.userId);
        const senderName = sender?.name || "Unknown";

        const broadcast = await BroadcastModel.create({
            sender_id: req.user.userId,
            sender_name: senderName,
            sender_role: req.user.user_role,
            message: message.trim(),
        });

        return res.status(201).send({ message: "Broadcast sent!", broadcast });
    } catch (error) {
        console.error("Broadcast error:", error);
        return res.status(500).send({ message: error.message });
    }
});

// Get all broadcasts (latest first, last 50) respecting user join date
BroadcastRoutes.get("/", authenticateUser, async (req, res) => {
    try {
        const joinDate = getUserJoinDate(req.user.userId);
        const broadcasts = await BroadcastModel.find({ createdAt: { $gte: joinDate } })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        return res.status(200).send(broadcasts);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Mark broadcast as read
BroadcastRoutes.patch("/:id/read", authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        await BroadcastModel.findByIdAndUpdate(req.params.id, {
            $addToSet: { read_by: { user_id: userId } },
        });
        return res.status(200).send({ message: "Marked as read." });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Mark all broadcasts as read for the current user
BroadcastRoutes.patch("/read-all", authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const joinDate = getUserJoinDate(userId);
        
        // Add current user to read_by for all broadcasts since they joined
        await BroadcastModel.updateMany(
            { createdAt: { $gte: joinDate }, "read_by.user_id": { $ne: userId } },
            { $addToSet: { read_by: { user_id: userId } } }
        );
        
        return res.status(200).send({ message: "All broadcasts marked as read." });
    } catch (error) {
        console.error("Clear all broadcasts error:", error);
        return res.status(500).send({ message: error.message });
    }
});

export default BroadcastRoutes;
