// Read-only: no app startup, jobs, index creation, repairs or repricing.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
dotenv.config({ quiet: true });
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const { BookingModel } = await import('../src/models/bookingModel.js');
const { ServiceModel } = await import('../src/models/ServiceModel.js');
const { auditBooking } = await import('../src/utils/deductionAudit.js');
try {
  if (!process.env.Mongo_URL) throw new Error('Mongo_URL is not configured.');
  await mongoose.connect(process.env.Mongo_URL, { serverSelectionTimeoutMS: 10000 });
  const catalog = await ServiceModel.find().select('name value deduction').maxTimeMS(15000).lean();
  const ids = process.argv.filter((arg) => arg.startsWith('--booking-id=')).map((arg) => arg.slice('--booking-id='.length));
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new Error('Invalid booking ID.');
  const cursor = BookingModel.find({ isDeleted: { $ne: true }, ...(ids.length ? { _id: { $in: ids } } : {}) }).lean().maxTimeMS(60000).cursor({ batchSize: 100 });
  const summaryOnly = process.argv.includes('--summary');
  const reportPath = process.argv.find((arg) => arg.startsWith('--report='))?.slice('--report='.length);
  const reported = /vital|ko green|jay maa kali|greenion energy|harish metri|^anil$/i;
  const rows = [];
  let checked = 0, flagged = 0, pending = 0, missingSnapshots = 0, unmatchedServices = 0;
  for await (const booking of cursor) {
    checked++;
    try {
      const audit = await auditBooking(booking, catalog);
      pending += audit.after.pending;
      if (audit.flags.some((flag) => flag.startsWith('Missing saved fee:'))) missingSnapshots++;
      if (audit.flags.some((flag) => flag.startsWith('Unmatched service:'))) unmatchedServices++;
      const row = { id: audit.booking_id, company: audit.company_name, date: audit.booking_date, revision: audit.financial_revision, flags: audit.flags, date_candidates: audit.date_candidates, before: { official: audit.before.official, applied: audit.before.applied, pending: audit.before.pending }, proposed: { official: audit.after.official, applied: audit.after.applied, pending: audit.after.pending }, proposed_snapshot: audit.proposed_snapshot, payment_mode: booking.bank, terms: audit.before.terms.map((term) => ({ term: term.term_key, gross: term.gross, mode: term.payment_mode, date: term.payment_date, gst: term.gst, applied: term.applied, net: term.net })) };
      if (audit.flags.length || reported.test(booking.company_name || '')) rows.push(row);
      if (audit.flags.length) {
        flagged++;
        if (!summaryOnly) console.log(JSON.stringify(row));
      }
      if (summaryOnly && reported.test(booking.company_name || '')) console.log(JSON.stringify(row));
    } catch (error) { flagged++; console.log(JSON.stringify({ id: String(booking._id), company: booking.company_name, unresolved: error.message })); }
  }
  const summary = { mode: 'READ ONLY', checked, flagged, missingSnapshots, unmatchedServices, proposedPending: Math.round(pending * 100) / 100 };
  if (reportPath) {
    const target = resolve(reportPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 2), { flag: 'wx' });
  }
  console.log(JSON.stringify(summary));
} catch (error) { console.error(`Deduction audit failed: ${error.message}`); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
