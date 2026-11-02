// Disposable local database only; no application startup or production connection.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import BookingRoutes from '../src/routes/BookingRoute.js';
import { BookingModel } from '../src/models/bookingModel.js';
import { UserModel } from '../src/models/UserModel.js';
import { ServiceModel } from '../src/models/ServiceModel.js';
import { snapshotServiceDeductions, reconcileServiceDeductionSnapshot } from '../src/utils/revenueRules.js';
const { MongoMemoryServer } = createRequire(import.meta.url)('mongodb-memory-server');
let mongo, token;
const registration = 'PRIVATE LIMITED COMPANY (UTTAR PRADESH) REGISTRATION';
const startup = 'STARTUP INDIA CERTIFICATE';
const app = express();
app.use(express.json());
app.use('/booking', BookingRoutes);
before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongo.getUri(), { dbName: 'isolated_service_deductions' });
  process.env.JWT_SECRET = 'isolated-deduction-test';
  const admin = await UserModel.create({ name: 'Admin', email: 'admin@test.invalid', password: 'test', user_role: 'dev' });
  token = jwt.sign({ userId: String(admin._id), user_role: 'dev' }, process.env.JWT_SECRET);
  await ServiceModel.create([
    { name: registration, value: registration, deduction: 9200, status: true },
    { name: startup, value: startup, deduction: 2700, status: true },
    { name: 'ISO 9001 (NON-IAF) + SUPPORT', value: 'ISO+SUPPORT', deduction: 1500, status: true },
    { name: 'No deduction', value: 'NONE', deduction: 0, status: true },
  ]);
}, { timeout: 120000 });
after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('literal brackets and plus signs match catalog names/values, without duplicate charges', async () => {
  const snapshots = await snapshotServiceDeductions([registration, registration.toLowerCase(), startup, 'ISO+SUPPORT', 'No deduction']);
  assert.deepEqual(snapshots.map((r) => r.deduction), [9200, 2700, 1500]);
  assert.deepEqual(await snapshotServiceDeductions(['PRIVATE LIMITED COMPANY UTTAR PRADESH REGISTRATION']), []);
});
test('service changes preserve saved rates, remove deleted services and add missing deductions', async () => {
  const snapshot = await reconcileServiceDeductionSnapshot([registration, startup], [
    { service_name: startup, deduction: 2300 },
    { service_name: 'Removed service', deduction: 500 },
  ]);
  assert.deepEqual(snapshot, [{ service_name: registration, deduction: 9200 }, { service_name: startup, deduction: 2300 }]);
});
test('new bookings and edited services persist registration deductions through real HTTP routes', async () => {
  const owner = await UserModel.findOne({ user_role: 'dev' }).lean();
  const result = await request(app).post('/booking/addbooking').set('Authorization', token).send({
    user_id: String(owner._id), bdm: owner.name, branch_name: 'Delhi', company_name: 'Test',
    contact_person: 'Test', email: 'test@example.test', contact_no: 9999999999,
    services: [registration, startup], total_amount: 30000, term_1: 20000,
    pan: 'TEST', state: 'UP', date: '2026-10-31', bank: 'Cash', funddisbursement: 'N/A',
    payment_proof_url: 'https://example.test/proof', payment_date: '2026-10-31',
  }).expect(201);
  const id = result.body.booking_id;
  assert.deepEqual(result.body.booking.service_deductions_snapshot.map((r) => r.deduction), [9200, 2700]);
  // Reproduce a legacy missing registration entry, then edit services.
  await BookingModel.updateOne({ _id: id }, { $set: { service_deductions_snapshot: [{ service_name: startup, deduction: 2300 }] } });
  await request(app).patch(`/booking/editbooking/${id}`).set('Authorization', token)
    .set('user-role', 'dev').send({ services: [registration, startup], note: 'Correct service' }).expect(200);
  const saved = await BookingModel.findById(id).lean();
  assert.deepEqual(saved.service_deductions_snapshot.map((r) => r.deduction), [9200, 2300]);
  assert.equal(saved.term_1, 20000);
});
