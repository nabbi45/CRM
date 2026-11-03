import { getBookingFinancials, splitPaise, paise, money, termHasGst } from './bookingFinancials.js';
export { getBookingFinancials } from './bookingFinancials.js';
const sumMoney = (rows, field) => money(rows.reduce((sum, row) => sum + paise(row[field]), 0));
const participantAmount = (rows, userId, admin) => admin ? sumMoney(rows, 'amount') : Number(rows.find((row) => String(row.user_id) === String(userId))?.amount || 0);
const metadata = (booking) => ({ bookingId: booking._id, bookingName: booking.contact_person || booking.company_name || 'N/A', clientName: booking.contact_person || 'N/A', companyName: booking.company_name || 'N/A' });
export const getRefundableMeta = (booking = {}) => booking.is_refundable && Number(booking.refundable_percentage) > 0
  ? { type: 'disbursement', label: 'Disbursement Refundable', percentage: Number(booking.refundable_percentage), autoDeduct: true }
  : booking.is_approval_refundable && Number(booking.approval_refundable_percentage) > 0
    ? { type: 'approval', label: 'Approval Refundable', percentage: Number(booking.approval_refundable_percentage), autoDeduct: false }
    : { type: 'none', label: '', percentage: 0, autoDeduct: false };
export const getBookingRefundableLabel = (booking = {}) => { const meta = getRefundableMeta(booking); return meta.percentage ? `${meta.label} ${meta.percentage}%` : ''; };
export const buildServiceDeductionMap = () => ({});
export const getBookingServiceDeductions = (booking) => getBookingFinancials(booking).services.map((row) => ({ service: row.service_name, amount: row.official, ...row }));

function refundRows(booking, includeTerm) {
  const state = getBookingFinancials(booking);
  const bases = new Map();
  state.terms.forEach((term) => term.base_participants.forEach((person) => {
    const old = bases.get(person.user_id) || { ...person, weight: 0 };
    old.weight += paise(person.amount); bases.set(person.user_id, old);
  }));
  return (booking.refund_adjustments || []).flatMap((refund) => {
    const date = refund.refund_date || refund.created_at;
    if (!includeTerm({ payment_date: date }, 'refund')) return [];
    const taxable = termHasGst(booking, 'term_1');
    const amount = !taxable ? paise(refund.amount) : Number(refund.amount_excluding_gst) > 0 && Number(refund.gst_amount) > 0 ? paise(refund.amount_excluding_gst) : Math.round(paise(refund.amount) / 1.18);
    return splitPaise(amount, [...bases.values()]).filter((person) => person.amount).map((person) => ({ ...metadata(booking), type: 'Manual Refund Adjustment', service: 'Manual Refund', totalDeduction: money(amount), deduction: person.amount, employeeId: person.user_id, employeeName: person.user_name, date, termKey: 'refund' }));
  });
}

export function getBookingDeductionRowsForStats(booking, includeTerm = () => true, usersMap = {}) {
  const state = getBookingFinancials(booking);
  const rows = [];
  const add = (type, service, amount, participants, date, termKey, extra = {}) => participants.forEach((person) => {
    if (!person.amount) return;
    rows.push({ ...metadata(booking), type, service, totalDeduction: amount, deduction: person.amount, employeeId: person.user_id, employeeName: person.user_name || usersMap[person.user_id] || 'UNKNOWN', date, termKey, ...extra });
  });
  state.terms.forEach((term) => {
    if (!includeTerm(term, term.term_key)) return;
    term.allocations.forEach((allocation) => add('Service Deduction', allocation.service_name, allocation.amount, allocation.participants, term.payment_date, term.term_key, { serviceKey: allocation.service_key }));
    add('Refundable Clause Deduction', getBookingRefundableLabel(booking), term.refundable, term.refundable_participants, term.payment_date, term.term_key);
  });
  (booking.deduction_recoveries || []).forEach((event) => {
    if (!includeTerm({ payment_date: event.effective_date }, 'recovery')) return;
    const sign = event.kind === 'reversal' ? -1 : 1;
    add(event.kind === 'reversal' ? 'Deduction Recovery Reversal' : 'Historical Deduction Recovery', event.service_name, sign * event.amount, event.participants.map((person) => ({ ...person, amount: sign * person.amount })), event.effective_date, 'recovery', { eventId: event.id, note: event.reason, serviceKey: event.service_key });
  });
  return booking.refund_adjustments?.length ? [...rows, ...refundRows(booking, includeTerm)] : rows;
}

export function getBookingDeductionRowsForUser(booking, userId, isAdmin = false, includeTerm = () => true, unused = {}, usersMap = {}) {
  const rows = getBookingDeductionRowsForStats(booking, includeTerm, usersMap);
  return isAdmin ? rows : rows.filter((row) => String(row.employeeId) === String(userId));
}
export const getBookingDeductionForUser = (booking, userId, isAdmin = false, includeTerm = () => true) => sumMoney(getBookingDeductionRowsForUser(booking, userId, isAdmin, includeTerm), 'deduction');

export function getBookingRevenueRowsForUser(booking, userId, isAdmin = false, includeTerm = () => true) {
  const refundable = getRefundableMeta(booking);
  return getBookingFinancials(booking).terms.filter((term) => includeTerm(term, term.term_key) && (isAdmin || term.base_participants.some((person) => String(person.user_id) === String(userId)))).map((term) => ({
    ...metadata(booking), type: 'Revenue', service: (booking.services || []).join(', '), amount: participantAmount(term.participants, userId, isAdmin), grossCredit: participantAmount(term.base_participants, userId, isAdmin), creditBeforeService: participantAmount(term.credit_participants, userId, isAdmin), termKey: term.term_key, date: term.payment_date,
    refundableType: refundable.type, refundablePercentage: refundable.percentage,
    note: `Credited from ${term.term_key.replace('_', ' ').toUpperCase()}${refundable.type === 'approval' ? ` | Approval Guarantee Refundable ${refundable.percentage}% (no automatic cut)` : ''}`,
  }));
}
export function getBookingRevenueForUser(booking, userId, isAdmin = false, includeTerm = () => true) {
  let total = 0;
  getBookingFinancials(booking).terms.forEach((term) => {
    if (includeTerm(term, term.term_key)) total += paise(participantAmount(term.participants, userId, isAdmin));
  });
  if (booking.refund_adjustments?.length) {
    refundRows(booking, includeTerm).forEach((row) => { if (isAdmin || String(row.employeeId) === String(userId)) total -= paise(row.deduction); });
  }
  (booking.deduction_recoveries || []).forEach((event) => {
    if (!includeTerm({ payment_date: event.effective_date }, 'recovery')) return;
    const amount = participantAmount(event.participants, userId, isAdmin);
    total -= paise(amount) * (event.kind === 'reversal' ? -1 : 1);
  });
  return money(total);
}
export const hasBookingPaymentForUser = (booking, userId, isAdmin = false, includeTerm = () => true) => getBookingFinancials(booking).terms.some((term) => includeTerm(term, term.term_key) && (isAdmin || term.base_participants.some((person) => String(person.user_id) === String(userId))));

export function addBookingRevenueToLeaderboard(booking, board, usersMap = {}, includeTerm = () => true) {
  getBookingFinancials(booking).terms.forEach((term) => {
    if (!includeTerm(term, term.term_key)) return;
    term.participants.forEach((person) => {
      const name = person.user_name || usersMap[person.user_id] || 'UNKNOWN';
      if (!board[name]) board[name] = { revenue: 0, count: 0, deduction: 0 };
      board[name].revenue += person.amount; board[name].count++;
    });
  });
  getBookingDeductionRowsForStats(booking, includeTerm, usersMap).forEach((row) => {
    const name = row.employeeName;
    if (!board[name]) board[name] = { revenue: 0, count: 0, deduction: 0 };
    board[name].deduction += row.deduction;
    if (['Manual Refund Adjustment', 'Historical Deduction Recovery', 'Deduction Recovery Reversal'].includes(row.type)) board[name].revenue -= row.deduction;
  });
}
