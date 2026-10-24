// Pure policy functions. Dates are civil dates in Asia/Kolkata, never host dates.
export const DEFAULT_POLICY = {
  officeStart: "10:00",
  graceUntil: "10:15",
  halfDayAfter: "11:00",
  checkout: "18:30",
  earlyGoingReference: "18:30",
  emergencyCutoff: "09:30",
  allowedLates: 3,
  elMonthly: 1,
  elFirstPartialMonth: 0,
  mlMonthly: 0.5,
  mlFirstMonth: 0.5,
  wfhMonthly: 2,
  wfhFirstMonth: 0,
  wfhQuarterly: 6,
  maxEL: 5,
  maxWFH: 5,
  maxCombined: 8,
  extendedPerQuarter: 1,
  weeklyOffs: [0],
  departmentWeeklyOffs: {},
  earlyGoingPenalty: 0,
  approvalMode: "MANAGER_OR_HR",
};
const istDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
export const todayIST = (now = new Date()) => istDateFormatter.format(now);
export const dateKey = (value) => {
  const key = String(value || "").slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
    !Number.isFinite(Date.parse(key)) ||
    new Date(key).toISOString().slice(0, 10) !== key
  )
    throw new Error("Invalid date");
  return key;
};
export const addDays = (date, amount) =>
  new Date(Date.parse(dateKey(date)) + amount * 86400000)
    .toISOString()
    .slice(0, 10);
export const daysBetween = (from, to) => {
  from = dateKey(from);
  to = dateKey(to);
  const n = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (n < 0 || n > 366)
    throw new Error("Date range must be ordered and at most 367 days");
  return Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
};
export const monthDates = (month) => {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month");
  const first = dateKey(`${month}-01`);
  const next = new Date(first);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return daysBetween(first, addDays(next.toISOString().slice(0, 10), -1));
};
export const quarter = (date) => {
  const [y, m] = dateKey(date).split("-").map(Number);
  return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}`;
};
export const minutes = (time) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || ""))
    throw new Error("Time must be HH:mm");
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
};
export const isOff = (date, employee, policy, holidays) => {
  const holiday = holidays.find(
    (h) =>
      h.date === date &&
      (!h.department || h.department === employee.department) &&
      (!h.location || h.location === employee.branch),
  );
  if (holiday) return "Holiday";
  const weekly =
    policy.departmentWeeklyOffs?.[employee.department] || policy.weeklyOffs;
  return weekly.includes(new Date(`${date}T12:00:00Z`).getUTCDay())
    ? "Week Off"
    : "";
};
export const deriveAttendance = (row, policy, lateNumber, now = new Date()) => {
  const result = { ...row, late: false, lateNumber: 0, earlyGoingMinutes: 0 };
  if (!row.checkIn) return { ...result, status: "Pending", payable: null };
  const checkIn = minutes(row.checkIn);
  result.late = !row.excusedLate && checkIn > minutes(policy.graceUntil);
  result.lateNumber = result.late ? lateNumber : 0;
  const deadline = new Date(`${row.date}T${policy.checkout}:00+05:30`);
  const checkout =
    row.checkOutSource === "HR_MANUAL"
      ? row.checkOut
      : now >= deadline
        ? policy.checkout
        : "";
  if (checkout && minutes(checkout) < checkIn)
    throw new Error("Checkout cannot precede check-in");
  result.checkOut = checkout;
  result.checkOutSource = checkout
    ? row.checkOutSource === "HR_MANUAL"
      ? "HR_MANUAL"
      : "AUTO"
    : "";
  result.earlyGoingMinutes = checkout
    ? Math.max(0, minutes(policy.earlyGoingReference) - minutes(checkout))
    : 0;
  const half =
    !row.excusedHalfDay &&
    (checkIn > minutes(policy.halfDayAfter) ||
      (result.late && lateNumber > policy.allowedLates));
  return {
    ...result,
    status: half ? "Half Day" : result.late ? "Late" : "Present",
    payable: half ? 0.5 : 1,
  };
};
export const eligibleCredit = (employee, month, kind) => {
  if (!employee.dateOfJoining || employee.eligible === false) return false;
  const joined = String(employee.dateOfJoining).slice(0, 10);
  if (
    employee.exitDate &&
    String(employee.exitDate).slice(0, 10) < `${month}-01`
  )
    return false;
  if (kind === "WFH") return joined.slice(0, 7) < month;
  if (kind === "ML" && employee.gender !== "Female") return false;
  return joined <= `${month}-01`;
};

export const monthlyCredit = (
  employee,
  month,
  kind,
  policy = DEFAULT_POLICY,
) => {
  if (!employee.dateOfJoining || employee.eligible === false)
    return { amount: 0, date: `${month}-01` };
  const joined = String(employee.dateOfJoining).slice(0, 10),
    first = `${month}-01`;
  if (
    joined.slice(0, 7) > month ||
    (employee.exitDate && employee.exitDate < first)
  )
    return { amount: 0, date: first };
  const firstMonth = joined.slice(0, 7) === month;
  let amount =
    kind === "EL"
      ? policy.elMonthly
      : kind === "WFH"
        ? policy.wfhMonthly
        : policy.mlMonthly;
  if (firstMonth && kind === "EL" && joined > first)
    amount = policy.elFirstPartialMonth;
  if (firstMonth && kind === "WFH") amount = policy.wfhFirstMonth;
  if (firstMonth && kind === "ML") amount = policy.mlFirstMonth;
  if (kind === "ML" && employee.gender !== "Female") amount = 0;
  return { amount, date: firstMonth ? joined : first };
};
