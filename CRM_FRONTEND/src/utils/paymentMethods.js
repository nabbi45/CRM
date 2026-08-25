// One source of truth for payment modes used by new bookings and continuations.
export const BOOKING_PAYMENT_METHODS = Object.freeze([
  "IDFC BANK - CONSULTANCY",
  "IDFC BANK - ADVISORY",
  "YES BANK",
  "RAZORPAY",
  "CASHFREE",
  "CHEQUE IDFC BANK - ADVISORY",
  "CHEQUE IDFC BANK - CONSULTANCY",
  "CHEQUE YES BANK",
  "CASH",
]);

// These values remain selectable in filters and while editing older bookings.
// They are not offered for new bookings, preventing fresh inconsistent values.
export const LEGACY_PAYMENT_METHODS = Object.freeze([
  "Axis Bank",
  "IDFC BANK",
  "Razor Pay",
  "Cashfree",
  "Cheque IDFC Bank",
  "Cheque Axis Bank",
  "Cash",
]);

export const ALL_PAYMENT_METHODS = Object.freeze([
  ...new Set([...BOOKING_PAYMENT_METHODS, ...LEGACY_PAYMENT_METHODS]),
]);

export const getPaymentMethodsForEdit = (currentValue = "") => [
  ...new Set([
    ...BOOKING_PAYMENT_METHODS,
    ...LEGACY_PAYMENT_METHODS,
    String(currentValue || "").trim(),
  ].filter(Boolean)),
];
