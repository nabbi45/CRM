import express from "express";
import { MessageModel } from "../models/MessageModel.js";
import { UserModel } from "../models/UserModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const ChatRoutes = express.Router();

// Get all users for the sidebar, including their last message with the current user
ChatRoutes.get("/users", authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        // Fetch all users except the current user
        const users = await UserModel.find({ _id: { $ne: currentUserId } })
            .select("name email user_role")
            .lean();

        // For each user, fetch the last message exchanged with the current user
        const usersWithLastMsg = await Promise.all(
            users.map(async (u) => {
                const lastMsg = await MessageModel.findOne({
                    is_global: false,
                    $or: [
                        { sender_id: currentUserId, receiver_id: u._id.toString() },
                        { sender_id: u._id.toString(), receiver_id: currentUserId },
                    ],
                })
                    .sort({ createdAt: -1 })
                    .select("message createdAt read_by sender_id")
                    .lean();

                return {
                    ...u,
                    lastMessage: lastMsg,
                    isOnline: global.onlineUsers?.has(u._id.toString()) || false
                };
            })
        );

        // Sort users by latest message first, then alphabetically
        usersWithLastMsg.sort((a, b) => {
            const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
            if (aTime !== bTime) return bTime - aTime;
            return a.name.localeCompare(b.name);
        });

        return res.status(200).send(usersWithLastMsg);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Get global "All Company" chat history
ChatRoutes.get("/global", authenticateUser, async (req, res) => {
    try {
        const messages = await MessageModel.find({ is_global: true })
            .sort({ createdAt: 1 })
            .limit(100) // fetch last 100 max
            .lean();
        return res.status(200).send(messages);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Get 1-on-1 direct chat history
ChatRoutes.get("/direct/:receiverId", authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const receiverId = req.params.receiverId;

        const messages = await MessageModel.find({
            is_global: false,
            $or: [
                { sender_id: currentUserId, receiver_id: receiverId },
                { sender_id: receiverId, receiver_id: currentUserId },
            ],
        })
            .sort({ createdAt: 1 })
            .limit(100)
            .lean();

        // Mark as read natively when fetching
        await MessageModel.updateMany(
            { sender_id: receiverId, receiver_id: currentUserId, "read_by.user_id": { $ne: currentUserId } },
            { $addToSet: { read_by: { user_id: currentUserId, read_at: new Date() } } }
        );

        return res.status(200).send(messages);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Get total unread message count for current user
ChatRoutes.get("/unreads", authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.userId;

        const unreads = await MessageModel.countDocuments({
            is_global: false,
            receiver_id: currentUserId,
            "read_by.user_id": { $ne: currentUserId }
        });

        return res.status(200).send({ unreadCount: unreads });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

export default ChatRoutes;
