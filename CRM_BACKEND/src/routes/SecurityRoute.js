import express from "express";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { SecuritySettingsModel } from "../models/SecuritySettingsModel.js";
import {
  canManageSecurity,
  getClientIp,
  getSecuritySettings,
  isIpAllowed,
  isIpAllowedByNetwork,
  isValidIpNetwork,
} from "../utils/ipAccess.js";

const SecurityRoutes = express.Router();

const requireSecurityAdmin = (req, res, next) => {
  if (!canManageSecurity(req.user?.user_role)) {
    return res.status(403).send({ message: "Only authorized admins can manage security settings." });
  }
  next();
};

const serializeSettings = (settings) => ({
  ipRestrictionEnabled: Boolean(settings.ipRestrictionEnabled),
  allowlist: settings.allowlist || [],
  updatedBy: settings.updatedBy || "",
  updatedAt: settings.updatedAt,
});

SecurityRoutes.get("/settings", authenticateUser, requireSecurityAdmin, async (req, res) => {
  const settings = await getSecuritySettings();
  res.status(200).send(serializeSettings(settings));
});

SecurityRoutes.put("/settings", authenticateUser, requireSecurityAdmin, async (req, res) => {
  const { ipRestrictionEnabled, allowlist } = req.body;
  const list = Array.isArray(allowlist) ? allowlist : [];

  const normalizedAllowlist = list
    .map((item) => ({
      _id: item._id,
      label: String(item.label || "").trim(),
      value: String(item.value || "").trim(),
      enabled: Boolean(item.enabled),
      addedBy: item.addedBy || req.user?.userId || "",
      addedAt: item.addedAt || new Date(),
    }))
    .filter((item) => item.value);

  const invalid = normalizedAllowlist.find((item) => !isValidIpNetwork(item.value));
  if (invalid) {
    return res.status(400).send({ message: `Invalid IP/network: ${invalid.value}` });
  }

  const settings = await SecuritySettingsModel.findOneAndUpdate(
    {},
    {
      $set: {
        ipRestrictionEnabled: Boolean(ipRestrictionEnabled),
        allowlist: normalizedAllowlist,
        updatedBy: req.user?.userId || "",
      },
    },
    { new: true, upsert: true, runValidators: true }
  );

  res.status(200).send(serializeSettings(settings));
});

SecurityRoutes.get("/current-ip", authenticateUser, requireSecurityAdmin, async (req, res) => {
  const clientIp = getClientIp(req);
  const { allowed, settings } = await isIpAllowed(clientIp);
  const matchedNetwork = (settings.allowlist || [])
    .filter((item) => item.enabled)
    .find((item) => isIpAllowedByNetwork(clientIp, item.value));

  res.status(200).send({
    ip: clientIp,
    allowed,
    matchedNetwork: matchedNetwork || null,
  });
});

export default SecurityRoutes;
