import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingModel } from "../models/bookingModel.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.resolve(__dirname, "SELF_SHARE_BOOKING_REPAIR.md");
const TERM_KEYS = ["term_1", "term_2", "term_3"];

const toUpperText = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : value;

const stripSelfShares = (entries = [], creatorUserId = "") =>
  (Array.isArray(entries) ? entries : []).filter((entry) => {
    const userId = String(entry?.user_id || "");
    const percentage = Number(entry?.percentage || 0);
    if (!userId || percentage <= 0) return false;
    if (creatorUserId && userId === String(creatorUserId)) return false;
    return true;
  });

const pretty = (value) => {
  try {
    return `\`${JSON.stringify(value)}\``;
  } catch {
    return `\`${String(value)}\``;
  }
};

const toHistoryKey = (field) => String(field || "").replace(/\./g, "_");

const buildRepairCandidate = (booking = {}) => {
  const updates = {};
  const changes = {};

  const topLevelClean = stripSelfShares(booking.shared_with, booking.user_id);
  if (JSON.stringify(topLevelClean) !== JSON.stringify(booking.shared_with || [])) {
    updates.shared_with = topLevelClean.map((item) => ({
      ...item,
      user_name: toUpperText(item.user_name),
      percentage: Number(item.percentage || 0),
    }));
    changes.shared_with = {
      old: booking.shared_with || [],
      new: updates.shared_with,
    };
  }

  const nextTermShares = { ...(booking.term_shares || {}) };
  let termChanged = false;

  TERM_KEYS.forEach((termKey) => {
    const current = booking?.term_shares?.[termKey];
    if (!current?.creator?.user_id) return;
    const cleaned = stripSelfShares(current.shared_with, current.creator.user_id).map((item) => ({
      ...item,
      user_name: toUpperText(item.user_name),
      percentage: Number(item.percentage || 0),
    }));
    if (JSON.stringify(cleaned) !== JSON.stringify(current.shared_with || [])) {
      nextTermShares[termKey] = {
        ...current,
        shared_with: cleaned,
      };
      changes[toHistoryKey(`term_shares.${termKey}.shared_with`)] = {
        old: current.shared_with || [],
        new: cleaned,
      };
      termChanged = true;
    }
  });

  if (termChanged) {
    updates.term_shares = nextTermShares;
  }

  if (!Object.keys(updates).length) return null;

  return {
    bookingId: String(booking._id),
    companyName: booking.company_name || booking.contact_person || "UNKNOWN BOOKING",
    bdm: booking.bdm || "N/A",
    updates,
    changes,
  };
};

const main = async () => {
  if (!process.env.Mongo_URL) {
    throw new Error("Mongo_URL is missing in environment.");
  }

  await mongoose.connect(process.env.Mongo_URL, { serverSelectionTimeoutMS: 30000 });

  try {
    const bookings = await BookingModel.find({ isDeleted: { $ne: true } }).lean();
    const candidates = bookings.map(buildRepairCandidate).filter(Boolean);

    const lines = [
      "# Self Share Booking Repair Log",
      "",
      `Generated at: ${new Date().toISOString()}`,
      "",
      "This repair removes creator self-share rows from top-level `shared_with` and term-level `term_shares.*.shared_with`.",
      "",
      `Bookings repaired: **${candidates.length}**`,
      "",
    ];

    for (const candidate of candidates) {
      await BookingModel.updateOne(
        { _id: candidate.bookingId },
        {
          $set: candidate.updates,
          $push: {
            updatedhistory: {
              updatedBy: "CODEX REPAIR SCRIPT",
              updatedAt: new Date(),
              note: "Removed invalid creator self-share rows from booking sharing metadata",
              changes: candidate.changes,
            },
          },
        }
      );

      lines.push(`## ${candidate.companyName}`);
      lines.push("");
      lines.push(`- Booking ID: \`${candidate.bookingId}\``);
      lines.push(`- BDM: ${candidate.bdm}`);
      Object.entries(candidate.changes).forEach(([field, change]) => {
        lines.push(`- Field: \`${field}\``);
        lines.push(`  - Old: ${pretty(change.old)}`);
        lines.push(`  - New: ${pretty(change.new)}`);
      });
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    if (!candidates.length) {
      lines.push("No creator self-share repair candidates were found.");
    }

    await fs.writeFile(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
    console.log(`Repair log written to ${OUTPUT_FILE}`);
    console.log(`Bookings repaired: ${candidates.length}`);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

main().catch(async (error) => {
  console.error("Self-share booking repair failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
