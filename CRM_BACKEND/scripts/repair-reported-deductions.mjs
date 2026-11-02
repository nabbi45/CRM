// Scoped repair for the two bookings reported on 2 November 2026.
// Preview is read-only; --apply requires a previously reviewed --booking-id.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
dotenv.config();
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const { BookingModel } = await import('../src/models/bookingModel.js');
const { ServiceModel } = await import('../src/models/ServiceModel.js');
const { reconcileServiceDeductionSnapshot } = await import('../src/utils/revenueRules.js');
const apply = process.argv.includes('--apply');
const requestedIds = process.argv.filter((v) => v.startsWith('--booking-id=')).map((v) => v.split('=')[1]);
try {
  await mongoose.connect(process.env.Mongo_URL, { serverSelectionTimeoutMS: 10000 });
  const filter = { company_name: { $in: [/^GREENION ENERGY$/i, /^ANIL$/i] }, isDeleted: { $ne: true } };
  if (requestedIds.length) filter._id = { $in: requestedIds };
  const bookings = await BookingModel.find(filter).select('company_name contact_person bdm date services service_deductions_snapshot updatedhistory').lean();
  if (apply && (!requestedIds.length || bookings.length !== requestedIds.length)) throw new Error('Supply the exact booking IDs from the preview.');
  const catalog = await ServiceModel.find({ $or: [{ name: /UTTAR PRADESH|STARTUP INDIA/i }, { value: /UTTAR PRADESH|STARTUP INDIA/i }] }).select('name value deduction').lean();
  console.log(JSON.stringify({ catalog }, null, 2));
  for (const booking of bookings) {
    const before = booking.service_deductions_snapshot || [];
    const after = await reconcileServiceDeductionSnapshot(booking.services, before);
    const simplified = (rows) => rows.map((r) => ({ service_name: r.service_name, deduction: r.deduction }));
    const changed = JSON.stringify(simplified(before)) !== JSON.stringify(simplified(after));
    console.log(JSON.stringify({ id: String(booking._id), company: booking.company_name, contact: booking.contact_person, bdm: booking.bdm, date: booking.date, services: booking.services, before: simplified(before), after, changed }, null, 2));
    if (!apply || !changed) continue;
    const backupDir = resolve('../.local-backups/deduction-repairs');
    await mkdir(backupDir, { recursive: true });
    const backupFile = resolve(backupDir, `${booking._id}-${Date.now()}.json`);
    await writeFile(backupFile, JSON.stringify({ booking, proposedSnapshot: after }, null, 2), { flag: 'wx' });
    const result = await BookingModel.updateOne(
      { _id: booking._id, services: booking.services, service_deductions_snapshot: before },
      {
        $set: { service_deductions_snapshot: after },
        $push: { updatedhistory: {
          updatedBy: 'SYSTEM REPAIR', updatedAt: new Date(),
          note: 'Restored missing service deductions after fixing literal service-name matching (parentheses were interpreted as regex groups). Existing deduction rates retained.',
          changes: { service_deductions_snapshot: { old: simplified(before), new: after } },
        } },
      },
    );
    if (result.modifiedCount !== 1) throw new Error(`Booking ${booking._id} changed since preview; repair skipped. Backup: ${backupFile}`);
    const verified = await BookingModel.findById(booking._id).select('service_deductions_snapshot').lean();
    console.log(JSON.stringify({ repaired: String(booking._id), backupFile, verified: simplified(verified.service_deductions_snapshot) }));
  }
} finally {
  await mongoose.disconnect();
}
