import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingModel } from "../models/bookingModel.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.resolve(__dirname, "CONTINUATION_PAYMENT_DATE_REPAIR.md");

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
};

const getContinuationHistoryEntries = (booking = {}) =>
  (Array.isArray(booking.updatedhistory) ? booking.updatedhistory : []).filter((entry) =>
    String(entry?.note || "").toLowerCase().includes("approved from booking approval queue")
  );

const getChangesObject = (changes = {}) => {
  if (!changes) return {};
  if (changes instanceof Map) return Object.fromEntries(changes.entries());
  return changes;
};

const getSafePaymentDateRepair = (booking = {}) => {
  const term1PaymentDate = booking?.term_shares?.term_1?.payment_date;
  if (!term1PaymentDate) return null;

  const currentPaymentDate = booking?.payment_date;
  if (!currentPaymentDate) return null;

  const currentDateKey = formatDate(currentPaymentDate);
  const term1DateKey = formatDate(term1PaymentDate);
  if (currentDateKey === "N/A" || term1DateKey === "N/A" || currentDateKey === term1DateKey) {
    return null;
  }

  const continuationEntries = getContinuationHistoryEntries(booking);
  const hasPaymentDateHistoryChange = continuationEntries.some((entry) => {
    const changes = getChangesObject(entry?.changes);
    return Object.prototype.hasOwnProperty.call(changes, "payment_date");
  });

  if (!hasPaymentDateHistoryChange) return null;

  return {
    bookingId: String(booking._id),
    companyName: booking.company_name || booking.contact_person || "UNKNOWN BOOKING",
    bdm: booking.bdm || "N/A",
    currentPaymentDate,
    proposedPaymentDate: term1PaymentDate,
    term1PaymentDate,
    term2PaymentDate: booking?.term_shares?.term_2?.payment_date || null,
    term3PaymentDate: booking?.term_shares?.term_3?.payment_date || null,
  };
};

const main = async () => {
  if (!process.env.Mongo_URL) {
    throw new Error("Mongo_URL is missing in environment.");
  }

  await mongoose.connect(process.env.Mongo_URL, { serverSelectionTimeoutMS: 30000 });

  try {
    const allBookings = await BookingModel.find({ isDeleted: { $ne: true } }).lean();
    const repairCandidates = allBookings
      .map(getSafePaymentDateRepair)
      .filter(Boolean);

    const lines = [
      "# Continuation Payment Date Repair Log",
      "",
      `Generated at: ${new Date().toISOString()}`,
      "",
      "This log records only Method A repairs: restoring parent booking `payment_date` back to `term_shares.term_1.payment_date` when continuation approval history shows the field was overwritten.",
      "",
      `Bookings repaired: **${repairCandidates.length}**`,
      "",
    ];

    for (const candidate of repairCandidates) {
      await BookingModel.updateOne(
        { _id: candidate.bookingId },
        {
          $set: {
            payment_date: new Date(candidate.proposedPaymentDate),
          },
          $push: {
            updatedhistory: {
              updatedBy: "CODEX REPAIR SCRIPT",
              updatedAt: new Date(),
              note: "Method A repair: restored parent payment_date after continuation approval overwrite",
              changes: {
                payment_date: {
                  old: candidate.currentPaymentDate,
                  new: candidate.proposedPaymentDate,
                },
              },
            },
          },
        }
      );

      lines.push(`## ${candidate.companyName}`);
      lines.push("");
      lines.push(`- Booking ID: \`${candidate.bookingId}\``);
      lines.push(`- BDM: ${candidate.bdm}`);
      lines.push(`- Previous payment_date: ${formatDate(candidate.currentPaymentDate)}`);
      lines.push(`- Restored payment_date: ${formatDate(candidate.proposedPaymentDate)}`);
      lines.push(`- Term 1 payment_date: ${formatDate(candidate.term1PaymentDate)}`);
      lines.push(`- Term 2 payment_date: ${formatDate(candidate.term2PaymentDate)}`);
      lines.push(`- Term 3 payment_date: ${formatDate(candidate.term3PaymentDate)}`);
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    if (!repairCandidates.length) {
      lines.push("No safe Method A payment_date repair candidates were found.");
    }

    await fs.writeFile(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
    console.log(`Repair log written to ${OUTPUT_FILE}`);
    console.log(`Bookings repaired: ${repairCandidates.length}`);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

main().catch(async (error) => {
  console.error("Continuation payment_date repair failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
