import {
  addBookingRevenueToLeaderboard,
  buildServiceDeductionMap,
  getBookingDeductionRowsForUser,
  getBookingDeductionRowsForStats,
  getBookingRevenueForUser,
  getBookingRevenueRowsForUser,
} from "./bookingRevenue.js";

const TERM_KEYS = Array.from({ length: 10 }, (_, index) => `term_${index + 1}`);
// Business-month grouping must not depend on the Render machine's timezone.
const calendarDate = (date) => new Date(date.getTime() + 330 * 60000);
const monthKeyFor = (date) => calendarDate(date).toISOString().slice(0, 7);

const parseDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateKey = (value) => {
  const date = parseDateValue(value);
  return date ? date.toISOString().split("T")[0] : "";
};

export function buildDashboardSummary({
  bookings,
  allCompanyBookings = bookings,
  users = [],
  services = [],
  totalUsers = 0,
  session,
  isAdmin,
  now = new Date(),
}) {
  const result = { totalUsers };
  const serviceDeductionMap = buildServiceDeductionMap(services);
  const serviceDeductionCatalogRows = services
    .map((service) => ({
      id: service._id || service.name,
      service: service.name || service.value || "SERVICE",
      deduction: Number(service.deduction || 0),
      status: service.status,
    }))
    .sort(
      (a, b) => b.deduction - a.deduction || a.service.localeCompare(b.service),
    );
  const activeUsersMap = Object.fromEntries(
    users.map((u) => [String(u._id), u.name]),
  );
  const userDirectoryByName = Object.fromEntries(
    users.map((u) => [
      (u.name || "").trim().toUpperCase(),
      {
        name: u.name,
        role: u.user_role,
        profilePicture: u.profilePicture || "",
      },
    ]),
  );
  const today = now.toISOString().split("T")[0];

  const currentMonth = calendarDate(now).getUTCMonth();
  const currentYear = calendarDate(now).getUTCFullYear();
  const threeMonthsAgo = calendarDate(now);
  threeMonthsAgo.setUTCMonth(threeMonthsAgo.getUTCMonth() - 3);
  threeMonthsAgo.setUTCHours(0, 0, 0, 0);

  let bookingCount = 0;
  let bookingCountThisMonth = 0;
  let currentMonthRevenue = 0;
  let todayRevenueAmt = 0;
  const sortedBookings = [];
  const bdmRevMap = {};
  const monthlyMap = {};
  const serviceSoldMap = {};
  const serviceRevenueMap = {};
  const currentMonthDeductions = [];

  const getTransactionDate = (entry = {}) => {
    const candidates = [
      entry?.payment_date,
      entry?.refund_date,
      entry?.created_at,
      entry?.date,
      entry?.createdAt,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const date = new Date(candidate);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return null;
  };

  const isCurrentMonthTerm = (termShare) => {
    const termDate = getTransactionDate(termShare);
    if (!termDate) return false;
    return (
      !Number.isNaN(termDate.getTime()) &&
      calendarDate(termDate).getUTCMonth() === currentMonth &&
      calendarDate(termDate).getUTCFullYear() === currentYear
    );
  };

  const isTodayTerm = (termShare) => {
    const termDate = getTransactionDate(termShare);
    return termDate ? getDateKey(termDate) === today : false;
  };

  for (const booking of bookings) {
    bookingCount += 1;

    const currentMonthParticipationRows = getBookingRevenueRowsForUser(
      booking,
      session.user_id,
      isAdmin,
      (termShare, termKey) =>
        termKey !== "refund" && isCurrentMonthTerm(termShare),
    );
    if (currentMonthParticipationRows.length > 0) {
      bookingCountThisMonth += 1;
    }

    const revenueForAccess = getBookingRevenueForUser(
      booking,
      session.user_id,
      isAdmin,
      () => true,
      serviceDeductionMap,
    );
    const currentMonthRev = isAdmin
      ? getBookingRevenueForUser(
          booking,
          session.user_id,
          true,
          isCurrentMonthTerm,
          serviceDeductionMap,
        )
      : getBookingRevenueForUser(
          booking,
          session.user_id,
          false,
          isCurrentMonthTerm,
          serviceDeductionMap,
        );

    currentMonthRevenue += currentMonthRev;

    todayRevenueAmt += isAdmin
      ? getBookingRevenueForUser(
          booking,
          session.user_id,
          true,
          isTodayTerm,
          serviceDeductionMap,
        )
      : getBookingRevenueForUser(
          booking,
          session.user_id,
          false,
          isTodayTerm,
          serviceDeductionMap,
        );

    addBookingRevenueToLeaderboard(
      booking,
      bdmRevMap,
      activeUsersMap,
      isCurrentMonthTerm,
      serviceDeductionMap,
    );

    currentMonthDeductions.push(
      ...(isAdmin
        ? getBookingDeductionRowsForStats(
            booking,
            isCurrentMonthTerm,
            activeUsersMap,
          )
        : getBookingDeductionRowsForUser(
            booking,
            session.user_id,
            false,
            isCurrentMonthTerm,
            serviceDeductionMap,
            activeUsersMap,
          )),
    );

    const paymentDate = new Date(
      booking.payment_date || booking.date || booking.createdAt,
    );
    if (
      !Number.isNaN(paymentDate.getTime()) &&
      calendarDate(paymentDate) >= threeMonthsAgo
    ) {
      const services = Array.isArray(booking.services)
        ? booking.services.filter(
            (service) => typeof service === "string" && service.trim(),
          )
        : [];

      if (services.length > 0) {
        const splitBaseRevenue = Math.max(
          0,
          isAdmin
            ? getBookingRevenueForUser(
                booking,
                session.user_id,
                true,
                () => true,
                serviceDeductionMap,
              )
            : revenueForAccess,
        );
        const splitRevenue = splitBaseRevenue / services.length;

        services.forEach((serviceNameRaw) => {
          const serviceName = serviceNameRaw.trim();
          serviceSoldMap[serviceName] = (serviceSoldMap[serviceName] || 0) + 1;
          serviceRevenueMap[serviceName] =
            (serviceRevenueMap[serviceName] || 0) + splitRevenue;
        });
      }
    }

    TERM_KEYS.forEach((termKey) => {
      const termAmount = getBookingRevenueForUser(
        booking,
        session.user_id,
        isAdmin,
        (_, key) => key === termKey,
        serviceDeductionMap,
      );
      if (!termAmount) return;

      const termDate = new Date(
        booking.term_shares?.[termKey]?.payment_date ||
          booking.payment_date ||
          booking.date ||
          booking.createdAt,
      );
      if (Number.isNaN(termDate.getTime())) return;

      const monthKey = monthKeyFor(termDate);
      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = 0;
      monthlyMap[monthKey] += termAmount;
    });

    (booking.refund_adjustments || []).forEach((refund) => {
      const refundDate = new Date(refund.refund_date || refund.created_at);
      if (Number.isNaN(refundDate.getTime())) return;
      const monthKey = monthKeyFor(refundDate);
      if (!monthlyMap[monthKey]) monthlyMap[monthKey] = 0;
      monthlyMap[monthKey] += getBookingRevenueForUser(
        booking,
        session.user_id,
        isAdmin,
        (_, termKey) => termKey === "refund",
        serviceDeductionMap,
      );
    });

    sortedBookings.push(booking);
  }

  const board = Object.entries(bdmRevMap)
    .map(([name, data]) => {
      const profile =
        userDirectoryByName[(name || "").trim().toUpperCase()] || {};
      return {
        name,
        ...data,
        profilePicture: profile.profilePicture || "",
        role: profile.role || "",
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
  result.leaderboard = board;

  const monthBuckets = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(currentYear, currentMonth - i, 1));
    const monthKey = date.toISOString().slice(0, 7);
    monthBuckets.push({
      label: date.toLocaleString("default", {
        month: "short",
        timeZone: "UTC",
      }),
      value: monthlyMap[monthKey] || 0,
    });
  }
  result.monthlyRevData = {
    labels: monthBuckets.map((month) => month.label),
    values: monthBuckets.map((month) => month.value),
  };

  if (!isAdmin) {
    const companySoldMap = {};
    const companyRevenueMap = {};

    for (const booking of allCompanyBookings) {
      const paymentDate = new Date(
        booking.payment_date || booking.date || booking.createdAt,
      );
      if (
        Number.isNaN(paymentDate.getTime()) ||
        calendarDate(paymentDate) < threeMonthsAgo
      )
        continue;

      const services = Array.isArray(booking.services)
        ? booking.services.filter(
            (service) => typeof service === "string" && service.trim(),
          )
        : [];
      if (!services.length) continue;

      const revenue = Math.max(
        0,
        getBookingRevenueForUser(
          booking,
          session.user_id,
          true,
          () => true,
          serviceDeductionMap,
        ),
      );
      const splitRevenue = revenue / services.length;

      services.forEach((serviceNameRaw) => {
        const serviceName = serviceNameRaw.trim();
        companySoldMap[serviceName] = (companySoldMap[serviceName] || 0) + 1;
        companyRevenueMap[serviceName] =
          (companyRevenueMap[serviceName] || 0) + splitRevenue;
      });
    }

    const personalSoldEntries = Object.entries(serviceSoldMap).sort(
      (a, b) => b[1] - a[1],
    );
    const personalRevenueEntries = Object.entries(companySoldMap).sort(
      (a, b) => b[1] - a[1],
    );
    const personalSoldTop = personalSoldEntries[0] || ["-", 0];
    const personalRevenueTop = personalRevenueEntries[0] || ["-", 0];
    result.personalMostSoldService = {
      name: personalSoldTop[0],
      count: personalSoldTop[1],
    };
    result.personalMostRevenueService = {
      name: personalRevenueTop[0],
      revenue: Number(personalRevenueTop[1] || 0),
    };

    Object.keys(serviceSoldMap).forEach((key) => delete serviceSoldMap[key]);
    Object.assign(serviceSoldMap, companySoldMap);
    Object.keys(serviceRevenueMap).forEach(
      (key) => delete serviceRevenueMap[key],
    );
    Object.assign(serviceRevenueMap, companyRevenueMap);
  } else {
    result.personalMostSoldService = { name: "-", count: 0 };
    result.personalMostRevenueService = { name: "-", revenue: 0 };
  }

  const soldEntries = Object.entries(serviceSoldMap).sort(
    (a, b) => b[1] - a[1],
  );
  const activityEntries = Object.entries(serviceSoldMap).sort(
    (a, b) => b[1] - a[1],
  );

  const soldTop = soldEntries[0] || ["-", 0];
  const activityTop = activityEntries[0] || ["-", 0];

  result.mostSoldService = { name: soldTop[0], count: soldTop[1] };
  result.mostRevenueService = {
    name: activityTop[0],
    revenue: Number(activityTop[1] || 0),
  };

  result.serviceSoldData = {
    labels: soldEntries.slice(0, 6).map(([service]) => service),
    values: soldEntries.slice(0, 6).map(([, count]) => count),
  };

  result.serviceRevenueData = {
    labels: activityEntries.slice(0, 6).map(([service]) => service),
    values: activityEntries.slice(0, 6).map(([, count]) => Math.round(count)),
  };

  result.serviceDeductionCatalog = serviceDeductionCatalogRows;
  const serviceDeductionRows = currentMonthDeductions.filter(
    (row) => row.type === "Service Deduction",
  );
  const manualRefundRows = currentMonthDeductions.filter(
    (row) => row.type === "Manual Refund Adjustment",
  );
  const refundableDeductionRows = currentMonthDeductions.filter(
    (row) => row.type === "Refundable Clause Deduction",
  );
  result.deductionTransactions = serviceDeductionRows;
  result.manualRefundTransactions = manualRefundRows;
  result.refundableTransactions = refundableDeductionRows;
  result.totalServiceDeductions = serviceDeductionRows.reduce(
    (sum, row) => sum + Number(row.deduction || 0),
    0,
  );
  result.totalManualRefunds = manualRefundRows.reduce(
    (sum, row) => sum + Number(row.deduction || 0),
    0,
  );
  result.totalRefundableCuts = refundableDeductionRows.reduce(
    (sum, row) => sum + Number(row.deduction || 0),
    0,
  );

  const recent = sortedBookings
    .sort(
      (a, b) =>
        new Date(b.createdAt || b.date || 0) -
        new Date(a.createdAt || a.date || 0),
    )
    .slice(0, 6);

  result.totalBookings = bookingCount;
  result.totalRevenue = currentMonthRevenue;
  result.todayRevenue = todayRevenueAmt;
  result.bookingsThisMonth = bookingCountThisMonth;
  result.recentBookings = recent;
  return result;
}
