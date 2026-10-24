// Scale/regression check in a disposable database; never loads CRM .env.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import DashboardRoutes from '../src/routes/DashboardRoute.js';
import HRMRoutes from '../src/hrm/routes.js';
import LeadRoutes from '../src/routes/LeadManagementRoute.js';
import { UserModel } from '../src/models/UserModel.js';
import { EmployeeModel } from '../src/models/EmployeeProfile.js';
import { BookingModel } from '../src/models/bookingModel.js';
import { LeadManagementModel } from '../src/models/LeadManagementModel.js';
import { HRMControl, HRMAttendance, HRMLedger, HRMRequest } from '../src/hrm/models.js';
import { invalidateReadCaches, invalidateReadsAfterWrite, cachedRead } from '../src/utils/readCache.js';
import { todayIST } from '../src/hrm/rules.js';
const { MongoMemoryServer } = createRequire(import.meta.url)('mongodb-memory-server');
process.env.JWT_SECRET = 'isolated-scale-test-only';
const app = express();
app.use(express.json(), invalidateReadsAfterWrite);
app.use('/dashboard', DashboardRoutes);
app.use('/hrm', HRMRoutes);
app.use('/leads-management', LeadRoutes);
// Simulate the same successful booking write boundary used by the real router.
app.patch('/booking/test-change', async (_req, res) => {
  await BookingModel.collection.updateOne({ company_name: 'Company 0' }, { $set: { term_1: 2000 } });
  res.json({ saved: true });
});
let mongo, users;
const today = todayIST(), month = today.slice(0, 7);
const token = user => jwt.sign({ userId: String(user._id), user_role: user.user_role }, process.env.JWT_SECRET);
before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongo.getUri(), { dbName: 'isolated_read_scale' });
  users = await UserModel.create(Array.from({ length: 100 }, (_, i) => ({
    name: `Person ${i}`, email: `person${i}@test.invalid`, password: 'test-only',
    user_role: i ? 'employee' : 'super admin', feature_permissions: i ? ['timecard', 'lead_management'] : [],
    ...(i === 0 ? { profilePicture: `data:image/jpeg;base64,${'A'.repeat(5 * 1024 * 1024)}` } : {}),
  })));
  await EmployeeModel.collection.insertMany(users.map(u => ({ userId: String(u._id), department: 'Admin', branch: 'Delhi', dateOfJoining: new Date(`${month}-01`) })));
  await BookingModel.collection.insertMany(Array.from({ length: 5000 }, (_, i) => ({
    user_id: String(users[i % 100]._id), bdm: `Person ${i % 100}`, company_name: `Company ${i}`, contact_person: `Contact ${i}`,
    services: [`Service ${i % 9}`], term_1: 1000, bank: 'Cash', isDeleted: false,
    createdAt: new Date(Date.now() - i * 1000), payment_date: new Date(),
    updatedhistory: [{ note: 'must-not-be-in-summary' }],
  })));
  await LeadManagementModel.collection.insertMany(Array.from({ length: 5000 }, (_, i) => ({
    name: `Lead ${i}`, mobileNumber: '9876543210', status: i % 2 ? 'qualified' : 'new',
    assignedTo: String(users[i % 100]._id), createdAt: new Date(Date.now() - i * 1000),
  })));
  await HRMControl.create({ _id: 'portal', activationDate: `${month}-01` });
  await HRMLedger.collection.insertMany(Array.from({ length: 5000 }, (_, i) => ({
    key: `fixture:${i}`, userId: String(users[i % 100]._id), kind: 'EL', date: `${month}-01`, amount: 0.5, category: 'Adjustment',
  })));
  await HRMRequest.collection.insertMany(Array.from({ length: 5000 }, (_, i) => ({
    userId: String(users[i % 100]._id), kind: 'WFH', status: 'pending', from: today, to: today, data: {}, createdAt: new Date(Date.now() - i * 1000),
  })));
  await HRMAttendance.collection.insertMany(users.map(u => ({ userId: String(u._id), date: `${month}-02`, data: { checkIn: '10:00' } })));
  invalidateReadCaches();
}, { timeout: 120000 });
after(async () => { mongoose.set('debug', false); invalidateReadCaches(); await mongoose.disconnect(); await mongo?.stop(); });

test('100 concurrent users share one projected booking read for 5,000 bookings', async t => {
  let bookingReads = 0;
  mongoose.set('debug', (collection, method) => { if (collection === BookingModel.collection.name && ['find', 'aggregate'].includes(method)) bookingReads++; });
  const start = performance.now();
  const results = await Promise.all(users.map(u => request(app).get('/dashboard/summary').set('Authorization', token(u)).expect(200)));
  t.diagnostic(`100 dashboard responses: ${Math.round(performance.now() - start)} ms; booking source reads: ${bookingReads}`);
  assert.equal(bookingReads, 1);
  assert.equal(results[0].body.summary.totalBookings, 5000);
  assert.equal(results[0].body.summary.totalRevenue, 5000000);
  for (const result of results.slice(1)) {
    assert.equal(result.body.summary.totalBookings, 50);
    assert.equal(result.body.summary.totalRevenue, 50000);
    assert.equal(result.body.summary.recentBookings.length, 6);
    assert.deepEqual(result.body.summary.serviceSoldData, results[0].body.summary.serviceSoldData);
  }
  assert(!JSON.stringify(results[0].body).includes('data:image'));
  assert(!JSON.stringify(results[0].body).includes('must-not-be-in-summary'));
  mongoose.set('debug', false);
});

test('successful CRM writes invalidate summaries and disabled accounts cannot use a cached summary', async () => {
  await request(app).patch('/booking/test-change').expect(200);
  const updated = await request(app).get('/dashboard/summary').set('Authorization', token(users[0])).expect(200);
  assert.equal(updated.body.summary.totalRevenue, 5001000);
  await UserModel.updateOne({ _id: users[99]._id }, { $set: { isDisabled: true } });
  await request(app).get('/dashboard/summary').set('Authorization', token(users[99])).expect(403);
});

test('HRM uses bounded queries for 100 employees and does not select original photos', async t => {
  let reads = 0;
  mongoose.set('debug', (_collection, method) => { if (['find', 'findOne', 'aggregate', 'countDocuments'].includes(method)) reads++; });
  const start = performance.now();
  const workspace = await request(app).get(`/hrm/bootstrap?section=dashboard&month=${month}`).set('Authorization', token(users[0])).expect(200);
  const workspaceReads = reads;
  reads = 0;
  const team = await request(app).get(`/hrm/attendance/team?month=${month}&page=1`).set('Authorization', token(users[0])).expect(200);
  t.diagnostic(`HRM workspace + 100-person month: ${Math.round(performance.now() - start)} ms; reads: ${workspaceReads} + ${reads}`);
  assert(workspaceReads <= 24);
  assert(reads <= 14); // Constant, independent of employee count.
  assert.equal(workspace.body.balances.EL, 25);
  assert.equal(team.body.team.length, 100);
  assert(team.body.team.every(t => t.records.length >= 28));
  assert(!JSON.stringify(workspace.body).includes('data:image'));
  assert(!JSON.stringify(team.body).includes('data:image'));
  const approvals = await request(app).get(`/hrm/bootstrap?section=approvals&month=${month}`).set('Authorization', token(users[0])).expect(200);
  assert.equal(approvals.body.requests.length, 100);
  assert.equal(approvals.body.pagination.total, 5000);
  mongoose.set('debug', false);
});

test('5,000 leads remain filtered, newest-first and limited to 100 per page', async () => {
  const first = await request(app).get('/leads-management/bootstrap?status=qualified&page=1').set('Authorization', token(users[0])).expect(200);
  const second = await request(app).get('/leads-management/bootstrap?status=qualified&page=2').set('Authorization', token(users[0])).expect(200);
  assert.equal(first.body.leads.length, 100);
  assert.equal(first.body.pagination.total, 2500);
  assert(first.body.leads.every(l => l.status === 'qualified'));
  assert(first.body.leads.every(l => !second.body.leads.some(other => other._id === l._id)));
  assert.equal(first.body.leads[0].name, 'Lead 1');
  assert.equal(first.body.users, undefined);
});

test('a read started before invalidation cannot repopulate the cache', async () => {
  let resolve;
  const old = cachedRead('race', () => new Promise(r => { resolve = r; }));
  await Promise.resolve();
  invalidateReadCaches();
  resolve('old');
  assert.equal(await old, 'old');
  assert.equal(await cachedRead('race', () => 'new'), 'new');
});
