import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import mongoose from "mongoose";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { UserModel } from "../models/UserModel.js";
import { NotificationModel } from "../models/NotificationModel.js";
import {
  LeadColumnModel,
  LeadManagementModel,
} from "../models/LeadManagementModel.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, done) => {
    const valid = /\.(csv|xlsx|xls)$/i.test(file.originalname || "");
    done(
      valid ? null : new Error("Upload a CSV, XLS or XLSX lead file."),
      valid,
    );
  },
});

const MANAGEMENT_ROLES = [
  "admin",
  "senior admin",
  "super admin",
  "director",
  "dev",
  "srdev",
  "sr dev",
];
const SENIOR_DELETE_ROLES = ["senior admin", "super admin", "director"];
const STATUSES = [
  "new",
  "contacted",
  "qualified",
  "prospect",
  "unqualified",
  "junk",
];
const RESERVED_KEYS = new Set([
  "name",
  "mobile_number",
  "email",
  "service_requirement",
  "company_name",
  "status",
  "notes",
]);
const normalizeRole = (role = "") => String(role).trim().toLowerCase();
const isManager = (user) =>
  MANAGEMENT_ROLES.includes(normalizeRole(user?.user_role));
const canDeleteLeads = (user) =>
  SENIOR_DELETE_ROLES.includes(normalizeRole(user?.user_role));
const managerOnly = (req, res, next) =>
  isManager(req.user)
    ? next()
    : res
        .status(403)
        .json({ message: "Only admin or development roles can manage leads." });
const seniorManagementOnly = (req, res, next) =>
  canDeleteLeads(req.user)
    ? next()
    : res.status(403).json({
        message:
          "Only Senior Admin, Super Admin, or Director can delete leads.",
      });
const cleanText = (value, max = 1000) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const cleanMobile = (value) => cleanText(value, 40).replace(/[^0-9]/g, "");
const validMobile = (value) => value.length >= 7 && value.length <= 15;
const keyFor = (value) =>
  cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
const displayLabel = (value) => cleanText(value, 80).replace(/[_-]+/g, " ");
const getActorName = async (req) => {
  if (req.user.name) return cleanText(req.user.name, 160);
  const user = await UserModel.findById(req.user.userId).select("name").lean();
  return cleanText(user?.name || "Unknown", 160);
};

const canonicalHeader = (header) => {
  const key = keyFor(header).replace(/_/g, "");
  if (["name", "fullname", "leadname", "contactname"].includes(key))
    return "name";
  if (
    [
      "mobilenumber",
      "mobile",
      "phone",
      "phonenumber",
      "contactnumber",
      "whatsappnumber",
    ].includes(key)
  )
    return "mobileNumber";
  if (["email", "emailaddress"].includes(key)) return "email";
  if (
    [
      "servicerequirement",
      "requirement",
      "service",
      "servicesrequired",
    ].includes(key)
  )
    return "serviceRequirement";
  if (["companyname", "company", "organisation", "organization"].includes(key))
    return "companyName";
  return "";
};

const normaliseCustomFields = (fields = {}) => {
  const result = {};
  if (!fields || typeof fields !== "object" || Array.isArray(fields))
    return result;
  for (const [rawKey, rawValue] of Object.entries(fields)) {
    const key = keyFor(rawKey);
    if (!key || RESERVED_KEYS.has(key)) continue;
    const value = cleanText(rawValue, 2000);
    if (value) result[key] = value;
  }
  return result;
};

const normaliseLead = (source = {}) => {
  const lead = {
    name: cleanText(source.name, 160),
    mobileNumber: cleanMobile(source.mobileNumber),
    email: cleanText(source.email, 254).toLowerCase(),
    serviceRequirement: cleanText(source.serviceRequirement, 1000),
    companyName: cleanText(source.companyName, 200),
    customFields: normaliseCustomFields(source.customFields),
  };
  if (!lead.name) throw new Error("Name is required.");
  if (!validMobile(lead.mobileNumber))
    throw new Error("Mobile number must contain 7 to 15 digits.");
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email))
    throw new Error("Email format is invalid.");
  return lead;
};

const ensureColumns = async (entries, currentActor) => {
  const unique = new Map();
  for (const entry of entries) {
    const key = keyFor(entry.key || entry.label);
    if (!key || RESERVED_KEYS.has(key)) continue;
    unique.set(key, displayLabel(entry.label || key));
  }
  if (unique.size > 30)
    throw new Error("A lead sheet can contain up to 30 custom columns.");
  for (const [key, label] of unique) {
    await LeadColumnModel.updateOne(
      { key },
      {
        $setOnInsert: {
          key,
          label,
          active: true,
          createdBy: currentActor.id,
          createdByName: currentActor.name,
        },
      },
      { upsert: true },
    );
  }
};

const canAccessLead = (req, lead) =>
  isManager(req.user) || lead.assignedTo === String(req.user.userId);

const listColumns = () =>
  LeadColumnModel.find().sort({ active: -1, label: 1 }).lean();

const listAssignableUsers = async () => {
  const users = await UserModel.find({ isDisabled: { $ne: true } })
    // Assignment only needs an unambiguous recipient. Avoid reading or resizing
    // profile images on every lead-page visit; the selector is loaded on demand.
    .select("name email user_role")
    .sort({ name: 1 })
    .lean();
  return users.map((user) => ({
    userId: String(user._id),
    name: user.name,
    email: user.email,
    role: user.user_role,
  }));
};

const listLeads = async (req) => {
  const query = isManager(req.user)
    ? {}
    : { assignedTo: String(req.user.userId) };
  const status = cleanText(req.query.status, 30).toLowerCase();
  const search = cleanText(req.query.search, 120);
  if (STATUSES.includes(status)) query.status = status;
  if (search) {
    const regex = new RegExp(
      search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    query.$or = [
      { name: regex },
      { mobileNumber: regex },
      { email: regex },
      { companyName: regex },
      { serviceRequirement: regex },
    ];
  }
  // The UI deliberately pages at 100 records so an old import cannot block the
  // dashboard. Keep this server-side: filters always apply before paging.
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 100);
  const page = Math.max(Math.floor(Number(req.query.page) || 1), 1);
  const [leads, total] = await Promise.all([
    LeadManagementModel.find(query)
      .select("-assignmentHistory -statusHistory")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .maxTimeMS(12000)
      .lean(),
    LeadManagementModel.countDocuments(query).maxTimeMS(12000),
  ]);
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  return {
    leads,
    pagination: {
      page: Math.min(page, totalPages),
      pageSize: limit,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  };
};

const leadForResponse = (lead) => {
  const plain = lead?.toObject ? lead.toObject() : { ...lead };
  delete plain.assignmentHistory;
  delete plain.statusHistory;
  return plain;
};

router.use(authenticateUser);

router.get("/template", managerOnly, (_req, res) => {
  const csv =
    "Name,Mobile Number,Email,Service Requirement,Company Name\nAarav Sharma,9876543210,aarav@example.com,Website development,Example Private Limited\n";
  res.type("text/csv").attachment("leads-import-template.csv").send(csv);
});

router.get("/columns", async (_req, res) => {
  try {
    const columns = await listColumns();
    res.json({ columns });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/columns", managerOnly, async (req, res) => {
  try {
    const currentActor = {
      id: String(req.user.userId),
      name: await getActorName(req),
    };
    const label = displayLabel(req.body?.label);
    const key = keyFor(req.body?.key || label);
    if (!label || !key || RESERVED_KEYS.has(key))
      return res
        .status(400)
        .json({ message: "Choose a unique custom column name." });
    const column = await LeadColumnModel.create({
      key,
      label,
      createdBy: currentActor.id,
      createdByName: currentActor.name,
    });
    res.status(201).json({ message: "Custom column added.", column });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({
      message:
        error.code === 11000
          ? "A column with that name already exists."
          : error.message,
    });
  }
});

router.patch("/columns/:id", managerOnly, async (req, res) => {
  try {
    const updates = {};
    if (Object.prototype.hasOwnProperty.call(req.body, "label")) {
      const label = displayLabel(req.body.label);
      if (!label)
        return res.status(400).json({ message: "Column label is required." });
      updates.label = label;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "active"))
      updates.active = Boolean(req.body.active);
    const column = await LeadColumnModel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!column) return res.status(404).json({ message: "Column not found." });
    res.json({ message: "Column updated.", column });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/users", managerOnly, async (_req, res) => {
  try {
    res.json({ users: await listAssignableUsers() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/bootstrap", async (req, res) => {
  try {
    const manager = isManager(req.user);
    const [leadData, columns] = await Promise.all([
      listLeads(req),
      listColumns(),
    ]);
    res.json({
      ...leadData,
      columns,
      canManage: manager,
      canDelete: canDeleteLeads(req.user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const leadData = await listLeads(req);
    res.json({
      ...leadData,
      canManage: isManager(req.user),
      canDelete: canDeleteLeads(req.user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", managerOnly, async (req, res) => {
  try {
    const currentActor = {
      id: String(req.user.userId),
      name: await getActorName(req),
    };
    const leadData = normaliseLead(req.body);
    await ensureColumns(
      Object.keys(leadData.customFields).map((key) => ({ key, label: key })),
      currentActor,
    );
    const lead = await LeadManagementModel.create({
      ...leadData,
      createdBy: currentActor.id,
      createdByName: currentActor.name,
      source: "manual",
      lastUpdatedBy: currentActor.id,
      lastUpdatedByName: currentActor.name,
    });
    res
      .status(201)
      .json({ message: "Lead added.", lead: leadForResponse(lead) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/import", managerOnly, upload.single("file"), async (req, res) => {
  try {
    if (!req.file?.buffer)
      return res
        .status(400)
        .json({ message: "Choose a CSV, XLS or XLSX file to import." });
    const book = XLSX.read(req.file.buffer, {
      type: "buffer",
      raw: false,
      cellText: true,
    });
    const sheet = book.Sheets[book.SheetNames[0]];
    const grid = sheet
      ? XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          blankrows: false,
        })
      : [];
    const headings = (grid[0] || []).map((value) => cleanText(value, 80));
    const indexed = headings
      .map((label, index) => ({
        label,
        index,
        canonical: canonicalHeader(label),
      }))
      .filter((item) => item.label);
    const hasName = indexed.some((item) => item.canonical === "name");
    const hasMobile = indexed.some((item) => item.canonical === "mobileNumber");
    if (!hasName || !hasMobile)
      return res.status(400).json({
        message:
          "The first row must include Name and Mobile Number. Optional standard columns: Email, Service Requirement, Company Name. Download the template if needed.",
      });
    const rows = grid
      .slice(1)
      .filter((row) => row.some((cell) => cleanText(cell)));
    if (!rows.length)
      return res
        .status(400)
        .json({ message: "The selected file has no lead rows." });
    if (rows.length > 5000)
      return res
        .status(400)
        .json({ message: "Upload up to 5,000 leads in one file." });
    const currentActor = {
      id: String(req.user.userId),
      name: await getActorName(req),
    };
    const customColumns = indexed
      .filter((item) => !item.canonical)
      .map((item) => ({ key: keyFor(item.label), label: item.label }));
    await ensureColumns(customColumns, currentActor);
    const valid = [],
      rejected = [];
    rows.forEach((row, offset) => {
      const valueFor = (canonical) =>
        indexed.find((item) => item.canonical === canonical)?.index;
      const customFields = Object.fromEntries(
        indexed
          .filter((item) => !item.canonical)
          .map((item) => [keyFor(item.label), cleanText(row[item.index], 2000)])
          .filter(([, value]) => value),
      );
      try {
        const data = normaliseLead({
          name: row[valueFor("name")],
          mobileNumber: row[valueFor("mobileNumber")],
          email: row[valueFor("email")],
          serviceRequirement: row[valueFor("serviceRequirement")],
          companyName: row[valueFor("companyName")],
          customFields,
        });
        valid.push({
          ...data,
          createdBy: currentActor.id,
          createdByName: currentActor.name,
          source: "import",
          importedFileName: cleanText(req.file.originalname, 255),
          lastUpdatedBy: currentActor.id,
          lastUpdatedByName: currentActor.name,
        });
      } catch (error) {
        rejected.push({ row: offset + 2, reason: error.message });
      }
    });
    if (!valid.length)
      return res.status(400).json({
        message:
          "No rows could be imported. Fix the required Name and Mobile Number values.",
        rejected,
      });
    const inserted = await LeadManagementModel.insertMany(valid, {
      ordered: false,
    });
    res.status(201).json({
      message: `${inserted.length} lead${inserted.length === 1 ? "" : "s"} imported.`,
      imported: inserted.length,
      rejected,
      columns: customColumns,
    });
  } catch (error) {
    res
      .status(400)
      .json({ message: error.message || "Could not read the lead file." });
  }
});

router.post("/assign", managerOnly, async (req, res) => {
  try {
    const ids = [
      ...new Set(
        Array.isArray(req.body?.leadIds) ? req.body.leadIds.map(String) : [],
      ),
    ].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const assignedTo = String(req.body?.userId || "");
    if (!ids.length)
      return res
        .status(400)
        .json({ message: "Select at least one lead to assign." });
    if (ids.length > 5000)
      return res
        .status(400)
        .json({ message: "Assign up to 5,000 leads at once." });
    const [recipient, leads] = await Promise.all([
      UserModel.findOne({ _id: assignedTo, isDisabled: { $ne: true } })
        .select("name")
        .lean(),
      LeadManagementModel.find({ _id: { $in: ids } })
        .select("_id")
        .lean(),
    ]);
    if (!recipient)
      return res.status(400).json({ message: "Choose an active CRM user." });
    if (!leads.length)
      return res
        .status(404)
        .json({ message: "The selected leads are no longer available." });
    const currentActor = {
      id: String(req.user.userId),
      name: await getActorName(req),
    };
    const now = new Date();
    const operations = leads.map((lead) => ({
      updateOne: {
        filter: { _id: lead._id },
        update: {
          $set: {
            assignedTo,
            assignedToName: recipient.name,
            assignedBy: currentActor.id,
            assignedByName: currentActor.name,
            assignedAt: now,
            lastUpdatedBy: currentActor.id,
            lastUpdatedByName: currentActor.name,
          },
          $push: {
            assignmentHistory: {
              assignedTo,
              assignedToName: recipient.name,
              assignedBy: currentActor.id,
              assignedByName: currentActor.name,
              assignedAt: now,
            },
          },
        },
      },
    }));
    await LeadManagementModel.bulkWrite(operations, { ordered: false });
    await NotificationModel.create({
      user_id: assignedTo,
      type: "lead_assigned",
      message: `${currentActor.name} assigned ${leads.length} lead${leads.length === 1 ? "" : "s"} to you.`,
      reference_id: String(leads[0]._id),
    });
    res.json({
      message: `${leads.length} lead${leads.length === 1 ? "" : "s"} assigned to ${recipient.name}.`,
      assigned: leads.length,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/selected", seniorManagementOnly, async (req, res) => {
  try {
    const ids = [
      ...new Set(
        Array.isArray(req.body?.leadIds) ? req.body.leadIds.map(String) : [],
      ),
    ].filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!ids.length)
      return res
        .status(400)
        .json({ message: "Select at least one lead to delete." });
    if (ids.length > 100)
      return res
        .status(400)
        .json({ message: "Delete up to 100 leads at once." });
    const deletion = await LeadManagementModel.deleteMany({
      _id: { $in: ids },
    });
    res.json({
      message: `${deletion.deletedCount} lead${deletion.deletedCount === 1 ? "" : "s"} deleted.`,
      deletedIds: ids,
      deleted: deletion.deletedCount,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const lead = await LeadManagementModel.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found." });
    if (!canAccessLead(req, lead))
      return res
        .status(403)
        .json({ message: "You can update only leads assigned to you." });
    const manager = isManager(req.user);
    const currentActor = {
      id: String(req.user.userId),
      name: await getActorName(req),
    };
    const updates = {
      lastUpdatedBy: currentActor.id,
      lastUpdatedByName: currentActor.name,
    };
    if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
      const status = cleanText(req.body.status, 30).toLowerCase();
      if (!STATUSES.includes(status))
        return res.status(400).json({ message: "Choose a valid lead status." });
      if (status !== lead.status) {
        updates.status = status;
        lead.statusHistory.push({
          from: lead.status,
          to: status,
          changedBy: currentActor.id,
          changedByName: currentActor.name,
          changedAt: new Date(),
        });
      }
    }
    if (manager) {
      const source = {
        ...lead.toObject(),
        ...req.body,
        customFields: {
          ...(lead.customFields?.toObject?.() ||
            Object.fromEntries(lead.customFields || [])),
          ...(req.body.customFields || {}),
        },
      };
      const clean = normaliseLead(source);
      Object.assign(updates, clean);
      await ensureColumns(
        Object.keys(clean.customFields).map((key) => ({ key, label: key })),
        currentActor,
      );
    }
    Object.assign(lead, updates);
    await lead.save();
    res.json({ message: "Lead updated.", lead: leadForResponse(lead) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/:id/notes", async (req, res) => {
  try {
    const lead = await LeadManagementModel.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found." });
    if (!canAccessLead(req, lead))
      return res
        .status(403)
        .json({ message: "You can update only leads assigned to you." });
    const number = Number(req.body?.number);
    const content = cleanText(req.body?.content, 3000);
    if (!Number.isInteger(number) || number < 1 || number > 5 || !content)
      return res
        .status(400)
        .json({ message: "Provide note 1 to 5 and its content." });
    const currentActor = {
      id: String(req.user.userId),
      name: await getActorName(req),
    };
    const existing = lead.noteEntries.find((note) => note.number === number);
    if (
      existing &&
      !isManager(req.user) &&
      existing.createdBy !== currentActor.id
    )
      return res.status(403).json({
        message:
          "Only the original author or an administrator can edit this note.",
      });
    if (existing) {
      existing.content = content;
      existing.updatedAt = new Date();
    } else {
      lead.noteEntries.push({
        number,
        content,
        createdBy: currentActor.id,
        createdByName: currentActor.name,
      });
    }
    lead.lastUpdatedBy = currentActor.id;
    lead.lastUpdatedByName = currentActor.name;
    await lead.save();
    res.json({ message: `Note ${number} saved.`, lead: leadForResponse(lead) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.use((error, _req, res, _next) =>
  res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
    message:
      error.code === "LIMIT_FILE_SIZE"
        ? "Lead file must be 12 MB or smaller."
        : error.message || "Unable to process the lead request.",
  }),
);

export default router;
