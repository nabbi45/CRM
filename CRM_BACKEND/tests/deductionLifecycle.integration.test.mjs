// Replica-set database is disposable; never loads the application or CRM .env.
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import BookingRoutes from '../src/routes/BookingRoute.js';
import ApprovalRoutes from '../src/routes/BookingApprovalRoute.js';
import DashboardRoutes from '../src/routes/DashboardRoute.js';
import { BookingModel } from '../src/models/bookingModel.js';
import { BookingApprovalModel } from '../src/models/BookingApprovalModel.js';
import { UserModel } from '../src/models/UserModel.js';
import { ServiceModel } from '../src/models/ServiceModel.js';
import { FinancialGuard, FinancialBackup } from '../src/models/FinancialControlModel.js';
import { prepareFinancialMutation } from '../src/utils/bookingFinancialState.js';
import { invalidateReadsAfterWrite, invalidateReadCaches } from '../src/utils/readCache.js';
import { calculateBookingFinancials, monthIST } from '../../CRM_FRONTEND/src/utils/bookingFinancials.js';
import { getBookingRevenueForUser } from '../../CRM_FRONTEND/src/utils/bookingRevenue.js';
const { MongoMemoryReplSet } = createRequire(import.meta.url)('mongodb-memory-server');
const startup = 'STARTUP INDIA CERTIFICATE', registration = 'PRIVATE LIMITED COMPANY (MADHYA PRADESH) REGISTRATION';
let mongo, director, admin, A, B;
const token = (user) => jwt.sign({ userId: String(user._id), user_role: user.user_role }, process.env.JWT_SECRET);
const auth = (req, user = director) => req.set('Authorization', token(user));
const app = express();
app.use(express.json(), invalidateReadsAfterWrite);
app.use('/booking', BookingRoutes); app.use('/booking-approvals', ApprovalRoutes); app.use('/dashboard', DashboardRoutes);
const base = (extra = {}) => ({ user_id: String(A._id), bdm: 'A', branch_name: 'Delhi', company_name: 'Fixture', contact_person: 'Fixture', email: 'fixture@test.invalid', contact_no: 9999999999, services: [registration], total_amount: 30000, term_1: 100, pan: 'TEST', state: 'MP', date: '2026-10-15', payment_date: '2026-10-15', bank: 'Cash', isDeleted: false, ...extra });
const create = (extra) => BookingModel.create(base(extra));
const fresh = async (extra) => BookingModel.create(await prepareFinancialMutation(null, base(extra), { actor: { name: 'Test' } }));
const get = async (id) => BookingModel.findById(id).lean();
async function review(id) {
  const detail = await auth(request(app).get(`/booking/${id}/deductions`)).expect(200);
  return auth(request(app).post(`/booking/${id}/deduction-review`)).send({ expected_revision: detail.body.financial_revision, snapshot_hash: detail.body.audit.snapshot_hash, reason: 'Reviewed missing fees', request_id: `review_${id}` }).expect(200);
}
before(async () => {
  process.env.JWT_SECRET = 'isolated-financial-lifecycle';
  mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.14' }, replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'isolated_deduction_lifecycle' });
  [director, admin, A, B] = await UserModel.create(['director', 'admin', 'employee', 'employee'].map((user_role, i) => ({ name: ['Director', 'Admin', 'A', 'B'][i], email: `user${i}@test.invalid`, password: 'test', user_role })));
  await ServiceModel.create([{ name: startup, value: 'STARTUP', deduction: 2700, status: true }, { name: registration, value: 'MP-REG', deduction: 17200, status: true }]);
  await Promise.all([FinancialGuard.init(), FinancialBackup.init(), BookingModel.init()]);
}, { timeout: 120000 });
beforeEach(async () => { await BookingModel.deleteMany({}); await BookingApprovalModel.deleteMany({}); await FinancialGuard.deleteMany({}); await FinancialBackup.deleteMany({}); invalidateReadCaches(); });
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });

test('targeted date edits and legacy all-term payloads preserve earlier dates, modes and sharing', async () => {
  const booking = await fresh({ services: [], term_1: 1000, term_2: 2000, term_3: 3000, shared_with: [{ user_id: String(B._id), percentage: 25 }], term_shares: { term_1: { creator: { user_id: String(A._id) }, payment_date: '2026-10-15', payment_mode: 'Cash', shared_with: [{ user_id: String(B._id), percentage: 25 }] }, term_2: { creator: { user_id: String(B._id) }, payment_date: '2026-10-20', payment_mode: 'Bank' }, term_3: { creator: { user_id: String(B._id) }, payment_date: '2026-10-25', payment_mode: 'Bank' } } });
  const before = await get(booking._id);
  await auth(request(app).patch(`/booking/editbooking/${booking._id}`)).send({ edit_term_key: 'term_2', term_2: 2000, payment_date: '2026-11-02', bank: 'Cash', shared_with: [] }).expect(200);
  let saved = await get(booking._id);
  assert.deepEqual(saved.term_shares.term_1, before.term_shares.term_1); assert.deepEqual(saved.term_shares.term_3, before.term_shares.term_3);
  assert.equal(String(saved.payment_date), String(before.payment_date)); assert.equal(saved.bank, before.bank); assert.deepEqual(saved.shared_with, before.shared_with);
  await auth(request(app).patch(`/booking/editbooking/${booking._id}`)).send({ term_1: 1000, term_2: 2000, term_3: 3000, payment_date: '2026-11-03', term_shares: { term_3: { ...saved.term_shares.term_3, payment_date: '2026-11-03' } } }).expect(200);
  saved = await get(booking._id);
  assert.deepEqual(saved.term_shares.term_1, before.term_shares.term_1); assert.equal(saved.term_shares.term_2.payment_date.toISOString().slice(0, 10), '2026-11-02');
  await auth(request(app).patch(`/booking/editbooking/${booking._id}`)).send({ payment_date: '2026-11-04', term_1: 1000, term_2: 2000, term_3: 3000 }).expect(400);
});

test('continuation approval retains saved rates, snapshots new fees and charges the later term only', async () => {
  const booking = await fresh({ services: [startup], term_1: 5900, bank: 'Bank' });
  const approval = await BookingApprovalModel.create({ payload: { continuation_of_booking_id: String(booking._id), continuation_term_key: 'term_2', services: [startup, registration], term_2: 23600, bank: 'Cash', payment_date: '2026-11-03', term_shares: { term_2: { creator: { user_id: String(B._id), user_name: 'B' }, payment_date: '2026-11-03', payment_mode: 'Cash' } } }, submitted_by: String(B._id), submitted_by_name: 'B', submitted_by_role: 'employee' });
  const before = await get(booking._id);
  await auth(request(app).patch(`/booking-approvals/${approval._id}/approve`)).send({}).expect(200);
  const saved = await get(booking._id), state = calculateBookingFinancials(saved);
  assert.equal(saved.service_deductions_snapshot.find((item) => item.service_name === registration).effective_term_key, 'term_2');
  assert.equal(state.terms[0].net, 2300); assert.equal(state.terms[1].applied, 17200); assert.equal(state.terms[1].net, 6400);
  assert.equal(saved.payment_date.getTime(), before.payment_date.getTime()); assert.deepEqual(saved.term_shares.term_1, before.term_shares.term_1);
  await auth(request(app).patch(`/booking-approvals/${approval._id}/approve`)).send({}).expect(400);
});

test('catalog aliases are charged once and cash GST flags cannot reduce the score', async () => {
  const booking = await fresh({ services: [startup, 'STARTUP', registration], term_1: 5900, bank: 'Cash', gst_included: true, shared_with: [{ user_id: String(B._id), percentage: null }] });
  const state = calculateBookingFinancials(await get(booking._id));
  assert.equal(state.official, 19900); assert.equal(state.applied, 5900); assert.equal(state.pending, 14000);
  assert.deepEqual(state.terms[0].allocations[0].participants.map((person) => person.amount), [1350, 1350]);
  await auth(request(app).patch(`/booking/editbooking/${booking._id}`)).send({ edit_term_key: 'term_1', shared_with: [{ user_id: String(B._id), percentage: null }, { user_id: String(admin._id), percentage: 25 }] }).expect(400);
});

test('review freezes legacy credit, recoveries cap each employee and reversals restore pending balances', async () => {
  const booking = await create({ shared_with: [{ user_id: String(B._id), user_name: 'B', percentage: 50 }], service_deductions_snapshot: [] });
  const reviewed = await review(booking._id);
  assert.equal(reviewed.body.state.pending, 17200); assert.equal(reviewed.body.state.terms[0].net, 100);
  const service_key = reviewed.body.state.services[0].service_key;
  const body = { service_key, term_key: 'term_1', period: 'original', reason: 'Recover reviewed fee', expected_revision: reviewed.body.financial_revision, request_id: 'original_recovery_1' };
  const preview = await auth(request(app).post(`/booking/${booking._id}/deduction-recoveries/preview`)).send(body).expect(200);
  assert.equal(preview.body.amount, 100); assert.deepEqual(preview.body.participants.map((person) => person.amount), [50, 50]);
  const posted = await auth(request(app).post(`/booking/${booking._id}/deduction-recoveries`)).send(body).expect(200);
  assert.equal(posted.body.state.pending, 17100);
  assert.equal(getBookingRevenueForUser(await get(booking._id), String(A._id)), 0);
  const duplicate = await auth(request(app).post(`/booking/${booking._id}/deduction-recoveries`)).send(body).expect(200); assert.equal(duplicate.body.duplicate, true);
  await fresh({ services: [], term_1: 300, payment_date: new Date(), date: new Date() });
  await fresh({ services: [], user_id: String(B._id), bdm: 'B', term_1: 100, payment_date: new Date(), date: new Date() });
  const current = await auth(request(app).post(`/booking/${booking._id}/deduction-recoveries`)).send({ ...body, period: 'current', expected_revision: posted.body.financial_revision, request_id: 'current_recovery_1' }).expect(200);
  assert.equal(current.body.event.month, monthIST(new Date())); assert.equal(current.body.event.amount, 400); assert.deepEqual(current.body.event.participants.map((person) => person.amount), [300, 100]);
  const reversed = await auth(request(app).post(`/booking/${booking._id}/deduction-recoveries/${posted.body.event.id}/reverse`)).send({ expected_revision: current.body.financial_revision, reason: 'Reverse original recovery', request_id: 'reverse_recovery_1' }).expect(200);
  assert.equal(reversed.body.state.pending, 16800);
  assert.equal(await FinancialBackup.countDocuments({ booking_id: String(booking._id) }), 4);
  const dashboard = await auth(request(app).get('/dashboard/summary?month=2026-10')).expect(200);
  assert.equal(dashboard.body.summary.totalServiceDeductions, 0);
});

test('future terms consume reviewed legacy pending balances and deleting the latest term reopens them', async () => {
  const booking = await create({ services: [startup, registration], term_1: 5900, bank: 'Bank', service_deductions_snapshot: [{ service_name: startup, deduction: 2700 }] });
  await review(booking._id);
  await auth(request(app).patch(`/booking/editbooking/${booking._id}`)).send({ edit_term_key: 'term_2', term_2: 11800, term_shares: { term_2: { creator: { user_id: String(B._id) }, payment_date: '2026-11-03', payment_mode: 'Bank', shared_with: [] } } }).expect(200);
  let saved = await get(booking._id), state = calculateBookingFinancials(saved);
  assert.equal(state.terms[0].net, 2300); assert.equal(state.terms[1].net, 0); assert.equal(state.pending, 7200);
  await auth(request(app).delete(`/booking/editbooking/${booking._id}/terms/term_2`)).expect(200);
  saved = await get(booking._id); state = calculateBookingFinancials(saved);
  assert.equal(state.pending, 17200); assert.equal(state.terms[0].net, 2300);
});

test('recovery permissions use the authenticated role and stale reviews cannot write', async () => {
  const booking = await create({ service_deductions_snapshot: [] });
  await auth(request(app).get('/booking/deduction-audit'), A).set('user-role', 'dev').expect(403);
  await auth(request(app).post(`/booking/${booking._id}/deduction-recoveries`), admin).set('user-role', 'dev').send({}).expect(403);
  await auth(request(app).get(`/booking/${booking._id}/deductions`), B).expect(403);
  const detail = await auth(request(app).get(`/booking/${booking._id}/deductions`)).expect(200);
  await auth(request(app).post(`/booking/${booking._id}/deduction-review`)).send({ reason: 'stale', request_id: 'stale_review', snapshot_hash: detail.body.audit.snapshot_hash, expected_revision: 5 }).expect(409);
  await auth(request(app).patch(`/booking/editbooking/${booking._id}`), A).set('user-role', 'dev').send({ company_name: 'Spoof' }).expect(403);
});

test('concurrent recoveries from different bookings cannot spend the same employee score twice', async () => {
  const first = await create({ service_deductions_snapshot: [], term_1: 1 });
  const second = await create({ service_deductions_snapshot: [], term_1: 1 });
  await fresh({ services: [], term_1: 1000 });
  const reviewed = [await review(first._id), await review(second._id)];
  // Establish the period guard before racing transactions to exercise conflict retry.
  await FinancialGuard.create({ _id: `${A._id}:2026-10`, revision: 0 });
  const results = await Promise.all([first, second].map((booking, index) => auth(request(app).post(`/booking/${booking._id}/deduction-recoveries`)).send({ service_key: reviewed[index].body.state.services[0].service_key, term_key: 'term_1', amount: 1000, period: 'original', reason: 'Concurrent recovery', request_id: `concurrent_${index}`, expected_revision: reviewed[index].body.financial_revision })));
  assert(results.every((result) => result.status === 200), results.map((result) => JSON.stringify(result.body)).join('\n'));
  assert.equal(results.reduce((sum, result) => sum + result.body.event.amount, 0), 1002);
  const all = await BookingModel.find().lean();
  assert.equal(all.reduce((sum, booking) => sum + getBookingRevenueForUser(booking, String(A._id)), 0), 0);
});
