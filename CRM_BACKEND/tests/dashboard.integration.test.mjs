import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import mongoose from "mongoose";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import sharp from "sharp";
import DashboardRoutes from "../src/routes/DashboardRoute.js";
import { UserModel } from "../src/models/UserModel.js";
import { BookingModel } from "../src/models/bookingModel.js";
import { buildDashboardSummary } from "../../CRM_FRONTEND/src/utils/dashboardSummary.js";
import { getBookingRevenueForUser } from "../../CRM_FRONTEND/src/utils/bookingRevenue.js";
import { profileThumbnail } from "../src/utils/profileThumbnail.js";
const { MongoMemoryServer } = createRequire(import.meta.url)(
  "mongodb-memory-server",
);
process.env.JWT_SECRET = "isolated-dashboard-secret";
const app = express();
app.use("/dashboard", DashboardRoutes);
let mongo, admin, employee;
const token = (u) =>
  jwt.sign(
    { userId: String(u._id), user_role: u.user_role },
    process.env.JWT_SECRET,
  );
before(
  async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongo.getUri(), { dbName: "isolated_dashboard" });
    [admin, employee] = await UserModel.create([
      {
        name: "Admin",
        email: "admin@test.invalid",
        password: "test",
        user_role: "super admin",
      },
      {
        name: "Employee",
        email: "employee@test.invalid",
        password: "test",
        user_role: "employee",
      },
    ]);
    await BookingModel.collection.insertMany([
      {
        user_id: String(employee._id),
        company_name: "Own",
        contact_person: "Own",
        bdm: "Employee",
        bank: "Cash",
        term_1: 1000,
        payment_date: new Date(),
        createdAt: new Date(),
        isDeleted: false,
        services: ["Test"],
        email: "private@test.invalid",
        updatedhistory: [{ note: "private-history" }],
      },
      {
        user_id: String(admin._id),
        company_name: "Other",
        bdm: "Admin",
        bank: "Cash",
        term_1: 2000,
        createdAt: new Date(),
        payment_date: new Date(),
        isDeleted: false,
        services: ["Other"],
      },
    ]);
  },
  { timeout: 120000 },
);
after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test("summary preserves GST, sharing, deductions, refunds and ten payment terms", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const booking = {
    _id: "booking",
    user_id: "owner",
    bdm: "Owner",
    bank: "Bank",
    gst_included: true,
    payment_date: now,
    createdAt: now,
    services: ["Website"],
    term_1: 1180,
    term_10: 590,
    shared_with: [{ user_id: "member", user_name: "Member", percentage: 25 }],
    service_deductions_snapshot: [{ service_name: "Website", deduction: 100 }],
    refund_adjustments: [{ amount: 118, refund_date: now }],
  };
  for (const [id, isAdmin] of [
    ["owner", false],
    ["member", false],
    ["admin", true],
  ]) {
    const summary = buildDashboardSummary({
      bookings: [booking],
      session: { user_id: id },
      isAdmin,
      now,
    });
    assert.equal(
      summary.totalRevenue,
      getBookingRevenueForUser(booking, id, isAdmin),
    );
    assert.equal(summary.todayRevenue, summary.totalRevenue);
    assert.equal(summary.totalBookings, 1);
  }
});
test("summary and booking detail enforce ownership without returning full booking history", async () => {
  await request(app).get("/dashboard/summary").expect(401);
  const own = await request(app)
    .get("/dashboard/summary")
    .set("Authorization", token(employee))
    .expect(200);
  assert.equal(own.body.summary.totalBookings, 1);
  assert.equal(own.body.summary.totalRevenue, 1000);
  assert(!JSON.stringify(own.body).includes("private-history"));
  const all = await request(app)
    .get("/dashboard/summary")
    .set("Authorization", token(admin))
    .expect(200);
  assert.equal(all.body.summary.totalBookings, 2);
  const other = all.body.summary.recentBookings.find(
    (b) => b.company_name === "Other",
  );
  await request(app)
    .get(`/dashboard/booking/${other._id}`)
    .set("Authorization", token(employee))
    .expect(403);
  await request(app)
    .get(`/dashboard/booking/${own.body.summary.recentBookings[0]._id}`)
    .set("Authorization", token(employee))
    .expect(200);
});
test("business-month revenue is independent of server timezone", () => {
  const summary = buildDashboardSummary({
    bookings: [{ user_id: "owner", bank: "Cash", term_1: 500, payment_date: new Date("2026-10-31T17:00:00Z") }],
    session: { user_id: "owner" }, isAdmin: true, now: new Date("2026-10-31T20:00:00Z"),
  });
  assert.equal(summary.totalRevenue, 0);
  assert.equal(summary.monthlyRevData.labels.at(-1), "Nov");
});
test("embedded photos are thumbnailed without changing the input photo", async () => {
  const photo = `data:image/png;base64,${(
    await sharp({
      create: { width: 1000, height: 1000, channels: 3, background: "#ff3b1f" },
    })
      .png()
      .toBuffer()
  ).toString("base64")}`;
  const thumbnail = await profileThumbnail(photo);
  assert(thumbnail.startsWith("data:image/webp;base64,"));
  assert(thumbnail.length < photo.length);
  assert.equal(await profileThumbnail(photo), thumbnail);
  assert.equal(
    await profileThumbnail("https://images.test/avatar.png"),
    "https://images.test/avatar.png",
  );
});
