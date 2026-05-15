const termKeys = ["term_1", "term_2", "term_3"];

const getTermShare = (booking, termKey) => {
  const termShare = booking?.term_shares?.[termKey];
  if (termShare?.creator?.user_id) return termShare;

  if (termKey === "term_1") {
    return {
      creator: {
        user_id: booking?.user_id,
        user_name: booking?.bdm,
      },
      payment_date: booking?.payment_date || booking?.date || booking?.createdAt,
      shared_with: Array.isArray(booking?.shared_with) ? booking.shared_with : [],
    };
  }

  return {
    creator: {
      user_id: booking?.user_id,
      user_name: booking?.bdm,
    },
    payment_date: booking?.payment_date || booking?.date || booking?.createdAt,
    shared_with: [],
  };
};

const normalizeServiceName = (serviceName) => String(serviceName || "").trim().toLowerCase();

export const buildServiceDeductionMap = (services = []) => {
  return services.reduce((map, service) => {
    const name = normalizeServiceName(service?.name || service?.value);
    if (!name) return map;
    map[name] = Number(service?.deduction || 0);
    return map;
  }, {});
};

export const getBookingServiceDeductions = (booking, serviceDeductionMap = {}) => {
  const services = Array.isArray(booking?.services) ? booking.services : [];
  return services
    .map((serviceNameRaw) => {
      const service = String(serviceNameRaw || "").trim();
      const amount = Number(serviceDeductionMap[normalizeServiceName(service)] || 0);
      return amount > 0 ? { service, amount } : null;
    })
    .filter(Boolean);
};

const getDeductionTermKey = (booking) => {
  return termKeys.find((termKey) => Number(booking?.[termKey] || 0) > 0) || "term_1";
};

const getParticipantShare = (booking, termKey, userId, isAdmin = false) => {
  if (isAdmin) return 1;

  const termShare = getTermShare(booking, termKey);
  const sharedWith = Array.isArray(termShare.shared_with) ? termShare.shared_with : [];
  const sharedTotal = sharedWith.reduce((total, sw) => total + Number(sw.percentage || 0), 0);

  if (String(termShare.creator?.user_id || "") === String(userId || "")) {
    return Math.max(0, (100 - sharedTotal) / 100);
  }

  const sharedUser = sharedWith.find((sw) => String(sw.user_id) === String(userId || ""));
  return sharedUser ? Number(sharedUser.percentage || 0) / 100 : 0;
};

export const getBookingDeductionForUser = (
  booking,
  userId,
  isAdmin = false,
  includeTerm = () => true,
  serviceDeductionMap = {}
) => {
  const deductionTermKey = getDeductionTermKey(booking);
  const termShare = getTermShare(booking, deductionTermKey);
  if (!includeTerm(termShare, deductionTermKey)) return 0;

  const totalDeduction = getBookingServiceDeductions(booking, serviceDeductionMap)
    .reduce((sum, item) => sum + item.amount, 0);
  if (!totalDeduction) return 0;

  return totalDeduction * getParticipantShare(booking, deductionTermKey, userId, isAdmin);
};

export const getBookingDeductionRowsForUser = (
  booking,
  userId,
  isAdmin = false,
  includeTerm = () => true,
  serviceDeductionMap = {},
  usersMap = {}
) => {
  const deductionTermKey = getDeductionTermKey(booking);
  const termShare = getTermShare(booking, deductionTermKey);
  if (!includeTerm(termShare, deductionTermKey)) return [];

  const share = getParticipantShare(booking, deductionTermKey, userId, isAdmin);
  if (!share) return [];

  return getBookingServiceDeductions(booking, serviceDeductionMap).map((item) => ({
    bookingId: booking?._id,
    bookingName: booking?.contact_person || booking?.company_name || "N/A",
    clientName: booking?.contact_person || "N/A",
    companyName: booking?.company_name || "N/A",
    service: item.service,
    totalDeduction: item.amount,
    deduction: item.amount * share,
    employeeName: isAdmin
      ? "COMPANY"
      : termShare.creator?.user_name || usersMap[termShare.creator?.user_id] || booking?.bdm || "UNKNOWN",
    date: termShare?.payment_date || booking?.payment_date || booking?.date || booking?.createdAt,
  }));
};

export const getBookingRevenueForUser = (
  booking,
  userId,
  isAdmin = false,
  includeTerm = () => true,
  serviceDeductionMap = {}
) => {
  return termKeys.reduce((sum, termKey) => {
    const amount = Number(booking?.[termKey] || 0);
    if (!amount) return sum;
    const termShare = getTermShare(booking, termKey);
    if (!includeTerm(termShare, termKey)) return sum;
    if (isAdmin) return sum + amount;

    const sharedWith = Array.isArray(termShare.shared_with) ? termShare.shared_with : [];
    const sharedTotal = sharedWith.reduce((total, sw) => total + Number(sw.percentage || 0), 0);

    if (String(termShare.creator?.user_id || "") === String(userId || "")) {
      return sum + amount * ((100 - sharedTotal) / 100);
    }

    const sharedUser = sharedWith.find((sw) => String(sw.user_id) === String(userId || ""));
    if (sharedUser) return sum + amount * (Number(sharedUser.percentage || 0) / 100);

    return sum;
  }, 0) - getBookingDeductionForUser(booking, userId, isAdmin, includeTerm, serviceDeductionMap);
};

export const addBookingRevenueToLeaderboard = (
  booking,
  board,
  usersMap = {},
  includeTerm = () => true,
  serviceDeductionMap = {}
) => {
  const deductionTermKey = getDeductionTermKey(booking);
  const totalDeduction = getBookingServiceDeductions(booking, serviceDeductionMap)
    .reduce((sum, item) => sum + item.amount, 0);

  termKeys.forEach((termKey) => {
    const amount = Number(booking?.[termKey] || 0);
    if (!amount) return;

    const termShare = getTermShare(booking, termKey);
    if (!includeTerm(termShare, termKey)) return;
    const sharedWith = Array.isArray(termShare.shared_with) ? termShare.shared_with : [];
    let sharedGrossAmount = 0;

    sharedWith.forEach((sw) => {
      const percentage = Number(sw.percentage || 0);
      const deductionShare = termKey === deductionTermKey ? totalDeduction * (percentage / 100) : 0;
      const sharedGross = amount * (percentage / 100);
      const sharedAmount = sharedGross - deductionShare;
      sharedGrossAmount += sharedGross;
      const name = sw.user_name || usersMap[sw.user_id] || "COWORKER";
      if (!board[name]) board[name] = { revenue: 0, count: 0, deduction: 0 };
      board[name].revenue += sharedAmount;
      board[name].deduction += deductionShare;
      board[name].count += 1;
    });

    const creatorName = termShare.creator?.user_name || usersMap[termShare.creator?.user_id] || booking?.bdm || "UNKNOWN";
    const sharedTotalPercentage = sharedWith.reduce((total, sw) => total + Number(sw.percentage || 0), 0);
    const creatorDeduction = termKey === deductionTermKey ? totalDeduction * ((100 - sharedTotalPercentage) / 100) : 0;
    if (!board[creatorName]) board[creatorName] = { revenue: 0, count: 0, deduction: 0 };
    board[creatorName].revenue += amount - sharedGrossAmount - creatorDeduction;
    board[creatorName].deduction += creatorDeduction;
    board[creatorName].count += 1;
  });
};
