// Read-only database diagnostics. Never initialises indexes or runs automation.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { performance } from 'node:perf_hooks';
dotenv.config();
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const { BookingModel } = await import('../src/models/bookingModel.js');
const { UserModel } = await import('../src/models/UserModel.js');
const { ServiceModel } = await import('../src/models/ServiceModel.js');
const { buildDashboardSummary } = await import('../../CRM_FRONTEND/src/utils/dashboardSummary.js');
const hrm = await import('../src/hrm/service.js');
const { workspace } = await import('../src/hrm/workspace.js');
const { dashboardFinancialProjection } = await import('../src/routes/DashboardRoute.js');
async function timed(label, fn) {
  const start = performance.now();
  const result = await fn();
  console.log(JSON.stringify({ label, ms: Math.round(performance.now() - start), rows: Array.isArray(result) ? result.length : undefined }));
  return result;
}
try {
  await timed('database-connect', () => mongoose.connect(process.env.Mongo_URL, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000, compressors: ['zlib'], zlibCompressionLevel: 3 }));
  const bookings = await timed('bookings-financial-projection', () => BookingModel.collection.aggregate([
    { $match: { isDeleted: false } }, { $project: dashboardFinancialProjection },
  ], { maxTimeMS: 10000, batchSize: 1000 }).toArray());
  console.log(JSON.stringify({ label: 'financial-data-size', bytes: Buffer.byteLength(JSON.stringify(bookings)) }));
  const users = await timed('users-without-photos', () => UserModel.find().select('name user_role feature_permissions isDisabled').maxTimeMS(10000).lean());
  const services = await timed('services', () => ServiceModel.find().select('name value status deduction').maxTimeMS(10000).lean());
  const actor = { ...users.find(u => ['super admin', 'admin', 'dev'].includes(u.user_role)), userId: '' };
  actor.userId = String(actor._id);
  await timed('summary-cpu-real-bookings', () => buildDashboardSummary({ bookings, users, services, session: { user_id: actor.userId }, isAdmin: true }));
  const sample = Array.from({ length: 5000 }, (_, i) => bookings[i % bookings.length]);
  await timed('summary-cpu-5000-bookings', () => buildDashboardSummary({ bookings: sample, users, services, session: { user_id: actor.userId }, isAdmin: true }));
  await timed('hrm-directory', () => hrm.employees());
  await timed('hrm-workspace', () => workspace(actor, { section: 'dashboard' }));
  await timed('hrm-team-month', () => hrm.attendanceTeam(actor, new Date().toISOString().slice(0, 7), { page: 1 }));
} finally { await mongoose.disconnect(); }
