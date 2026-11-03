import React, { useMemo } from 'react';
import { Alert, Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { calculateBookingFinancials, freezeTermAllocations, serviceKey, TERM_KEYS, termFinancialSignature } from '../utils/bookingFinancials';

const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
export function previewFinancials(booking, catalog, source, targetTerm = 'term_1') {
  const previous = source?.service_deductions_snapshot || [];
  const seen = new Set();
  const snapshot = (booking.services || []).map((label) => {
    const normalized = String(label).trim().toLowerCase();
    const service = catalog.find((item) => [item.name, item.value].some((name) => String(name || '').trim().toLowerCase() === normalized));
    const saved = previous.find((item) => String(item.service_name).trim().toLowerCase() === normalized || (service && String(item.service_id) === String(service._id)));
    const item = saved || (service && Number(service.deduction) > 0 ? { service_name: label, service_id: service._id, deduction: service.deduction, effective_term_key: targetTerm } : null);
    const identity = item && (item.service_id || serviceKey(item));
    if (!item || seen.has(identity)) return null;
    seen.add(identity); return item;
  }).filter(Boolean);
  const baseline = source && !(source.financial_version >= 2) ? freezeTermAllocations(calculateBookingFinancials(source)) : source?.deduction_baseline || [];
  const financialChange = !source || termFinancialSignature(booking, targetTerm) !== termFinancialSignature(source, targetTerm);
  return calculateBookingFinancials({ ...source, ...booking, financial_version: 2, service_deductions_snapshot: snapshot, deduction_baseline: baseline.filter((term) => !financialChange || TERM_KEYS.indexOf(term.term_key) < TERM_KEYS.indexOf(targetTerm)) });
}

export default function DeductionPreview({ booking, catalog, source, targetTerm = 'term_1', state: suppliedState }) {
  const state = useMemo(() => suppliedState || (catalog ? previewFinancials(booking, catalog, source, targetTerm) : null), [suppliedState, booking, catalog, source, targetTerm]);
  if (!state) return <Alert severity="info">Service deduction preview is waiting for the service catalog.</Alert>;
  if (!state.services.length) return null;
  const term = state.terms.find((item) => item.term_key === targetTerm);
  return <Box sx={{ width: '100%', my: 1, overflowX: 'auto' }}>
    <Typography fontWeight={700}>Service deductions</Typography>
    <Table size="small" aria-label="Service deduction preview">
      <TableHead><TableRow><TableCell>Service</TableCell><TableCell align="right">Official fee</TableCell><TableCell align="right">Applied</TableCell><TableCell align="right">Pending</TableCell></TableRow></TableHead>
      <TableBody>{state.services.map((item) => <TableRow key={item.service_key}><TableCell>{item.service_name}</TableCell><TableCell align="right">{currency(item.official)}</TableCell><TableCell align="right">{currency(item.applied)}</TableCell><TableCell align="right">{currency(item.pending)}</TableCell></TableRow>)}</TableBody>
    </Table>
    <Typography variant="body2" sx={{ mt: 1 }}>Official {currency(state.official)} · Applied {currency(state.applied)} · Pending {currency(state.pending)}{term ? ` · This term deduction ${currency(term.applied)} · Net credit ${currency(term.net)}` : ''}</Typography>
    {state.pending > 0 && <Alert severity="warning" sx={{ mt: 1 }}>The maximum available amount is deducted automatically. The pending balance will be deducted from later payments.</Alert>}
  </Box>;
}
