import express from "express";
import multer from "multer";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { LeaveModel } from "../models/LeaveModel.js";
import { HRMRequest } from "./models.js";
import { loadActor, wrap, uploadAttachment } from "./routes.js";
import * as service from "./service.js";
import { dateKey, daysBetween } from "./rules.js";

// Installed before the old routers. Historical reads/notifications retain their
// existing handlers; active-period writes enter the shared HRM services.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});
const legacyAttendance = (row) => {
  let status = row.status;
  if (!row.historical) {
    if (/WFH/.test(status)) status = "WFH";
    else if (/Half|Menstrual/.test(status)) status = "Half Day Leave";
    else if (/Earned/.test(status)) status = "EL Taken";
    else if (/Unpaid|Absent|^UA$/.test(status)) status = "Full Day Leave";
    else if (status === "Late") status = "Present";
  }
  return { ...row, hrmStatus: row.status, status, notes: row.remarks || "" };
};
const activeUpload = wrap(async (req, res, next) => {
  if (!(await service.control())?.activationDate) return next();
  upload.single("supportingDocument")(req, res, next);
});
export const timecardBridge = express.Router();
timecardBridge.use(authenticateUser, loadActor);
timecardBridge.use(
  wrap(async (req, res, next) => {
    const c = await service.control();
    if (!c?.activationDate) return next();
    if (!service.hasPortal(req.actor)) service.fail("HRM access required", 403);
    if (req.method === "POST" && req.path === "/attendance/mark") {
      const status = req.body.status;
      if (
        ![
          "Present",
          "Full Day Leave",
          "Half Day Leave",
          "WFH",
          "Week Off",
          "Holiday",
          "EL Taken",
        ].includes(status)
      )
        service.fail("Invalid attendance status");
      if (["Week Off", "Holiday", "WFH", "EL Taken"].includes(status))
        service.fail(
          "Use the HRM holiday or approved request workflow for this status",
          409,
        );
      const payable =
        status === "Half Day Leave" ? 0.5 : status === "Full Day Leave" ? 0 : 1;
      const row = await service.saveAttendance(req.actor, {
        ...req.body,
        remarks: req.body.notes,
        override: { status, payable },
      });
      return res.json({ attendance: row, message: "Attendance updated" });
    }
    if (req.method === "POST" && req.path === "/holidays")
      return res.json(await service.saveHoliday(req.actor, req.body));
    if (req.method === "DELETE" && /^\/holidays\/[^/]+$/.test(req.path))
      return res.json(
        await service.saveHoliday(
          req.actor,
          { remove: true },
          req.path.split("/").pop(),
        ),
      );
    const ownMonth = req.path.match(/^\/attendance\/my-month\/(\d{4}-\d{2})$/);
    const userMonth = req.path.match(
      /^\/attendance\/user-month\/([^/]+)\/(\d{4}-\d{2})$/,
    );
    if (req.method === "GET" && (ownMonth || userMonth)) {
      const userId = userMonth ? userMonth[1] : req.actor.userId;
      if (!(await service.scopeIds(req.actor)).includes(userId))
        service.fail("Access denied", 403);
      return res.json({
        records: (
          await service.attendanceMonth(
            userId,
            userMonth ? userMonth[2] : ownMonth[1],
          )
        ).map(legacyAttendance),
      });
    }
    const daily = req.path.match(/^\/attendance\/daily\/(\d{4}-\d{2}-\d{2})$/);
    if (req.method === "GET" && daily && daily[1] >= c.activationDate) {
      if (!service.isHR(req.actor)) service.fail("HR required", 403);
      const records = [];
      for (const e of await service.employees())
        records.push({
          ...legacyAttendance(
            (
              await service.attendanceMonth(e.userId, daily[1].slice(0, 7))
            ).find((r) => r.date === daily[1]),
          ),
          userId: { _id: e.userId, name: e.name, email: e.email },
        });
      return res.json({ records });
    }
    next();
  }),
);

export const leaveBridge = express.Router();
leaveBridge.use(authenticateUser, loadActor);
leaveBridge.post(
  "/",
  activeUpload,
  wrap(async (req, res, next) => {
    const c = await service.control();
    if (!c?.activationDate) return next();
    if (!service.hasPortal(req.actor)) service.fail("HRM access required", 403);
    const leaveType =
      {
        earned: "earned",
        sick: "normal",
        casual: "normal",
        unpaid: "normal",
        other: "normal",
      }[req.body.leave_type] || req.body.leave_type;
    const attachment = await uploadAttachment(req.file);
    const request = await service.createRequest(
      req.actor,
      {
        kind: "LEAVE",
        leaveType,
        from: dateKey(req.body.start_date),
        to: dateKey(req.body.end_date),
        reason: req.body.reason,
        source: "EMPLOYEE_CRM",
      },
      attachment,
    );
    res
      .status(201)
      .json({ message: "Leave request submitted!", leave: request });
  }),
);
leaveBridge.get(
  ["/my", "/all"],
  wrap(async (req, res, next) => {
    if (!(await service.control())?.activationDate) return next();
    if (req.path === "/all" && !service.isHR(req.actor))
      service.fail("HR access required", 403);
    const mine = req.path === "/my";
    const legacy = await LeaveModel.find(
      mine ? { user_id: req.actor.userId } : {},
    )
      .sort({ createdAt: -1 })
      .lean();
    const current = await HRMRequest.find({
      kind: "LEAVE",
      ...(mine ? { userId: req.actor.userId } : {}),
    })
      .sort({ createdAt: -1 })
      .lean();
    const people = await service.employees();
    res.json([
      ...current.map((r) => ({
        ...r,
        user_id: r.userId,
        user_name: people.find((e) => e.userId === r.userId)?.name,
        leave_type: r.data.leaveType,
        start_date: r.from,
        end_date: r.to,
        reason: r.data.reason,
        approved_by: r.data.approvalBy,
        notes: r.data.actionRemarks,
        supporting_document_url: r.data.attachment?.url,
        supporting_document_file_name: r.data.attachment?.name,
      })),
      ...legacy,
    ]);
  }),
);
leaveBridge.patch(
  "/:id",
  wrap(async (req, res, next) => {
    const c = await service.control();
    if (!c?.activationDate) return next();
    const migrated = await HRMRequest.findOne({
      "data.legacyId": req.params.id,
    }).lean();
    if (migrated)
      return res.json({
        message: "Leave updated",
        leave: await service.actionRequest(req.actor, migrated._id, {
          ...req.body,
          remarks: req.body.notes || req.body.remarks,
        }),
      });
    if (await HRMRequest.exists({ _id: req.params.id }))
      return res.json({
        leave: await service.actionRequest(req.actor, req.params.id, {
          ...req.body,
          remarks: req.body.notes || req.body.remarks,
        }),
        message: "Leave updated",
      });
    const old = await LeaveModel.findById(req.params.id).lean();
    if (!old) service.fail("Leave not found", 404);
    const from = dateKey(old.start_date.toISOString()),
      to = dateKey(old.end_date.toISOString());
    if (to < c.activationDate) return next();
    if (from < c.activationDate)
      service.fail(
        "Split the request at the activation date before processing in HRM",
        409,
      );
    if (req.body.status !== "approved") {
      await service.mutate(req.actor, async (s) => {
        if (!service.isHR(req.actor) || req.actor.userId === old.user_id)
          service.fail("Another HR approver is required", 403);
        for (const date of daysBetween(from, to))
          await service.assertUnlocked(date, s);
        if (req.body.status !== "rejected")
          service.fail("Status must be approved or rejected");
        await LeaveModel.updateOne(
          { _id: old._id, status: "pending" },
          {
            $set: {
              status: "rejected",
              notes: req.body.notes || "",
              approved_by: req.actor.name,
            },
          },
          { session: s },
        );
        await service.audit(
          s,
          req.actor,
          "Legacy leave",
          "reject",
          old.user_id,
          old,
          req.body,
          req.body.notes,
        );
      });
      return res.json({ message: "Leave rejected" });
    }
    const request = await service.createRequest(
      req.actor,
      {
        kind: "LEAVE",
        userId: old.user_id,
        leaveType: old.leave_type === "earned" ? "earned" : "normal",
        from,
        to,
        reason: old.reason,
        source: "EMPLOYEE_CRM",
        intimationAt: old.createdAt.toISOString(),
        alreadyApproved: true,
        approvalBy: req.actor.name,
        approvalAt: new Date().toISOString(),
        payTreatment: req.body.payTreatment,
        remarks: req.body.notes,
        overrideReason: req.body.overrideReason,
      },
      old.supporting_document_url
        ? {
            url: old.supporting_document_url,
            name: old.supporting_document_file_name,
          }
        : null,
      String(old._id),
    );
    res.json({ message: "Leave approved in HRM", leave: request });
  }),
);
const errors = (error, req, res, next) =>
  res
    .status(error.status || 400)
    .json({ message: error.message, error: error.message });
timecardBridge.use(errors);
leaveBridge.use(errors);
