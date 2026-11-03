import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBookingFinancials as calculate, splitPaise, participantsForTerm, paise } from '../../CRM_FRONTEND/src/utils/bookingFinancials.js';
import { getBookingRevenueForUser, getBookingDeductionRowsForStats } from '../../CRM_FRONTEND/src/utils/bookingRevenue.js';
import { buildDashboardSummary } from '../../CRM_FRONTEND/src/utils/dashboardSummary.js';
import { dateReviewCandidates } from '../src/utils/deductionAudit.js';

const fees = [{ service_name: 'Startup India', deduction: 2700 }, { service_name: 'MP Registration', deduction: 17200 }];
const booking = (extra = {}) => ({ _id: 'booking', financial_version: 2, user_id: 'A', bdm: 'A', bank: 'Bank', payment_date: '2026-10-15', term_1: 5900, services: ['Startup India', 'MP Registration'], service_deductions_snapshot: fees, ...extra });

test('taxable and cash KO Green payments use full capacity and carry every unpaid rupee', () => {
  for (const [bank, expectedApplied, expectedPending] of [['Bank', 5000, 14900], ['Cash', 5900, 14000]]) {
    const value = booking({ bank, gst_included: true });
    const first = calculate(value);
    assert.equal(first.applied, expectedApplied); assert.equal(first.pending, expectedPending); assert.equal(first.terms[0].net, 0);
    const paid = calculate({ ...value, term_2: 23600, term_shares: { term_2: { creator: { user_id: 'B', user_name: 'B' }, payment_mode: 'Bank', payment_date: '2026-11-03' } } });
    assert.equal(paid.terms[1].applied, expectedPending); assert.equal(paid.terms[1].net, 20000 - expectedPending); assert.equal(paid.pending, 0);
    assert.equal(getBookingRevenueForUser({ ...value, term_2: 23600, term_shares: { term_2: { creator: { user_id: 'B', user_name: 'B' }, payment_mode: 'Bank', payment_date: '2026-11-03' } } }, 'A'), 0);
  }
});

test('service additions are effective from their term and only real applied amounts are reported', () => {
  const value = booking({ service_deductions_snapshot: [{ ...fees[0], effective_term_key: 'term_2' }], term_2: 1180 });
  const state = calculate(value);
  assert.equal(state.terms[0].applied, 0); assert.equal(state.terms[1].applied, 1000); assert.equal(state.pending, 1700);
  assert.equal(getBookingDeductionRowsForStats(value).reduce((sum, row) => sum + row.deduction, 0), 1000);
});

test('ten terms consume a fee progressively and keep the final remainder visible', () => {
  const terms = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`term_${i + 1}`, 100]));
  const state = calculate(booking({ ...terms, bank: 'Cash', service_deductions_snapshot: [{ service_name: 'Large', deduction: 1200 }] }));
  assert.equal(state.terms.length, 10); assert.equal(state.applied, 1000); assert.equal(state.pending, 200); assert(state.terms.every((term) => term.net === 0));
});

test('equal sharing, explicit zero access and percentage sharing have distinct meanings', () => {
  const equal = booking({ bank: 'Cash', term_shares: { term_1: { creator: { user_id: 'A' }, shared_with: [{ user_id: 'B', percentage: null }] } } });
  const state = calculate(equal);
  assert.deepEqual(state.terms[0].allocations[0].participants.map((person) => person.amount), [1350, 1350]);
  assert.equal(participantsForTerm(booking({ shared_with: [{ user_id: 'B', percentage: 0 }] }), 'term_1').length, 1);
  assert.deepEqual(participantsForTerm(booking({ shared_with: [{ user_id: 'B', percentage: 25 }] }), 'term_1').map((person) => person.weight), [75, 25]);
  assert.throws(() => participantsForTerm(booking({ shared_with: [{ user_id: 'B', percentage: 25 }, { user_id: 'C', percentage: null }] }), 'term_1', { validate: true }), /every percentage/);
});

test('paise allocations conserve totals and each employee credit minus deductions equals net', () => {
  const state = calculate(booking({ bank: 'Cash', term_1: 0.05, shared_with: [{ user_id: 'B', percentage: null }, { user_id: 'C', percentage: null }], service_deductions_snapshot: [{ service_name: 'One', deduction: 0.01 }, { service_name: 'Two', deduction: 0.01 }, { service_name: 'Three', deduction: 0.01 }] }));
  const term = state.terms[0];
  assert.equal(term.participants.reduce((sum, person) => sum + paise(person.amount), 0), paise(term.net));
  term.base_participants.forEach((person) => {
    const cuts = term.allocations.reduce((sum, item) => sum + paise(item.participants.find((row) => row.user_id === person.user_id).amount), 0);
    assert.equal(paise(person.amount) - cuts, paise(term.participants.find((row) => row.user_id === person.user_id).amount));
  });
  assert.equal(splitPaise(101, [{ user_id: 'A', weight: 1 }, { user_id: 'B', weight: 1 }]).reduce((sum, person) => sum + paise(person.amount), 0), 101);
});

test('refundability retains its existing precedence ahead of service costs', () => {
  const value = booking({ term_1: 1180, is_refundable: true, refundable_percentage: 20, service_deductions_snapshot: [{ service_name: 'Service', deduction: 900 }] });
  const state = calculate(value);
  assert.equal(state.terms[0].refundable, 200); assert.equal(state.applied, 800); assert.equal(state.pending, 100);
  assert.equal(calculate({ ...value, is_refundable: false, is_approval_refundable: true, approval_refundable_percentage: 80 }).terms[0].refundable, 0);
});

test('legacy score reductions are capped and existing later term scores wait for reviewed recovery', () => {
  const state = calculate(booking({ financial_version: undefined, term_2: 1180 }));
  assert.equal(state.applied, 5000); assert.equal(state.terms[1].net, 1000); assert.equal(state.pending, 14900);
});

test('term dates, per-term payment modes and month reporting are consistent across summaries', () => {
  const value = booking({ bank: 'Cash', gst_included: true, payment_date: '2026-11-03', service_deductions_snapshot: [], term_2: 1180, term_shares: { term_1: { payment_date: '2026-10-15', payment_mode: 'Cash' }, term_2: { creator: { user_id: 'B', user_name: 'B' }, payment_date: '2026-11-03', payment_mode: 'Bank' } } });
  const summary = buildDashboardSummary({ bookings: [value], session: { user_id: 'A' }, isAdmin: true, month: '2026-10', now: new Date('2026-11-03') });
  assert.equal(summary.totalRevenue, 5900);
  assert.equal(getBookingRevenueForUser(value, 'B'), 1000);
});

test('history identifies possible cross-term date overwrites for review without guessing a repair', () => {
  const value = { term_shares: { term_1: { payment_date: '2026-11-03' } }, updatedhistory: [{ changes: { term_shares: { old: { term_1: { payment_date: '2026-10-15' }, term_2: { payment_date: '2026-10-20' } }, new: { term_1: { payment_date: '2026-11-03' }, term_2: { payment_date: '2026-11-03' } } } } }] };
  const candidates = dateReviewCandidates(value);
  assert.equal(candidates[0].previous_date, '2026-10-15'); assert.equal(candidates[0].requires_review, true);
  assert.equal(value.term_shares.term_1.payment_date, '2026-11-03');
  assert.deepEqual(dateReviewCandidates({ ...value, term_shares: { term_1: { payment_date: '2026-10-15' } } }), []);
});
