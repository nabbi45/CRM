import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingModel } from "../models/bookingModel.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, "JAY_MAA_KALI_SERVICE_DEDUCTION_REPAIR.md");
const BOOKING_ID = "6a701eb19d1b47338e6b6a3a";
const SNAPSHOT = [
  { service_name: "ISO 9001 ( NON -IAF) CERTIFICATE", deduction: 1500 },
  { service_name: "ISO 14001 ( NON-IAF) CERTIFICATE", deduction: 2500 },
];

const main = async () => {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.Mongo_URL, { serverSelectionTimeoutMS: 30000 });
  const booking = await BookingModel.findById(BOOKING_ID);
  if (!booking) throw new Error(`Booking ${BOOKING_ID} was not found.`);

  const before = booking.service_deductions_snapshot || [];
  const markdown = [
    "# JAY MAA KALI TRADING COMPANY Service Deduction Repair",
    "",
    `- Booking ID: \`${BOOKING_ID}\``,
    "- Booking date: 02/08/2026 (local business date)",
    "- Reason: the booking contains two deduction-bearing ISO services but its saved deduction snapshot was empty.",
    "- No booking amount, payment date, sharing, or term values are changed.",
    "",
    "## Before",
    "",
    `\`${JSON.stringify(before)}\``,
    "",
    "## After",
    "",
    `\`${JSON.stringify(SNAPSHOT)}\``,
    "",
    `- Mode: ${apply ? "APPLIED" : "DRY RUN"}`,
  ].join("\n");
  await fs.writeFile(OUTPUT_FILE, markdown, "utf8");

  if (!apply) {
    console.log(`Dry run complete. Audit: ${OUTPUT_FILE}`);
    return;
  }

  booking.service_deductions_snapshot = SNAPSHOT;
  booking.updatedhistory = Array.isArray(booking.updatedhistory) ? booking.updatedhistory : [];
  booking.updatedhistory.push({
    updatedBy: "SYSTEM REPAIR",
    updatedAt: new Date(),
    note: "Restored the missing service deduction snapshot for the two ISO services.",
    changes: {
      service_deductions_snapshot: { old: before, new: SNAPSHOT },
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
