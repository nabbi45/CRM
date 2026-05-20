import express from "express";
import { MessageModel } from "../models/MessageModel.js";
import { UserModel } from "../models/UserModel.js";
import { ChatGroupModel } from "../models/ChatGroupModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { getUserJoinDate } from "../utils/userJoinDate.js";

const ChatRoutes = express.Router();

const normalizeRole = (role = "") => role.toString().trim().toLowerCase();
const GROUP_CREATOR_ROLES = ["admin", "super admin", "senior admin", "director", "hr", "dev", "srdev", "sr dev"];

const canCreateGroup = (user) => {
    const role = normalizeRole(user?.user_role);
    return GROUP_CREATOR_ROLES.includes(role);
};

// Get all users for the sidebar, including their last message with the current user
ChatRoutes.get("/users", authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        // Fetch all users including the current user for Saved Messages
        const users = await UserModel.find({})
            .select("name email user_role profilePicture")
            .lean();

        // For each user, fetch the last message exchanged with the current user
        const usersWithLastMsg = await Promise.all(
            users.map(async (u) => {
                const isSelf = u._id.toString() === currentUserId;
                if (isSelf) {
                    u.name = "You (Save Messages)";
                }

                const lastMsg = await MessageModel.findOne({
                    is_global: false,
                    is_group: { $ne: true },
                    $or: isSelf 
                        ? [{ sender_id: currentUserId, receiver_id: currentUserId }]
                        : [
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

// Get groups current user belongs to
ChatRoutes.get("/groups", authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const groups = await ChatGroupModel.find({ "members.user_id": currentUserId })
            .sort({ updatedAt: -1 })
            .lean();

        const groupsWithLastMsg = await Promise.all(groups.map(async (group) => {
            const lastMessage = await MessageModel.findOne({
                is_group: true,
                group_id: group._id.toString(),
            })
                .sort({ createdAt: -1 })
                .select("message createdAt sender_name sender_id read_by")
                .lean();
            return { ...group, lastMessage };
        }));

        return res.status(200).send(groupsWithLastMsg);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Create a group chat
ChatRoutes.post("/groups", authenticateUser, async (req, res) => {
    try {
        if (!canCreateGroup(req.user)) {
            return res.status(403).send({ message: "Only HR, super admin, and higher authorities can create groups." });
        }

        const { name, memberIds = [] } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).send({ message: "Group name is required." });
        }

        const uniqueIds = [...new Set([req.user.userId, ...memberIds].filter(Boolean).map(String))];
        if (uniqueIds.length < 2) {
            return res.status(400).send({ message: "Select at least one group member." });
        }

        const users = await UserModel.find({ _id: { $in: uniqueIds } }).select("name").lean();
        const nameById = users.reduce((acc, user) => {
            acc[user._id.toString()] = user.name;
            return acc;
        }, {});

        const group = await ChatGroupModel.create({
            name: name.trim(),
            created_by: req.user.userId,
            created_by_name: nameById[req.user.userId] || "",
            members: uniqueIds.map((id) => ({
                user_id: id,
                user_name: nameById[id] || "",
            })),
        });

        return res.status(201).send({ message: "Group created successfully.", group });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Get global "All Company" chat history
ChatRoutes.get("/global", authenticateUser, async (req, res) => {
    try {
        const joinDate = getUserJoinDate(req.user.userId);
        const messages = await MessageModel.find({
            is_global: true,
            createdAt: { $gte: joinDate },
        })
            .sort({ createdAt: 1 })
            .limit(100)
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

        const joinDate = getUserJoinDate(currentUserId);

        const messages = await MessageModel.find({
            is_global: false,
            $or: [
                { sender_id: currentUserId, receiver_id: receiverId },
                { sender_id: receiverId, receiver_id: currentUserId },
            ],
            createdAt: { $gte: joinDate },
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

// Get group chat history
ChatRoutes.get("/groups/:groupId/messages", authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const groupId = req.params.groupId;

        const group = await ChatGroupModel.findOne({
            _id: groupId,
            "members.user_id": currentUserId,
        }).lean();

        if (!group) {
            return res.status(403).send({ message: "You are not a member of this group." });
        }

        const messages = await MessageModel.find({
            is_group: true,
            group_id: groupId,
        })
            .sort({ createdAt: 1 })
            .limit(150)
            .lean();

        await MessageModel.updateMany(
            { is_group: true, group_id: groupId, "read_by.user_id": { $ne: currentUserId } },
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

// Edit a message
ChatRoutes.patch("/messages/:messageId", authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const { messageId } = req.params;
        const { message: newMessage } = req.body;

        if (!newMessage || newMessage.trim().length === 0) {
            return res.status(400).send({ message: "Message content cannot be empty" });
        }

        // Find the message
        const msg = await MessageModel.findById(messageId);
        if (!msg) {
            return res.status(404).send({ message: "Message not found" });
        }

        // Only allow sender to edit their own message
        if (msg.sender_id !== currentUserId) {
            return res.status(403).send({ message: "You can only edit your own messages" });
        }

        // Update the message
        msg.message = newMessage.trim();
        msg.edited_at = new Date();
        await msg.save();

        return res.status(200).send({ 
            message: "Message updated successfully",
            updatedMessage: msg 
        });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Delete a message
ChatRoutes.delete("/messages/:messageId", authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const { messageId } = req.params;

        // Find the message
        const msg = await MessageModel.findById(messageId);
        if (!msg) {
            return res.status(404).send({ message: "Message not found" });
        }

        // Only allow sender to delete their own message
        if (msg.sender_id !== currentUserId) {
            return res.status(403).send({ message: "You can only delete your own messages" });
        }

        // Delete the message
        await MessageModel.findByIdAndDelete(messageId);

        return res.status(200).send({ message: "Message deleted successfully" });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Delete a group
ChatRoutes.delete("/groups/:groupId", authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const { groupId } = req.params;

        const group = await ChatGroupModel.findById(groupId);
        if (!group) {
            return res.status(404).send({ message: "Group not found" });
        }

        if (group.created_by !== currentUserId && !canCreateGroup(req.user)) {
            return res.status(403).send({ message: "Only the group creator or admin can delete this group." });
        }

        await ChatGroupModel.findByIdAndDelete(groupId);
        await MessageModel.deleteMany({ is_group: true, group_id: groupId });

        return res.status(200).send({ message: "Group deleted successfully" });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Update group members
ChatRoutes.patch("/groups/:groupId/members", authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const { groupId } = req.params;
        const { memberIds = [] } = req.body;

        const group = await ChatGroupModel.findById(groupId);
        if (!group) {
            return res.status(404).send({ message: "Group not found" });
        }

        if (group.created_by !== currentUserId && !canCreateGroup(req.user)) {
            return res.status(403).send({ message: "Only the group creator or admin can manage members." });
        }

        const uniqueIds = [...new Set([group.created_by, ...memberIds].filter(Boolean).map(String))];
        if (uniqueIds.length < 2) {
            return res.status(400).send({ message: "Select at least one group member besides the creator." });
        }

        const users = await UserModel.find({ _id: { $in: uniqueIds } }).select("name").lean();
        const nameById = users.reduce((acc, user) => {
            acc[user._id.toString()] = user.name;
            return acc;
        }, {});

        group.members = uniqueIds.map((id) => ({
            user_id: id,
            user_name: nameById[id] || "",
        }));

        await group.save();

        return res.status(200).send({ message: "Group members updated successfully", group });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Rename a group
ChatRoutes.patch("/groups/:groupId", authenticateUser, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const { groupId } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).send({ message: "Group name is required." });
        }

        const group = await ChatGroupModel.findById(groupId);
        if (!group) {
            return res.status(404).send({ message: "Group not found" });
        }

        if (group.created_by !== currentUserId && !canCreateGroup(req.user)) {
            return res.status(403).send({ message: "Only the group creator or admin can rename this group." });
        }

        group.name = name.trim();
        await group.save();

        return res.status(200).send({ message: "Group renamed successfully", group });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

export default ChatRoutes;
