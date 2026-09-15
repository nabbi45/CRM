import express from "express";
import { BookingModel } from "../models/bookingModel.js";
import { MeetingUpdateModel } from "../models/MeetingUpdateModel.js";
import { UserModel } from "../models/UserModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const MeetingUpdateRoutes = express.Router();
const ADMIN_ROLES = ["admin", "senior admin", "super admin", "dev", "srdev", "director", "hr", "sr dev"];
const DEV_EDITOR_ROLES = ["dev", "srdev", "sr dev"];
const TERM_KEYS = Array.from({ length: 10 }, (_, index) => `term_${index + 1}`);
const MEETING_KEYS = new Set(["meeting_1", "meeting_2", "meeting_3"]);

const normalizeClientKey = (value = "") =>
  String(value || "").trim().replace(/\s+/g, " ").toUpperCase();

const bookingAccessConditions = (userId) => [
  { user_id: userId },
  { "shared_with.user_id": userId },
  ...TERM_KEYS.flatMap((termKey) => [
    { [`term_shares.${termKey}.creator.user_id`]: userId },
    { [`term_shares.${termKey}.shared_with.user_id`]: userId },
  ]),
];

const canEditMeetingUpdates = async (user = {}) => {
  const role = String(user?.user_role || "").trim().toLowerCase();
  if (DEV_EDITOR_ROLES.includes(role)) return true;
  const userId = String(user?.userId || user?.user_id || "");
  if (!userId) return false;
  const currentUser = await UserModel.findById(userId).select("feature_permissions").lean();
  return Boolean(currentUser?.feature_permissions?.includes("meeting_updates_edit"));
};

MeetingUpdateRoutes.get("/", authenticateUser, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const search = String(req.query.search || "").trim();
    const userId = String(req.user?.userId || req.user?.user_id || "");
    const role = String(req.user?.user_role || "").trim().toLowerCase();

    const bookingQuery = { isDeleted: false };
    if (!ADMIN_ROLES.includes(role)) bookingQuery.$or = bookingAccessConditions(userId);
    if (search) bookingQuery.company_name = { $regex: search, $options: "i" };

    const bookings = await BookingModel.find(bookingQuery)
      .select("_id company_name contact_person services date createdAt")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const groups = new Map();
    bookings.forEach((booking) => {
      const clientKey = normalizeClientKey(booking.company_name || booking.contact_person);
      if (!clientKey) return;
      const current = groups.get(clientKey) || {
        clientKey,
        companyName: booking.company_name || booking.contact_person || "Unnamed Client",
        bookingIds: [],
        services: new Set(),
        latestBookingDate: booking.date || booking.createdAt || null,
      };
      current.bookingIds.push(booking._id);
      (booking.services || []).forEach((service) => service && current.services.add(service));
      if (new Date(booking.date || booking.createdAt || 0) > new Date(current.latestBookingDate || 0)) {
        current.latestBookingDate = booking.date || booking.createdAt || null;
      }
      groups.set(clientKey, current);
    });

    const allGroups = [...groups.values()];
    const records = allGroups.length
      ? await MeetingUpdateModel.find({ clientKey: { $in: allGroups.map((group) => group.clientKey) } }).lean()
      : [];
    const recordByKey = new Map(records.map((record) => [record.clientKey, record]));
    const totalCount = allGroups.length;
    const pagedGroups = allGroups.slice((page - 1) * limit, page * limit);

    return res.status(200).send({
      clients: pagedGroups.map((group) => {
        const record = recordByKey.get(group.clientKey);
        return {
          clientKey: group.clientKey,
          companyName: group.companyName,
          bookingCount: group.bookingIds.length,
          bookingIds: group.bookingIds.map(String),
          services: [...group.services],
          latestBookingDate: group.latestBookingDate,
          meetings: record?.meetings || {},
        };
      }),
      permissions: { canEdit: await canEditMeetingUpdates(req.user) },
      pagination: {
        totalCount,
        totalPages: Math.max(Math.ceil(totalCount / limit), 1),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    return res.status(500).send({ message: error.message || "Unable to load meeting updates." });
  }
});

MeetingUpdateRoutes.patch("/:clientKey", authenticateUser, async (req, res) => {
  try {
    if (!(await canEditMeetingUpdates(req.user))) {
      return res.status(403).send({ message: "You do not have permission to edit meeting updates." });
    }

    const clientKey = normalizeClientKey(req.params.clientKey);
    const { meetingKey, note } = req.body || {};
    if (!clientKey || !MEETING_KEYS.has(meetingKey)) {
      return res.status(400).send({ message: "A valid client and meeting number are required." });
    }
    if (typeof note !== "string" || note.length > 10000) {
      return res.status(400).send({ message: "Meeting notes must be text up to 10,000 characters." });
    }

    const userId = String(req.user?.userId || req.user?.user_id || "");
    const role = String(req.user?.user_role || "").trim().toLowerCase();
    const accessibleBookingsQuery = { isDeleted: false };
    if (!ADMIN_ROLES.includes(role)) accessibleBookingsQuery.$or = bookingAccessConditions(userId);
    const matchingBookings = (await BookingModel.find(accessibleBookingsQuery)
      .select("_id company_name contact_person")
      .lean())
      .filter((booking) => normalizeClientKey(booking.company_name || booking.contact_person) === clientKey);

    if (!matchingBookings.length) {
      return res.status(404).send({ message: "No accessible booking was found for this client." });
    }

    const update = {
      $set: {
        companyName: String(matchingBookings[0].company_name || matchingBookings[0].contact_person || clientKey).trim(),
        bookingIds: matchingBookings.map((booking) => booking._id),
        [`meetings.${meetingKey}`]: {
          note: note.trim(),
          updatedAt: new Date(),
          updatedBy: String(req.user?.userId || req.user?.user_id || ""),
          updatedByName: String(req.user?.name || req.headers["user-name"] || "").trim(),
        },
      },
    };
    const meetingUpdate = await MeetingUpdateModel.findOneAndUpdate(
      { clientKey },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.status(200).send({ message: "Meeting update saved.", meetingUpdate });
  } catch (error) {
    return res.status(500).send({ message: error.message || "Unable to save meeting update." });
  }
});

export default MeetingUpdateRoutes;
