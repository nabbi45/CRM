import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { UserModel } from "../models/UserModel.js";
import DailyActivityModel from "../models/DailyActivityModel.js";
import { prepareUploadFile, toDataUri } from "../utils/uploadCompression.js";
import { HRMAudit, HRMAttendance, HRMRequest, HRMLock } from "./models.js";
import * as service from "./service.js";
import { todayIST, dateKey } from "./rules.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});
export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const loadActor = wrap(async (req, res, next) => {
  const user = await UserModel.findById(req.user.userId)
    .select("name user_role feature_permissions isDisabled")
    .lean();
  if (!user || user.isDisabled)
    return res.status(403).json({ message: "Account is unavailable" });
  req.actor = { ...user, userId: String(user._id) };
  next();
});
export const uploadAttachment = async (file) => {
  if (!file) return null;
  if (
    !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(
      file.mimetype,
    )
  )
    service.fail("Attachment must be a PNG, JPEG, WebP or PDF");
  const prepared = await prepareUploadFile(file);
  const result = await cloudinary.uploader.upload(toDataUri(prepared), {
    resource_type: prepared.resourceType === "image" ? "image" : "raw",
    folder: "hrm_proof",
  });
  return {
    url: result.secure_url,
    name: file.originalname,
    mime: file.mimetype,
  };
};
export const parseBody = (req) =>
  req.body.payload ? JSON.parse(req.body.payload) : req.body;
router.use(authenticateUser, loadActor);
router.get("/session", (req, res) =>
  res.json({ valid: true, user: req.actor }),
);
router.use((req, res, next) =>
  service.hasPortal(req.actor)
    ? next()
    : res.status(403).json({ message: "HRM Portal access required" }),
);
router.get(
  "/bootstrap",
  wrap(async (req, res) => {
    await service.runAutomation();
    res.json(await service.bootstrap(req.actor, req.query.month));
  }),
);
router.get(
  "/attendance",
  wrap(async (req, res) => {
    const ids = await service.scopeIds(req.actor),
      userId = String(req.query.userId || req.actor.userId);
    if (!ids.includes(userId))
      service.fail("Employee is outside your team", 403);
    res.json({
      records: await service.attendanceMonth(
        userId,
        req.query.month || todayIST().slice(0, 7),
      ),
    });
  }),
);
router.post(
  "/attendance",
  wrap(async (req, res) =>
    res.json(await service.saveAttendance(req.actor, req.body)),
  ),
);
router.post(
  "/policy",
  wrap(async (req, res) =>
    res.json(await service.savePolicy(req.actor, req.body)),
  ),
);
router.post(
  "/setup",
  wrap(async (req, res) => res.json(await service.setup(req.actor, req.body))),
);
router.post(
  "/activate",
  wrap(async (req, res) =>
    res.json(await service.activate(req.actor, req.body)),
  ),
);
router.post(
  "/requests",
  upload.single("attachment"),
  wrap(async (req, res) =>
    res
      .status(201)
      .json(
        await service.createRequest(
          req.actor,
          parseBody(req),
          await uploadAttachment(req.file),
        ),
      ),
  ),
);
router.patch(
  "/requests/:id",
  wrap(async (req, res) =>
    res.json(await service.actionRequest(req.actor, req.params.id, req.body)),
  ),
);
router.post(
  "/requests/:id/verify",
  wrap(async (req, res) =>
    res.json(await service.verifySales(req.actor, req.params.id, req.body)),
  ),
);
router.post(
  "/regularisations",
  wrap(async (req, res) =>
    res.status(201).json(await service.regularisation(req.actor, req.body)),
  ),
);
router.patch(
  "/regularisations/:id",
  wrap(async (req, res) =>
    res.json(await service.regularisation(req.actor, req.body, req.params.id)),
  ),
);
router.post(
  "/adjustments",
  wrap(async (req, res) =>
    res.json(await service.adjustBalance(req.actor, req.body)),
  ),
);
router.post(
  "/holidays",
  wrap(async (req, res) =>
    res.json(await service.saveHoliday(req.actor, req.body)),
  ),
);
router.delete(
  "/holidays/:id",
  wrap(async (req, res) =>
    res.json(
      await service.saveHoliday(req.actor, { remove: true }, req.params.id),
    ),
  ),
);
router.post(
  "/months/:month/lock",
  wrap(async (req, res) =>
    res.json(await service.lockMonth(req.actor, req.params.month, req.body)),
  ),
);
router.post(
  "/months/:month/recalculate",
  wrap(async (req, res) => {
    res.json(
      await service.recalculateMonth(req.actor, req.params.month, req.body),
    );
  }),
);
router.get(
  "/reports",
  wrap(async (req, res) =>
    res.json(
      await service.report(
        req.actor,
        req.query.month,
        req.query.type || "attendance",
      ),
    ),
  ),
);
router.get(
  "/audit",
  wrap(async (req, res) => {
    if (!service.isHR(req.actor)) service.fail("HR access required", 403);
    res.json(
      await HRMAudit.find(req.query.userId ? { userId: req.query.userId } : {})
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean(),
    );
  }),
);
router.get(
  "/activities/:date",
  wrap(async (req, res) => {
    if (!service.isHR(req.actor)) service.fail("HR access required", 403);
    const date = dateKey(req.params.date);
    res.json(
      await DailyActivityModel.find({ date })
        .populate("userId", "name email")
        .lean(),
    );
  }),
);
router.use((error, req, res, next) =>
  res
    .status(error.status || (error.code === 11000 ? 409 : 400))
    .json({ message: error.message }),
);
export default router;
