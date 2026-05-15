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

  if (normalized.term_shares && typeof normalized.term_shares === "object") {
    normalized.term_shares = { ...normalized.term_shares };

    ["term_1", "term_2", "term_3"].forEach((termKey) => {
      if (!normalized.term_shares[termKey]) return;
      normalized.term_shares[termKey] = {
        ...normalized.term_shares[termKey],
        creator: normalized.term_shares[termKey].creator
          ? {
              ...normalized.term_shares[termKey].creator,
              user_name: toUpperText(normalized.term_shares[termKey].creator.user_name),
            }
          : normalized.term_shares[termKey].creator,
        shared_with: Array.isArray(normalized.term_shares[termKey].shared_with)
          ? normalized.term_shares[termKey].shared_with.map((shared) => ({
              ...shared,
              user_name: toUpperText(shared.user_name),
            }))
          : [],
      };
    });
  }

  return normalized;
};
