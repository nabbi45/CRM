import mongoose from 'mongoose';
// One guard per employee/month serializes competing capped recoveries.
export const FinancialGuard = mongoose.model('financial_guard', new mongoose.Schema({ _id: String, revision: { type: Number, default: 0 } }, { versionKey: false }));
export const FinancialBackup = mongoose.model('financial_backup', new mongoose.Schema({ booking_id: { type: String, index: true }, revision: Number, at: { type: Date, default: Date.now }, actor_id: String, reason: String, before: mongoose.Schema.Types.Mixed }, { versionKey: false }));
