import express from "express";
import { LeaveModel } from "../models/LeaveModel.js";
import { NotificationModel } from "../models/NotificationModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { UserModel } from "../models/UserModel.js";

const LeaveRoutes = express.Router();

const APPROVER_ROLES = ["admin", "dev", "srdev", "senior admin", "HR"];

// Helper to get user name from JWT userId
const getUserName = async (userId) => {
    const user = await UserModel.findById(userId);
    return user?.name || "Unknown";
};

// Submit a leave request
LeaveRoutes.post("/", authenticateUser, async (req, res) => {
    try {
        const { leave_type, start_date, end_date, reason } = req.body;
        if (!leave_type || !start_date || !end_date || !reason) {
            return res.status(400).send({ message: "All fields are required." });
        }

        const userName = await getUserName(req.user.userId);

        const leave = await LeaveModel.create({
            user_id: req.user.userId,
            user_name: userName,
            leave_type,
            start_date,
            end_date,
            reason,
        });

        // Notify all admin/HR/dev users about the new leave request
        try {
            const approvers = await UserModel.find({ user_role: { $in: APPROVER_ROLES } });
            const notifications = approvers.map((u) => ({
                user_id: u._id.toString(),
                type: "leave_submitted",
                message: `${userName} submitted a ${leave_type} leave request (${new Date(start_date).toLocaleDateString()} - ${new Date(end_date).toLocaleDateString()}).`,
                reference_id: leave._id.toString(),
            }));
            if (notifications.length) await NotificationModel.insertMany(notifications);
        } catch (e) {
            console.error("Error creating leave notifications:", e);
        }

        return res.status(201).send({ message: "Leave request submitted!", leave });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Get all leaves (admin/HR/dev) — with history
LeaveRoutes.get("/all", authenticateUser, async (req, res) => {
    try {
        if (!APPROVER_ROLES.includes(req.user?.user_role)) {
            return res.status(403).send({ message: "Access denied." });
        }
        const leaves = await LeaveModel.find().sort({ createdAt: -1 }).lean();
        return res.status(200).send(leaves);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Get current user's leaves
LeaveRoutes.get("/my", authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const leaves = await LeaveModel.find({ user_id: userId }).sort({ createdAt: -1 }).lean();
        return res.status(200).send(leaves);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Approve or Reject a leave request
LeaveRoutes.patch("/:id", authenticateUser, async (req, res) => {
    try {
        if (!APPROVER_ROLES.includes(req.user?.user_role)) {
            return res.status(403).send({ message: "Access denied." });
        }

        const { status, notes } = req.body;
        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).send({ message: "Status must be 'approved' or 'rejected'." });
        }

        const approverName = await getUserName(req.user.userId);

        const leave = await LeaveModel.findByIdAndUpdate(
            req.params.id,
            {
                status,
                approved_by: approverName,
                approver_role: req.user.user_role,
                notes: notes || "",
            },
            { new: true }
        );

        if (!leave) return res.status(404).send({ message: "Leave not found." });

        // Notify the requesting user
        await NotificationModel.create({
            user_id: leave.user_id,
            type: status === "approved" ? "leave_approved" : "leave_rejected",
            message: `Your ${leave.leave_type} leave (${new Date(leave.start_date).toLocaleDateString()} - ${new Date(leave.end_date).toLocaleDateString()}) has been ${status} by ${approverName} (${req.user.user_role}).${notes ? ' Note: ' + notes : ''}`,
            reference_id: leave._id.toString(),
        });

        return res.status(200).send({ message: `Leave ${status}.`, leave });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Get notifications for current user
LeaveRoutes.get("/notifications", authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const notifications = await NotificationModel.find({ user_id: userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        return res.status(200).send(notifications);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Mark notification as read
LeaveRoutes.patch("/notifications/:id/read", authenticateUser, async (req, res) => {
    try {
        await NotificationModel.findByIdAndUpdate(req.params.id, { read: true });
        return res.status(200).send({ message: "Marked as read." });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Clear all notifications for user
LeaveRoutes.delete("/notifications/clear-all", authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        await NotificationModel.deleteMany({ user_id: userId });
        return res.status(200).send({ message: "All alerts cleared." });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

export default LeaveRoutes;
