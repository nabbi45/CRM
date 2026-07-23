import { ServiceModel } from "../models/ServiceModel.js";

export const GST_RATE = 18;
export const GST_MULTIPLIER = 1 + GST_RATE / 100;
export const TERM_KEYS = Array.from({ length: 10 }, (_, index) => `term_${index + 1}`);
export const ADMIN_ROLES = ["admin", "senior admin", "super admin", "director", "dev", "srdev", "sr dev"];

export const normalizeRole = (role = "") => String(role || "").trim().toLowerCase();

export const isAdminRole = (role = "") => ADMIN_ROLES.includes(normalizeRole(role));

export const isCashPayment = (paymentMode = "") =>
  String(paymentMode || "").trim().toLowerCase() === "cash";

export const roundMoney = (amount) =>
  Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;

export const isGstIncludedBooking = (paymentMode = "") => !isCashPayment(paymentMode);

export const amountExcludingGst = (amount, gstIncluded = true) => {
  const numericAmount = Number(amount || 0);
  if (!numericAmount) return 0;
  return gstIncluded ? roundMoney(numericAmount / GST_MULTIPLIER) : roundMoney(numericAmount);
};

export const gstComponent = (amount, gstIncluded = true) =>
  gstIncluded ? roundMoney(Number(amount || 0) - amountExcludingGst(amount, true)) : 0;

export const buildGstMetadata = (booking = {}) => {
  const gstIncluded = isGstIncludedBooking(booking.bank);
  const amounts = TERM_KEYS.reduce((acc, termKey) => {
    acc[termKey] = Number(booking[termKey] || 0);
    return acc;
  }, {
    total_amount: Number(booking.total_amount || 0),
  });

  return {
    gst_included: gstIncluded,
    gst_applied: gstIncluded,
    gst_rate: gstIncluded ? GST_RATE : 0,
    total_amount_before_gst: amountExcludingGst(amounts.total_amount, gstIncluded),
    gst_amount: gstComponent(amounts.total_amount, gstIncluded),
    gst_excluded_amounts: Object.entries(amounts).reduce((acc, [key, value]) => {
      acc[key] = amountExcludingGst(value, gstIncluded);
      return acc;
    }, {}),
  };
};

export const sanitizeRefundable = ({
  is_refundable,
  refundable_percentage,
  is_approval_refundable,
  approval_refundable_percentage,
} = {}) => {
  const disbursementEnabled = Boolean(is_refundable);
  const approvalEnabled = !disbursementEnabled && Boolean(is_approval_refundable);
  const disbursementPercentage = disbursementEnabled
    ? Math.min(Math.max(Number(refundable_percentage || 0), 0), 100)
    : 0;
  const approvalPercentage = approvalEnabled
    ? Math.min(Math.max(Number(approval_refundable_percentage || 0), 0), 100)
    : 0;

  return {
    is_refundable: disbursementEnabled && disbursementPercentage > 0,
    refundable_percentage: disbursementEnabled ? disbursementPercentage : 0,
    is_approval_refundable: approvalEnabled && approvalPercentage > 0,
    approval_refundable_percentage: approvalEnabled ? approvalPercentage : 0,
  };
};

export const snapshotServiceDeductions = async (services = []) => {
  if (!Array.isArray(services) || !services.length) return [];

  const serviceDocs = await ServiceModel.find({
    name: { $in: services.map((service) => new RegExp(`^${String(service).trim()}$`, "i")) },
  }).lean();

  const deductionByName = new Map(
    serviceDocs.map((service) => [String(service.name || "").trim().toLowerCase(), Number(service.deduction || 0)])
  );

  return services
    .map((service) => {
      const serviceName = String(service || "").trim();
      return {
        service_name: serviceName,
        deduction: roundMoney(deductionByName.get(serviceName.toLowerCase()) || 0),
      };
    })
    .filter((item) => item.service_name && item.deduction > 0);
};

export const prepareBookingFinancials = async (booking = {}, { snapshotDeductions = true } = {}) => {
  const gstMetadata = buildGstMetadata(booking);
  const refundable = sanitizeRefundable(booking);
  const service_deductions_snapshot = snapshotDeductions
    ? await snapshotServiceDeductions(booking.services || [])
    : booking.service_deductions_snapshot || [];

  return {
    ...gstMetadata,
    ...refundable,
    service_deductions_snapshot,
  };
};

export const getTermShare = (booking = {}, termKey = "term_1") =>
  booking.term_shares?.[termKey] || {
    creator: { user_id: booking.user_id, user_name: booking.bdm },
    payment_date: booking.payment_date,
    payment_mode: booking.bank,
    shared_with: termKey === "term_1" ? (booking.shared_with || []) : [],
  };

export const getFirstPaidTermKey = (booking = {}) =>
  TERM_KEYS.find((termKey) => Number(booking[termKey] || 0) > 0) || "term_1";

export const collectAffectedUserIds = (booking = {}) => {
  const ids = new Set();
  if (booking.user_id) ids.add(String(booking.user_id));
  (booking.shared_with || []).forEach((shared) => {
    if (shared?.user_id) ids.add(String(shared.user_id));
  });
  TERM_KEYS.forEach((termKey) => {
    const termShare = getTermShare(booking, termKey);
    if (termShare?.creator?.user_id) ids.add(String(termShare.creator.user_id));
    (termShare?.shared_with || []).forEach((shared) => {
      if (shared?.user_id) ids.add(String(shared.user_id));
    });
  });
  return [...ids];
};
