import express from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { authenticateUser } from '../middlewares/authMiddleware.js';
import { BookingModel } from '../models/bookingModel.js';
import { ServiceModel } from '../models/ServiceModel.js';
import { FinancialGuard, FinancialBackup } from '../models/FinancialControlModel.js';
import { isAdminRole, collectAffectedUserIds, TERM_KEYS, buildGstMetadata } from '../utils/revenueRules.js';
import { auditBooking } from '../utils/deductionAudit.js';
import { financialError, prepareFinancialMutation, financialSummary, revisionFilter } from '../utils/bookingFinancialState.js';
import { calculateBookingFinancials, freezeTermAllocations, participantsForTerm, splitPaise, paise, money, monthIST, termMetadata, activeRecoveries } from '../../../CRM_FRONTEND/src/utils/bookingFinancials.js';
import { getBookingRevenueForUser } from '../../../CRM_FRONTEND/src/utils/bookingRevenue.js';

const router = express.Router();
export const recoveryRoles = ['director', 'dev', 'srdev', 'sr dev'];
const role = (req) => String(req.user.user_role || '').trim().toLowerCase();
const requireRecoveryRole = (req, res, next) => recoveryRoles.includes(role(req)) ? next() : res.status(403).json({ message: 'Only director and developer roles can manage deduction recoveries.' });
export const scorecardProjection = 'user_id bdm company_name contact_person shared_with term_shares services service_deductions_snapshot financial_version financial_revision deduction_baseline deduction_recoveries bank gst_included gst_applied is_refundable refundable_percentage is_approval_refundable approval_refundable_percentage refund_adjustments payment_date date createdAt isDeleted ' + TERM_KEYS.join(' ');
const canRead = (req, booking) => isAdminRole(role(req)) || collectAffectedUserIds(booking).includes(String(req.user.userId));
const catalogQuery = () => ServiceModel.find().select('name value deduction').lean();
const pageFor = (req) => Math.max(1, Math.floor(Number(req.query.page) || 1));
const respondError = (res, error) => res.status(error.status || (error.code === 11000 ? 409 : 500)).json({ message: error.message });

async function transaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } catch (error) {
    if (/Transaction numbers|replica set|mongos/i.test(error.message)) throw financialError('Deduction review and recovery require MongoDB transaction support. No financial changes were saved.', 503);
    throw error;
  } finally { await session.endSession(); }
}
async function backup(booking, req, reason, session) {
  await FinancialBackup.create([{ booking_id: String(booking._id), revision: Number(booking.financial_revision || 0), actor_id: String(req.user.userId), reason, before: booking }], { session });
}
const checkRevision = (booking, body) => {
  if (!Number.isInteger(body.expected_revision) || body.expected_revision !== Number(booking.financial_revision || 0)) throw financialError('Booking changed. Refresh the preview before posting.', 409);
};
const checkReason = (body) => { if (!String(body.reason || '').trim()) throw financialError('A reason is required.'); };
const checkRequest = (body) => { if (!/^[a-zA-Z0-9_-]{8,100}$/.test(body.request_id || '')) throw financialError('A unique request_id is required.'); };

router.get('/scorecard-source', authenticateUser, async (req, res) => {
  try {
    const bookings = await BookingModel.find({ isDeleted: { $ne: true } }).select(scorecardProjection).lean();
    res.json({ bookings: bookings.filter((booking) => canRead(req, booking)) });
  } catch (error) { respondError(res, error); }
});

router.get('/deduction-audit', authenticateUser, requireRecoveryRole, async (req, res) => {
  try {
    const page = pageFor(req), limit = 50;
    const filter = { isDeleted: { $ne: true } };
    if (req.query.booking_id) {
      if (!mongoose.isValidObjectId(req.query.booking_id)) throw financialError('Invalid booking ID.');
      filter._id = req.query.booking_id;
    }
    const [bookings, total, catalog] = await Promise.all([BookingModel.find(filter).select(`${scorecardProjection} updatedhistory`).sort({ _id: 1 }).skip((page - 1) * limit).limit(limit).lean(), BookingModel.countDocuments(filter), catalogQuery()]);
    const rows = [];
    for (const booking of bookings) {
      try { const audit = await auditBooking(booking, catalog); rows.push({ ...audit, before: financialSummary(audit.before), after: financialSummary(audit.after) }); }
      catch (error) { rows.push({ booking_id: String(booking._id), company_name: booking.company_name, flags: [error.message], unresolved: true }); }
    }
    res.json({ rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { respondError(res, error); }
});

router.get('/:id/deductions', authenticateUser, async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.id).lean();
    if (!booking || booking.isDeleted) throw financialError('Booking not found.', 404);
    if (!canRead(req, booking)) throw financialError('Booking access required.', 403);
    const page = pageFor(req), limit = 20;
    const events = [...(booking.financial_events || [])].reverse();
    const audit = recoveryRoles.includes(role(req)) ? await auditBooking(booking, await catalogQuery()) : undefined;
    res.json({ financial_revision: Number(booking.financial_revision || 0), state: calculateBookingFinancials(booking), audit, events: events.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: events.length }, recoveries: booking.deduction_recoveries || [] });
  } catch (error) { respondError(res, error); }
});

router.post('/:id/deduction-review', authenticateUser, requireRecoveryRole, async (req, res) => {
  try {
    checkReason(req.body); checkRequest(req.body);
    const catalog = await catalogQuery();
    const result = await transaction(async (session) => {
      const booking = await BookingModel.findById(req.params.id).session(session).lean();
      if (!booking || booking.isDeleted) throw financialError('Booking not found.', 404);
      const prior = (booking.financial_events || []).find((event) => event.request_id === req.body.request_id);
      if (prior) return { event: prior, state: calculateBookingFinancials(booking), duplicate: true };
      checkRevision(booking, req.body);
      const audit = await auditBooking(booking, catalog);
      if (audit.snapshot_hash !== req.body.snapshot_hash) throw financialError('Catalog rates changed. Refresh and review the new proposal.', 409);
      if (audit.flags.some((flag) => flag.startsWith('Unmatched service:'))) throw financialError('Resolve unmatched service names in the catalog before confirming this audit.');
      const next = await prepareFinancialMutation(booking, { ...booking, service_deductions_snapshot: audit.proposed_snapshot }, { actor: req.user, reason: req.body.reason, reconcile: false });
      const event = { id: randomUUID(), request_id: req.body.request_id, kind: 'catalog_review', at: new Date(), actor_id: String(req.user.userId), actor_name: req.user.name, reason: req.body.reason, before: financialSummary(audit.before), after: financialSummary(calculateBookingFinancials(next)) };
      next.financial_events.push(event);
      await backup(booking, req, req.body.reason, session);
      const saved = await BookingModel.findOneAndUpdate(revisionFilter(booking), { $set: { ...buildGstMetadata(next), financial_version: next.financial_version, financial_revision: next.financial_revision, service_deductions_snapshot: next.service_deductions_snapshot, deduction_baseline: next.deduction_baseline, deduction_allocations: next.deduction_allocations, financial_events: next.financial_events }, $push: { updatedhistory: { updatedBy: req.user.name, updatedAt: new Date(), note: req.body.reason, changes: { service_deductions_snapshot: { old: booking.service_deductions_snapshot || [], new: next.service_deductions_snapshot }, gst_included: { old: booking.gst_included, new: next.gst_included } } } } }, { new: true, session }).lean();
      if (!saved) throw financialError('Booking changed. Refresh and try again.', 409);
      return { event, state: calculateBookingFinancials(saved), financial_revision: saved.financial_revision };
    });
    res.json(result);
  } catch (error) { respondError(res, error); }
});

async function recoveryPreview(booking, body, session, lock = false) {
  if (!(booking.financial_version >= 2)) throw financialError('Review the booking deduction audit first.', 409);
  if (!TERM_KEYS.includes(body.term_key) || !(booking[body.term_key] > 0)) throw financialError('Select a received originating term.');
  if (!['original', 'current'].includes(body.period)) throw financialError('Choose original or current month.');
  const state = calculateBookingFinancials(booking);
  const service = state.services.find((item) => item.service_key === body.service_key);
  if (!service) throw financialError('Select a service deduction.');
  const desired = body.amount == null || body.amount === '' ? paise(service.pending) : paise(body.amount);
  if (!Number.isSafeInteger(desired) || desired <= 0 || desired > paise(service.pending)) throw financialError('Recovery must be positive and no greater than the service pending balance.');
  if (body.period === 'original' && !(booking.term_shares?.[body.term_key]?.payment_date || (body.term_key === 'term_1' && booking.payment_date))) throw financialError('Resolve the originating term payment date before posting to its original month.');
  const date = body.period === 'original' ? termMetadata(booking, body.term_key).payment_date : new Date();
  const month = monthIST(date);
  if (!month) throw financialError('The originating payment date must be resolved before recovery.');
  const people = participantsForTerm(booking, body.term_key);
  if (lock) {
    for (const person of [...people].sort((a, b) => a.user_id.localeCompare(b.user_id))) await FinancialGuard.findOneAndUpdate({ _id: `${person.user_id}:${month}` }, { $inc: { revision: 1 } }, { upsert: true, session });
  }
  const query = BookingModel.find({ isDeleted: { $ne: true } }).select(scorecardProjection).lean();
  if (session) query.session(session);
  const all = await query;
  const participants = splitPaise(desired, people).map((person) => {
    const score = all.reduce((sum, item) => sum + paise(getBookingRevenueForUser(item, person.user_id, false, (term) => monthIST(term.payment_date) === month)), 0);
    return { user_id: person.user_id, user_name: person.user_name, requested: person.amount, available: money(Math.max(0, score)), amount: money(Math.min(paise(person.amount), Math.max(0, score))) };
  });
  const applied = participants.reduce((sum, person) => sum + paise(person.amount), 0);
  return { service_key: service.service_key, service_name: service.service_name, term_key: body.term_key, period: body.period, month, effective_date: date, requested: money(desired), amount: money(applied), pending_after: money(paise(service.pending) - applied), participants, financial_revision: Number(booking.financial_revision || 0) };
}

router.post('/:id/deduction-recoveries/preview', authenticateUser, requireRecoveryRole, async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.id).lean();
    if (!booking || booking.isDeleted) throw financialError('Booking not found.', 404);
    res.json(await recoveryPreview(booking, req.body));
  } catch (error) { respondError(res, error); }
});

router.post('/:id/deduction-recoveries', authenticateUser, requireRecoveryRole, async (req, res) => {
  try {
    checkReason(req.body); checkRequest(req.body);
    const result = await transaction(async (session) => {
      const booking = await BookingModel.findById(req.params.id).session(session).lean();
      if (!booking || booking.isDeleted) throw financialError('Booking not found.', 404);
      const duplicate = (booking.deduction_recoveries || []).find((event) => event.request_id === req.body.request_id);
      if (duplicate) return { event: duplicate, duplicate: true };
      checkRevision(booking, req.body);
      const preview = await recoveryPreview(booking, req.body, session, true);
      if (!preview.amount) throw financialError('No positive employee score is available in this month. The deduction remains pending.', 422);
      const before = calculateBookingFinancials(booking);
      const event = { ...preview, id: randomUUID(), request_id: req.body.request_id, kind: 'recovery', at: new Date(), actor_id: String(req.user.userId), actor_name: req.user.name, reason: req.body.reason, participants: preview.participants.map(({ user_id, user_name, amount }) => ({ user_id, user_name, amount })) };
      const next = { ...booking, deduction_baseline: freezeTermAllocations(before), deduction_recoveries: [...(booking.deduction_recoveries || []), event], financial_revision: Number(booking.financial_revision || 0) + 1 };
      const after = calculateBookingFinancials(next);
      const audit = { ...event, before: financialSummary(before), after: financialSummary(after) };
      await backup(booking, req, req.body.reason, session);
      const saved = await BookingModel.findOneAndUpdate(revisionFilter(booking), { $set: { deduction_baseline: next.deduction_baseline, deduction_recoveries: next.deduction_recoveries, financial_revision: next.financial_revision }, $push: { financial_events: audit, updatedhistory: { updatedBy: req.user.name, updatedAt: new Date(), note: `Historical deduction recovery: ${req.body.reason}` } } }, { new: true, session }).lean();
      if (!saved) throw financialError('Booking changed. Refresh and try again.', 409);
      return { event, state: after, financial_revision: saved.financial_revision };
    });
    res.json(result);
  } catch (error) { respondError(res, error); }
});

router.post('/:id/deduction-recoveries/:eventId/reverse', authenticateUser, requireRecoveryRole, async (req, res) => {
  try {
    checkReason(req.body); checkRequest(req.body);
    const result = await transaction(async (session) => {
      const booking = await BookingModel.findById(req.params.id).session(session).lean();
      if (!booking || booking.isDeleted) throw financialError('Booking not found.', 404);
      const duplicate = (booking.deduction_recoveries || []).find((event) => event.request_id === req.body.request_id);
      if (duplicate) return { event: duplicate, duplicate: true };
      checkRevision(booking, req.body);
      const original = activeRecoveries(booking).find((event) => event.id === req.params.eventId);
      if (!original) throw financialError('Recovery was already reversed or does not exist.', 409);
      const before = calculateBookingFinancials(booking);
      const event = { ...original, id: randomUUID(), request_id: req.body.request_id, kind: 'reversal', reverses: original.id, at: new Date(), actor_id: String(req.user.userId), actor_name: req.user.name, reason: req.body.reason };
      const next = { ...booking, deduction_baseline: freezeTermAllocations(before), deduction_recoveries: [...(booking.deduction_recoveries || []), event] };
      const after = calculateBookingFinancials(next);
      await backup(booking, req, req.body.reason, session);
      const saved = await BookingModel.findOneAndUpdate(revisionFilter(booking), { $set: { deduction_baseline: next.deduction_baseline, deduction_recoveries: next.deduction_recoveries }, $inc: { financial_revision: 1 }, $push: { financial_events: { ...event, before: financialSummary(before), after: financialSummary(after) }, updatedhistory: { updatedBy: req.user.name, updatedAt: new Date(), note: `Deduction recovery reversed: ${req.body.reason}` } } }, { new: true, session }).lean();
      if (!saved) throw financialError('Booking changed. Refresh and try again.', 409);
      return { event, state: after, financial_revision: saved.financial_revision };
    });
    res.json(result);
  } catch (error) { respondError(res, error); }
});

export default router;
