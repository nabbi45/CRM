import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingModel } from "../models/bookingModel.js";
import { BookingApprovalModel } from "../models/BookingApprovalModel.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.resolve(__dirname, "CONTINUATION_BOOKING_AUDIT.md");

const termKeys = ["term_1", "term_2", "term_3"];

const toNumber = (value) => Number(value || 0);

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
};

const prettyJson = (value) => {
  try {
    return `\`${JSON.stringify(value)}\``;
  } catch {
    return `\`${String(value)}\``;
  }
};

const normalizeChanges = (changes = {}) => {
  if (!changes) return {};
  if (changes instanceof Map) return Object.fromEntries(changes.entries());
  return changes;
};

const getContinuationHistoryEntries = (booking = {}) =>
  (Array.isArray(booking.updatedhistory) ? booking.updatedhistory : []).filter((entry) =>
    String(entry?.note || "").toLowerCase().includes("approved from booking approval queue")
  );

const sumTerms = (booking = {}) =>
  termKeys.reduce((sum, key) => sum + toNumber(booking?.[key]), 0);

const buildSuspicionReasons = (booking, approvalsForBooking = []) => {
  const reasons = [];
  const continuationEntries = getContinuationHistoryEntries(booking);

  continuationEntries.forEach((entry) => {
    const changes = normalizeChanges(entry?.changes);
    ["total_amount", "payment_date", "shared_with"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(changes, field)) {
        reasons.push({
          type: "history-change",
          field,
          oldValue: changes[field]?.old,
          newValue: changes[field]?.new,
          note: entry?.note || "",
          updatedAt: entry?.updatedAt,
        });
      }
    });
  });

  const firstTermDate = booking?.term_shares?.term_1?.payment_date || booking?.payment_date || booking?.date;
  if (
    booking?.term_shares?.term_1?.payment_date &&
    booking?.payment_date &&
    formatDate(booking.payment_date) !== formatDate(booking.term_shares.term_1.payment_date)
  ) {
    reasons.push({
      type: "heuristic",
      field: "payment_date",
      oldValue: booking.term_shares.term_1.payment_date,
      newValue: booking.payment_date,
      note: "Top-level payment_date differs from term_1 payment_date.",
    });
  }

  const totalAmount = toNumber(booking?.total_amount);
  const totalReceived = sumTerms(booking);
  if (totalAmount > 0 && totalReceived > totalAmount) {
    reasons.push({
      type: "heuristic",
      field: "total_amount",
      oldValue: totalAmount,
      newValue: totalReceived,
      note: "Sum of term amounts is greater than top-level total_amount.",
    });
  }

  approvalsForBooking.forEach((approval) => {
    const termKey = approval?.payload?.continuation_term_key;
    const termAmount = toNumber(approval?.payload?.[termKey]);
    const persistedAmount = toNumber(booking?.[termKey]);
    if (termKey && termAmount > 0 && persistedAmount !== termAmount) {
      reasons.push({
        type: "approval-mismatch",
        field: termKey,
        oldValue: termAmount,
        newValue: persistedAmount,
        note: `Approved continuation amount for ${termKey} differs from the stored booking value.`,
      });
    }
  });

  if (
    booking?.shared_with &&
    Array.isArray(booking.shared_with) &&
    booking?.term_shares?.term_1?.shared_with &&
    JSON.stringify(booking.shared_with) !== JSON.stringify(booking.term_shares.term_1.shared_with)
  ) {
    reasons.push({
      type: "heuristic",
      field: "shared_with",
      oldValue: booking.term_shares.term_1.shared_with,
      newValue: booking.shared_with,
      note: "Top-level shared_with differs from term_1 shared_with.",
    });
  }

  return { reasons, firstTermDate };
};

const buildProposedRepairs = (booking, reasons = [], firstTermDate) => {
  const repairs = [];

  const latestChangeByField = {};
  reasons
    .filter((reason) => reason.field && (reason.type === "history-change" || reason.type === "heuristic"))
    .forEach((reason) => {
      latestChangeByField[reason.field] = reason;
    });

  if (latestChangeByField.total_amount?.type === "history-change") {
    repairs.push({
      field: "total_amount",
      currentValue: booking.total_amount,
      proposedValue: latestChangeByField.total_amount.oldValue,
      source: "updatedhistory old value",
    });
  }

  if (latestChangeByField.payment_date) {
    repairs.push({
      field: "payment_date",
      currentValue: booking.payment_date,
      proposedValue:
        latestChangeByField.payment_date.type === "history-change"
          ? latestChangeByField.payment_date.oldValue
          : firstTermDate,
      source:
        latestChangeByField.payment_date.type === "history-change"
          ? "updatedhistory old value"
          : "term_1 payment_date fallback",
    });
  }

  if (latestChangeByField.shared_with?.type === "history-change") {
    repairs.push({
      field: "shared_with",
      currentValue: booking.shared_with,
      proposedValue: latestChangeByField.shared_with.oldValue,
      source: "updatedhistory old value",
    });
  }

  return repairs;
};

const main = async () => {
  if (!process.env.Mongo_URL) {
    throw new Error("Mongo_URL is missing in environment.");
  }

  await mongoose.connect(process.env.Mongo_URL, { serverSelectionTimeoutMS: 30000 });

  try {
    const approvals = await BookingApprovalModel.find({
      status: "approved",
      "payload.continuation_of_booking_id": { $exists: true, $ne: "" },
    })
      .sort({ reviewed_at: -1 })
      .lean();

    const bookingIds = [...new Set(approvals.map((approval) => String(approval?.payload?.continuation_of_booking_id || "")).filter(Boolean))];
    const bookings = await BookingModel.find({ _id: { $in: bookingIds } }).lean();
    const bookingMap = new Map(bookings.map((booking) => [String(booking._id), booking]));

    const approvalsByBooking = approvals.reduce((acc, approval) => {
      const bookingId = String(approval?.payload?.continuation_of_booking_id || "");
      if (!bookingId) return acc;
      if (!acc[bookingId]) acc[bookingId] = [];
      acc[bookingId].push(approval);
      return acc;
    }, {});

    const suspiciousBookings = [];

    bookingIds.forEach((bookingId) => {
      const booking = bookingMap.get(bookingId);
      if (!booking) return;
      const relatedApprovals = approvalsByBooking[bookingId] || [];
      const { reasons, firstTermDate } = buildSuspicionReasons(booking, relatedApprovals);
      if (!reasons.length) return;

      suspiciousBookings.push({
        booking,
        relatedApprovals,
        reasons,
        proposedRepairs: buildProposedRepairs(booking, reasons, firstTermDate),
      });
    });

    const generatedAt = new Date().toISOString();
    const lines = [
      "# Continuation Booking Audit",
      "",
      `Generated at: ${generatedAt}`,
      "",
      "This is a read-only audit report. No database records were changed while producing this file.",
      "",
      `Approved continuation approvals scanned: **${approvals.length}**`,
      `Suspicious parent bookings found: **${suspiciousBookings.length}**`,
      "",
      "## How To Use",
      "",
      "Review each booking below before any repair. Proposed repairs are suggestions only, based on approval history and term-level data.",
      "",
    ];

    if (!suspiciousBookings.length) {
      lines.push("No suspicious continuation parent bookings were detected by the current audit rules.");
    }

    suspiciousBookings.forEach((item, index) => {
      const { booking, relatedApprovals, reasons, proposedRepairs } = item;
      lines.push(`## ${index + 1}. ${booking.company_name || booking.contact_person || "UNKNOWN BOOKING"}`);
      lines.push("");
      lines.push(`- Booking ID: \`${booking._id}\``);
      lines.push(`- BDM: ${booking.bdm || "N/A"}`);
      lines.push(`- Total Amount: ${booking.total_amount || 0}`);
      lines.push(`- Term 1 / Term 2 / Term 3: ${toNumber(booking.term_1)} / ${toNumber(booking.term_2)} / ${toNumber(booking.term_3)}`);
      lines.push(`- Sum of Terms: ${sumTerms(booking)}`);
      lines.push(`- Top-level Payment Date: ${formatDate(booking.payment_date)}`);
      lines.push(`- Term 1 Payment Date: ${formatDate(booking?.term_shares?.term_1?.payment_date)}`);
      lines.push(`- Term 2 Payment Date: ${formatDate(booking?.term_shares?.term_2?.payment_date)}`);
      lines.push(`- Term 3 Payment Date: ${formatDate(booking?.term_shares?.term_3?.payment_date)}`);
      lines.push("");
      lines.push("### Suspicion Reasons");
      lines.push("");
      reasons.forEach((reason) => {
        lines.push(`- Field: \`${reason.field}\` | Type: \`${reason.type}\` | Note: ${reason.note}`);
        lines.push(`  - Old/Expected: ${prettyJson(reason.oldValue)}`);
        lines.push(`  - Current/New: ${prettyJson(reason.newValue)}`);
      });
      lines.push("");
      lines.push("### Related Continuation Approvals");
      lines.push("");
      relatedApprovals.forEach((approval) => {
        lines.push(`- Approval ID: \`${approval._id}\` | Term: ${approval?.payload?.continuation_term_label || approval?.payload?.continuation_term_key || "N/A"} | Reviewed At: ${formatDate(approval.reviewed_at)}`);
        lines.push(`  - Approval Payment Date: ${formatDate(approval?.payload?.payment_date)}`);
        lines.push(`  - Approval Term Amount: ${approval?.payload?.continuation_term_key ? toNumber(approval?.payload?.[approval.payload.continuation_term_key]) : "N/A"}`);
        lines.push(`  - Approval Total Amount Payload: ${toNumber(approval?.payload?.total_amount)}`);
      });
      lines.push("");
      lines.push("### Proposed Repair Fields");
      lines.push("");
      if (proposedRepairs.length) {
        proposedRepairs.forEach((repair) => {
          lines.push(`- Field: \`${repair.field}\``);
          lines.push(`  - Current Value: ${prettyJson(repair.currentValue)}`);
          lines.push(`  - Proposed Value: ${prettyJson(repair.proposedValue)}`);
          lines.push(`  - Source: ${repair.source}`);
        });
      } else {
        lines.push("- No automatic repair proposed. Manual review required.");
      }
      lines.push("");
      lines.push("---");
      lines.push("");
    });

    await fs.writeFile(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
    console.log(`Audit report written to ${OUTPUT_FILE}`);
    console.log(`Suspicious bookings: ${suspiciousBookings.length}`);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

main().catch(async (error) => {
  console.error("Continuation audit failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
