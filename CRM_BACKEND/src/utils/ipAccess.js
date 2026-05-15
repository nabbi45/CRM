import { SecuritySettingsModel } from "../models/SecuritySettingsModel.js";

export const SECURITY_ADMIN_ROLES = ["director", "super admin", "dev", "srdev", "sr dev", "admin", "senior admin"];

export const normalizeRole = (role = "") => role.toString().trim().toLowerCase();

export const canManageSecurity = (role = "") => SECURITY_ADMIN_ROLES.includes(normalizeRole(role));

export const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")?.[0] || req.ip || req.socket?.remoteAddress || "";

  return raw
    .toString()
    .trim()
    .replace(/^::ffff:/, "")
    .replace(/^::1$/, "127.0.0.1");
};

const ipv4ToNumber = (ip) => {
  const parts = String(ip).trim().split(".");
  if (parts.length !== 4) return null;

  let total = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (value < 0 || value > 255) return null;
    total = (total << 8) + value;
  }

  return total >>> 0;
};

export const isValidIpNetwork = (network = "") => {
  const value = network.trim();
  if (!value) return false;

  if (value.includes("/")) {
    const [ip, prefix] = value.split("/");
    const prefixNum = Number(prefix);
    return ipv4ToNumber(ip) !== null && Number.isInteger(prefixNum) && prefixNum >= 0 && prefixNum <= 32;
  }

  return ipv4ToNumber(value) !== null || value.includes(":");
};

export const isIpAllowedByNetwork = (ip, network) => {
  const value = String(network || "").trim();
  const requestIp = String(ip || "").trim();
  if (!value || !requestIp) return false;

  if (!value.includes("/")) return value === requestIp;

  const [baseIp, prefix] = value.split("/");
  const requestNumber = ipv4ToNumber(requestIp);
  const baseNumber = ipv4ToNumber(baseIp);
  const prefixNum = Number(prefix);

  if (requestNumber === null || baseNumber === null || !Number.isInteger(prefixNum)) return false;
  const mask = prefixNum === 0 ? 0 : (0xffffffff << (32 - prefixNum)) >>> 0;

  return (requestNumber & mask) === (baseNumber & mask);
};

export const getSecuritySettings = async () => {
  let settings = await SecuritySettingsModel.findOne();
  if (!settings) {
    settings = await SecuritySettingsModel.create({});
  }
  return settings;
};

export const isIpAllowed = async (ip) => {
  const settings = await getSecuritySettings();
  if (!settings.ipRestrictionEnabled) return { allowed: true, settings };

  const activeNetworks = (settings.allowlist || []).filter((item) => item.enabled);
  if (activeNetworks.length === 0) return { allowed: false, settings };

  return {
    allowed: activeNetworks.some((item) => isIpAllowedByNetwork(ip, item.value)),
    settings,
  };
};
