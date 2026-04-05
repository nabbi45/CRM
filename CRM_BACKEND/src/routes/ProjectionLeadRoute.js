import express from "express";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { ProjectionLeadModel } from "../models/ProjectionLeadModel.js";
import { UserModel } from "../models/UserModel.js";

const ProjectionLeadRoutes = express.Router();

const normalizeRole = (role = "") => role.toString().trim().toLowerCase();

const ROLES_WITH_ALL_ACCESS = ["admin", "super admin", "dev", "srdev", "senior admin"];
const ROLES_WITH_EDIT_ALL = ["bdm", ...ROLES_WITH_ALL_ACCESS];

const canViewAllLeads = (role) => ROLES_WITH_ALL_ACCESS.includes(normalizeRole(role));

const canEditLead = (role, lead, userId) => {
  if (!lead) return false;
  const normalized = normalizeRole(role);
  if (ROLES_WITH_EDIT_ALL.includes(normalized)) return true;
  return lead.created_by === userId;
};

const getUserName = async (userId) => {
  const user = await UserModel.findById(userId).lean();
  return user?.name || "Unknown";
};

ProjectionLeadRoutes.post("/", authenticateUser, async (req, res) => {
  try {
    const {
      date,
      name,
      phone_number,
      company_name,
      state,
      turnover,
      requirement,
      pitched,
      given_lead_to,
      notes_update,
    } = req.body;

    if (!date || !name || !phone_number) {
      return res.status(400).send({ message: "Date, Name and Phone Number are required." });
    }

    const createdByName = await getUserName(req.user.userId);

    const lead = await ProjectionLeadModel.create({
      date,
      name,
      phone_number,
      company_name: company_name || "",
      state: state || "",
      turnover: turnover || "",
      requirement: requirement || "",
      pitched: pitched || "",
      given_lead_to: given_lead_to || "",
      notes_update: notes_update || "",
      created_by: req.user.userId,
      created_by_name: createdByName,
    });

    return res.status(201).send({ message: "Projection lead created.", lead });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

ProjectionLeadRoutes.get("/", authenticateUser, async (req, res) => {
  try {
    const shouldViewAll = canViewAllLeads(req.user?.user_role);
    const includeTransferred = req.query?.include_transferred === "true";

    if (includeTransferred && !shouldViewAll) {
      return res.status(403).send({ message: "Only admin/dev roles can view transferred history." });
    }

    const query = { transferred_to_booking: includeTransferred };

    if (!shouldViewAll) {
      query.created_by = req.user.userId;
    }

    const leads = await ProjectionLeadModel.find(query).sort({ createdAt: -1 }).lean();
    return res.status(200).send(leads);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

ProjectionLeadRoutes.patch("/:id", authenticateUser, async (req, res) => {
  try {
    const lead = await ProjectionLeadModel.findById(req.params.id);
    if (!lead) {
      return res.status(404).send({ message: "Projection lead not found." });
    }

    if (!canEditLead(req.user?.user_role, lead, req.user.userId)) {
      return res.status(403).send({ message: "You do not have permission to edit this lead." });
    }

    const editableFields = [
      "date",
      "name",
      "phone_number",
      "company_name",
      "state",
      "turnover",
      "requirement",
      "pitched",
      "given_lead_to",
      "notes_update",
      "payment_received",
    ];

    const updates = {};
    for (const key of editableFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "payment_received")) {
      if (updates.payment_received) {
        updates.payment_received_at = new Date();
      } else {
        updates.payment_received_at = null;
      }
    }

    const updatedLead = await ProjectionLeadModel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );

    return res.status(200).send({ message: "Projection lead updated.", lead: updatedLead });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

ProjectionLeadRoutes.patch("/:id/mark-transferred", authenticateUser, async (req, res) => {
  try {
    const lead = await ProjectionLeadModel.findById(req.params.id);
    if (!lead) {
      return res.status(404).send({ message: "Projection lead not found." });
    }

    if (!canEditLead(req.user?.user_role, lead, req.user.userId)) {
      return res.status(403).send({ message: "You do not have permission to transfer this lead." });
    }

    if (!lead.payment_received) {
      return res.status(400).send({ message: "Payment must be received before transfer to booking." });
    }

    const bookingId = req.body?.booking_id || "";

    const updatedLead = await ProjectionLeadModel.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          transferred_to_booking: true,
          transferred_booking_id: bookingId,
          transferred_at: new Date(),
        },
      },
      { new: true }
    );

    return res.status(200).send({ message: "Lead transferred to booking.", lead: updatedLead });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

export default ProjectionLeadRoutes;
