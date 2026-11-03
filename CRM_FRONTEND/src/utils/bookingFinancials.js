// Pure financial rules shared by the browser, API, audit and import paths.
export const TERM_KEYS = Array.from({ length: 10 }, (_, i) => `term_${i + 1}`);
export const FINANCIAL_VERSION = 2;
export const paise = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100);
export const money = (value) => value / 100;
export const monthIST = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 7);
};
export const serviceKey = (service) => String(service.service_key || service.service_id || service.service_name || service.service || '').trim().toLowerCase();
export const blankPercentage = (value) => value === '' || value === null || value === undefined;

export function termMetadata(booking, key) {
  const saved = booking.term_shares?.[key] || {};
  return {
    ...saved,
    creator: saved.creator?.user_id ? saved.creator : { user_id: booking.user_id, user_name: booking.bdm },
    payment_date: saved.payment_date || booking.payment_date || booking.date || booking.createdAt,
    payment_mode: saved.payment_mode || booking.bank || '',
    shared_with: Array.isArray(saved.shared_with) && (saved.creator?.user_id || saved.shared_with.length)
      ? saved.shared_with : key === 'term_1' ? (booking.shared_with || []) : [],
  };
}

export function termHasGst(booking, key) {
  const mode = String(termMetadata(booking, key).payment_mode || '').trim().toLowerCase();
  if (mode) return mode !== 'cash';
  if (typeof booking.gst_included === 'boolean') return booking.gst_included;
  if (typeof booking.gst_applied === 'boolean') return booking.gst_applied;
  return true;
}

export function participantsForTerm(booking, key, { validate = false } = {}) {
  const term = termMetadata(booking, key);
  const creator = { user_id: String(term.creator?.user_id || ''), user_name: term.creator?.user_name || 'UNKNOWN' };
  const seen = new Set([creator.user_id]);
  const shared = (term.shared_with || []).filter((item) => {
    const id = String(item.user_id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id); return true;
  });
  const blanks = shared.filter((item) => blankPercentage(item.percentage));
  if (validate && blanks.length && blanks.length !== shared.length) throw new Error('Leave every coworker percentage blank for equal sharing, or enter every percentage.');
  if (blanks.length === shared.length && shared.length) return [creator, ...shared].map((item) => ({ ...item, user_id: String(item.user_id), weight: 1 }));
  const total = shared.reduce((sum, item) => sum + Number(item.percentage || 0), 0);
  if (validate && (total > 100 || shared.some((item) => !Number.isFinite(Number(item.percentage)) || Number(item.percentage) < 0))) throw new Error('Shared percentages must be finite, non-negative and total at most 100%.');
  return [{ ...creator, weight: Math.max(0, 100 - total) }, ...shared.map((item) => ({ ...item, user_id: String(item.user_id), weight: Number(item.percentage || 0) }))].filter((item) => item.weight > 0);
}

export const termFinancialSignature = (booking, key) => JSON.stringify([
  paise(booking?.[key]), String(termMetadata(booking || {}, key).payment_mode).trim().toLowerCase(),
  participantsForTerm(booking || {}, key).map((person) => [person.user_id, person.weight]),
]);

// Largest remainder allocation; ties follow the saved participant order.
export function splitPaise(total, participants) {
  const weight = participants.reduce((sum, item) => sum + item.weight, 0);
  if (!weight) return [];
  const sign = total < 0 ? -1 : 1;
  const absolute = Math.abs(total);
  const rows = participants.map((item, index) => {
    const raw = absolute * item.weight / weight;
    return { ...item, index, amount: Math.floor(raw), fraction: raw - Math.floor(raw) };
  });
  let remaining = absolute - rows.reduce((sum, row) => sum + row.amount, 0);
  [...rows].sort((a, b) => b.fraction - a.fraction || a.index - b.index).forEach((row) => { if (remaining > 0) { row.amount++; remaining--; } });
  return rows.map(({ index, fraction, weight: unused, ...row }) => ({ ...row, amount: money(row.amount * sign) }));
}

export function activeRecoveries(booking) {
  const events = booking.deduction_recoveries || [];
  const reversed = new Set(events.filter((event) => event.kind === 'reversal').map((event) => event.reverses));
  return events.filter((event) => event.kind !== 'reversal' && !reversed.has(event.id));
}

function takeFromParticipants(amount, people, available) {
  const taken = new Map(people.map((person) => [person.user_id, 0]));
  let remaining = amount;
  while (remaining > 0) {
    const eligible = people.filter((person) => (available.get(person.user_id) || 0) > 0);
    if (!eligible.length) break;
    let used = 0;
    splitPaise(remaining, eligible).forEach((person) => {
      const value = Math.min(paise(person.amount), available.get(person.user_id));
      taken.set(person.user_id, taken.get(person.user_id) + value);
      available.set(person.user_id, available.get(person.user_id) - value);
      used += value;
    });
    if (!used) break;
    remaining -= used;
  }
  return people.map((person) => ({ user_id: person.user_id, user_name: person.user_name, amount: money(taken.get(person.user_id)) }));
}

export function calculateBookingFinancials(booking, { forceAutomatic = false } = {}) {
  const seen = new Set();
  const services = (booking.service_deductions_snapshot || []).filter((item) => {
    const identity = String(item.service_id || serviceKey(item));
    if (seen.has(identity) || paise(item.deduction) <= 0) return false;
    seen.add(identity); return true;
  }).map((item) => ({ ...item, service_key: serviceKey(item), official: paise(item.deduction), remaining: paise(item.deduction), applied: 0 }));
  const recoveries = activeRecoveries(booking);
  recoveries.forEach((event) => {
    const service = services.find((item) => item.service_key === event.service_key);
    if (service) { service.remaining -= paise(event.amount); service.applied += paise(event.amount); }
  });
  const first = TERM_KEYS.find((key) => Number(booking[key] || 0) > 0);
  const terms = [];
  for (const key of TERM_KEYS) {
    if (!(Number(booking[key]) > 0)) continue;
    const metadata = termMetadata(booking, key);
    const gross = paise(booking[key]);
    const base = termHasGst(booking, key) ? Math.round(gross / 1.18) : gross;
    const refundable = booking.is_refundable ? Math.round(base * Number(booking.refundable_percentage || 0) / 100) : 0;
    let capacity = Math.max(0, base - refundable);
    const participants = participantsForTerm(booking, key);
    const baseParticipants = splitPaise(base, participants);
    const available = new Map(baseParticipants.map((person) => [person.user_id, paise(person.amount)]));
    const refundableParticipants = takeFromParticipants(refundable, participants, available);
    const creditParticipants = participants.map((person) => ({ user_id: person.user_id, user_name: person.user_name, amount: money(available.get(person.user_id) || 0) }));
    const allocations = [];
    const baseline = !forceAutomatic && (booking.deduction_baseline || []).find((item) => item.term_key === key);
    const legacy = !forceAutomatic && Number(booking.financial_version || 0) < FINANCIAL_VERSION;
    for (const service of services) {
      const eligible = TERM_KEYS.indexOf(service.effective_term_key || 'term_1') <= TERM_KEYS.indexOf(key);
      const fixed = baseline?.allocations?.find((item) => item.service_key === service.service_key);
      const requested = baseline ? paise(fixed?.amount) : legacy && key !== first ? 0 : capacity;
      const amount = eligible ? Math.max(0, Math.min(capacity, service.remaining, requested)) : 0;
      if (!amount) continue;
      service.remaining -= amount; service.applied += amount; capacity -= amount;
      allocations.push({ service_key: service.service_key, service_name: service.service_name, amount: money(amount), participants: takeFromParticipants(amount, participants, available) });
    }
    terms.push({ term_key: key, ...metadata, gross: money(gross), base: money(base), gst: money(gross - base), refundable: money(refundable), credit_before_service: money(base - refundable), applied: money(base - refundable - capacity), net: money(capacity), allocations,
      participants: participants.map((person) => ({ user_id: person.user_id, user_name: person.user_name, amount: money(available.get(person.user_id) || 0) })), credit_participants: creditParticipants, refundable_participants: refundableParticipants, base_participants: baseParticipants });
  }
  const balances = services.map(({ official, remaining, applied, ...service }) => ({ ...service, official: money(official), applied: money(applied), pending: money(Math.max(0, remaining)) }));
  return { version: FINANCIAL_VERSION, terms, recoveries, services: balances,
    official: money(services.reduce((sum, item) => sum + item.official, 0)), applied: money(services.reduce((sum, item) => sum + item.applied, 0)), pending: money(services.reduce((sum, item) => sum + Math.max(0, item.remaining), 0)) };
}

export const freezeTermAllocations = (state) => state.terms.map((term) => ({ term_key: term.term_key, allocations: term.allocations.map(({ service_key, service_name, amount }) => ({ service_key, service_name, amount })) }));

const cache = new WeakMap();
export function getBookingFinancials(booking) {
  const prior = cache.get(booking);
  if (prior && prior.revision === booking.financial_revision && prior.version === booking.financial_version &&
      prior.bank === booking.bank && prior.gst === booking.gst_included && prior.refundable === booking.is_refundable &&
      prior.percentage === booking.refundable_percentage && prior.date === booking.payment_date &&
      prior.snapshot === booking.service_deductions_snapshot && prior.shares === booking.term_shares &&
      prior.baseline === booking.deduction_baseline && prior.recoveries === booking.deduction_recoveries &&
      TERM_KEYS.every((key) => prior.amounts[key] === booking[key])) return prior.state;
  const state = calculateBookingFinancials(booking);
  cache.set(booking, { revision: booking.financial_revision, version: booking.financial_version, bank: booking.bank, gst: booking.gst_included,
    refundable: booking.is_refundable, percentage: booking.refundable_percentage, date: booking.payment_date,
    amounts: Object.fromEntries(TERM_KEYS.map((key) => [key, booking[key]])), snapshot: booking.service_deductions_snapshot,
    shares: booking.term_shares, baseline: booking.deduction_baseline, recoveries: booking.deduction_recoveries, state });
  return state;
}
