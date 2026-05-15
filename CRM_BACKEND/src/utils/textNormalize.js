export const toUpperText = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : value;

export const toLowerEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export const normalizeBookingPayload = (booking = {}) => {
  const normalized = { ...booking };

  ["bdm", "company_name", "contact_person", "pan", "gst"].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(normalized, field)) {
      normalized[field] = toUpperText(normalized[field]);
    }
  });

  if (Object.prototype.hasOwnProperty.call(normalized, "email")) {
    normalized.email = toLowerEmail(normalized.email);
  }

  if (Array.isArray(normalized.shared_with)) {
    normalized.shared_with = normalized.shared_with.map((shared) => ({
      ...shared,
      user_name: toUpperText(shared.user_name),
    }));
  }

  return normalized;
};
