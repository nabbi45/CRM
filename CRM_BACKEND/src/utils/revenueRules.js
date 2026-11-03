import { ServiceModel } from "../models/ServiceModel.js";
import { termHasGst, FINANCIAL_VERSION } from '../../../CRM_FRONTEND/src/utils/bookingFinancials.js';

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
      acc[key] = amountExcludingGst(value, key === 'total_amount' ? gstIncluded : termHasGst(booking, key));
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

export const snapshotServiceDeductions = async (services = [], catalog = null) => {
  if (!Array.isArray(services) || !services.length) return [];

  // Catalog labels are literal text, including brackets, dots and plus signs.
  // Interpolating a label such as COMPANY (UTTAR PRADESH) into a regex silently
  // failed to match its parentheses, dropping the deduction on create and edit.
  const names = [...new Map(services.map((service) => String(service || '').trim())
    .filter(Boolean).map((name) => [name.toLowerCase(), name])).values()];
  const patterns = names.map((name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
  const serviceDocs = catalog || await ServiceModel.find({
    $or: [{ name: { $in: patterns } }, { value: { $in: patterns } }],
  }).lean();

  const deductionByName = new Map();
  const requestedLabels = new Set(names.map((name) => name.toLowerCase()));
  for (const service of serviceDocs) {
    if (![service.name, service.value].some((label) => requestedLabels.has(String(label || '').trim().toLowerCase()))) continue;
    for (const label of [service.name, service.value]) {
      const key = String(label || '').trim().toLowerCase();
      const amount = Number(service.deduction || 0);
      if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid catalog deduction for ${service.name}.`);
      if (deductionByName.has(key) && deductionByName.get(key).id !== String(service._id))
        throw new Error(`Conflicting catalog deduction rates for ${label}. Please resolve the duplicate service.`);
      deductionByName.set(key, { amount, id: String(service._id) });
    }
  }

  const seenIds = new Set();
  return names
    .map((service) => {
      const serviceName = String(service || "").trim();
      const catalog = deductionByName.get(serviceName.toLowerCase());
      if (!catalog || seenIds.has(catalog.id)) return null;
      seenIds.add(catalog.id);
      return {
        service_id: catalog.id,
        service_key: catalog.id,
        service_name: serviceName,
        deduction: roundMoney(catalog.amount || 0),
      };
    })
    .filter((item) => item && item.service_name && item.deduction > 0);
};

// Service deductions are financial snapshots. Editing a booking's services must remove
// deleted services without rewriting the historical rate of services that remain.
export const reconcileServiceDeductionSnapshot = async (services = [], existingSnapshot = [], catalog = null) => {
  const normalizedServices = [...new Map(
    (Array.isArray(services) ? services : [])
      .map((service) => String(service || "").trim())
      .filter(Boolean)
      .map((service) => [service.toLowerCase(), service])
  ).values()];

  const existingByName = new Map(
    (Array.isArray(existingSnapshot) ? existingSnapshot : [])
      .filter((item) => String(item?.service_name || "").trim())
      .map((item) => [String(item.service_name).trim().toLowerCase(), {
        ...(item.service_id ? { service_id: String(item.service_id) } : {}),
        ...(item.service_key ? { service_key: item.service_key } : {}),
        ...(item.effective_term_key ? { effective_term_key: item.effective_term_key } : {}),
        service_name: String(item.service_name).trim(),
        deduction: roundMoney(item.deduction || 0),
      }])
  );

  const labels = [...normalizedServices, ...existingSnapshot.map((item) => item.service_name)].filter(Boolean);
  const patterns = labels.map((label) => new RegExp(`^${String(label).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
  const resolvedCatalog = catalog || (patterns.length ? await ServiceModel.find({ $or: [{ name: { $in: patterns } }, { value: { $in: patterns } }] }).lean() : []);
  const catalogByLabel = new Map(resolvedCatalog.flatMap((item) => [item.name, item.value].map((label) => [String(label || '').trim().toLowerCase(), item])));
  const newSnapshots = await snapshotServiceDeductions(normalizedServices, resolvedCatalog);
  const newByName = new Map(
    newSnapshots.map((item) => [String(item.service_name).trim().toLowerCase(), item])
  );

  const existingById = new Map(existingSnapshot.map((item) => [String(item.service_id || catalogByLabel.get(String(item.service_name).trim().toLowerCase())?._id || ''), item]).filter(([id]) => id));
  const freshById = new Map(newSnapshots.map((item) => [item.service_id, item]));
  const seen = new Set();
  return normalizedServices.map((service) => {
    const serviceId = String(catalogByLabel.get(service.toLowerCase())?._id || '');
    const fresh = newByName.get(service.toLowerCase()) || freshById.get(serviceId);
    const retained = existingByName.get(service.toLowerCase()) || existingById.get(serviceId);
    const item = retained ? { ...retained, service_name: service, ...(serviceId ? { service_id: serviceId, service_key: retained.service_key || String(retained.service_name).trim().toLowerCase() } : {}) } : fresh && { ...fresh, service_name: service };
    if (!item || item.deduction <= 0) return null;
    const key = item.service_id || item.service_name.toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key); return item;
  }).filter(Boolean);
};

export const prepareBookingFinancials = async (booking = {}, { snapshotDeductions = true } = {}) => {
  const gstMetadata = buildGstMetadata(booking);
  const refundable = sanitizeRefundable(booking);
  const service_deductions_snapshot = snapshotDeductions
    ? await snapshotServiceDeductions(booking.services || [])
    : booking.service_deductions_snapshot || [];

  return {
    financial_version: FINANCIAL_VERSION,
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
