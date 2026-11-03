import { randomUUID } from 'node:crypto';
import { calculateBookingFinancials, freezeTermAllocations, FINANCIAL_VERSION, TERM_KEYS, participantsForTerm, serviceKey, activeRecoveries, termMetadata, termFinancialSignature, paise } from '../../../CRM_FRONTEND/src/utils/bookingFinancials.js';
import { reconcileServiceDeductionSnapshot, buildGstMetadata } from './revenueRules.js';

export const financialError = (message, status = 400) => Object.assign(new Error(message), { status });
export const plainBooking = (booking) => booking?.toObject ? booking.toObject() : booking;
export const financialSummary = (state) => ({ official: state.official, applied: state.applied, pending: state.pending, services: state.services, terms: state.terms });
export const financialFields = ['financial_version', 'financial_revision', 'deduction_baseline', 'deduction_allocations', 'deduction_recoveries', 'financial_events', 'service_deductions_snapshot'];
export function stripFinancialInput(updates) {
  const result = { ...updates };
  financialFields.forEach((key) => delete result[key]);
  Object.keys(result).forEach((key) => { if (key.includes('.') || key.startsWith('$')) throw financialError('Nested update operators are not accepted.'); });
  return result;
}

export async function prepareFinancialMutation(previous, input, { actor = {}, reason = 'Booking financial update', targetTerm, reconcile = true, resetFromTerm = false } = {}) {
  const old = previous ? plainBooking(previous) : null;
  const next = { ...input };
  if (!old) {
    next.deduction_baseline = [];
    next.deduction_recoveries = [];
    next.financial_events = [];
    next.term_shares = { ...(next.term_shares || {}) };
    TERM_KEYS.forEach((key) => { if (Number(next[key]) > 0) next.term_shares[key] = termMetadata(next, key); });
  }
  const before = old ? calculateBookingFinancials(old) : null;
  if (old) {
    next.deduction_recoveries = old.deduction_recoveries || [];
    next.deduction_baseline = old.financial_version >= FINANCIAL_VERSION ? (old.deduction_baseline || []) : freezeTermAllocations(before);
    if (resetFromTerm && targetTerm) next.deduction_baseline = next.deduction_baseline.filter((term) => TERM_KEYS.indexOf(term.term_key) < TERM_KEYS.indexOf(targetTerm));
  }
  if (reconcile) {
    const retained = old?.service_deductions_snapshot || [];
    const snapshot = await reconcileServiceDeductionSnapshot(next.services, retained);
    const retainedKeys = new Set(retained.map(serviceKey));
    next.service_deductions_snapshot = snapshot.map((item) => ({ ...item,
      service_key: item.service_key || (retained.some((row) => String(row.service_name).toLowerCase() === String(item.service_name).toLowerCase()) ? String(item.service_name).trim().toLowerCase() : serviceKey(item)),
      effective_term_key: item.effective_term_key || (old && !retainedKeys.has(serviceKey(item)) ? targetTerm || 'term_1' : 'term_1'),
    }));
  }
  const keys = new Set((next.service_deductions_snapshot || []).map(serviceKey));
  if (activeRecoveries(next).some((event) => !keys.has(event.service_key))) throw financialError('Reverse historical recoveries before removing their service.');
  for (const key of TERM_KEYS) {
    const value = next[key] === '' || next[key] == null ? 0 : Number(next[key]);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(paise(value))) throw financialError('Term amounts must be finite, non-negative and within the supported monetary range.');
    if (value > 0) {
      const date = termMetadata(next, key).payment_date;
      if (date && Number.isNaN(new Date(date).getTime())) throw financialError(`Invalid payment date for ${key}.`);
      try { participantsForTerm(next, key, { validate: true }); }
      catch (error) { throw financialError(error.message); }
    }
  }
  next.financial_version = FINANCIAL_VERSION;
  next.financial_revision = Number(old?.financial_revision || 0) + 1;
  Object.assign(next, buildGstMetadata(next));
  const after = calculateBookingFinancials(next);
  next.deduction_allocations = after.terms.map((term) => ({ term_key: term.term_key, allocations: term.allocations }));
  const changed = !before || JSON.stringify(financialSummary(before)) !== JSON.stringify(financialSummary(after));
  next.financial_events = [...(old?.financial_events || []), ...(changed ? [{ id: randomUUID(), kind: old ? 'recalculation' : 'initial_allocation', at: new Date(), actor_id: String(actor.userId || actor.user_id || ''), actor_name: actor.name || 'SYSTEM', reason, before: before ? financialSummary(before) : null, after: financialSummary(after) }] : [])];
  return next;
}

// Older clients used to send every amount. Only an explicit target, a single
// nested term or one genuinely changed amount can identify a date/mode edit.
export function isolateTermUpdate(old, input) {
  const updates = { ...input };
  let target = updates.edit_term_key;
  delete updates.edit_term_key;
  const nested = Object.keys(updates.term_shares || {}).filter((key) => TERM_KEYS.includes(key));
  const changed = TERM_KEYS.filter((key) => Object.hasOwn(updates, key) && Number(updates[key] || 0) !== Number(old[key] || 0));
  if (target && !TERM_KEYS.includes(target)) throw financialError('Invalid edit_term_key.');
  if (!target && nested.length === 1) target = nested[0];
  if (!target && changed.length === 1) target = changed[0];
  if (!target && (Object.hasOwn(updates, 'payment_date') || Object.hasOwn(updates, 'bank') || nested.length)) throw financialError('Specify edit_term_key to change a payment date or mode.');
  if (target) {
    if (changed.some((key) => key !== target) || nested.some((key) => key !== target)) throw financialError('Only one payment term can be edited at a time.');
    TERM_KEYS.filter((key) => key !== target).forEach((key) => delete updates[key]);
    const term = { ...(old.term_shares?.[target] || {}), ...(updates.term_shares?.[target] || {}) };
    if (!term.creator?.user_id) term.creator = { user_id: old.user_id, user_name: old.bdm };
    if (Object.hasOwn(updates, 'payment_date')) term.payment_date = updates.payment_date;
    if (Object.hasOwn(updates, 'bank')) term.payment_mode = updates.bank;
    if (Object.hasOwn(updates, 'shared_with')) term.shared_with = updates.shared_with;
    updates.term_shares = { ...(old.term_shares || {}), [target]: term };
    // These compatibility fields belong to Term 1, never to a continuation.
    if (target !== 'term_1') { delete updates.payment_date; delete updates.bank; delete updates.shared_with; delete updates.date; }
  }
  return { updates, target };
}

export const revisionFilter = (booking) => ({ _id: booking._id, ...(booking.financial_revision == null ? { $or: [{ financial_revision: { $exists: false } }, { financial_revision: 0 }] } : { financial_revision: Number(booking.financial_revision) }) });
export const amountChanged = (old, next, target) => target && termFinancialSignature(old, target) !== termFinancialSignature(next, target);
