import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_POLICY as p,
  deriveAttendance,
  todayIST,
  monthDates,
  dateKey,
  quarter,
  eligibleCredit,
  monthlyCredit,
  isOff,
} from "../src/hrm/rules.js";
const row = (
  time,
  late = 1,
  extra = {},
  now = new Date("2026-10-22T15:00:00Z"),
) =>
  deriveAttendance(
    { date: "2026-10-22", checkIn: time, ...extra },
    p,
    late,
    now,
  );
test("IST date boundaries and leap-year validation", () => {
  assert.equal(todayIST(new Date("2026-10-21T19:00:00Z")), "2026-10-22");
  assert.equal(monthDates("2024-02").length, 29);
  assert.throws(() => dateKey("2026-02-29"));
  assert.equal(quarter("2026-04-01"), "2026-04");
  assert.equal(quarter("2027-01-01"), "2027-01");
});
test("grace, monthly fourth late, and 11:00 thresholds are strict", () => {
  assert.equal(row("10:15").status, "Present");
  assert.equal(row("10:16", 3).status, "Late");
  assert.equal(row("10:16", 4).status, "Half Day");
  assert.equal(row("11:00").status, "Late");
  assert.equal(row("11:01").status, "Half Day");
  assert.equal(row("11:01", 4, { excusedHalfDay: true }).status, "Late");
});
test("missing check-in stays pending and no checkout is invented before deadline", () => {
  assert.equal(row("").status, "Pending");
  const early = row("10:00", 1, {}, new Date("2026-10-22T08:00:00Z"));
  assert.equal(early.checkOut, "");
  assert.equal(row("10:00").checkOut, "18:30");
  assert.equal(row("10:00").checkOutSource, "AUTO");
});
test("manual checkout overrides auto and early going never penalises pay", () => {
  const r = row("10:00", 1, { checkOut: "18:10", checkOutSource: "HR_MANUAL" });
  assert.equal(r.earlyGoingMinutes, 20);
  assert.equal(r.payable, 1);
  assert.equal(r.status, "Present");
  assert.equal(
    row("10:00", 1, { checkOut: "18:35", checkOutSource: "HR_MANUAL" })
      .earlyGoingMinutes,
    0,
  );
  assert.throws(() =>
    row("11:00", 1, { checkOut: "10:00", checkOutSource: "HR_MANUAL" }),
  );
});
test("EL partial joining month, first-day joining, WFH second month, exits and ML eligibility", () => {
  const e = { dateOfJoining: "2026-09-18", gender: "Female", eligible: true };
  assert.equal(eligibleCredit(e, "2026-09", "EL"), false);
  assert.equal(eligibleCredit(e, "2026-10", "EL"), true);
  assert.equal(
    eligibleCredit({ ...e, dateOfJoining: "2026-09-01" }, "2026-09", "EL"),
    true,
  );
  assert.equal(
    eligibleCredit({ ...e, dateOfJoining: "2026-09-01" }, "2026-09", "WFH"),
    false,
  );
  assert.equal(eligibleCredit(e, "2026-10", "WFH"), true);
  assert.equal(
    eligibleCredit({ ...e, exitDate: "2026-10-29" }, "2026-10", "EL"),
    true,
  );
  assert.equal(
    eligibleCredit({ ...e, exitDate: "2026-09-29" }, "2026-10", "EL"),
    false,
  );
  assert.equal(
    eligibleCredit({ ...e, gender: "Male" }, "2026-10", "ML"),
    false,
  );
});
test("Sunday-only weekly off and department/location holidays", () => {
  const e = { department: "Sales", branch: "Delhi" };
  assert.equal(isOff("2026-10-24", e, p, []), "");
  assert.equal(isOff("2026-10-25", e, p, []), "Week Off");
  const h = [{ date: "2026-10-22", department: "Admin", location: "Delhi" }];
  assert.equal(isOff("2026-10-22", e, p, h), "");
  assert.equal(
    isOff("2026-10-22", { ...e, department: "Admin" }, p, h),
    "Holiday",
  );
});
test("joining-month credits are policy-driven and never precede employment", () => {
  const e = { dateOfJoining: "2026-10-18", gender: "Female", eligible: true };
  assert.deepEqual(monthlyCredit(e, "2026-10", "EL"), {
    amount: 0,
    date: "2026-10-18",
  });
  assert.equal(monthlyCredit(e, "2026-10", "WFH").amount, 0);
  assert.equal(monthlyCredit(e, "2026-10", "ML").amount, 0.5);
  assert.equal(
    monthlyCredit(e, "2026-10", "EL", { ...p, elFirstPartialMonth: 0.5 })
      .amount,
    0.5,
  );
  assert.equal(monthlyCredit(e, "2026-11", "WFH").amount, 2);
});
