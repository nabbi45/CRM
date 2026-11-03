import { createHash } from 'node:crypto';
import { reconcileServiceDeductionSnapshot } from './revenueRules.js';
import { calculateBookingFinancials, freezeTermAllocations, serviceKey, TERM_KEYS } from '../../../CRM_FRONTEND/src/utils/bookingFinancials.js';

const dateKey = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString().slice(0, 10) : '';
export function dateReviewCandidates(booking) {
  const candidates = [];
  for (const entry of [...(booking.updatedhistory || [])].reverse()) {
    const changes = entry.changes instanceof Map ? Object.fromEntries(entry.changes) : entry.changes || {};
    const oldShares = changes.term_shares?.old || {}, nextShares = changes.term_shares?.new || {};
    const oldFirst = dateKey(oldShares.term_1?.payment_date), newFirst = dateKey(nextShares.term_1?.payment_date);
    if (!candidates.length && oldFirst && newFirst && oldFirst !== newFirst && dateKey(booking.term_shares?.term_1?.payment_date) === newFirst && TERM_KEYS.slice(1).some((key) => dateKey(nextShares[key]?.payment_date) === newFirst && dateKey(oldShares[key]?.payment_date) !== newFirst)) {
      candidates.push({ term_key: 'term_1', current_date: newFirst, previous_date: oldFirst, recorded_at: entry.updatedAt, note: entry.note, requires_review: true });
    }
  }
  return candidates;
}

export async function auditBooking(booking, catalog) {
  const flags = [];
  const date_candidates = dateReviewCandidates(booking);
  if (date_candidates.length) flags.push('Possible earlier-term date overwrite in history; verify the original date before editing');
  const old = booking.service_deductions_snapshot || [];
  const snapshot = await reconcileServiceDeductionSnapshot(booking.services || [], old, catalog);
  const known = new Set(catalog.flatMap((service) => [service.name, service.value].map((label) => String(label || '').trim().toLowerCase())));
  (booking.services || []).forEach((label) => { if (!known.has(String(label).trim().toLowerCase())) flags.push(`Unmatched service: ${label}`); });
  snapshot.forEach((service) => { if (!old.some((item) => serviceKey(item) === serviceKey(service) || item.service_name.toLowerCase() === service.service_name.toLowerCase())) flags.push(`Missing saved fee: ${service.service_name}`); });
  TERM_KEYS.forEach((key) => {
    if (!(booking[key] > 0)) return;
    if (!booking.term_shares?.[key]?.payment_date && key !== 'term_1') flags.push(`Review missing payment date for ${key}`);
    const mode = booking.term_shares?.[key]?.payment_mode || booking.bank;
    if (!(booking.financial_version >= 2) && String(mode).trim().toLowerCase() === 'cash' && (booking.gst_included || booking.gst_applied)) flags.push(`Legacy booking GST flags do not describe the cash payment in ${key}`);
  });
  const before = calculateBookingFinancials(booking);
  const proposed = { ...booking, financial_version: 2, deduction_baseline: booking.financial_version >= 2 ? booking.deduction_baseline : freezeTermAllocations(before), service_deductions_snapshot: snapshot };
  const after = calculateBookingFinancials(proposed);
  if (after.pending > 0) flags.push('Unpaid service deductions');
  // Never infer an overwritten term date from a mismatching parent date alone.
  const term1Date = booking.term_shares?.term_1?.payment_date;
  if (term1Date && booking.payment_date && new Date(term1Date).getTime() !== new Date(booking.payment_date).getTime()) flags.push('Parent/Term 1 date mismatch; review history before restoring dates');
  const snapshot_hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return { booking_id: String(booking._id), company_name: booking.company_name, contact_person: booking.contact_person, booking_date: booking.date, financial_revision: Number(booking.financial_revision || 0), flags, date_candidates, snapshot_hash, before, after, proposed_snapshot: snapshot };
}
