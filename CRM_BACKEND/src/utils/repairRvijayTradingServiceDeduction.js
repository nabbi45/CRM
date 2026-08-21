import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingModel } from "../models/bookingModel.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, "RVIJAY_TRADING_SERVICE_DEDUCTION_REPAIR.md");
const BOOKING_ID = "6a7d77ce7befee63a9f302c8";
const REMOVED_SERVICE = "ORGANIZATION DSC";

const normalize = (value) => String(value || "").trim().toLowerCase();

const main = async () => {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.Mongo_URL, { serverSelectionTimeoutMS: 30000 });
  const booking = await BookingModel.findById(BOOKING_ID);
  if (!booking) throw new Error(`Booking ${BOOKING_ID} was not found.`);

  const before = booking.service_deductions_snapshot || [];
  const after = before.filter((item) => normalize(item.service_name) !== normalize(REMOVED_SERVICE));
  const markdown = [
    "# RVIJAY TRADING PRIVATE LIMITED Service Deduction Repair",
    "",
    `- Booking ID: \`${BOOKING_ID}\``,
    "- Booking date: 13/08/2026",
    "- Reason: ORGANIZATION DSC was removed from the booking services but its ₹2,700 saved deduction snapshot remained.",
    "- No amount, date, payment mode, sharing, or term data is changed.",
    "",
    "## Before",
    "",
    `\`${JSON.stringify(before)}\``,
    "",
    "## After",
    "",
    `\`${JSON.stringify(after)}\``,
    "",
    `- Mode: ${apply ? "APPLIED" : "DRY RUN"}`,
  ].join("\n");
  await fs.writeFile(OUTPUT_FILE, markdown, "utf8");

  if (!apply) {
    console.log(`Dry run complete. Audit: ${OUTPUT_FILE}`);
    return;
  }

  booking.service_deductions_snapshot = after;
  booking.updatedhistory = Array.isArray(booking.updatedhistory) ? booking.updatedhistory : [];
  booking.updatedhistory.push({
    updatedBy: "SYSTEM REPAIR",
    updatedAt: new Date(),
    note: "Removed the stale ORGANIZATION DSC service deduction after the service was removed from the booking.",
    changes: {
      service_deductions_snapshot: { old: before, new: after },
    },
  });
  await booking.save();
  console.log(`Repair applied. Audit: ${OUTPUT_FILE}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
