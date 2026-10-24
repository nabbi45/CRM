import express from "express";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { BookingModel } from "../models/bookingModel.js";
import { UserModel } from "../models/UserModel.js";
import { ServiceModel } from "../models/ServiceModel.js";
import { isAdminRole, TERM_KEYS } from "../utils/revenueRules.js";
import { buildDashboardSummary } from "../../../CRM_FRONTEND/src/utils/dashboardSummary.js";
import { cachedRead, readCacheGeneration } from "../utils/readCache.js";

const router = express.Router();
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
export const dashboardFinancialProjection = {
  ...Object.fromEntries(fields.split(' ').map((field) => [field, 1])),
  // Mongoose stores ten default share objects on many legacy bookings. Empty
  // term metadata has no financial/access effect: omit it at MongoDB, before
  // transfer, instead of sending it for every booking on every cold read.
  term_shares: {
    $arrayToObject: {
      $filter: {
        input: { $objectToArray: { $ifNull: ['$term_shares', {}] } },
        as: 'term',
        cond: { $or: [
          { $ne: [{ $ifNull: ['$$term.v.creator.user_id', ''] }, ''] },
          { $ne: [{ $ifNull: ['$$term.v.payment_date', ''] }, ''] },
          { $gt: [{ $size: { $ifNull: ['$$term.v.shared_with', []] } }, 0] },
        ] },
      },
    },
  },
  ...Object.fromEntries(TERM_KEYS.map((key) => [key, {
    $cond: [{ $ne: [{ $ifNull: [`$${key}`, 0] }, 0] }, `$${key}`, '$$REMOVE'],
  }])),
};
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
  const key = admin ? 'dashboard:admin' : `dashboard:user:${id}`;
  const generation = readCacheGeneration();
  try {
    const payload = await cachedRead(key, async () => {
        const [company, users, services, count] = await Promise.all([
          // One shared projected source read serves concurrent dashboard users.
          // Browsers receive only the computed summary and six recent bookings.
          cachedRead('dashboard:financial-source', () => BookingModel.collection.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            { $project: dashboardFinancialProjection },
          ], { maxTimeMS: 12000, batchSize: 1000 }).toArray()),
          cachedRead('dashboard:user-directory', () => UserModel.find({ isDisabled: { $ne: true } })
            .select("name user_role")
            .lean()
            .maxTimeMS(10000)),
          cachedRead('dashboard:services', () => ServiceModel.find()
            .select("name value status deduction")
            .lean()
            .maxTimeMS(10000)),
          admin ? cachedRead('dashboard:user-count', () => UserModel.countDocuments().maxTimeMS(10000)) : 0,
        ]);
        const companyBookings = company.filter((b) => b.isDeleted === false);
        const companySummary = await cachedRead(`dashboard:company-calculations:${generation}`, () => buildDashboardSummary({
          bookings: companyBookings, users, services, totalUsers: count,
          session: { user_id: id }, isAdmin: true,
        }));
        const summary = admin ? { ...companySummary, totalUsers: count } : buildDashboardSummary({
          bookings: company.filter((b) => accessible(b, id)),
          allCompanyBookings: companyBookings,
          companyServiceStats: companySummary,
          users,
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
        return { summary, generatedAt: new Date().toISOString() };
      });
    res.set('Cache-Control', 'no-store').json(payload);
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
