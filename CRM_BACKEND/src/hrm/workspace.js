import * as service from "./service.js";
import mongoose from "mongoose";
import {
  HRMEmployee,
  HRMRequest,
  HRMLedger,
  HRMPolicy,
  HRMLock,
} from "./models.js";
import { LeaveModel } from "../models/LeaveModel.js";
import HolidayModel from "../models/HolidayModel.js";
import { monthDates, todayIST, quarter } from "./rules.js";

const pagination = (page, total, size = 100) => ({
  page,
  pageSize: size,
  total,
  totalPages: Math.max(1, Math.ceil(total / size)),
});
export async function workspace(actor, options = {}) {
  const today = todayIST(),
    month = options.month || today.slice(0, 7);
  const dates = monthDates(month),
    section = options.section || "dashboard";
  const page = Math.max(1, Math.floor(Number(options.page) || 1)),
    size = 100;
  const own = String(actor.userId || actor._id),
    hr = service.isHR(actor);
  const [directory, control, preference, policy, holidays] = await Promise.all([
    service.employees(),
    service.control(),
    HRMEmployee.findOne({ userId: own }).lean(),
    service.policyFor(today),
    HolidayModel.find().lean(),
  ]);
  const employees = directory.filter(
    (e) => hr || e.userId === own || e.managerId === own,
  );
  const ids = employees.map((e) => e.userId);
  const selected = String(options.userId || own);
  if (!ids.includes(selected))
    service.fail("Employee is outside your team", 403);
  const requestQuery = { userId: { $in: ids } };
  const requestSections = [
    "dashboard",
    "leave",
    "wfh",
    "approvals",
    "regularisation",
  ];
  if (section === "dashboard")
    Object.assign(requestQuery, {
      userId: own,
      $or: [{ status: "pending" }, { to: { $gte: today } }],
    });
  if (section === "leave") requestQuery.kind = "LEAVE";
  if (section === "wfh") requestQuery.kind = "WFH";
  if (section === "regularisation") requestQuery.kind = "REGULARISATION";
  if (options.search && section !== "dashboard") {
    const search = String(options.search).slice(0, 120);
    const regex = new RegExp(
      search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    requestQuery.$or = [
      { status: regex },
      { kind: regex },
      { "data.source": regex },
      {
        userId: {
          $in: employees.filter((e) => regex.test(e.name)).map((e) => e.userId),
        },
      },
    ];
  }
  const ledgerQuery = { userId: selected };
  const legacyQuery = { user_id: { $in: ids } };
  const quarterStart = `${quarter(today)}-01`,
    monthStart = `${today.slice(0, 7)}-01`;
  const endOfQuarter = new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(quarter(today).slice(5)) + 2, 1),
  )
    .toISOString()
    .slice(0, 10);
  const endOfMonth = new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1),
  )
    .toISOString()
    .slice(0, 10);
  const periods = [
    { kind: "EL" },
    { kind: "WFH", date: { $gte: quarterStart } },
    { kind: "ML", date: { $gte: monthStart } },
  ];
  const futurePeriods = [
    { kind: "EL" },
    { kind: "WFH", date: { $gte: quarterStart, $lt: endOfQuarter } },
    { kind: "ML", date: { $gte: monthStart, $lt: endOfMonth } },
  ];
  const balanceQuery = {
    userId: { $in: ids },
    $or: [
      { date: { $lte: today }, $or: periods },
      {
        date: { $gt: today },
        category: { $in: ["Usage", "UA", "Reversal"] },
        $or: futurePeriods,
      },
    ],
  };
  const [
    requests,
    requestCount,
    ledger,
    ledgerCount,
    opening,
    balanceRows,
    attendance,
    policies,
    locks,
    legacyLeaves,
    legacyCount,
    pendingCount,
    usedRows,
    ledgerSummary,
  ] = await Promise.all([
    requestSections.includes(section)
      ? HRMRequest.find(requestQuery)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * size)
          .limit(size)
          .lean()
      : [],
    requestSections.includes(section)
      ? HRMRequest.countDocuments(requestQuery)
      : 0,
    section === "ledger"
      ? HRMLedger.find(ledgerQuery)
          .sort({ date: -1, _id: -1 })
          .skip((page - 1) * size)
          .limit(size)
          .lean()
      : [],
    section === "ledger" ? HRMLedger.countDocuments(ledgerQuery) : 0,
    section === "setup" || !control?.activationDate
      ? HRMLedger.find({ userId: { $in: ids }, category: "Opening" }).lean()
      : [],
    HRMLedger.aggregate([
      { $match: balanceQuery },
      {
        $group: {
          _id: { userId: "$userId", kind: "$kind" },
          amount: { $sum: "$amount" },
        },
      },
    ]),
    ["dashboard", "attendance"].includes(section)
      ? service.attendanceForEmployees(
          [employees.find((e) => e.userId === own)], month, { c: control, holidays },
        ).then((team) => team[0].records)
      : [],
    hr &&
    (["settings", "monthly", "setup"].includes(section) ||
      !control?.activationDate)
      ? HRMPolicy.find().sort({ effectiveDate: -1 }).lean()
      : [],
    hr && section === "monthly"
      ? HRMLock.find({ month }).select("-snapshot").sort({ version: -1 }).lean()
      : [],
    section === "leave"
      ? LeaveModel.find(legacyQuery)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * size)
          .limit(size)
          .lean()
      : [],
    section === "leave" ? LeaveModel.countDocuments(legacyQuery) : 0,
    section === "dashboard"
      ? HRMRequest.countDocuments({ userId: own, status: "pending" })
      : 0,
    HRMLedger.aggregate([
      {
        $match: {
          userId: own,
          kind: "WFH",
          category: "Usage",
          date: { $gte: quarterStart, $lte: today },
        },
      },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    section === "ledger"
      ? ledgerPeriodSummary(selected, month, dates.at(-1))
      : [],
  ]);
  const employeeBalances = Object.fromEntries(
    ids.map((id) => [id, { EL: 0, WFH: 0, ML: 0 }]),
  );
  for (const row of balanceRows)
    employeeBalances[row._id.userId][row._id.kind] = Math.max(0, row.amount);
  let database = null;
  if (hr && (section === "setup" || !control?.activationDate)) {
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 }, { maxTimeMS: 3000 });
      database = { connected: true, transactionsSupported: Boolean(hello.setName || hello.msg === "isdbgrid") };
    } catch { database = { connected: true, transactionsSupported: null }; }
  }
  return {
    today,
    activationDate: control?.activationDate || "",
    isHR: hr,
    isSystem: service.isSystem(actor),
    onboarding: {
      tourVersion: preference?.tourVersion || 0,
      adminTourVersion: preference?.adminTourVersion || 0,
      database,
    },
    policy,
    policies,
    employees,
    requests,
    pendingCount,
    balances: employeeBalances[own] || { EL: 0, WFH: 0, ML: 0 },
    employeeBalances,
    holidays,
    attendance,
    locks,
    legacyLeaves,
    ledger: section === "ledger" ? ledger : opening,
    ledgerSummary,
    wfhUsedQuarter: -(usedRows[0]?.amount || 0),
    pagination: pagination(
      page,
      Math.max(requestCount, ledgerCount, legacyCount),
    ),
  };
}

async function ledgerPeriodSummary(userId, month, end) {
  const [year, m] = month.split("-").map(Number);
  const start = {
    $switch: {
      branches: [
        {
          case: { $eq: ["$kind", "EL"] },
          then: `${m >= 4 ? year : year - 1}-04-01`,
        },
        {
          case: { $eq: ["$kind", "WFH"] },
          then: `${quarter(`${month}-01`)}-01`,
        },
      ],
      default: `${month}-01`,
    },
  };
  const rows = await HRMLedger.aggregate([
    { $match: { userId, date: { $lte: end } } },
    {
      $group: {
        _id: {
          kind: "$kind",
          category: "$category",
          before: { $lt: ["$date", start] },
        },
        amount: { $sum: "$amount" },
      },
    },
  ]);
  return rows.map((r) => ({
    userId,
    kind: r._id.kind,
    category: r._id.category,
    amount: r.amount,
    date: r._id.before ? "0000-01-01" : end,
  }));
}
