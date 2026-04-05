import express from "express";
import { LeaveModel } from "../models/LeaveModel.js";
import { TimecardModel } from "../models/TimecardModel.js";
import { NotificationModel } from "../models/NotificationModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { UserModel } from "../models/UserModel.js";

const LeaveRoutes = express.Router();

const APPROVER_ROLES = ["admin", "dev", "srdev", "senior admin", "super admin", "hr"];

const normalizeRole = (role = "") => role.toString().trim().toLowerCase();
const canApprove = (role) => APPROVER_ROLES.includes(normalizeRole(role));

const getMonthKey = (inputMonth) => {
    if (typeof inputMonth === "string" && /^\d{4}-\d{2}$/.test(inputMonth)) {
        return inputMonth;
    }
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
};

const toCount = (value) => {
    const num = Number(value || 0);
    return Number.isFinite(num) && num > 0 ? num : 0;
};

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
            const allUsers = await UserModel.find({}, "_id user_role");
            const approvers = allUsers.filter((u) => canApprove(u.user_role));
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
        if (!canApprove(req.user?.user_role)) {
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

LeaveRoutes.get("/timecard/my", authenticateUser, async (req, res) => {
    try {
        const month = getMonthKey(req.query?.month);
        const card = await TimecardModel.findOne({ user_id: req.user.userId, month }).lean();

        if (!card) {
            return res.status(200).send({
                month,
                user_id: req.user.userId,
                user_name: req.user.user_name || "",
                present_days: 0,
                leave_days: 0,
                week_off: 0,
                holiday: 0,
                half_day: 0,
                wfh: 0,
                el_taken: 0,
                total_leave: 0,
                payable_days: 0,
                notes: "",
            });
        }

        return res.status(200).send(card);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

LeaveRoutes.get("/timecard/all", authenticateUser, async (req, res) => {
    try {
        if (!canApprove(req.user?.user_role)) {
            return res.status(403).send({ message: "Access denied." });
        }

        const month = getMonthKey(req.query?.month);
        const [users, cards] = await Promise.all([
            UserModel.find({}, "_id name user_role").sort({ name: 1 }).lean(),
            TimecardModel.find({ month }).lean(),
        ]);

        const cardMap = new Map(cards.map((c) => [c.user_id, c]));
        const rows = users.map((u) => {
            const id = u._id.toString();
            const existing = cardMap.get(id);
            if (existing) return existing;

            return {
                user_id: id,
                user_name: u.name,
                month,
                present_days: 0,
                leave_days: 0,
                week_off: 0,
                holiday: 0,
                half_day: 0,
                wfh: 0,
                el_taken: 0,
                total_leave: 0,
                payable_days: 0,
                notes: "",
            };
        });

        return res.status(200).send(rows);
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

LeaveRoutes.put("/timecard/mark", authenticateUser, async (req, res) => {
    try {
        if (!canApprove(req.user?.user_role)) {
            return res.status(403).send({ message: "Access denied." });
        }

        const {
            user_id,
            month,
            present_days,
            leave_days,
            week_off,
            holiday,
            half_day,
            wfh,
            el_taken,
            notes,
        } = req.body;

        if (!user_id) {
            return res.status(400).send({ message: "user_id is required." });
        }

        const targetUser = await UserModel.findById(user_id).lean();
        if (!targetUser) {
            return res.status(404).send({ message: "Employee not found." });
        }

        const monthKey = getMonthKey(month);
        const normalized = {
            present_days: toCount(present_days),
            leave_days: toCount(leave_days),
            week_off: toCount(week_off),
            holiday: toCount(holiday),
            half_day: toCount(half_day),
            wfh: toCount(wfh),
            el_taken: toCount(el_taken),
        };

        const total_leave = normalized.leave_days + normalized.half_day;
        const payable_days =
            normalized.present_days +
            normalized.week_off +
            normalized.holiday +
            normalized.half_day +
            normalized.wfh +
            normalized.el_taken;

        const markerName = await getUserName(req.user.userId);

        const card = await TimecardModel.findOneAndUpdate(
            { user_id, month: monthKey },
            {
                user_name: targetUser.name || "Unknown",
                month: monthKey,
                ...normalized,
                total_leave,
                payable_days,
                notes: notes || "",
                marked_by: markerName,
                marker_role: req.user.user_role || "",
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return res.status(200).send({ message: "Timecard saved.", card });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Approve or Reject a leave request
LeaveRoutes.patch("/:id", authenticateUser, async (req, res) => {
    try {
        if (!canApprove(req.user?.user_role)) {
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

export default LeaveRoutes;
