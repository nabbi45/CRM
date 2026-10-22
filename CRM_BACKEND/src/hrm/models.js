import mongoose from "mongoose";
const { Schema } = mongoose;
const mixed = Schema.Types.Mixed;
const model = (name, fields, indexes = []) => {
  const schema = new Schema(fields, { timestamps: true });
  indexes.forEach(([keys, options]) => schema.index(keys, options));
  return mongoose.models[name] || mongoose.model(name, schema);
};
export const HRMControl = model("HRMControl", {
  _id: String,
  revision: { type: Number, default: 0 },
  activationDate: String,
  leaseUntil: Date,
});
export const HRMPolicy = model("HRMPolicy", {
  effectiveDate: { type: String, unique: true },
  values: mixed,
  createdBy: String,
});
export const HRMEmployee = model("HRMEmployee", {
  userId: { type: String, unique: true },
  managerId: String,
  group: String,
  eligible: Boolean,
  exitDate: String,
  setupConfirmed: Boolean,
});
export const HRMAttendance = model(
  "HRMAttendance",
  { userId: String, date: String, data: mixed },
  [[{ userId: 1, date: 1 }, { unique: true }]],
);
export const HRMRequest = model(
  "HRMRequest",
  {
    userId: String,
    kind: String,
    from: String,
    to: String,
    status: String,
    data: mixed,
  },
  [[{ userId: 1, from: 1, to: 1 }, {}]],
);
export const HRMLedger = model("HRMLedger", {
  key: { type: String, unique: true },
  userId: String,
  kind: String,
  date: String,
  amount: Number,
  category: String,
  reference: String,
  reason: String,
});
export const HRMAudit = model("HRMAudit", {
  userId: String,
  module: String,
  action: String,
  before: mixed,
  after: mixed,
  actor: String,
  reason: String,
});
export const HRMLock = model(
  "HRMLock",
  {
    month: String,
    version: Number,
    locked: Boolean,
    snapshot: mixed,
    actor: String,
    reason: String,
  },
  [[{ month: 1, version: 1 }, { unique: true }]],
);
export const HRMJob = model("HRMJob", {
  key: { type: String, unique: true },
  completedAt: Date,
});
export const HRMMonthPolicy = model("HRMMonthPolicy", {
  month: { type: String, unique: true },
  effectiveDate: String,
  values: mixed,
  actor: String,
  reason: String,
});
