import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { UserModel } from "../models/UserModel.js";
import { EmployeeModel } from "../models/EmployeeProfile.js";
import AttendanceModel from "../models/AttendanceModel.js";
import HolidayModel from "../models/HolidayModel.js";
import { LeaveModel } from "../models/LeaveModel.js";
import { NotificationModel } from "../models/NotificationModel.js";
import {
  HRMControl,
  HRMPolicy,
  HRMEmployee,
  HRMAttendance,
  HRMRequest,
  HRMLedger,
  HRMAudit,
  HRMLock,
  HRMJob,
  HRMMonthPolicy,
} from "./models.js";
import {
  DEFAULT_POLICY,
  todayIST,
  dateKey,
  addDays,
  daysBetween,
  monthDates,
  quarter,
  minutes,
  isOff,
  deriveAttendance,
  eligibleCredit,
  monthlyCredit,
} from "./rules.js";

const SYSTEM = ["super admin", "director", "dev", "srdev", "sr dev"];
const ADMIN = [...SYSTEM, "hr", "admin", "senior admin"];
export const role = (u) =>
  String(u?.user_role || "")
    .trim()
    .toLowerCase();
export const isSystem = (u) => SYSTEM.includes(role(u));
export const isHR = (u) =>
  isSystem(u) ||
  (u?.feature_permissions?.length
    ? u.feature_permissions.includes("timecard_edit")
    : ADMIN.includes(role(u)));
export const hasPortal = (u) =>
  isHR(u) ||
  !u.feature_permissions?.length ||
  u.feature_permissions.includes("timecard");
export const fail = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const actorId = (u) => String(u.userId || u._id);
const sessionQuery = (q, s) => (s ? q.session(s) : q);
export const audit = async (
  s,
  actor,
  module,
  action,
  userId,
  before,
  after,
  reason = "",
) =>
  HRMAudit.create(
    [{ actor: actorId(actor), module, action, userId, before, after, reason }],
    { session: s },
  );
const notify = async (s, userId, message, reference = "") =>
  NotificationModel.create(
    [{ user_id: userId, type: "hrm_update", message, reference_id: reference }],
    { session: s },
  );
let ready;
export const initializeHRM = () =>
  ready ||
  (ready = Promise.all(
    [
      HRMControl,
      HRMPolicy,
      HRMEmployee,
      HRMAttendance,
      HRMRequest,
      HRMLedger,
      HRMAudit,
      HRMLock,
      HRMJob,
      HRMMonthPolicy,
    ].map((model) => model.init()),
  ).catch((e) => {
    ready = undefined;
    throw e;
  }));

// The control write serialises all HRM writes across processes. Mongo transactions
// make request effects, balances, locks, audits and notifications one atomic change.
export const mutate = async (actor, callback) => {
  await initializeHRM();
  try {
    await HRMControl.updateOne(
      { _id: "portal" },
      { $setOnInsert: { revision: 0 } },
      { upsert: true },
    );
  } catch (e) {
    if (e.code !== 11000) throw e;
  }
  const s = await mongoose.startSession();
  let result;
  try {
    await s.withTransaction(async () => {
      await HRMControl.updateOne(
        { _id: "portal" },
        { $inc: { revision: 1 } },
        { session: s },
      );
      result = await callback(s);
    });
    return result;
  } catch (e) {
    if (/Transaction numbers|replica set|mongos/.test(e.message))
      fail(
        "Your connected MongoDB does not support transactions. HRM balance changes require transaction support on this same database (Atlas already provides it). No second database or employee reseeding is required. Ask your database administrator to review the current deployment; existing CRM records are unchanged.",
        503,
      );
    throw e;
  } finally {
    await s.endSession();
  }
};
export const control = (s) =>
  sessionQuery(HRMControl.findById("portal").lean(), s);
export const policyFor = async (date, s) => {
  const p = await sessionQuery(
    HRMPolicy.findOne({ effectiveDate: { $lte: date } })
      .sort({ effectiveDate: -1 })
      .lean(),
    s,
  );
  return { ...DEFAULT_POLICY, ...(p?.values || {}) };
};
const requireActive = async (date, s) => {
  const c = await control(s);
  if (!c?.activationDate || date < c.activationDate)
    fail(
      "This date is before HRM activation; historical records are read-only in HRM.",
    );
};
export const assertUnlocked = async (date, s) => {
  if (
    await sessionQuery(
      HRMLock.exists({ month: date.slice(0, 7), locked: true }),
      s,
    )
  )
    fail(
      "Attendance month is locked. A system administrator must unlock it first.",
      409,
    );
};
const assertDates = async (dates, s) => {
  for (const date of [...new Set(dates)]) {
    await requireActive(date, s);
    await assertUnlocked(date, s);
  }
};
export const employees = async (s) => {
  const users = await sessionQuery(
    UserModel.find()
      .select(
        "name email user_role feature_permissions isDisabled profilePicture",
      )
      .lean(),
    s,
  );
  const profiles = await sessionQuery(
    EmployeeModel.find()
      .select(
        "userId employeeId department branch gender dateOfJoining reportingManager isActive",
      )
      .lean(),
    s,
  );
  const settings = await sessionQuery(HRMEmployee.find().lean(), s);
  return users.map((u) => {
    const id = String(u._id),
      p = profiles.find((p) => p.userId === id) || {},
      h = settings.find((h) => h.userId === id) || {};
    return {
      userId: id,
      name: u.name,
      email: u.email,
      user_role: u.user_role,
      profilePicture: u.profilePicture,
      disabled: u.isDisabled,
      hasProfile: Boolean(p._id),
      employeeId: p.employeeId,
      department: p.department || h.eligibilityProfile?.department || "",
      branch: p.branch || h.eligibilityProfile?.branch || "",
      gender: p.gender || h.eligibilityProfile?.gender,
      dateOfJoining: p.dateOfJoining
        ? p.dateOfJoining.toISOString().slice(0, 10)
        : h.eligibilityProfile?.dateOfJoining || "",
      reportingManager: p.reportingManager || "",
      group:
        (p.department || h.eligibilityProfile?.department) === "Sales"
          ? "Sales"
          : "Operations",
      eligible: p.isActive !== false && !u.isDisabled,
      ...h,
      userId: id,
    };
  });
};
const employeeFor = async (userId, s) => {
  const e = (await employees(s)).find((e) => e.userId === userId);
  if (!e) fail("Employee not found", 404);
  return e;
};
export const scopeIds = async (actor, s) => {
  const list = await employees(s);
  return isHR(actor)
    ? list.map((e) => e.userId)
    : list
        .filter(
          (e) => e.userId === actorId(actor) || e.managerId === actorId(actor),
        )
        .map((e) => e.userId);
};
const canApprove = async (actor, userId, s) =>
  isHR(actor) ||
  ((await policyFor(todayIST(), s)).approvalMode !== "HR_ONLY" &&
    (await employeeFor(userId, s)).managerId === actorId(actor));
const ledger = async (s, item) =>
  HRMLedger.updateOne(
    { key: item.key },
    { $setOnInsert: item },
    { upsert: true, session: s },
  );
export const balance = async (userId, kind, date, s) => {
  const start =
    kind === "WFH"
      ? `${quarter(date)}-01`
      : kind === "ML"
        ? `${date.slice(0, 7)}-01`
        : "0000-01-01";
  const entries = await sessionQuery(
    HRMLedger.find({ userId, kind, date: { $gte: start, $lte: date } }).lean(),
    s,
  );
  return Math.round(entries.reduce((n, x) => n + x.amount, 0) * 100) / 100;
};
// Reserve already approved future usage as well as usage before this date.
// Expiries are recalculated after backdated changes, rather than treating their
// previous amount as a new entitlement or permanently consumed allocation.
const availableBalance = async (userId, kind, date, s) => {
  const start =
    kind === "WFH"
      ? `${quarter(date)}-01`
      : kind === "ML"
        ? `${date.slice(0, 7)}-01`
        : "0000-01-01";
  const [year, quarterMonth] = quarter(date).split("-");
  const end =
    kind === "WFH"
      ? monthDates(
          `${year}-${String(Number(quarterMonth) + 2).padStart(2, "0")}`,
        ).slice(-1)[0]
      : kind === "ML"
        ? monthDates(date.slice(0, 7)).slice(-1)[0]
        : "9999-12-31";
  const rows = await sessionQuery(
    HRMLedger.find({
      userId,
      kind,
      category: { $ne: "Expiry" },
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .lean(),
    s,
  );
  let running = rows
      .filter((r) => r.date <= date)
      .reduce((n, r) => n + r.amount, 0),
    minimum = running;
  const byDate = new Map();
  rows
    .filter((r) => r.date > date)
    .forEach((r) => byDate.set(r.date, (byDate.get(r.date) || 0) + r.amount));
  for (const amount of byDate.values()) {
    running += amount;
    minimum = Math.min(minimum, running);
  }
  return Math.max(0, minimum);
};

export const savePolicy = async (actor, body) =>
  mutate(actor, async (s) => {
    if (!isSystem(actor))
      fail("Only system administrators may change HR policies.", 403);
    const effectiveDate = dateKey(body.effectiveDate);
    const c = await control(s);
    if (c?.activationDate && effectiveDate <= todayIST())
      fail("Policy changes must take effect on a future date.");
    const values = { ...DEFAULT_POLICY, ...body.values };
    [
      "officeStart",
      "graceUntil",
      "halfDayAfter",
      "checkout",
      "earlyGoingReference",
      "emergencyCutoff",
    ].forEach((k) => minutes(values[k]));
    if (
      minutes(values.officeStart) > minutes(values.graceUntil) ||
      minutes(values.graceUntil) > minutes(values.halfDayAfter) ||
      minutes(values.halfDayAfter) >= minutes(values.checkout)
    )
      fail("Office time thresholds must be in order.");
    for (const key of [
      "allowedLates",
      "elMonthly",
      "elFirstPartialMonth",
      "mlMonthly",
      "mlFirstMonth",
      "wfhMonthly",
      "wfhFirstMonth",
      "wfhQuarterly",
      "maxEL",
      "maxWFH",
      "maxCombined",
      "extendedPerQuarter",
    ]) {
      if (!Number.isFinite(values[key]) || values[key] < 0 || values[key] > 366)
        fail(`Invalid policy value: ${key}`);
    }
    for (const days of [
      values.weeklyOffs,
      ...Object.values(values.departmentWeeklyOffs || {}),
    ]) {
      if (
        !Array.isArray(days) ||
        days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
      )
        fail("Weekly offs must contain weekday numbers 0–6");
    }
    values.earlyGoingPenalty = 0;
    if (!["MANAGER_OR_HR", "HR_ONLY"].includes(values.approvalMode))
      fail("Invalid approval workflow");
    if (c?.activationDate) {
      const old = await policyFor(effectiveDate, s);
      if (
        (JSON.stringify(old.weeklyOffs) !== JSON.stringify(values.weeklyOffs) ||
          JSON.stringify(old.departmentWeeklyOffs) !==
            JSON.stringify(values.departmentWeeklyOffs)) &&
        (await HRMRequest.exists({
          kind: { $in: ["LEAVE", "WFH"] },
          status: { $in: ["approved", "pending"] },
          to: { $gte: effectiveDate },
        }).session(s))
      )
        fail(
          "Resolve future requests before changing their working-day calendar",
        );
    }
    const before = await HRMPolicy.findOne({ effectiveDate }).session(s).lean();
    await HRMPolicy.updateOne(
      { effectiveDate },
      { $set: { values, createdBy: actorId(actor) } },
      { upsert: true, session: s },
    );
    await audit(
      s,
      actor,
      "Policy",
      "save",
      "",
      before,
      { effectiveDate, values },
      body.reason,
    );
    return { effectiveDate, values };
  });

export const setup = async (actor, body) =>
  mutate(actor, async (s) => {
    if (!isHR(actor)) fail("HR access required", 403);
    const userId = String(body.userId || "");
    await employeeFor(userId, s);
    if (body.profile) {
      const profile = body.profile;
      if (
        !["Sales", "Digital", "Admin", "Legal", "Finance"].includes(
          profile.department,
        ) ||
        !["Male", "Female", "Other"].includes(profile.gender) ||
        !String(profile.branch || "").trim()
      )
        fail("Confirm department, branch and gender");
      const joiningDate = dateKey(profile.dateOfJoining);
      const beforeProfile = await EmployeeModel.findOne({ userId })
        .session(s)
        .lean();
      const fields = {
        department: profile.department,
        gender: profile.gender,
        branch: String(profile.branch).trim(),
        dateOfJoining: new Date(`${joiningDate}T00:00:00Z`),
        updatedBy: actorId(actor),
      };
      if (beforeProfile) {
        await EmployeeModel.updateOne(
          { userId },
          { $set: fields },
          { session: s, runValidators: true },
        );
      } else {
        // Keep minimal eligibility on the existing account, not a fabricated full profile.
        await HRMEmployee.updateOne(
          { userId },
          {
            $set: {
              eligibilityProfile: {
                department: fields.department,
                branch: fields.branch,
                gender: fields.gender,
                dateOfJoining: joiningDate,
              },
            },
          },
          { upsert: true, session: s },
        );
      }
      await audit(
        s,
        actor,
        "Employee profile",
        "setup review",
        userId,
        Object.fromEntries(
          Object.keys(fields).map((k) => [k, beforeProfile?.[k]]),
        ),
        fields,
      );
    }
    const before = await HRMEmployee.findOne({ userId }).session(s).lean();
    const settings = {
      managerId: body.managerId || "",
      group: body.group || "Operations",
      eligible: body.eligible !== false,
      exitDate: body.exitDate ? dateKey(body.exitDate) : "",
      setupConfirmed: true,
    };
    if (
      !["Sales", "Operations"].includes(settings.group) ||
      settings.managerId === userId
    )
      fail("Invalid group or manager");
    if (settings.managerId) await employeeFor(settings.managerId, s);
    const all = await employees(s);
    let manager = settings.managerId;
    const visited = new Set([userId]);
    while (manager) {
      if (visited.has(manager))
        fail("Reporting manager assignment creates a cycle");
      visited.add(manager);
      manager = all.find((e) => e.userId === manager)?.managerId;
    }
    await HRMEmployee.updateOne(
      { userId },
      { $set: settings },
      { upsert: true, session: s },
    );
    const c = await control(s);
    if (body.openingBalances) {
      if (c?.activationDate)
        fail(
          "Opening balances cannot change after activation. Use a ledger adjustment.",
        );
      for (const kind of ["EL", "WFH", "ML"]) {
        const amount = Number(body.openingBalances[kind] || 0);
        if (!Number.isFinite(amount) || amount < 0 || amount % 0.5)
          fail("Opening balances must be non-negative half-day units");
        await HRMLedger.updateOne(
          { key: `opening:${userId}:${kind}` },
          {
            $set: {
              userId,
              kind,
              amount,
              date: "9999-01-01",
              category: "Opening",
              reason: "HR confirmed opening balance",
            },
          },
          { upsert: true, session: s },
        );
      }
    }
    await audit(s, actor, "Employee setup", "save", userId, before, {
      ...settings,
      openingBalances: body.openingBalances,
    });
    return settings;
  });
export const activate = async (actor, body) =>
  mutate(actor, async (s) => {
    if (!isSystem(actor))
      fail("System administrator required to activate HRM", 403);
    const activationDate = dateKey(body.activationDate);
    if ((await control(s))?.activationDate) fail("HRM is already activated");
    if (
      !(await HRMPolicy.exists({
        effectiveDate: { $lte: activationDate },
      }).session(s))
    )
      fail("Save an initial policy effective on or before activation first.");
    const list = (await employees(s)).filter((e) => !e.disabled);
    if (
      list.some(
        (e) =>
          !e.setupConfirmed ||
          !e.dateOfJoining ||
          !e.department ||
          !e.branch ||
          !e.gender,
      )
    )
      fail(
        "Complete setup and employee profile eligibility fields for all enabled employees before activation.",
      );
    await HRMControl.updateOne(
      { _id: "portal" },
      { $set: { activationDate } },
      { session: s },
    );
    await HRMLedger.updateMany(
      { category: "Opening" },
      { $set: { date: activationDate } },
      { session: s },
    );
    // Initial credits are covered by HR-confirmed opening balances. Automation starts
    // with the first month after activation to avoid crediting the same units twice.
    await audit(s, actor, "Portal", "activate", "", null, { activationDate });
    return { activationDate };
  });

const holidayList = (s) => sessionQuery(HolidayModel.find().lean(), s);
const requestsFor = (userId, from, to, s) =>
  sessionQuery(
    HRMRequest.find({
      userId,
      status: "approved",
      from: { $lte: to },
      to: { $gte: from },
    }).lean(),
    s,
  );
// Team reads share month data; do not reload the employee directory and policies
// for each person. Authorization is applied once before constructing this batch.
export const attendanceTeam = async (actor, month) => {
  const dates = monthDates(month);
  const list = await employees();
  const visible = list.filter(
    (e) =>
      isHR(actor) ||
      e.userId === actorId(actor) ||
      e.managerId === actorId(actor),
  );
  const ids = visible.map((e) => e.userId);
  const range = { $gte: dates[0], $lte: dates[dates.length - 1] };
  const [
    c,
    locked,
    records,
    requests,
    holidays,
    legacy,
    oldLeaves,
    versions,
    recalculation,
  ] = await Promise.all([
    control(),
    HRMLock.findOne({ month, locked: true }).sort({ version: -1 }).lean(),
    HRMAttendance.find({ userId: { $in: ids }, date: range }).lean(),
    HRMRequest.find({
      userId: { $in: ids },
      status: "approved",
      from: { $lte: dates[dates.length - 1] },
      to: { $gte: dates[0] },
    }).lean(),
    holidayList(),
    AttendanceModel.find({ userId: { $in: ids }, date: range }).lean(),
    LeaveModel.find({
      user_id: { $in: ids },
      status: "approved",
      start_date: { $lte: new Date(`${dates[dates.length - 1]}T23:59:59Z`) },
      end_date: { $gte: new Date(dates[0]) },
    }).lean(),
    HRMPolicy.find({ effectiveDate: { $lte: dates[dates.length - 1] } })
      .sort({ effectiveDate: -1 })
      .lean(),
    HRMMonthPolicy.findOne({ month }).lean(),
  ]);
  return Promise.all(
    visible.map(async (employee) => ({
      employee,
      records: await attendanceMonth(employee.userId, month, undefined, {
        employee,
        c,
        locked,
        holidays,
        versions,
        recalculation,
        records: records.filter((r) => r.userId === employee.userId),
        requests: requests.filter((r) => r.userId === employee.userId),
        legacy: legacy.filter((r) => r.userId === employee.userId),
        oldLeaves: oldLeaves.filter((r) => r.user_id === employee.userId),
      }),
    })),
  );
};
export const attendanceMonth = async (userId, month, s, shared) => {
  const dates = monthDates(month),
    employee = shared ? shared.employee : await employeeFor(userId, s),
    c = shared ? shared.c : await control(s);
  const locked = shared
    ? shared.locked
    : await sessionQuery(
        HRMLock.findOne({ month, locked: true }).sort({ version: -1 }).lean(),
        s,
      );
  if (locked) {
    const saved = locked.snapshot.find((e) => e.employee.userId === userId);
    if (saved) return saved.rows;
    return dates.map((date) => ({
      userId,
      date,
      status: "Not Employed",
      payable: 0,
      locked: true,
    }));
  }
  const records = shared
    ? shared.records
    : await sessionQuery(
        HRMAttendance.find({
          userId,
          date: { $gte: dates[0], $lte: dates[dates.length - 1] },
        }).lean(),
        s,
      );
  const requests = shared
    ? shared.requests
    : await requestsFor(userId, dates[0], dates[dates.length - 1], s);
  const holidays = shared ? shared.holidays : await holidayList(s);
  const legacy = shared
    ? shared.legacy
    : await sessionQuery(
        AttendanceModel.find({
          userId,
          date: { $gte: dates[0], $lte: dates[dates.length - 1] },
        }).lean(),
        s,
      );
  const oldLeaves = shared
    ? shared.oldLeaves
    : await sessionQuery(
        LeaveModel.find({
          user_id: userId,
          status: "approved",
          start_date: {
            $lte: new Date(`${dates[dates.length - 1]}T23:59:59Z`),
          },
          end_date: { $gte: new Date(dates[0]) },
        }).lean(),
        s,
      );
  const versions = shared
    ? shared.versions
    : await sessionQuery(
        HRMPolicy.find({ effectiveDate: { $lte: dates[dates.length - 1] } })
          .sort({ effectiveDate: -1 })
          .lean(),
        s,
      );
  const recalculation = shared
    ? shared.recalculation
    : await sessionQuery(HRMMonthPolicy.findOne({ month }).lean(), s);
  let late = 0;
  const rows = [];
  for (const date of dates) {
    const historical = !c?.activationDate || date < c.activationDate;
    if (historical) {
      const old = legacy.find((r) => r.date === date);
      rows.push({
        date,
        userId,
        status: old?.status || "Historical / Not Marked",
        historical: true,
        remarks: old?.notes || "",
        payable: null,
      });
      continue;
    }
    const policy = {
      ...DEFAULT_POLICY,
      ...(versions.find((p) => p.effectiveDate <= date)?.values || {}),
      ...(recalculation?.values || {}),
    };
    const record = records.find((r) => r.date === date)?.data || {};
    const off = isOff(date, employee, policy, holidays);
    const req = requests.find((r) => r.data.days?.some((d) => d.date === date));
    const fullRequest =
      req?.data.days.find((d) => d.date === date)?.units === 1;
    let row = {
      ...record,
      date,
      userId,
      attendancePolicyVersion:
        recalculation?.effectiveDate ||
        versions.find((p) => p.effectiveDate <= date)?.effectiveDate,
    };
    if (
      record.checkIn &&
      !off &&
      !fullRequest &&
      !record.excusedLate &&
      minutes(record.checkIn) > minutes(policy.graceUntil)
    )
      late++;
    row = deriveAttendance(row, policy, late);
    if (off)
      row = { ...row, status: off, payable: 1, late: false, lateNumber: 0 };
    if (req && !off) {
      const d = req.data.days.find((d) => d.date === date);
      if (d.units === 0.5 && record.checkIn) {
        if (row.payable === 0.5 && !record.override) row.requiresReview = true;
        row = {
          ...row,
          status: `${d.status} + ${row.status}`,
          payable:
            d.payable === null
              ? null
              : Math.min(1, d.payable + (row.payable || 0) * 0.5),
        };
        if (row.requiresReview) row.payable = null;
      } else row = { ...row, status: d.status, payable: d.payable };
      row.requestId = String(req._id);
      row.requestSource = req.data.source;
      row.requestUnits = d.units;
      if (d.units === 1) {
        row.late = false;
        row.lateNumber = 0;
      }
      // Half-day leave needs attendance or an explicit HR decision for the other half.
      if (d.units === 0.5 && !record.checkIn && !record.override) {
        row.payable = null;
        row.requiresReview = true;
      }
    }
    const oldLeave = oldLeaves.find(
      (l) =>
        l.start_date.toISOString().slice(0, 10) <= date &&
        l.end_date.toISOString().slice(0, 10) >= date,
    );
    if (oldLeave && !req && !off)
      row = {
        ...row,
        status: "Legacy Approved Leave — HR Review",
        payable: null,
        requiresReview: true,
        requestId: String(oldLeave._id),
        requestSource: "EMPLOYEE_CRM",
      };
    const legacyAttendance = legacy.find((r) => r.date === date);
    if (
      legacyAttendance &&
      !records.some((r) => r.date === date) &&
      !req &&
      !oldLeave &&
      !off
    )
      row = {
        ...row,
        status: `Legacy ${legacyAttendance.status} — HR Review`,
        payable: null,
        requiresReview: true,
        remarks: legacyAttendance.notes || "",
        legacyStatus: legacyAttendance.status,
      };
    if (record.override)
      row = { ...row, requiresReview: false, ...record.override };
    const notEmployed =
      date < employee.dateOfJoining ||
      (employee.exitDate && date > employee.exitDate);
    if (notEmployed) row = { ...row, status: "Not Employed", payable: 0 };
    row.future = date > todayIST();
    rows.push(row);
  }
  return rows;
};

export const saveAttendance = async (actor, body) =>
  mutate(actor, async (s) => {
    if (!isHR(actor)) fail("Only HR may enter attendance", 403);
    const userId = String(body.userId),
      date = dateKey(body.date);
    await employeeFor(userId, s);
    await assertDates([date], s);
    if (date > todayIST()) fail("Cannot enter attendance in the future");
    const before = await HRMAttendance.findOne({ userId, date })
      .session(s)
      .lean();
    const data = {
      ...(before?.data || {}),
      remarks: String(body.remarks || ""),
      modifiedBy: actorId(actor),
    };
    if (Object.hasOwn(body, "checkIn")) {
      if (body.checkIn) minutes(body.checkIn);
      data.checkIn = body.checkIn || "";
      data.checkInSource = body.checkIn ? "HR_MANUAL" : "";
    }
    if (Object.hasOwn(body, "checkOut")) {
      if (body.checkOut) minutes(body.checkOut);
      data.checkOut = body.checkOut || "";
      data.checkOutSource = body.checkOut ? "HR_MANUAL" : "";
    }
    if (body.excusedLate !== undefined)
      data.excusedLate = Boolean(body.excusedLate);
    if (body.excusedHalfDay !== undefined)
      data.excusedHalfDay = Boolean(body.excusedHalfDay);
    if (
      (before || body.override || body.excusedLate || body.excusedHalfDay) &&
      !data.remarks.trim()
    )
      fail("Corrections and overrides require remarks");
    if (body.clearOverride) delete data.override;
    if (body.override) {
      if (
        ![
          "Present",
          "Absent",
          "UA",
          "Half Day",
          "Full Day Leave",
          "WFH",
          "EL Taken",
        ].includes(body.override.status)
      )
        fail("Invalid override status");
      if (
        ["Absent", "UA"].includes(body.override.status) &&
        !body.reviewConfirmed
      )
        fail(
          "Verify CRM, WhatsApp/offline, emergency and WFH records before confirming absence",
        );
      const approved = await requestsFor(userId, date, date, s);
      const pending = await HRMRequest.exists({
        userId,
        status: "pending",
        from: { $lte: date },
        to: { $gte: date },
      }).session(s);
      const oldLeave = await LeaveModel.exists({
        user_id: userId,
        status: { $in: ["pending", "approved"] },
        start_date: { $lte: new Date(`${date}T23:59:59Z`) },
        end_date: { $gte: new Date(date) },
      }).session(s);
      if (
        ["Absent", "UA"].includes(body.override.status) &&
        (approved.length || pending || oldLeave)
      )
        fail("Resolve linked leave/WFH requests before marking absence");
      const payable = Number(body.override.payable);
      if (
        !Number.isFinite(payable) ||
        payable < -1 ||
        payable > 1 ||
        payable % 0.5
      )
        fail("Invalid payable units");
      const el = Number(body.uaEL || 0);
      if (body.override.status === "UA") {
        if (
          !Number.isFinite(el) ||
          el < 0 ||
          el > 2 ||
          el % 0.5 ||
          payable !== el - 1
        )
          fail(
            "UA must allocate two units: payable units = EL allocation minus one",
          );
        const old = before?.data?.uaEL || 0;
        if ((await availableBalance(userId, "EL", date, s)) < el - old)
          fail("Insufficient EL for UA allocation");
        if (el !== old)
          await ledger(s, {
            key: `ua:${userId}:${date}:${randomUUID()}`,
            userId,
            kind: "EL",
            amount: old - el,
            date,
            category: "UA",
            reason: data.remarks,
          });
        data.uaEL = el;
      } else if (before?.data?.uaEL) {
        await ledger(s, {
          key: `ua-reverse:${userId}:${date}:${randomUUID()}`,
          userId,
          kind: "EL",
          amount: before.data.uaEL,
          date,
          category: "Reversal",
          reason: data.remarks,
        });
        data.uaEL = 0;
      }
      data.override = {
        status: body.override.status,
        payable,
        absenceReviewed: Boolean(body.reviewConfirmed),
      };
    } else if (body.clearOverride && before?.data?.uaEL) {
      await ledger(s, {
        key: `ua-reverse:${userId}:${date}:${randomUUID()}`,
        userId,
        kind: "EL",
        amount: before.data.uaEL,
        date,
        category: "Reversal",
        reason: data.remarks,
      });
      data.uaEL = 0;
    }
    deriveAttendance({ ...data, date }, await policyFor(date, s), 0); // validate time ordering before commit
    await HRMAttendance.updateOne(
      { userId, date },
      { $set: { data } },
      { upsert: true, session: s },
    );
    const rows = await attendanceMonth(userId, date.slice(0, 7), s);
    for (const row of rows.filter(
      (r) => r.lateNumber === 3 || r.lateNumber === 4,
    )) {
      const key = `late:${userId}:${row.date}:${row.lateNumber}`;
      if (!(await HRMJob.exists({ key }).session(s))) {
        await notify(
          s,
          userId,
          `${row.date}: late arrival ${row.lateNumber}${row.lateNumber === 4 ? " — half-day rule applies" : ""}.`,
        );
        await HRMJob.create([{ key, completedAt: new Date() }], { session: s });
      }
    }
    await audit(
      s,
      actor,
      "Attendance",
      "save",
      userId,
      before?.data,
      data,
      data.remarks,
    );
    await notify(s, userId, `HR updated your attendance for ${date}.`);
    return rows.find((r) => r.date === date);
  });

const validateLimits = async (request, employee, policy, s, overrideReason) => {
  const approved = await HRMRequest.find({
    userId: request.userId,
    kind: { $in: ["LEAVE", "WFH"] },
    status: "approved",
    _id: { $ne: request._id },
  })
    .session(s)
    .lean();
  const dates = new Map();
  for (const r of [...approved, request])
    for (const d of r.data.days || [])
      dates.set(
        d.date,
        r.kind === "WFH"
          ? "WFH"
          : r.data.leaveType === "earned" || r.data.payTreatment === "EL"
            ? "EL"
            : "OTHER",
      );
  const sorted = [...dates.keys()].sort(),
    holidays = await holidayList(s);
  let el = 0,
    wfh = 0,
    combined = 0,
    previous = "",
    extended = false,
    segment = [];
  const requested = new Set(request.data.days.map((d) => d.date));
  const checkSegment = () => {
    if (!segment.some((d) => requested.has(d.date))) return;
    let elRun = 0,
      wfhRun = 0,
      maxEL = 0,
      maxWFH = 0;
    for (const d of segment) {
      elRun = d.kind === "EL" ? elRun + 1 : 0;
      wfhRun = d.kind === "WFH" ? wfhRun + 1 : 0;
      maxEL = Math.max(maxEL, elRun);
      maxWFH = Math.max(maxWFH, wfhRun);
    }
    if (
      (maxEL > policy.maxEL ||
        maxWFH > policy.maxWFH ||
        segment.length > policy.maxCombined) &&
      !overrideReason
    )
      fail("Consecutive EL/WFH limits exceeded; HR override reason required");
    if (segment.length > Math.max(policy.maxEL, policy.maxWFH)) extended = true;
  };
  for (const date of sorted) {
    let bridged = false;
    if (
      previous &&
      (Date.parse(date) - Date.parse(previous)) / 86400000 <= 366
    ) {
      const gap = daysBetween(previous, date);
      bridged = gap
        .slice(1, -1)
        .every((d) => isOff(d, employee, policy, holidays));
    }
    if (!bridged || dates.get(date) === "OTHER") {
      checkSegment();
      segment = [];
      el = 0;
      wfh = 0;
      combined = 0;
    }
    const kind = dates.get(date);
    el = kind === "EL" ? el + 1 : 0;
    wfh = kind === "WFH" ? wfh + 1 : 0;
    combined = kind === "OTHER" ? 0 : combined + 1;
    if (kind !== "OTHER") segment.push({ date, kind });
    if (requested.has(date)) {
      if (
        (el > policy.maxEL ||
          wfh > policy.maxWFH ||
          combined > policy.maxCombined) &&
        !overrideReason
      )
        fail("Consecutive EL/WFH limits exceeded; HR override reason required");
      if (combined > Math.max(policy.maxEL, policy.maxWFH)) extended = true;
    }
    previous = date;
  }
  checkSegment();
  const used = approved.filter(
    (r) => r.data.extended && quarter(r.from) === quarter(request.from),
  ).length;
  if (extended && used >= policy.extendedPerQuarter && !overrideReason)
    fail("Extended EL/WFH combination already used this quarter");
  request.data.extended = extended;
};
const requestDays = async (body, employee, s) => {
  const all = daysBetween(body.from, body.to),
    holidays = await holidayList(s),
    result = [];
  if (!["LEAVE", "WFH"].includes(body.kind)) fail("Invalid request kind");
  for (const date of all)
    if (!isOff(date, employee, await policyFor(date, s), holidays))
      result.push({ date, units: body.halfDay ? 0.5 : 1 });
  if (!result.length) fail("Request has no working days");
  if (body.halfDay && (body.kind === "WFH" || result.length !== 1))
    fail("Half day is supported for a single leave date");
  return result;
};

const applyApproval = async (actor, request, body, s) => {
  const userId = request.userId;
  if (userId === actorId(actor)) fail("Self-approval is not allowed", 403);
  if (!(await canApprove(actor, userId, s)))
    fail("Not authorised to approve this request", 403);
  const employee = await employeeFor(userId, s),
    data = request.data;
  if (!employee.setupConfirmed || !employee.dateOfJoining || !employee.eligible)
    fail("HR must confirm employee eligibility first");
  const overlap = await HRMRequest.exists({
    _id: { $ne: request._id },
    userId,
    kind: { $in: ["LEAVE", "WFH"] },
    status: "approved",
    from: { $lte: request.to },
    to: { $gte: request.from },
  }).session(s);
  if (overlap) fail("An approved request overlaps these dates");
  if (
    data.days.some(
      (d) =>
        d.date < employee.dateOfJoining ||
        (employee.exitDate && d.date > employee.exitDate),
    )
  )
    fail("Request is outside employment dates");
  const overrideReason = String(body.overrideReason || "").trim();
  if (overrideReason && !isHR(actor))
    fail("Only HR may override restrictions", 403);
  const policy = await policyFor(request.from, s);
  if (data.lateEmergency && !overrideReason)
    fail("Late emergency intimation requires an HR exception reason");
  const normal =
    request.kind === "LEAVE" &&
    ["normal", "emergency"].includes(data.leaveType);
  if (normal && (!isHR(actor) || !["EL", "UNPAID"].includes(body.payTreatment)))
    fail("HR must choose EL or UNPAID treatment for Normal/Emergency Leave");
  if (data.leaveType === "menstrual" && employee.gender !== "Female")
    fail("Employee is not eligible for Menstrual Leave");
  data.payTreatment = normal
    ? body.payTreatment
    : data.leaveType === "earned"
      ? "EL"
      : data.leaveType === "menstrual"
        ? "ML"
        : "UNPAID";
  data.overrideReason = overrideReason;
  await validateLimits(request, employee, policy, s, overrideReason);
  for (const [i, day] of data.days.entries()) {
    const date = day.date,
      units = day.units;
    if (request.kind === "WFH") {
      if (
        !eligibleCredit(employee, date.slice(0, 7), "WFH") &&
        !(await policyFor(date, s)).wfhFirstMonth &&
        !overrideReason
      )
        fail("WFH eligibility begins in the second joining month");
      const available = await availableBalance(userId, "WFH", date, s);
      const charged = available >= units ? units : 0;
      day.charged = charged;
      day.status =
        employee.group === "Sales"
          ? "WFH Verification Pending"
          : charged >= units
            ? "WFH Paid"
            : "WFH Half Paid";
      day.payable =
        employee.group === "Sales" ? null : charged + (units - charged) * 0.5;
      if (charged)
        await ledger(s, {
          key: `use:${request._id}:${i}`,
          userId,
          kind: "WFH",
          date,
          amount: -charged,
          category: "Usage",
          reference: String(request._id),
        });
    } else {
      const kind = data.payTreatment;
      if (kind !== "UNPAID") {
        if ((await availableBalance(userId, kind, date, s)) < units)
          fail(
            `Insufficient ${kind} balance on ${date}, including approved future usage`,
          );
        await ledger(s, {
          key: `use:${request._id}:${i}`,
          userId,
          kind,
          date,
          amount: -units,
          category: "Usage",
          reference: String(request._id),
        });
      }
      day.status =
        kind === "EL"
          ? "Earned Leave"
          : kind === "ML"
            ? "Menstrual Leave"
            : "Unpaid Leave";
      day.payable = kind === "UNPAID" ? 0 : units;
    }
  }
  data.approvalBy = body.approvalBy || actor.name;
  data.approvedById = actorId(actor);
  data.approvalSource = body.approvalSource || "CRM";
  data.approvalAt = body.approvalAt || new Date().toISOString();
  if (
    !["CRM", "WhatsApp", "Call", "Verbal", "Other"].includes(
      data.approvalSource,
    ) ||
    !Number.isFinite(Date.parse(data.approvalAt)) ||
    Date.parse(data.approvalAt) > Date.now() ||
    Date.parse(data.approvalAt) < Date.parse(data.intimationAt)
  )
    fail("Invalid approval source or timestamp");
  request.status = "approved";
  request.data = data;
};

export const createRequest = async (
  actor,
  body,
  attachment = null,
  legacyId = null,
) =>
  mutate(actor, async (s) => {
    const userId = String(body.userId || actorId(actor)),
      hr = isHR(actor);
    if (userId !== actorId(actor) && !hr)
      fail("Only HR can create requests for another employee", 403);
    const employee = await employeeFor(userId, s),
      from = dateKey(body.from),
      to = dateKey(body.to);
    if (
      legacyId &&
      (await HRMRequest.exists({ "data.legacyId": legacyId }).session(s))
    )
      fail("This legacy request has already been recorded in HRM");
    await assertDates(daysBetween(from, to), s);
    const source = hr ? body.source || "HR_MANUAL" : "EMPLOYEE_CRM";
    if (!["EMPLOYEE_CRM", "WHATSAPP", "HR_MANUAL", "OTHER"].includes(source))
      fail("Invalid request source");
    if (!String(body.reason || "").trim()) fail("Reason is required");
    const kind = body.kind;
    if (
      kind === "LEAVE" &&
      !["earned", "menstrual", "emergency", "normal"].includes(body.leaveType)
    )
      fail("Invalid leave type");
    const intimationAt =
      hr && body.intimationAt
        ? new Date(body.intimationAt).toISOString()
        : new Date().toISOString();
    if (Date.parse(intimationAt) > Date.now())
      fail("Intimation time cannot be in the future");
    if (source === "WHATSAPP" && !body.intimationAt)
      fail("Original WhatsApp intimation timestamp is required");
    const emergency = body.emergency === true || body.leaveType === "emergency";
    const cutoff = new Date(
      `${from}T${(await policyFor(from, s)).emergencyCutoff}:00+05:30`,
    );
    const data = {
      leaveType: kind === "LEAVE" ? body.leaveType : undefined,
      halfDay: Boolean(body.halfDay),
      emergency,
      reason: body.reason,
      source,
      intimationAt,
      entryAt: new Date().toISOString(),
      enteredBy: actorId(actor),
      enteredByName: actor.name,
      lateEmergency: emergency && Date.parse(intimationAt) >= cutoff.getTime(),
      remarks: body.remarks || "",
      attachment,
      days: await requestDays({ ...body, from, to }, employee, s),
    };
    if (legacyId) data.legacyId = legacyId;
    const overlap = await HRMRequest.exists({
      userId,
      status: { $in: ["pending", "approved"] },
      from: { $lte: to },
      to: { $gte: from },
    }).session(s);
    if (overlap) fail("A pending or approved request overlaps these dates");
    const request = new HRMRequest({
      userId,
      kind,
      from,
      to,
      status: "pending",
      data,
    });
    if (body.alreadyApproved) {
      if (!hr) fail("Only HR can record prior approval", 403);
      if (!body.approvalBy || !body.approvalAt)
        fail("Original approver and approval timestamp required");
      await applyApproval(actor, request, body, s);
    }
    await request.save({ session: s });
    if (request.status === "approved") await reconcileExpiries(userId, s);
    if (legacyId) {
      const legacy = await LeaveModel.findById(legacyId).session(s);
      if (!legacy || !["pending", "approved"].includes(legacy.status))
        fail("Legacy request is no longer eligible for HRM import");
      legacy.status = request.status;
      legacy.approved_by = actor.name;
      legacy.notes = `Recorded in HRM: ${request._id}`;
      await legacy.save({ session: s });
    }
    await audit(
      s,
      actor,
      "Request",
      "create",
      userId,
      null,
      request.toObject(),
      body.remarks,
    );
    await notify(
      s,
      userId,
      `${kind === "WFH" ? "WFH" : "Leave"} for ${from}–${to} recorded by ${actor.name}; source: ${source}.`,
      String(request._id),
    );
    const approvers = (await employees(s)).filter(
      (e) => e.userId === employee.managerId || ADMIN.includes(role(e)),
    );
    for (const approver of approvers)
      if (approver.userId !== userId)
        await notify(
          s,
          approver.userId,
          `${employee.name}: ${kind} request ${from}–${to} (${source}).`,
          String(request._id),
        );
    return request;
  });

export const actionRequest = async (actor, id, body) =>
  mutate(actor, async (s) => {
    const request = await HRMRequest.findById(id).session(s);
    if (!request) fail("Request not found", 404);
    if (request.kind === "REGULARISATION")
      fail("Use the regularisation approval endpoint");
    const before = request.toObject(),
      dates = request.data.days.map((d) => d.date);
    await assertDates(dates, s);
    if (body.status === request.status) return request; // retry without duplicate effects
    if (!["approved", "rejected", "cancelled"].includes(body.status))
      fail("Invalid request action");
    if (body.status === "cancelled") {
      if (
        !isHR(actor) &&
        !(request.userId === actorId(actor) && request.status === "pending")
      )
        fail("HR must cancel an approved request", 403);
      if (!String(body.remarks || "").trim())
        fail("Cancellation reason required");
      const usages = await HRMLedger.find({
        reference: String(request._id),
        category: "Usage",
      })
        .session(s)
        .lean();
      for (const usage of usages)
        await ledger(s, {
          key: `reverse:${usage.key}`,
          userId: usage.userId,
          kind: usage.kind,
          date: usage.date,
          amount: -usage.amount,
          category: "Reversal",
          reference: String(request._id),
          reason: body.remarks,
        });
      request.status = "cancelled";
    } else {
      if (request.status !== "pending")
        fail("Only pending requests may be approved/rejected");
      if (request.userId === actorId(actor))
        fail("Self-approval is not allowed", 403);
      if (!(await canApprove(actor, request.userId, s)))
        fail("Not authorised to action this request", 403);
      if (body.status === "approved")
        await applyApproval(actor, request, body, s);
      else {
        if (!body.remarks?.trim()) fail("Rejection reason required");
        request.status = "rejected";
      }
    }
    request.data = {
      ...request.data,
      actionRemarks: body.remarks || "",
      actionBy: actorId(actor),
      actionAt: new Date().toISOString(),
    };
    request.markModified("data");
    await request.save({ session: s });
    if (request.data.legacyId)
      await LeaveModel.updateOne(
        { _id: request.data.legacyId },
        {
          $set: {
            status: request.status,
            notes: `Recorded in HRM: ${request._id}. ${body.remarks || ""}`,
          },
        },
        { session: s },
      );
    await reconcileExpiries(request.userId, s);
    await audit(
      s,
      actor,
      "Request",
      body.status,
      request.userId,
      before,
      request.toObject(),
      body.remarks || body.overrideReason,
    );
    await notify(
      s,
      request.userId,
      `Your ${request.kind} request for ${request.from}–${request.to} is ${request.status}.`,
      String(request._id),
    );
    return request;
  });

export const verifySales = async (actor, id, body) =>
  mutate(actor, async (s) => {
    if (!isHR(actor)) fail("HR verification required", 403);
    const request = await HRMRequest.findById(id).session(s);
    if (!request || request.kind !== "WFH" || request.status !== "approved")
      fail("Approved WFH request required");
    await assertDates(
      request.data.days.map((d) => d.date),
      s,
    );
    if (!body.reference?.trim() || !body.remarks?.trim())
      fail("Payment/verification reference and remarks required");
    if (!["Present", "Unpaid Leave", "Earned Leave"].includes(body.outcome))
      fail("Choose Present, Earned Leave or Unpaid Leave");
    if (request.userId === actorId(actor))
      fail("Self-verification is not allowed", 403);
    const before = request.toObject();
    if (!request.data.days.some((d) => d.status === "WFH Verification Pending"))
      fail("WFH verification is already finalised");
    for (const [i, d] of request.data.days.entries()) {
      if (body.outcome === "Earned Leave") {
        if ((await availableBalance(request.userId, "EL", d.date, s)) < d.units)
          fail("Insufficient EL");
        await ledger(s, {
          key: `sales:${id}:${i}`,
          userId: request.userId,
          kind: "EL",
          date: d.date,
          amount: -d.units,
          category: "Usage",
          reference: id,
        });
      }
      d.status = body.outcome;
      d.payable = body.outcome === "Unpaid Leave" ? 0 : d.units;
    }
    request.data.verification = {
      ...body,
      by: actorId(actor),
      at: new Date().toISOString(),
    };
    request.markModified("data");
    await request.save({ session: s });
    await audit(
      s,
      actor,
      "Sales WFH",
      "verify",
      request.userId,
      before,
      request.toObject(),
      body.remarks,
    );
    await notify(
      s,
      request.userId,
      `Sales WFH ${request.from}–${request.to} finalised: ${body.outcome}.`,
      id,
    );
    return request;
  });

// Recompute expiries after backdated usage/reversals, so cancelled old ML/WFH
// cannot become a spendable balance in a new entitlement period.
const reconcileExpiries = async (userId, s) => {
  const c = await control(s);
  if (!c?.activationDate) return;
  const now = todayIST();
  let month = c.activationDate.slice(0, 7);
  while (`${month}-01` < now) {
    const dates = monthDates(month),
      end = dates[dates.length - 1],
      next = addDays(end, 1);
    if (next > now) break;
    for (const kind of [
      "ML",
      ...(quarter(next) !== quarter(end) ? ["WFH"] : []),
    ]) {
      const key = `expire:${userId}:${kind}:${end}`;
      const old = await HRMLedger.findOne({ key }).session(s).lean();
      const remaining = Math.max(
        0,
        (await balance(userId, kind, end, s)) - (old?.amount || 0),
      );
      if (!old || old.amount !== -remaining) {
        const entry = {
          key,
          userId,
          kind,
          date: end,
          amount: -remaining,
          category: "Expiry",
          reason: `${kind} period ended`,
        };
        await HRMLedger.updateOne(
          { key },
          { $set: entry },
          { upsert: true, session: s },
        );
        await audit(
          s,
          { userId: "SYSTEM" },
          "Ledger",
          old ? "recalculate expiry" : "expire",
          userId,
          old,
          entry,
        );
      }
    }
    month = next.slice(0, 7);
  }
};

export const adjustBalance = async (actor, body) =>
  mutate(actor, async (s) => {
    if (!isHR(actor)) fail("HR required", 403);
    const date = dateKey(body.date),
      userId = String(body.userId),
      amount = Number(body.amount);
    await employeeFor(userId, s);
    await assertDates([date], s);
    if (date > todayIST()) fail("Balance adjustments cannot be future-dated");
    if (
      !["EL", "WFH", "ML"].includes(body.kind) ||
      !Number.isFinite(amount) ||
      !amount ||
      amount % 0.5 ||
      !body.reason?.trim()
    )
      fail("Choose a balance, half-day amount and reason");
    if (
      body.kind === "ML" &&
      (await employeeFor(userId, s)).gender !== "Female"
    )
      fail("Menstrual Leave eligibility required");
    if ((await balance(userId, body.kind, date, s)) + amount < 0)
      fail("Adjustment would make balance negative");
    if (
      amount < 0 &&
      (await availableBalance(userId, body.kind, date, s)) < -amount
    )
      fail("Adjustment conflicts with already approved future usage");
    const entry = {
      key: `adjust:${body.operationId || randomUUID()}`,
      userId,
      kind: body.kind,
      date,
      amount,
      category: "Adjustment",
      reason: body.reason,
    };
    await ledger(s, entry);
    await reconcileExpiries(userId, s);
    await audit(s, actor, "Ledger", "adjust", userId, null, entry, body.reason);
    return entry;
  });

export const regularisation = async (actor, body, id) =>
  mutate(actor, async (s) => {
    if (!id) {
      const date = dateKey(body.date);
      await assertDates([date], s);
      if (!body.reason?.trim()) fail("Reason required");
      if (body.checkIn) minutes(body.checkIn);
      if (body.checkOut) minutes(body.checkOut);
      const r = await HRMRequest.create(
        [
          {
            userId: actorId(actor),
            kind: "REGULARISATION",
            from: date,
            to: date,
            status: "pending",
            data: {
              ...body,
              source: "EMPLOYEE_CRM",
              entryAt: new Date().toISOString(),
              days: [],
            },
          },
        ],
        { session: s },
      );
      await audit(
        s,
        actor,
        "Regularisation",
        "create",
        actorId(actor),
        null,
        r[0].toObject(),
      );
      return r[0];
    }
    const r = await HRMRequest.findById(id).session(s);
    if (!r || r.kind !== "REGULARISATION") fail("Regularisation not found");
    if (!isHR(actor) || r.userId === actorId(actor))
      fail("Another HR approver is required", 403);
    await assertDates([r.from], s);
    if (
      r.status !== "pending" ||
      !["approved", "rejected"].includes(body.status) ||
      !body.remarks?.trim()
    )
      fail("Pending request, decision and remarks required");
    const before = r.toObject();
    if (body.status === "approved") {
      const existing = await HRMAttendance.findOne({
        userId: r.userId,
        date: r.from,
      })
        .session(s)
        .lean();
      const data = {
        ...(existing?.data || {}),
        remarks: body.remarks,
        modifiedBy: actorId(actor),
        regularisationId: id,
        excusedLate: Boolean(body.excusedLate),
        excusedHalfDay: Boolean(body.excusedHalfDay),
      };
      for (const key of ["checkIn", "checkOut"])
        if (r.data[key]) {
          data[key] = r.data[key];
          data[`${key}Source`] = "HR_MANUAL";
        }
      deriveAttendance(
        { ...data, date: r.from },
        await policyFor(r.from, s),
        0,
      );
      await HRMAttendance.updateOne(
        { userId: r.userId, date: r.from },
        { $set: { data } },
        { upsert: true, session: s },
      );
      await audit(
        s,
        actor,
        "Attendance",
        "regularise",
        r.userId,
        existing?.data,
        data,
        body.remarks,
      );
    }
    r.status = body.status;
    r.data = {
      ...r.data,
      actionRemarks: body.remarks,
      actionBy: actorId(actor),
    };
    await r.save({ session: s });
    await audit(
      s,
      actor,
      "Regularisation",
      body.status,
      r.userId,
      before,
      r.toObject(),
      body.remarks,
    );
    await notify(
      s,
      r.userId,
      `Regularisation for ${r.from} ${body.status}.`,
      id,
    );
    return r;
  });

export const saveHoliday = async (actor, body, id) =>
  mutate(actor, async (s) => {
    if (!isHR(actor)) fail("HR required", 403);
    const before = id
      ? await HolidayModel.findById(id).session(s).lean()
      : null;
    const date = dateKey(body.date || before?.date);
    await assertDates([date, ...(before ? [before.date] : [])], s);
    // Changing working-day classification under requests would invalidate committed
    // day units. Require HR to cancel/re-enter affected requests explicitly.
    if (
      await HRMRequest.exists({
        status: { $in: ["approved", "pending"] },
        from: { $lte: date },
        to: { $gte: date },
        kind: { $in: ["LEAVE", "WFH"] },
      }).session(s)
    )
      fail(
        "Resolve overlapping leave/WFH requests before changing this holiday",
      );
    if (body.remove) await HolidayModel.deleteOne({ _id: id }).session(s);
    else {
      if (!body.name?.trim()) fail("Holiday name required");
      await HolidayModel.updateOne(
        { date },
        {
          $set: {
            name: body.name,
            department: body.department || "",
            location: body.location || "",
            holidayType: body.holidayType || "Company",
            description: body.description || "",
            addedBy: actorId(actor),
          },
        },
        { upsert: true, session: s },
      );
    }
    await audit(
      s,
      actor,
      "Holiday",
      body.remove ? "delete" : "save",
      "",
      before,
      body,
    );
    return { saved: true };
  });

export const lockMonth = async (actor, month, body) =>
  mutate(actor, async (s) => {
    if (!isHR(actor)) fail("HR required", 403);
    const dates = monthDates(month);
    await requireActive(dates[dates.length - 1], s);
    const previous = await HRMLock.findOne({ month })
      .sort({ version: -1 })
      .session(s)
      .lean();
    if (body.unlock) {
      if (!isSystem(actor) || !body.reason?.trim())
        fail("System authority and reason required to unlock", 403);
      if (!previous?.locked) fail("Month is not locked");
      await HRMLock.updateOne(
        { _id: previous._id },
        { $set: { locked: false } },
        { session: s },
      );
      await audit(
        s,
        actor,
        "Monthly lock",
        "unlock",
        "",
        previous,
        { month },
        body.reason,
      );
      return { unlocked: true };
    }
    if (previous?.locked) fail("Month already locked");
    if (dates[dates.length - 1] >= todayIST())
      fail("Only completed months can be locked");
    if (!body.reviewConfirmed)
      fail("Confirm CRM, WhatsApp/offline and absence reviews");
    const c = await control(s);
    if (c.activationDate > dates[0])
      fail(
        "A partial activation month cannot produce a complete payroll snapshot; start payroll locking with the next full month",
      );
    if (
      await HRMRequest.exists({
        status: "pending",
        from: { $lte: dates[dates.length - 1] },
        to: { $gte: dates[0] },
      }).session(s)
    )
      fail("Resolve pending requests before locking");
    const snapshot = [];
    for (const e of (await employees(s)).filter((e) => e.setupConfirmed)) {
      const rows = await attendanceMonth(e.userId, month, s);
      const unresolved = rows.filter(
        (r) =>
          r.payable === null ||
          r.requiresReview ||
          (["UA", "Absent"].includes(r.status) && !r.absenceReviewed),
      );
      if (unresolved.length)
        fail(`${e.name}: ${unresolved.length} unresolved attendance dates`);
      snapshot.push({
        employee: {
          userId: e.userId,
          name: e.name,
          employeeId: e.employeeId,
          department: e.department,
          branch: e.branch,
        },
        rows,
        payableDays: Math.max(
          0,
          rows.reduce((n, r) => n + (r.payable || 0), 0),
        ),
      });
    }
    const version = (previous?.version || 0) + 1;
    await HRMLock.create(
      [
        {
          month,
          version,
          locked: true,
          snapshot,
          actor: actorId(actor),
          reason: body.reason || "HR monthly review completed",
        },
      ],
      { session: s },
    );
    await audit(
      s,
      actor,
      "Monthly lock",
      "lock",
      "",
      null,
      { month, version },
      body.reason,
    );
    return { month, version, snapshot };
  });

export const recalculateMonth = async (actor, month, body) =>
  mutate(actor, async (s) => {
    if (!isHR(actor) || !body.reason?.trim())
      fail("HR access and a recalculation reason required", 403);
    await assertDates(monthDates(month), s);
    const before = await HRMMonthPolicy.findOne({ month }).session(s).lean();
    let after = null;
    if (body.policyEffectiveDate) {
      const version = await HRMPolicy.findOne({
        effectiveDate: dateKey(body.policyEffectiveDate),
      })
        .session(s)
        .lean();
      if (!version) fail("Policy version not found");
      const values = Object.fromEntries(
        [
          "officeStart",
          "graceUntil",
          "halfDayAfter",
          "checkout",
          "earlyGoingReference",
          "allowedLates",
        ].map((k) => [k, { ...DEFAULT_POLICY, ...version.values }[k]]),
      );
      after = {
        month,
        effectiveDate: version.effectiveDate,
        values,
        actor: actorId(actor),
        reason: body.reason,
      };
      await HRMMonthPolicy.updateOne(
        { month },
        { $set: after },
        { upsert: true, session: s },
      );
    } else await HRMMonthPolicy.deleteOne({ month }).session(s);
    await audit(
      s,
      actor,
      "Attendance",
      "recalculate",
      "",
      before,
      after,
      body.reason,
    );
    return { month, policyEffectiveDate: after?.effectiveDate || null };
  });

export const runAutomation = async () => {
  if (mongoose.connection.readyState !== 1) return;
  const c = await control();
  if (!c?.activationDate) return;
  const today = todayIST(),
    currentPolicy = await policyFor(today);
  const afterCheckout =
    new Date() >= new Date(`${today}T${currentPolicy.checkout}:00+05:30`);
  const key = `daily:${today}:${afterCheckout ? "closed" : "open"}`;
  if (await HRMJob.exists({ key })) return;
  await mutate({ userId: "SYSTEM", name: "HRM automation" }, async (s) => {
    if (await HRMJob.exists({ key }).session(s)) return;
    let month = addDays(
      monthDates(c.activationDate.slice(0, 7)).slice(-1)[0],
      1,
    ).slice(0, 7);
    const list = await employees(s);
    while (`${month}-01` <= today) {
      const date = `${month}-01`,
        p = await policyFor(date, s);
      for (const e of list.filter((e) => e.setupConfirmed && !e.disabled)) {
        for (const kind of ["EL", "WFH", "ML"]) {
          const creditKey = `credit:${e.userId}:${kind}:${month}`;
          const entitlement = monthlyCredit(e, month, kind, p);
          if (
            !entitlement.amount ||
            entitlement.date > today ||
            (await HRMLedger.exists({ key: creditKey }).session(s))
          )
            continue;
          let credit = entitlement.amount;
          if (kind === "WFH") {
            const credits = await HRMLedger.find({
              userId: e.userId,
              kind,
              category: { $in: ["Monthly Credit", "Opening"] },
              date: { $gte: `${quarter(date)}-01`, $lte: date },
            })
              .session(s)
              .lean();
            credit = Math.max(
              0,
              Math.min(
                credit,
                p.wfhQuarterly - credits.reduce((n, r) => n + r.amount, 0),
              ),
            );
          }
          await ledger(s, {
            key: creditKey,
            userId: e.userId,
            kind,
            date: entitlement.date,
            amount: credit,
            category: "Monthly Credit",
            reason: "Monthly entitlement",
          });
          await notify(
            s,
            e.userId,
            `${kind}: ${credit} day(s) credited for ${month}.`,
          );
          await audit(
            s,
            { userId: "SYSTEM" },
            "Ledger",
            "monthly credit",
            e.userId,
            null,
            { kind, date, amount: credit },
          );
        }
      }
      month = addDays(monthDates(month).slice(-1)[0], 1).slice(0, 7);
    }
    for (const e of list.filter((e) => e.setupConfirmed))
      await reconcileExpiries(e.userId, s);
    const missingCheckouts = await HRMAttendance.find({
      date: { $gte: c.activationDate, $lte: today },
      "data.checkIn": { $exists: true, $ne: "" },
      "data.checkOutSource": { $nin: ["AUTO", "HR_MANUAL"] },
    }).session(s);
    for (const row of missingCheckouts) {
      const p = await policyFor(row.date, s);
      if (
        new Date() < new Date(`${row.date}T${p.checkout}:00+05:30`) ||
        (await HRMLock.exists({
          month: row.date.slice(0, 7),
          locked: true,
        }).session(s))
      )
        continue;
      const before = { ...row.data };
      row.data = { ...row.data, checkOut: p.checkout, checkOutSource: "AUTO" };
      await row.save({ session: s });
      await audit(
        s,
        { userId: "SYSTEM" },
        "Attendance",
        "automatic checkout",
        row.userId,
        before,
        row.data,
      );
    }
    await HRMJob.create([{ key, completedAt: new Date() }], { session: s });
  });
};

export const bootstrap = async (actor, month = todayIST().slice(0, 7)) => {
  monthDates(month);
  const [list, c] = await Promise.all([employees(), control()]);
  const ids = list
    .filter(
      (e) =>
        isHR(actor) ||
        e.userId === actorId(actor) ||
        e.managerId === actorId(actor),
    )
    .map((e) => e.userId);
  const visible = list.filter((e) => ids.includes(e.userId));
  const own = actorId(actor);
  const [requests, preference, ledgerRows] = await Promise.all([
    HRMRequest.find({ userId: { $in: ids } })
      .sort({ createdAt: -1 })
      .lean(),
    HRMEmployee.findOne({ userId: own }).lean(),
    HRMLedger.find({ userId: { $in: ids } })
      .sort({ date: -1 })
      .lean(),
  ]);
  let database = null;
  if (isHR(actor)) {
    try {
      const hello = await mongoose.connection.db
        .admin()
        .command({ hello: 1 }, { maxTimeMS: 3000 });
      database = {
        connected: true,
        transactionsSupported: Boolean(
          hello.setName || hello.msg === "isdbgrid",
        ),
      };
    } catch {
      database = { connected: true, transactionsSupported: null };
    }
  }
  const asOf = todayIST();
  const readBalance = (userId, kind) =>
    ledgerRows
      .filter(
        (l) =>
          l.userId === userId &&
          l.kind === kind &&
          l.date <= asOf &&
          (kind === "EL" ||
            l.date >=
              (kind === "WFH"
                ? `${quarter(asOf)}-01`
                : `${asOf.slice(0, 7)}-01`)),
      )
      .reduce((n, l) => n + l.amount, 0);
  const readAvailable = (userId, kind) =>
    Math.max(
      0,
      readBalance(userId, kind) +
        ledgerRows
          .filter(
            (l) =>
              l.userId === userId &&
              l.kind === kind &&
              l.date > asOf &&
              ["Usage", "UA", "Reversal"].includes(l.category) &&
              (kind === "EL" ||
                (kind === "WFH"
                  ? quarter(l.date) === quarter(asOf)
                  : l.date.slice(0, 7) === asOf.slice(0, 7))),
          )
          .reduce((n, l) => n + l.amount, 0),
    );
  const balances = Object.fromEntries(
    ["EL", "WFH", "ML"].map((kind) => [kind, readAvailable(own, kind)]),
  );
  const employeeBalances = {};
  for (const employee of visible) {
    employeeBalances[employee.userId] = {};
    for (const kind of ["EL", "WFH", "ML"])
      employeeBalances[employee.userId][kind] = readAvailable(
        employee.userId,
        kind,
      );
  }
  return {
    today: todayIST(),
    onboarding: {
      tourVersion: preference?.tourVersion || 0,
      adminTourVersion: preference?.adminTourVersion || 0,
      database,
    },
    activationDate: c?.activationDate || "",
    isHR: isHR(actor),
    isSystem: isSystem(actor),
    policy: await policyFor(todayIST()),
    policies: isHR(actor)
      ? await HRMPolicy.find().sort({ effectiveDate: -1 }).lean()
      : [],
    employees: visible,
    requests,
    balances,
    employeeBalances,
    holidays: await holidayList(),
    attendance: await attendanceMonth(own, month),
    locks: isHR(actor)
      ? await HRMLock.find()
          .select("-snapshot")
          .sort({ month: -1, version: -1 })
          .lean()
      : [],
    legacyLeaves: await LeaveModel.find(
      isHR(actor) ? {} : { user_id: { $in: ids } },
    )
      .sort({ createdAt: -1 })
      .lean(),
    ledger: ledgerRows,
    wfhUsedQuarter: -(
      await HRMLedger.find({
        userId: own,
        kind: "WFH",
        category: "Usage",
        date: { $gte: `${quarter(todayIST())}-01`, $lte: todayIST() },
      }).lean()
    ).reduce((n, e) => n + e.amount, 0),
  };
};

export const report = async (actor, month, type) => {
  if (!isHR(actor)) fail("HR reports access required", 403);
  monthDates(month);
  if (type === "payroll") {
    const locked = await HRMLock.findOne({ month, locked: true })
      .sort({ version: -1 })
      .lean();
    if (!locked) fail("Payroll export requires locked attendance");
    return locked.snapshot.flatMap((e) =>
      e.rows.map((r) => ({
        ...e.employee,
        ...r,
        month,
        version: locked.version,
        payableDays: e.payableDays,
      })),
    );
  }
  if (["leave", "wfh", "source"].includes(type)) {
    const requests = await HRMRequest.find({
      kind:
        type === "leave"
          ? "LEAVE"
          : type === "wfh"
            ? "WFH"
            : { $in: ["LEAVE", "WFH"] },
      from: { $lte: monthDates(month).slice(-1)[0] },
      to: { $gte: `${month}-01` },
    }).lean();
    const list = await employees();
    return requests.map((r) => ({
      requestId: String(r._id),
      userId: r.userId,
      name: list.find((e) => e.userId === r.userId)?.name || "",
      kind: r.kind,
      leaveType: r.data.leaveType || "",
      from: r.from,
      to: r.to,
      days: r.data.days.reduce((n, d) => n + d.units, 0),
      reason: r.data.reason,
      emergency: r.data.emergency || false,
      requestSource: r.data.source,
      originalIntimationAt: r.data.intimationAt,
      crmEntryAt: r.data.entryAt,
      status: r.status,
      approvedBy: r.data.approvalBy || "",
      approvalSource: r.data.approvalSource || "",
      approvalAt: r.data.approvalAt || "",
      enteredBy: r.data.enteredByName || "",
      remarks: r.data.actionRemarks || r.data.remarks || "",
      attendanceTreatment: r.data.days
        .map((d) => `${d.date}: ${d.status || "Pending"}`)
        .join("; "),
      salesVerification: r.data.verification?.reference || "",
    }));
  }
  const rows = [];
  for (const e of await employees())
    for (const r of await attendanceMonth(e.userId, month)) {
      if (
        (type === "late" && !r.late) ||
        (type === "early" && !r.earlyGoingMinutes) ||
        (type === "halfday" && !r.status.includes("Half")) ||
        (type === "ua" && r.status !== "UA")
      )
        continue;
      rows.push({
        name: e.name,
        department: e.department,
        branch: e.branch,
        ...r,
      });
    }
  return rows;
};
