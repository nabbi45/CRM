import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingModel } from "../models/bookingModel.js";
import { UserModel } from "../models/UserModel.js";
import { normalizeBookingPayload, toLowerEmail, toUpperText } from "./textNormalize.js";

dotenv.config();

async function main() {
  if (!process.env.Mongo_URL) {
    throw new Error("Mongo_URL is missing from .env");
  }

  await mongoose.connect(process.env.Mongo_URL, { serverSelectionTimeoutMS: 30000 });

  const users = await UserModel.find({}).lean();
  let usersUpdated = 0;
  for (const user of users) {
    const updates = {
      name: toUpperText(user.name),
      email: toLowerEmail(user.email),
    };

    if (updates.name !== user.name || updates.email !== user.email) {
      await UserModel.updateOne({ _id: user._id }, { $set: updates });
      usersUpdated += 1;
    }
  }

  const bookings = await BookingModel.find({}).lean();
  let bookingsUpdated = 0;
  for (const booking of bookings) {
    const baseTermShares = JSON.parse(JSON.stringify(booking.term_shares || {}));
    if (!baseTermShares.term_1?.creator?.user_id) {
      baseTermShares.term_1 = {
        creator: {
          user_id: booking.user_id,
          user_name: booking.bdm,
        },
        payment_date: booking.payment_date,
        shared_with: Array.isArray(booking.shared_with) ? booking.shared_with : [],
      };
    } else if (!baseTermShares.term_1.payment_date) {
      baseTermShares.term_1.payment_date = booking.payment_date;
    }

    const normalized = normalizeBookingPayload({
      ...booking,
      term_shares: baseTermShares,
    });
    const changed =
      normalized.bdm !== booking.bdm ||
      normalized.company_name !== booking.company_name ||
      normalized.contact_person !== booking.contact_person ||
      normalized.email !== booking.email ||
      normalized.pan !== booking.pan ||
      normalized.gst !== booking.gst ||
      JSON.stringify(normalized.shared_with || []) !== JSON.stringify(booking.shared_with || []) ||
      JSON.stringify(normalized.term_shares || {}) !== JSON.stringify(booking.term_shares || {});

    if (changed) {
      await BookingModel.updateOne(
        { _id: booking._id },
        {
          $set: {
            bdm: normalized.bdm,
            company_name: normalized.company_name,
            contact_person: normalized.contact_person,
            email: normalized.email,
            pan: normalized.pan,
            gst: normalized.gst,
            shared_with: normalized.shared_with,
            term_shares: normalized.term_shares,
          },
        }
      );
      bookingsUpdated += 1;
    }
  }

  console.log(`Users normalized: ${usersUpdated}`);
  console.log(`Bookings normalized: ${bookingsUpdated}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
