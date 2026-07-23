const termKeys = Array.from({ length: 10 }, (_, index) => `term_${index + 1}`);
const GST_MULTIPLIER = 1.18;

const roundMoney = (amount) => Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;

const isCashPayment = (paymentMode = "") => String(paymentMode || "").trim().toLowerCase() === "cash";

const isGstIncluded = (booking = {}) => {
  if (typeof booking.gst_included === "boolean") return booking.gst_included;
  if (typeof booking.gst_applied === "boolean") return booking.gst_applied;
  return !isCashPayment(booking.bank);
};

const amountExcludingGst = (booking, amount) => {
  const numericAmount = Number(amount || 0);
  if (!numericAmount) return 0;
  return isGstIncluded(booking) ? roundMoney(numericAmount / GST_MULTIPLIER) : numericAmount;
};

const getRefundAmountExcludingGst = (booking = {}, refund = {}) => {
  const rawAmount = Number(refund.amount || 0);
  const storedExcludingGst = Number(refund.amount_excluding_gst || 0);
  const storedGst = Number(refund.gst_amount || 0);

  if (!rawAmount) return 0;
  if (!isGstIncluded(booking)) return rawAmount;
  if (storedExcludingGst > 0 && storedGst > 0) return storedExcludingGst;

  return amountExcludingGst(booking, rawAmount);
};

const normalizeSharedWith = (sharedWith = [], creatorUserId = "") =>
  (Array.isArray(sharedWith) ? sharedWith : []).filter((shared) => {
    const userId = String(shared?.user_id || "");
    const percentage = Number(shared?.percentage || 0);
    if (!userId || percentage <= 0) return false;
    if (creatorUserId && userId === String(creatorUserId)) return false;
    return true;
  });

const getTermShare = (booking, termKey) => {
  const termShare = booking?.term_shares?.[termKey];
  if (termShare?.creator?.user_id) {
    return {
      ...termShare,
      payment_date:
        termKey === "term_1"
          ? booking?.payment_date || termShare?.payment_date || booking?.date || booking?.createdAt
          : termShare?.payment_date || booking?.date || booking?.createdAt,
      payment_mode:
        termKey === "term_1"
          ? termShare?.payment_mode || booking?.bank || ""
          : termShare?.payment_mode || booking?.bank || "",
      shared_with: normalizeSharedWith(termShare?.shared_with, termShare?.creator?.user_id),
    };
  }

  return {
    creator: {
      user_id: booking?.user_id,
      user_name: booking?.bdm,
    },
    payment_date: booking?.payment_date || booking?.date || booking?.createdAt,
    payment_mode: booking?.bank || "",
    shared_with:
      termKey === "term_1"
        ? normalizeSharedWith(booking?.shared_with, booking?.user_id)
        : [],
  };
};

const getDeductionTermKey = (booking) =>
  termKeys.find((termKey) => Number(booking?.[termKey] || 0) > 0) || "term_1";

const getParticipantShare = (booking, termKey, userId, isAdmin = false) => {
  if (isAdmin) return 1;

  const termShare = getTermShare(booking, termKey);
  const sharedWith = normalizeSharedWith(termShare.shared_with, termShare.creator?.user_id);
  const sharedTotal = sharedWith.reduce((total, sw) => total + Number(sw.percentage || 0), 0);

  if (String(termShare.creator?.user_id || "") === String(userId || "")) {
    return Math.max(0, (100 - sharedTotal) / 100);
  }

  const sharedUser = sharedWith.find((sw) => String(sw.user_id) === String(userId || ""));
  return sharedUser ? Number(sharedUser.percentage || 0) / 100 : 0;
};

const getSnapshotServiceDeductions = (booking) =>
  Array.isArray(booking?.service_deductions_snapshot)
    ? booking.service_deductions_snapshot
        .map((item) => ({
          service: item.service_name || item.service || "SERVICE",
          amount: Number(item.deduction || item.amount || 0),
        }))
        .filter((item) => item.amount > 0)
    : [];

const getServiceDeductionTotal = (booking) =>
  getSnapshotServiceDeductions(booking).reduce((sum, item) => sum + Number(item.amount || 0), 0);

export const getRefundableMeta = (booking = {}) => {
  if (booking?.is_refundable && Number(booking?.refundable_percentage || 0) > 0) {
    return {
      type: "disbursement",
      label: "Disbursement Refundable",
      percentage: Number(booking.refundable_percentage || 0),
      autoDeduct: true,
    };
  }

  if (booking?.is_approval_refundable && Number(booking?.approval_refundable_percentage || 0) > 0) {
    return {
      type: "approval",
      label: "Approval Refundable",
      percentage: Number(booking.approval_refundable_percentage || 0),
      autoDeduct: false,
    };
  }

  return {
    type: "none",
    label: "",
    percentage: 0,
    autoDeduct: false,
  };
};

export const getBookingRefundableLabel = (booking = {}) => {
  const meta = getRefundableMeta(booking);
  if (meta.type === "none" || !meta.percentage) return "";
  return `${meta.label} ${meta.percentage}%`;
};

const getRefundableDeduction = (booking, grossTermAmount) => {
  const meta = getRefundableMeta(booking);
  if (!meta.autoDeduct) return 0;
  const pct = Number(meta.percentage || 0);
  if (!pct) return 0;
  return roundMoney(amountExcludingGst(booking, grossTermAmount) * (pct / 100));
};

const getTermNetBeforeSharing = (booking, termKey) => {
  const gross = Number(booking?.[termKey] || 0);
  if (!gross) return 0;
  let net = amountExcludingGst(booking, gross);
  net -= getRefundableDeduction(booking, gross);
  if (termKey === getDeductionTermKey(booking)) {
    net -= getServiceDeductionTotal(booking);
  }
  return roundMoney(Math.max(0, net));
};

const getRefundDistributionEntries = (booking = {}, includeTerm = () => true) => {
  const entries = [];
  let totalBase = 0;

  termKeys.forEach((termKey) => {
    const amount = Number(booking?.[termKey] || 0);
    if (!amount) return;
    const termShare = getTermShare(booking, termKey);
    if (!includeTerm(termShare, termKey)) return;
    const baseAmount = amountExcludingGst(booking, amount);
    if (!baseAmount) return;

    const sharedWith = normalizeSharedWith(termShare.shared_with, termShare.creator?.user_id);
    const sharedTotal = sharedWith.reduce((total, sw) => total + Number(sw.percentage || 0), 0);

    const creatorBase = roundMoney(baseAmount * Math.max(0, (100 - sharedTotal) / 100));
    if (creatorBase > 0) {
      entries.push({
        userId: String(termShare.creator?.user_id || booking?.user_id || ""),
        userName: termShare.creator?.user_name || booking?.bdm || "UNKNOWN",
        amount: creatorBase,
        termKey,
        date: termShare?.payment_date || booking?.payment_date || booking?.date || booking?.createdAt,
      });
      totalBase += creatorBase;
    }

    sharedWith.forEach((sw) => {
      const sharedAmount = roundMoney(baseAmount * (Number(sw.percentage || 0) / 100));
      if (sharedAmount <= 0) return;
      entries.push({
        userId: String(sw.user_id || ""),
        userName: sw.user_name || "COWORKER",
        amount: sharedAmount,
        termKey,
        date: termShare?.payment_date || booking?.payment_date || booking?.date || booking?.createdAt,
      });
      totalBase += sharedAmount;
    });
  });

  return {
    entries,
    totalBase: roundMoney(totalBase),
  };
};

const getRefundShareAmountForUser = (booking, refundAmount, userId, isAdmin = false, includeTerm = () => true) => {
  if (isAdmin) return roundMoney(refundAmount);

  const { entries, totalBase } = getRefundDistributionEntries(booking, includeTerm);
  if (!entries.length || !totalBase) return 0;

  const userBase = entries
    .filter((entry) => String(entry.userId) === String(userId || ""))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  if (!userBase) return 0;
  return roundMoney((userBase / totalBase) * Number(refundAmount || 0));
};

const getParticipantEntriesForTerm = (booking, termKey, usersMap = {}) => {
  const termShare = getTermShare(booking, termKey);
  const amount = Number(booking?.[termKey] || 0);
  if (!amount) return [];

  const baseAmount = amountExcludingGst(booking, amount);
  if (!baseAmount) return [];

  const sharedWith = normalizeSharedWith(termShare.shared_with, termShare.creator?.user_id);
  const sharedTotal = sharedWith.reduce((total, sw) => total + Number(sw.percentage || 0), 0);
  const entries = [];

  const creatorShare = Math.max(0, (100 - sharedTotal) / 100);
  if (creatorShare > 0) {
    entries.push({
      userId: String(termShare.creator?.user_id || booking?.user_id || ""),
      userName: termShare.creator?.user_name || usersMap[termShare.creator?.user_id] || booking?.bdm || "UNKNOWN",
      share: creatorShare,
      date: termShare?.payment_date || booking?.payment_date || booking?.date || booking?.createdAt,
      termKey,
    });
  }

  sharedWith.forEach((sw) => {
    const share = Number(sw.percentage || 0) / 100;
    if (share <= 0) return;
    entries.push({
      userId: String(sw.user_id || ""),
      userName: sw.user_name || usersMap[sw.user_id] || "COWORKER",
      share,
      date: termShare?.payment_date || booking?.payment_date || booking?.date || booking?.createdAt,
      termKey,
    });
  });

  return entries;
};

export const buildServiceDeductionMap = () => ({});

export const getBookingServiceDeductions = (booking) => getSnapshotServiceDeductions(booking);

export const getBookingDeductionForUser = (
  booking,
  userId,
  isAdmin = false,
  includeTerm = () => true
) => {
  return getBookingDeductionRowsForUser(booking, userId, isAdmin, includeTerm)
    .reduce((sum, row) => sum + Number(row.deduction || 0), 0);
};

export const getBookingDeductionRowsForUser = (
  booking,
  userId,
  isAdmin = false,
  includeTerm = () => true,
  _serviceDeductionMap = {},
  usersMap = {}
) => {
  const rows = [];
  const deductionTermKey = getDeductionTermKey(booking);
  const serviceTermShare = getTermShare(booking, deductionTermKey);

  if (includeTerm(serviceTermShare, deductionTermKey)) {
    const share = getParticipantShare(booking, deductionTermKey, userId, isAdmin);
    if (share) {
      getSnapshotServiceDeductions(booking).forEach((item) => {
        rows.push({
          type: "Service Deduction",
          bookingId: booking?._id,
          bookingName: booking?.contact_person || booking?.company_name || "N/A",
          clientName: booking?.contact_person || "N/A",
          companyName: booking?.company_name || "N/A",
          service: item.service,
          totalDeduction: item.amount,
          deduction: roundMoney(item.amount * share),
          employeeName: serviceTermShare.creator?.user_name || usersMap[serviceTermShare.creator?.user_id] || booking?.bdm || "UNKNOWN",
          date: serviceTermShare?.payment_date || booking?.payment_date || booking?.date || booking?.createdAt,
        });
      });
    }
  }

  termKeys.forEach((termKey) => {
    const amount = Number(booking?.[termKey] || 0);
    if (!amount) return;
    const termShare = getTermShare(booking, termKey);
    if (!includeTerm(termShare, termKey)) return;
    const share = getParticipantShare(booking, termKey, userId, isAdmin);
    const refundableDeduction = getRefundableDeduction(booking, amount);
    if (!share || !refundableDeduction) return;
    rows.push({
      type: "Refundable Clause Deduction",
      bookingId: booking?._id,
      bookingName: booking?.contact_person || booking?.company_name || "N/A",
      clientName: booking?.contact_person || "N/A",
      companyName: booking?.company_name || "N/A",
      service: `${getRefundableMeta(booking).label} ${Number(getRefundableMeta(booking).percentage || 0)}%`,
      totalDeduction: refundableDeduction,
      deduction: roundMoney(refundableDeduction * share),
      employeeName: termShare.creator?.user_name || usersMap[termShare.creator?.user_id] || booking?.bdm || "UNKNOWN",
      date: termShare?.payment_date || booking?.payment_date || booking?.date || booking?.createdAt,
    });
  });

  (booking?.refund_adjustments || []).forEach((refund) => {
    const pseudoTerm = { payment_date: refund.refund_date || refund.created_at };
    if (!includeTerm(pseudoTerm, "refund")) return;
    const totalRefund = getRefundAmountExcludingGst(booking, refund);
    const userRefundShare = getRefundShareAmountForUser(booking, totalRefund, userId, isAdmin, () => true);
    if (!userRefundShare) return;
    const refundableMeta = getRefundableMeta(booking);
    rows.push({
      type: "Manual Refund Adjustment",
      bookingId: booking?._id,
      bookingName: booking?.contact_person || booking?.company_name || "N/A",
      clientName: booking?.contact_person || "N/A",
      companyName: booking?.company_name || "N/A",
      service:
        refundableMeta.type === "disbursement"
          ? "Manual Refund - Disbursement Refundable Booking"
          : refundableMeta.type === "approval"
            ? "Manual Refund - Approval Refundable Booking"
            : "Manual Refund - Standard Booking",
      totalDeduction: totalRefund,
      deduction: userRefundShare,
      employeeName: booking?.bdm || "UNKNOWN",
      date: refund.refund_date || refund.created_at,
    });
  });

  return rows;
};

export const getBookingDeductionRowsForStats = (
  booking,
  includeTerm = () => true,
  usersMap = {}
) => {
  const rows = [];
  const deductionTermKey = getDeductionTermKey(booking);
  const serviceTermShare = getTermShare(booking, deductionTermKey);

  if (includeTerm(serviceTermShare, deductionTermKey)) {
    const participantEntries = getParticipantEntriesForTerm(booking, deductionTermKey, usersMap);
    getSnapshotServiceDeductions(booking).forEach((item) => {
      participantEntries.forEach((entry) => {
        rows.push({
          type: "Service Deduction",
          bookingId: booking?._id,
          bookingName: booking?.contact_person || booking?.company_name || "N/A",
          clientName: booking?.contact_person || "N/A",
          companyName: booking?.company_name || "N/A",
          service: item.service,
          totalDeduction: item.amount,
          deduction: roundMoney(item.amount * entry.share),
          employeeName: entry.userName || "UNKNOWN",
          employeeId: entry.userId || "",
          date: entry.date,
        });
      });
    });
  }

  termKeys.forEach((termKey) => {
    const amount = Number(booking?.[termKey] || 0);
    if (!amount) return;
    const termShare = getTermShare(booking, termKey);
    if (!includeTerm(termShare, termKey)) return;
    const refundableDeduction = getRefundableDeduction(booking, amount);
    if (!refundableDeduction) return;

    getParticipantEntriesForTerm(booking, termKey, usersMap).forEach((entry) => {
      rows.push({
        type: "Refundable Clause Deduction",
        bookingId: booking?._id,
        bookingName: booking?.contact_person || booking?.company_name || "N/A",
        clientName: booking?.contact_person || "N/A",
        companyName: booking?.company_name || "N/A",
        service: `${getRefundableMeta(booking).label} ${Number(getRefundableMeta(booking).percentage || 0)}%`,
        totalDeduction: refundableDeduction,
        deduction: roundMoney(refundableDeduction * entry.share),
        employeeName: entry.userName || "UNKNOWN",
        employeeId: entry.userId || "",
        date: entry.date,
      });
    });
  });

  (booking?.refund_adjustments || []).forEach((refund) => {
    const pseudoTerm = { payment_date: refund.refund_date || refund.created_at };
    if (!includeTerm(pseudoTerm, "refund")) return;
    const refundAmount = getRefundAmountExcludingGst(booking, refund);
    const { entries, totalBase } = getRefundDistributionEntries(booking, () => true);
    if (!entries.length || !totalBase || !refundAmount) return;

    const aggregatedByUser = entries.reduce((acc, entry) => {
      const key = String(entry.userId || entry.userName || "");
      if (!acc[key]) {
        acc[key] = { userId: entry.userId, userName: entry.userName, amount: 0 };
      }
      acc[key].amount += Number(entry.amount || 0);
      return acc;
    }, {});

    Object.values(aggregatedByUser).forEach((entry) => {
      const refundableMeta = getRefundableMeta(booking);
      rows.push({
        type: "Manual Refund Adjustment",
        bookingId: booking?._id,
        bookingName: booking?.contact_person || booking?.company_name || "N/A",
        clientName: booking?.contact_person || "N/A",
        companyName: booking?.company_name || "N/A",
        service:
          refundableMeta.type === "disbursement"
            ? "Manual Refund - Disbursement Refundable Booking"
            : refundableMeta.type === "approval"
              ? "Manual Refund - Approval Refundable Booking"
              : "Manual Refund - Standard Booking",
        totalDeduction: refundAmount,
        deduction: roundMoney((Number(entry.amount || 0) / totalBase) * refundAmount),
        employeeName: entry.userName || "UNKNOWN",
        employeeId: entry.userId || "",
        date: refund.refund_date || refund.created_at,
      });
    });
  });

  return rows;
};

export const getBookingRevenueForUser = (
  booking,
  userId,
  isAdmin = false,
  includeTerm = () => true
) => {
  const termRevenue = termKeys.reduce((sum, termKey) => {
    const amount = Number(booking?.[termKey] || 0);
    if (!amount) return sum;
    const termShare = getTermShare(booking, termKey);
    if (!includeTerm(termShare, termKey)) return sum;
    return sum + getTermNetBeforeSharing(booking, termKey) * getParticipantShare(booking, termKey, userId, isAdmin);
  }, 0);

  const refundReversal = (booking?.refund_adjustments || []).reduce((sum, refund) => {
    const pseudoTerm = { payment_date: refund.refund_date || refund.created_at };
    if (!includeTerm(pseudoTerm, "refund")) return sum;
    const totalRefund = getRefundAmountExcludingGst(booking, refund);
    return sum + getRefundShareAmountForUser(booking, totalRefund, userId, isAdmin, () => true);
  }, 0);

  return roundMoney(termRevenue - refundReversal);
};

export const getBookingRevenueRowsForUser = (
  booking,
  userId,
  isAdmin = false,
  includeTerm = () => true
) => {
  const rows = [];

  termKeys.forEach((termKey) => {
    const amount = Number(booking?.[termKey] || 0);
    if (!amount) return;
    const termShare = getTermShare(booking, termKey);
    if (!includeTerm(termShare, termKey)) return;
    const participantShare = getParticipantShare(booking, termKey, userId, isAdmin);
    if (!participantShare) return;

    const termRevenue = roundMoney(getTermNetBeforeSharing(booking, termKey) * participantShare);
    if (!termRevenue) return;

    rows.push({
      type: "Revenue",
      bookingId: booking?._id,
      bookingName: booking?.contact_person || booking?.company_name || "N/A",
      clientName: booking?.contact_person || "N/A",
      companyName: booking?.company_name || "N/A",
      service: Array.isArray(booking?.services) ? booking.services.join(", ") : booking?.services || "-",
      amount: termRevenue,
      termKey,
      date: termShare?.payment_date || booking?.payment_date || booking?.date || booking?.createdAt,
      note: `Credited from ${String(termKey || "").replace("_", " ").toUpperCase()}`,
    });
  });

  return rows;
};

export const addBookingRevenueToLeaderboard = (
  booking,
  board,
  usersMap = {},
  includeTerm = () => true
) => {
  termKeys.forEach((termKey) => {
    const amount = Number(booking?.[termKey] || 0);
    if (!amount) return;
    const termShare = getTermShare(booking, termKey);
    if (!includeTerm(termShare, termKey)) return;
    const netAmount = getTermNetBeforeSharing(booking, termKey);
    const sharedWith = normalizeSharedWith(termShare.shared_with, termShare.creator?.user_id);

    sharedWith.forEach((sw) => {
      const name = sw.user_name || usersMap[sw.user_id] || "COWORKER";
      const revenue = netAmount * (Number(sw.percentage || 0) / 100);
      if (!board[name]) board[name] = { revenue: 0, count: 0, deduction: 0 };
      board[name].revenue += revenue;
      board[name].count += 1;
    });

    const creatorName = termShare.creator?.user_name || usersMap[termShare.creator?.user_id] || booking?.bdm || "UNKNOWN";
    const sharedTotalPercentage = sharedWith.reduce((total, sw) => total + Number(sw.percentage || 0), 0);
    if (!board[creatorName]) board[creatorName] = { revenue: 0, count: 0, deduction: 0 };
    board[creatorName].revenue += netAmount * Math.max(0, (100 - sharedTotalPercentage) / 100);
    board[creatorName].count += 1;
  });

  (booking?.refund_adjustments || []).forEach((refund) => {
    const pseudoTerm = { payment_date: refund.refund_date || refund.created_at };
    if (!includeTerm(pseudoTerm, "refund")) return;
    const refundAmount = getRefundAmountExcludingGst(booking, refund);
    const { entries, totalBase } = getRefundDistributionEntries(booking, () => true);
    if (!entries.length || !totalBase) return;
    const userTotals = {};
    entries.forEach((entry) => {
      const name = entry.userName || usersMap[entry.userId] || "UNKNOWN";
      userTotals[name] = (userTotals[name] || 0) + Number(entry.amount || 0);
    });
    Object.entries(userTotals).forEach(([name, baseAmount]) => {
      const reversal = roundMoney((baseAmount / totalBase) * refundAmount);
      if (!board[name]) board[name] = { revenue: 0, count: 0, deduction: 0 };
      board[name].revenue -= reversal;
      board[name].deduction += reversal;
    });
  });
};
