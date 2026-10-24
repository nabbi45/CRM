import express from "express";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { BookingModel } from "../models/bookingModel.js";
import { UserModel } from "../models/UserModel.js";
import { ServiceModel } from "../models/ServiceModel.js";
import { isAdminRole, TERM_KEYS } from "../utils/revenueRules.js";
import { buildDashboardSummary } from "../../../CRM_FRONTEND/src/utils/dashboardSummary.js";
import { profileThumbnail } from "../utils/profileThumbnail.js";

const router = express.Router();
const pending = new Map();
const fields = [
  "user_id",
  "shared_with",
  "term_shares",
  "refund_adjustments",
  "services",
  "service_deductions_snapshot",
  "gst_included",
  "gst_applied",
  "bank",
  "is_refundable",
  "refundable_percentage",
  "is_approval_refundable",
  "approval_refundable_percentage",
  "payment_date",
  "date",
  "createdAt",
  "company_name",
  "contact_person",
  "bdm",
  "status",
  "isDeleted",
  ...TERM_KEYS,
].join(" ");
const accessible = (booking, id) =>
  String(booking.user_id) === id ||
  (booking.shared_with || []).some((s) => String(s.user_id) === id) ||
  TERM_KEYS.some(
    (key) =>
      String(booking.term_shares?.[key]?.creator?.user_id) === id ||
      (booking.term_shares?.[key]?.shared_with || []).some(
        (s) => String(s.user_id) === id,
      ),
  );

router.get("/summary", authenticateUser, async (req, res) => {
  const id = String(req.user.userId);
  const admin = isAdminRole(req.user.user_role);
  const key = `${id}:${admin}`;
  try {
    if (!pending.has(key)) {
      const work = (async () => {
        const [company, users, services, count] = await Promise.all([
          BookingModel.find(admin ? { isDeleted: false } : { isDeleted: { $ne: true } })
            .select(fields)
            .lean()
            .maxTimeMS(20000),
          UserModel.find({ isDisabled: { $ne: true } })
            .select("name user_role profilePicture")
            .lean()
            .maxTimeMS(10000),
          ServiceModel.find()
            .select("name value status deduction")
            .lean()
            .maxTimeMS(10000),
          admin ? UserModel.countDocuments().maxTimeMS(10000) : 0,
        ]);
        const compactUsers = await Promise.all(
          users.map(async (u) => ({
            ...u,
            profilePicture: await profileThumbnail(u.profilePicture),
          })),
        );
        const summary = buildDashboardSummary({
          bookings: admin ? company : company.filter((b) => accessible(b, id)),
          allCompanyBookings: admin ? company : company.filter((b) => b.isDeleted === false),
          users: compactUsers,
          services,
          totalUsers: count,
          session: { user_id: id },
          isAdmin: admin,
        });
        // Detail/edit data is fetched on demand rather than embedded in this page.
        summary.recentBookings = summary.recentBookings.map((booking) =>
          Object.fromEntries(
            [
              "_id",
              "company_name",
              "contact_person",
              "createdAt",
              "date",
              "status",
              "bdm",
              "services",
              ...TERM_KEYS,
            ].map((key) => [key, booking[key]]),
          ),
        );
        return { summary };
      })().finally(() => pending.delete(key));
      pending.set(key, work);
    }
    res.json(await pending.get(key));
  } catch (error) {
    res
      .status(503)
      .json({ message: "Dashboard summary could not load. Please retry." });
    console.error("Dashboard summary:", error.message);
  }
});

router.get("/booking/:id", authenticateUser, async (req, res) => {
  try {
    const booking = await BookingModel.findOne({
      _id: req.params.id,
      isDeleted: false,
    }).lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (
      !isAdminRole(req.user.user_role) &&
      !accessible(booking, String(req.user.userId))
    )
      return res.status(403).json({ message: "Booking access required" });
    res.json({ booking });
  } catch (error) {
    res.status(400).json({ message: "Unable to open this booking." });
  }
});
export default router;
