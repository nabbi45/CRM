import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingModel } from "../models/bookingModel.js";
import { UserModel } from "../models/UserModel.js";
import { normalizeBookingPayload } from "./textNormalize.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fileArg = process.argv.find((arg) => arg.startsWith("--file="));
const CSV_PATH = fileArg
  ? path.resolve(process.cwd(), fileArg.replace("--file=", ""))
  : path.join(__dirname, "ALL BOOKING - Sheet3.csv");
const COMMIT = process.argv.includes("--commit");
const UPDATE_SHARES = process.argv.includes("--update-shares");
const SYNC = process.argv.includes("--sync");

const USER_ALIASES = {
  ASKSHIT: "AKSHIT GUPTA",
  "ASKSHIT GUPTA": "AKSHIT GUPTA",
  AKSHIT: "AKSHIT GUPTA",
  PRIYANKA: "PRIYANKA SINGH",
  "PRIYANKA GUPTA": "PRIYANKA SINGH",
  "KASHISH KAJANA": "KASHISH KAJANIA",
  "KASHISH KAJANAIA": "KASHISH KAJANIA",
  "NEELESH KUMAR": "NEELASH KUMAR",
  "ANSH SINGH": "AMRITANSH SINGH",
  "AMAN KUMAR": "Aman",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function normalizeName(value) {
  return String(value || "")
    .replace(/`/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function parseAmount(value) {
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

function parsePercentage(value, salespersonCount) {
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  if (cleaned) return Number(cleaned);
  return salespersonCount > 1 ? Number((100 / salespersonCount).toFixed(2)) : 0;
}

function parseDate(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function splitServices(value) {
  return String(value || "")
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean);
}

function splitNames(value) {
  return String(value || "")
    .split(",")
    .map(normalizeName)
    .filter(Boolean);
}

function getCell(row, headerIndex, header) {
  return (row[headerIndex[header]] || "").trim();
}

function resolveUser(name, usersByName) {
  const normalized = normalizeName(name);
  const alias = USER_ALIASES[normalized] || normalized;
  return usersByName.get(normalizeName(alias));
}

function buildDuplicateFilter(booking) {
  return {
    company_name: booking.company_name,
    contact_person: booking.contact_person,
    email: booking.email,
    contact_no: booking.contact_no,
    date: booking.date,
    total_amount: booking.total_amount,
    term_1: booking.term_1,
    services: booking.services,
    user_id: booking.user_id,
    isDeleted: { $ne: true },
  };
}

function buildNaturalFilter(booking) {
  return {
    company_name: booking.company_name,
    contact_person: booking.contact_person,
    email: booking.email,
    contact_no: booking.contact_no,
    date: booking.date,
    total_amount: booking.total_amount,
    term_1: booking.term_1,
    services: booking.services,
    isDeleted: { $ne: true },
  };
}

async function main() {
  if (!process.env.Mongo_URL) {
    throw new Error("Mongo_URL is missing from .env");
  }

  const csv = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csv);
  const headers = rows[0].map((header, index) => header.trim() || `__blank_${index}`);
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
  const dataRows = rows.slice(1);

  await mongoose.connect(process.env.Mongo_URL, { serverSelectionTimeoutMS: 30000 });

  const users = await UserModel.find({}).select("_id name").lean();
  const usersByName = new Map(users.map((user) => [normalizeName(user.name), user]));

  const bookings = [];
  const sourceRows = [];
  const skipped = [];

  dataRows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const shareNames = splitNames(getCell(row, headerIndex, "Share with User"));
    const primaryUser = shareNames.map((name) => resolveUser(name, usersByName)).find(Boolean);
    const originalPrimaryName = shareNames[0] || "";

    const bookingDate = parseDate(getCell(row, headerIndex, "Booking Date"));
    const paymentDate = parseDate(getCell(row, headerIndex, "Payment Date"));
    const services = splitServices(getCell(row, headerIndex, "Services"));
    const totalAmount = parseAmount(getCell(row, headerIndex, "Total Amount"));
    const receivedAmount = parseAmount(getCell(row, headerIndex, "Received Amount"));
    const sharePercentage = parsePercentage(
      getCell(row, headerIndex, "Percentage Share"),
      shareNames.length
    );

    const missing = [];
    if (!primaryUser) missing.push(`known user for "${originalPrimaryName || "blank"}"`);
    if (!bookingDate) missing.push("valid Booking Date");
    if (!services.length) missing.push("Services");
    if (!totalAmount) missing.push("Total Amount");
    if (!receivedAmount) missing.push("Received Amount");
    if (!getCell(row, headerIndex, "Branch")) missing.push("Branch");
    if (!getCell(row, headerIndex, "Contact Person Name")) missing.push("Contact Person Name");
    if (!getCell(row, headerIndex, "Email ID")) missing.push("Email ID");
    if (!getCell(row, headerIndex, "State")) missing.push("State");

    if (missing.length) {
      skipped.push({ rowNumber, reason: missing.join(", ") });
      return;
    }

    const sharedUsers = shareNames
      .map((name) => {
        const user = resolveUser(name, usersByName);
        if (!user || String(user._id) === String(primaryUser._id)) return null;
        return { user_id: String(user._id), user_name: user.name, percentage: sharePercentage };
      })
      .filter(Boolean);

    bookings.push(normalizeBookingPayload({
      user_id: String(primaryUser._id),
      bdm: primaryUser.name,
      branch_name: getCell(row, headerIndex, "Branch"),
      company_name: getCell(row, headerIndex, "Company Name"),
      contact_person: getCell(row, headerIndex, "Contact Person Name"),
      email: getCell(row, headerIndex, "Email ID"),
      contact_no: Number(getCell(row, headerIndex, "Contact Number").replace(/\D/g, "")),
      services,
      closed_by: getCell(row, headerIndex, "Closed By"),
      total_amount: totalAmount,
      term_1: receivedAmount,
      term_2: null,
      term_3: null,
      payment_date: paymentDate,
      pan: getCell(row, headerIndex, "PAN Number"),
      gst: getCell(row, headerIndex, "GST Number") || "N/A",
      remark: getCell(row, headerIndex, "Notes"),
      date: bookingDate,
      after_disbursement: getCell(row, headerIndex, "After Fund Disbursement"),
      bank: getCell(row, headerIndex, "Payment Mode"),
      state: getCell(row, headerIndex, "State"),
      status: receivedAmount >= totalAmount ? "Completed" : "Pending",
      shared_with: sharedUsers,
    }));
    sourceRows.push(rowNumber);
  });

  const duplicateIndexes = [];
  for (let index = 0; index < bookings.length; index += 1) {
    const exists = await BookingModel.exists(buildDuplicateFilter(bookings[index]));
    if (exists) duplicateIndexes.push(index);
  }

  const bookingsToInsert = bookings.filter((_, index) => !duplicateIndexes.includes(index));

  console.log(`Mode: ${COMMIT ? "commit" : "dry-run"}`);
  console.log(`Update shares: ${UPDATE_SHARES ? "yes" : "no"}`);
  console.log(`Sync existing: ${SYNC ? "yes" : "no"}`);
  console.log(`CSV rows: ${dataRows.length}`);
  console.log(`Valid rows: ${bookings.length}`);
  console.log(`Skipped rows: ${skipped.length}`);
  console.log(`Existing duplicates: ${duplicateIndexes.length}`);
  console.log(`Ready to insert: ${bookingsToInsert.length}`);

  if (bookingsToInsert.length > 0 && bookingsToInsert.length <= 25) {
    console.log("Ready detail:");
    bookings.forEach((booking, index) => {
      if (!duplicateIndexes.includes(index)) {
        console.log(
          `- Row ${sourceRows[index]}: ${booking.company_name} | ${booking.bdm} | ${booking.email} | ${booking.date.toISOString().slice(0, 10)}`
        );
      }
    });
  }

  if (skipped.length) {
    console.log("Skipped detail:");
    skipped.forEach((item) => console.log(`- Row ${item.rowNumber}: ${item.reason}`));
  }

  if (COMMIT && bookingsToInsert.length) {
    const result = await BookingModel.insertMany(bookingsToInsert, { ordered: false });
    console.log(`Inserted: ${result.length}`);
  }

  if (SYNC) {
    let updated = 0;
    let inserted = 0;

    for (const booking of bookings) {
      const exactMatch = await BookingModel.findOne(buildDuplicateFilter(booking)).select("_id").lean();
      const naturalMatch = exactMatch || await BookingModel.findOne(buildNaturalFilter(booking)).select("_id").lean();

      if (naturalMatch) {
        const result = await BookingModel.updateOne({ _id: naturalMatch._id }, { $set: booking });
        updated += result.modifiedCount || 0;
      } else {
        await BookingModel.create(booking);
        inserted += 1;
      }
    }

    console.log(`Sync updated existing: ${updated}`);
    console.log(`Sync inserted missing: ${inserted}`);
  }

  if (UPDATE_SHARES) {
    let updated = 0;
    for (const booking of bookings) {
      const result = await BookingModel.updateOne(buildDuplicateFilter(booking), {
        $set: { shared_with: booking.shared_with },
      });
      updated += result.modifiedCount || 0;
    }
    console.log(`Share records updated: ${updated}`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
