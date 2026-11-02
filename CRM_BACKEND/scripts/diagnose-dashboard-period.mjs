// Read-only financial/date diagnostics. Never starts the app or its background jobs.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const { BookingModel } = await import('../src/models/bookingModel.js');
const { UserModel } = await import('../src/models/UserModel.js');
const { buildDashboardSummary } = await import('../../CRM_FRONTEND/src/utils/dashboardSummary.js');
const { dashboardFinancialProjection } = await import('../src/routes/DashboardRoute.js');
try {
  await mongoose.connect(process.env.Mongo_URL, { serverSelectionTimeoutMS: 10000 });
  const bookings = await BookingModel.collection.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $project: dashboardFinancialProjection },
  ]).toArray();
  const users = await UserModel.find({ isDisabled: { $ne: true } }).select('name user_role').lean();
  const periods = ['2026-10', '2026-11'];
  console.log(JSON.stringify({ actualServerTime: new Date().toISOString(), loaded: bookings.length, legacyMissingDeletedFlag: bookings.filter((b) => b.isDeleted === undefined).length }));
  for (const month of periods) {
    const summary = buildDashboardSummary({ bookings: bookings.filter((b) => b.isDeleted === false), users, session: { user_id: '' }, isAdmin: true, month });
    console.log(JSON.stringify({ month, revenue: summary.totalRevenue, serviceDeductions: summary.totalServiceDeductions, bookingsWithPayments: summary.bookingsThisMonth, leaderboardCount: summary.leaderboard.length, graph: summary.monthlyRevData }));
  }
  const dateCounts = {};
  for (const booking of bookings) {
    const month = String(booking.date instanceof Date ? booking.date.toISOString() : booking.date || '').slice(0, 7);
    if (month) dateCounts[month] = (dateCounts[month] || 0) + 1;
  }
  console.log(JSON.stringify({ bookingDateCounts: dateCounts }));
} finally { await mongoose.disconnect(); }
