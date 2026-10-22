// Runs against a disposable local replica set. Never reads CRM .env or Mongo_URL.
import test, { before, after, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createRequire } from "node:module";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import HRMRoutes from "../src/hrm/routes.js";
import { timecardBridge, leaveBridge } from "../src/hrm/legacy.js";
import { UserModel } from "../src/models/UserModel.js";
import { EmployeeModel } from "../src/models/EmployeeProfile.js";
import AttendanceModel from "../src/models/AttendanceModel.js";
import HolidayModel from "../src/models/HolidayModel.js";
import { LeaveModel } from "../src/models/LeaveModel.js";
import { NotificationModel } from "../src/models/NotificationModel.js";
import * as models from "../src/hrm/models.js";
import * as hrm from "../src/hrm/service.js";
import { todayIST, addDays, monthDates } from "../src/hrm/rules.js";
const require = createRequire(import.meta.url);
const { MongoMemoryReplSet } = require("mongodb-memory-server");
// Freeze only Date; networking, process cleanup and timeouts use real timers.
mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-22T15:00:00Z") });
let repl, hr, employee, manager, sales;
process.env.JWT_SECRET = "isolated-hrm-test-secret-never-used-in-production";
const app = express();
app.use(express.json());
app.use("/hrm", HRMRoutes);
app.use("/timecard", timecardBridge);
app.use("/leaves", leaveBridge);
const token = (actor) =>
  jwt.sign(
    {
      userId: actor.userId,
      user_role: actor.user_role,
      feature_permissions: actor.feature_permissions,
    },
    process.env.JWT_SECRET,
  );
const today = todayIST(),
  month = today.slice(0, 7),
  first = `${month}-01`;
const previous = addDays(first, -1).slice(0, 7),
  activation = `${previous}-01`;
before(
  async () => {
    repl = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.14" },
    });
    await mongoose.connect(repl.getUri(), { dbName: "isolated_hrm_tests" });
    for (const m of [
      ...Object.values(models),
      UserModel,
      EmployeeModel,
      AttendanceModel,
      HolidayModel,
      LeaveModel,
      NotificationModel,
    ])
      await m.init();
    const users = await UserModel.create([
      {
        name: "HR",
        email: "hr@example.test",
        password: "not-a-real-password",
        user_role: "super admin",
      },
      {
        name: "Employee",
        email: "employee@example.test",
        password: "not-a-real-password",
        user_role: "employee",
      },
      {
        name: "Manager",
        email: "manager@example.test",
        password: "not-a-real-password",
        user_role: "employee",
      },
      {
        name: "Sales",
        email: "sales@example.test",
        password: "not-a-real-password",
        user_role: "employee",
      },
    ]);
    [hr, employee, manager, sales] = users.map((u) => ({
      ...u.toObject(),
      userId: String(u._id),
    }));
    for (const u of [hr, employee, manager, sales])
      await EmployeeModel.collection.insertOne({
        userId: u.userId,
        employeeId: `TEST-${u.userId}`,
        employeeFullName: u.name,
        dateOfJoining: new Date("2020-01-01"),
        department: u === sales ? "Sales" : "Admin",
        branch: "Delhi",
        gender: "Female",
        isActive: true,
      });
    await hrm.savePolicy(hr, { effectiveDate: activation });
    for (const u of [hr, employee, manager, sales])
      await hrm.setup(hr, {
        userId: u.userId,
        managerId: u === employee ? manager.userId : "",
        group: u === sales ? "Sales" : "Operations",
        openingBalances: { EL: 5, WFH: 2, ML: 0.5 },
      });
    await hrm.activate(hr, { activationDate: activation });
    await hrm.runAutomation();
  },
  { timeout: 240000 },
);
after(async () => {
  await mongoose.disconnect();
  mock.timers.reset();
  if (repl) await repl.stop();
});
const workDates = async () =>
  (await hrm.attendanceMonth(employee.userId, month))
    .filter((r) => !["Week Off", "Holiday"].includes(r.status))
    .map((r) => r.date);
test("startup/monthly catch-up is idempotent and manager scope is enforced", async () => {
  const beforeCount = await models.HRMLedger.countDocuments();
  await Promise.all([hrm.runAutomation(), hrm.runAutomation()]);
  assert.equal(await models.HRMLedger.countDocuments(), beforeCount);
  const ids = await hrm.scopeIds(manager);
  assert(ids.includes(employee.userId));
  assert(!ids.includes(sales.userId));
  assert.equal(await hrm.balance(employee.userId, "EL", today), 6);
  await assert.rejects(
    hrm.saveAttendance(employee, {
      userId: employee.userId,
      date: today,
      checkIn: "10:00",
    }),
    /Only HR/,
  );
});
test("WhatsApp original timing, approval/cancellation effects, and audit survive retries", async () => {
  const dates = await workDates(),
    date = dates[0];
  const request = await hrm.createRequest(hr, {
    userId: employee.userId,
    kind: "LEAVE",
    leaveType: "emergency",
    from: date,
    to: date,
    source: "WHATSAPP",
    intimationAt: `${date}T09:10:00+05:30`,
    reason: "Emergency",
    alreadyApproved: true,
    approvalBy: "Manager",
    approvalAt: `${date}T09:20:00+05:30`,
    payTreatment: "EL",
  });
  assert.equal(request.data.lateEmergency, false);
  assert.notEqual(request.data.intimationAt, request.data.entryAt);
  const before = await hrm.balance(employee.userId, "EL", today);
  await hrm.actionRequest(hr, request._id, { status: "approved" });
  assert.equal(await hrm.balance(employee.userId, "EL", today), before);
  await hrm.actionRequest(hr, request._id, {
    status: "cancelled",
    remarks: "Cancelled by employee",
  });
  assert.equal(await hrm.balance(employee.userId, "EL", today), before + 1);
  assert.equal(
    await models.HRMLedger.countDocuments({
      reference: String(request._id),
      category: "Reversal",
    }),
    1,
  );
  assert((await models.HRMAudit.countDocuments()) > 0);
});
test("self-approval is denied and parallel approvals cannot overspend", async () => {
  const dates = await workDates();
  const self = await hrm.createRequest(hr, {
    kind: "LEAVE",
    leaveType: "earned",
    from: dates[2],
    to: dates[2],
    reason: "Time off",
  });
  await assert.rejects(
    hrm.actionRequest(hr, self._id, { status: "approved" }),
    /Self-approval/,
  );
  const available = await hrm.balance(sales.userId, "EL", today);
  await hrm.adjustBalance(hr, {
    userId: sales.userId,
    kind: "EL",
    date: first,
    amount: -(available - 1),
    reason: "Test one remaining day",
  });
  const requests = [];
  for (const date of [dates[3], dates[5]])
    requests.push(
      await hrm.createRequest(sales, {
        kind: "LEAVE",
        leaveType: "earned",
        from: date,
        to: date,
        reason: "Time off",
      }),
    );
  const outcomes = await Promise.allSettled(
    requests.map((r) => hrm.actionRequest(hr, r._id, { status: "approved" })),
  );
  assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((r) => r.status === "rejected").length, 1);
});
test("Sales WFH requires explicit verification and preserves WFH entitlement usage", async () => {
  const date = (await workDates())[7];
  const r = await hrm.createRequest(sales, {
    kind: "WFH",
    from: date,
    to: date,
    reason: "Remote work",
  });
  await hrm.actionRequest(hr, r._id, { status: "approved" });
  let rows = await hrm.attendanceMonth(sales.userId, month);
  assert.equal(rows.find((r) => r.date === date).payable, null);
  await hrm.verifySales(hr, r._id, {
    outcome: "Present",
    reference: "BOOKING-TEST-001",
    remarks: "Qualifying payment verified",
  });
  rows = await hrm.attendanceMonth(sales.userId, month);
  assert.equal(rows.find((r) => r.date === date).status, "Present");
  assert.equal(rows.find((r) => r.date === date).payable, 1);
});
test("backdated late entry updates monthly numbering and default checkout", async () => {
  const dates = (await workDates()).filter((d) => d <= today).slice(8, 12);
  assert.equal(dates.length, 4);
  for (const date of dates.slice(1))
    await hrm.saveAttendance(hr, {
      userId: employee.userId,
      date,
      checkIn: "10:20",
      remarks: "WhatsApp time",
    });
  await hrm.saveAttendance(hr, {
    userId: employee.userId,
    date: dates[0],
    checkIn: "10:20",
    remarks: "Backdated correction",
  });
  const rows = await hrm.attendanceMonth(employee.userId, month);
  assert.equal(rows.find((r) => r.date === dates[3]).lateNumber, 4);
  assert.equal(rows.find((r) => r.date === dates[3]).status, "Half Day");
  await hrm.saveAttendance(hr, {
    userId: employee.userId,
    date: dates[0],
    checkIn: "10:00",
    remarks: "Correct original time",
  });
  assert.equal(
    (await hrm.attendanceMonth(employee.userId, month)).find(
      (r) => r.date === dates[3],
    ).status,
    "Late",
  );
});
test("explicit unlocked-month recalculation is audited and can restore original rules", async () => {
  const dates = (await workDates()).filter((d) => d <= today).slice(8, 12);
  const effectiveDate = addDays(today, 1);
  await hrm.savePolicy(hr, { effectiveDate, values: { graceUntil: "10:30" } });
  assert.equal(
    (await hrm.attendanceMonth(employee.userId, month)).find(
      (r) => r.date === dates[3],
    ).status,
    "Late",
  );
  await hrm.recalculateMonth(hr, month, {
    policyEffectiveDate: effectiveDate,
    reason: "Apply approved grace change to this unlocked month",
  });
  assert.equal(
    (await hrm.attendanceMonth(employee.userId, month)).find(
      (r) => r.date === dates[3],
    ).status,
    "Present",
  );
  await hrm.recalculateMonth(hr, month, {
    reason: "Restore effective-date policy",
  });
  assert.equal(
    (await hrm.attendanceMonth(employee.userId, month)).find(
      (r) => r.date === dates[3],
    ).status,
    "Late",
  );
});

test("HTTP routes enforce authentication, team boundaries and HR-only attendance writes", async () => {
  assert.equal((await request(app).get("/hrm/session")).status, 401);
  assert.equal(
    (
      await request(app)
        .get("/hrm/session")
        .set("Authorization", token(employee))
    ).status,
    200,
  );
  assert.equal(
    (
      await request(app)
        .get(`/hrm/attendance?userId=${sales.userId}&month=${month}`)
        .set("Authorization", token(manager))
    ).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .post("/hrm/attendance")
        .set("Authorization", token(employee))
        .send({ userId: employee.userId, date: today, checkIn: "10:00" })
    ).status,
    403,
  );
  await UserModel.updateOne(
    { _id: employee.userId },
    { $set: { isDisabled: true } },
  );
  assert.equal(
    (
      await request(app)
        .get("/hrm/session")
        .set("Authorization", token(employee))
    ).status,
    403,
  );
  await UserModel.updateOne(
    { _id: employee.userId },
    { $set: { isDisabled: false } },
  );
});
test("Normal Leave requires HR pay selection; confirmed UA records exactly two adjustment units", async () => {
  const dates = await workDates();
  const r = await hrm.createRequest(employee, {
    kind: "LEAVE",
    leaveType: "normal",
    from: dates[4],
    to: dates[4],
    reason: "Personal leave",
  });
  await assert.rejects(
    hrm.actionRequest(manager, r._id, {
      status: "approved",
      payTreatment: "EL",
    }),
    /HR must choose/,
  );
  await hrm.actionRequest(hr, r._id, {
    status: "approved",
    payTreatment: "UNPAID",
  });
  const date = dates[1],
    before = await hrm.balance(employee.userId, "EL", today);
  await assert.rejects(
    hrm.saveAttendance(hr, {
      userId: employee.userId,
      date,
      override: { status: "UA", payable: 0 },
      uaEL: 1,
      remarks: "Check",
    }),
    /Verify CRM/,
  );
  await hrm.saveAttendance(hr, {
    userId: employee.userId,
    date,
    override: { status: "UA", payable: 0 },
    uaEL: 1,
    reviewConfirmed: true,
    remarks: "Verified all channels; one EL and one unpaid unit",
  });
  assert.equal(await hrm.balance(employee.userId, "EL", today), before - 1);
  await hrm.saveAttendance(hr, {
    userId: employee.userId,
    date,
    override: { status: "UA", payable: 0 },
    uaEL: 1,
    reviewConfirmed: true,
    remarks: "Same allocation retry",
  });
  assert.equal(await hrm.balance(employee.userId, "EL", today), before - 1);
  await hrm.saveAttendance(hr, {
    userId: employee.userId,
    date,
    override: { status: "Present", payable: 1 },
    remarks: "Received original proof",
  });
  assert.equal(await hrm.balance(employee.userId, "EL", today), before);
});
test("legacy approved requests are visible for HR review and cannot silently become UA", async () => {
  const date = (await workDates())[6];
  const old = await LeaveModel.create({
    user_id: employee.userId,
    user_name: employee.name,
    leave_type: "casual",
    start_date: date,
    end_date: date,
    reason: "Legacy approved leave",
    createdAt: new Date(),
    status: "approved",
  });
  assert.equal(
    (await hrm.attendanceMonth(employee.userId, month)).find(
      (r) => r.date === date,
    ).requiresReview,
    true,
  );
  await assert.rejects(
    hrm.saveAttendance(hr, {
      userId: employee.userId,
      date,
      override: { status: "UA", payable: -1 },
      reviewConfirmed: true,
      remarks: "Check offline",
    }),
    /Resolve linked/,
  );
  // Import uses an explicit original timestamp supplied by HR; the approval is not guessed.
  const response = await request(app)
    .patch(`/leaves/${old._id}`)
    .set("Authorization", token(hr))
    .send({ status: "approved", payTreatment: "UNPAID" });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(
    (await hrm.attendanceMonth(employee.userId, month)).find(
      (r) => r.date === date,
    ).status,
    "Unpaid Leave",
  );
  await hrm.actionRequest(hr, response.body.leave._id, {
    status: "cancelled",
    remarks: "Original leave cancelled",
  });
  assert.equal((await LeaveModel.findById(old._id).lean()).status, "cancelled");
  assert.equal(
    (await hrm.attendanceMonth(employee.userId, month)).find(
      (r) => r.date === date,
    ).status,
    "Pending",
  );
});

test("Operations WFH beyond balance is half-paid and weekly-off entry does not add a late mark", async () => {
  const dates = await workDates(),
    available = await hrm.balance(manager.userId, "WFH", today);
  if (available)
    await hrm.adjustBalance(hr, {
      userId: manager.userId,
      kind: "WFH",
      date: first,
      amount: -available,
      reason: "Confirmed exhausted WFH balance",
    });
  const r = await hrm.createRequest(manager, {
    kind: "WFH",
    from: dates[0],
    to: dates[0],
    reason: "Additional WFH",
  });
  await hrm.actionRequest(hr, r._id, { status: "approved" });
  const row = (await hrm.attendanceMonth(manager.userId, month)).find(
    (r) => r.date === dates[0],
  );
  assert.equal(row.status, "WFH Half Paid");
  assert.equal(row.payable, 0.5);
  const sunday = (await hrm.attendanceMonth(manager.userId, month)).find(
    (r) => r.status === "Week Off" && r.date < today,
  );
  await hrm.saveAttendance(hr, {
    userId: manager.userId,
    date: sunday.date,
    checkIn: "10:20",
    remarks: "Optional weekly-off work",
  });
  const sundayRow = (await hrm.attendanceMonth(manager.userId, month)).find(
    (r) => r.date === sunday.date,
  );
  assert.equal(sundayRow.late, false);
  assert.equal(sundayRow.lateNumber, 0);
});

test("Normal Leave paid with EL also enforces the consecutive EL limit atomically", async () => {
  const dates = await workDates();
  const r = await hrm.createRequest(employee, {
    kind: "LEAVE",
    leaveType: "normal",
    from: dates[15],
    to: dates[20],
    reason: "Six working days across a weekly off",
  });
  const count = await models.HRMLedger.countDocuments();
  await assert.rejects(
    hrm.actionRequest(hr, r._id, { status: "approved", payTreatment: "EL" }),
    /Consecutive EL\/WFH limits/,
  );
  assert.equal(await models.HRMLedger.countDocuments(), count);
});
test("expired menstrual allowance cannot be revived by cancelling an old request", async () => {
  const rows = await hrm.attendanceMonth(employee.userId, previous);
  const date = rows.find((r) => r.status === "Pending").date;
  const currentBalance = await hrm.balance(employee.userId, "ML", today);
  const r = await hrm.createRequest(hr, {
    userId: employee.userId,
    kind: "LEAVE",
    leaveType: "menstrual",
    halfDay: true,
    from: date,
    to: date,
    reason: "Historical correction",
    source: "WHATSAPP",
    intimationAt: `${date}T08:30:00+05:30`,
    alreadyApproved: true,
    approvalBy: "HR",
    approvalAt: `${date}T09:00:00+05:30`,
  });
  await hrm.actionRequest(hr, r._id, {
    status: "cancelled",
    remarks: "Historical entry cancelled",
  });
  assert.equal(await hrm.balance(employee.userId, "ML", today), currentBalance);
  assert.equal(
    await models.HRMLedger.countDocuments({
      reference: String(r._id),
      category: "Reversal",
    }),
    1,
  );
  assert.equal(
    (
      await models.HRMLedger.findOne({
        key: `expire:${employee.userId}:ML:${monthDates(previous).slice(-1)[0]}`,
      }).lean()
    ).amount,
    -0.5,
  );
});

test("monthly lock blocks unresolved dates and all later attendance mutations", async () => {
  await assert.rejects(
    hrm.lockMonth(hr, previous, { reviewConfirmed: true }),
    /unresolved/,
  );
  for (const e of await hrm.employees()) {
    const rows = await hrm.attendanceMonth(e.userId, previous);
    for (const row of rows.filter((r) => r.status === "Pending"))
      await hrm.saveAttendance(hr, {
        userId: e.userId,
        date: row.date,
        override: { status: "Present", payable: 1 },
        remarks: "Verified historical migration",
      });
  }
  const locked = await hrm.lockMonth(hr, previous, { reviewConfirmed: true });
  assert.equal(locked.version, 1);
  await assert.rejects(
    hrm.saveAttendance(hr, {
      userId: employee.userId,
      date: `${previous}-02`,
      checkIn: "10:00",
      remarks: "Correction",
    }),
    /locked/,
  );
  const legacyWrite = await request(app)
    .post("/timecard/attendance/mark")
    .set("Authorization", token(hr))
    .send({
      userId: employee.userId,
      date: `${previous}-02`,
      status: "Present",
      notes: "Legacy correction",
    });
  assert.equal(legacyWrite.status, 409);
  assert((await hrm.report(hr, previous, "payroll")).length > 0);
  await assert.rejects(
    hrm.lockMonth(manager, previous, { unlock: true, reason: "Try unlock" }),
    /HR required/,
  );
  await hrm.lockMonth(hr, previous, {
    unlock: true,
    reason: "Authorised review",
  });
  assert.equal(await models.HRMLock.countDocuments({ month: previous }), 1);
});
