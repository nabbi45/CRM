import React, { useEffect, useState, useRef } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { apiUrl } from './LoginSignup';
import DeductionPreview from './DeductionPreview';
import { TERM_KEYS } from '../utils/bookingFinancials';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const controls = ['director', 'dev', 'srdev', 'sr dev'];
const currency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(amount || 0));
const requestId = () => window.crypto?.randomUUID?.() || `deduction_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export default function DeductionManager({ open, bookingId, onClose, onChanged }) {
  const session = JSON.parse(localStorage.getItem('userSession') || '{}');
  const canManage = controls.includes(String(session.user_role || '').trim().toLowerCase());
  const generation = useRef(0);
  const invalidateRequest = () => { generation.current++; };
  const [selected, setSelected] = useState(bookingId || '');
  const [data, setData] = useState(null);
  const [audit, setAudit] = useState(null);
  const [page, setPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [form, setForm] = useState({ service_key: '', term_key: 'term_1', amount: '', period: 'original' });
  const [preview, setPreview] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const call = async (path, body) => {
    const response = await fetchWithTimeout(`${apiUrl}/booking/${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: session.token || '', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Unable to load deductions.');
    return result;
  };
  const load = async (id = selected) => {
    const version = ++generation.current;
    if (id) {
      const result = await call(`${id}/deductions?page=${eventPage}`);
      if (version !== generation.current) return;
      setData(result);
      setForm((old) => ({ ...old, service_key: result.state.services.find((row) => row.pending > 0)?.service_key || result.state.services[0]?.service_key || '', term_key: result.state.terms[0]?.term_key || 'term_1', amount: '' }));
    } else if (canManage) { const result = await call(`deduction-audit?page=${page}`); if (version === generation.current) setAudit(result); }
  };
  useEffect(() => { if (open) { setSelected(bookingId || ''); setData(null); setPreview(null); setError(''); setReason(''); setEventPage(1); setPendingRequest(null); } }, [open, bookingId]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true); setError(''); setPreview(null); if (selected) setData(null);
    load().catch((err) => { if (!cancelled) setError(err.message); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; invalidateRequest(); };
    // Selection and paging are the request boundaries; session comes from login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, page, eventPage]);
  const change = (key, value) => { setForm((old) => ({ ...old, [key]: value })); setPreview(null); setPendingRequest(null); };
  const mutate = async (action, extra = {}) => {
    if (!reason.trim()) { setError('Enter a reason before posting a financial change.'); return; }
    setBusy(true); setError('');
    const request = pendingRequest?.action === action ? pendingRequest : { action, id: requestId() };
    setPendingRequest(request);
    try {
      await call(`${selected}/${action}`, { ...form, ...extra, reason, expected_revision: data.financial_revision, request_id: request.id });
      setPendingRequest(null); setPreview(null); await load(); if (onChanged) onChanged();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const showPreview = async () => {
    setBusy(true); setError('');
    try { setPreview(await call(`${selected}/deduction-recoveries/preview`, form)); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const reversed = new Set((data?.recoveries || []).filter((event) => event.kind === 'reversal').map((event) => event.reverses));
  return <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="lg" fullWidth>
    <DialogTitle>Booking deductions and audit</DialogTitle>
    <DialogContent dividers><Stack spacing={2}>
      {error && <Alert severity="error">{error}<Button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await load(); } catch (err) { setError(err.message); } finally { setBusy(false); } }}>Reload deductions</Button></Alert>}
      {busy && <Typography role="status">Loading…</Typography>}
      {!selected && audit && <>
        <Typography>Review every booking’s saved fees and unpaid balance. Confirm catalog fees before posting a recovery.</Typography>
        {audit.rows.map((row) => <Box key={row.booking_id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography fontWeight={700}>{row.company_name} · {row.contact_person}</Typography>
          <Typography variant="caption">{row.booking_id} · {row.booking_date ? new Date(row.booking_date).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : ''}</Typography>
          <Typography>{row.flags.join(' · ') || 'No missing fees detected'}</Typography>
          {row.after && <Typography>Official {currency(row.after.official)} · Applied {currency(row.after.applied)} · Pending {currency(row.after.pending)}</Typography>}
          <Button onClick={() => { setSelected(row.booking_id); setEventPage(1); }} disabled={row.unresolved}>Review booking</Button>
        </Box>)}
        <Stack direction="row" spacing={1}><Button disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}>Previous</Button><Typography>Page {page} of {audit.pagination.pages || 1}</Typography><Button disabled={page >= audit.pagination.pages || busy} onClick={() => setPage(page + 1)}>Next</Button></Stack>
      </>}
      {selected && data && <>
        <Typography variant="caption">Booking ID: {selected}</Typography>
        {data.state.terms.map((term) => <Box key={term.term_key} sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography fontWeight={700}>Term {TERM_KEYS.indexOf(term.term_key) + 1} · {term.payment_mode || 'Payment mode unavailable'}</Typography>
          <Typography variant="body2">Received {currency(term.gross)} · GST {currency(term.gst)} · Credit before service deductions {currency(term.credit_before_service)} · Service deductions {currency(term.applied)} · Net {currency(term.net)}</Typography>
        </Box>)}
        <DeductionPreview state={data.state} />
        {canManage && data.audit && <>
          {data.audit.flags.length > 0 && <Alert severity="info">{data.audit.flags.join(' · ')}</Alert>}
          {(data.audit.date_candidates || []).map((candidate) => <Alert severity="warning" key={candidate.term_key}>History shows {candidate.term_key.replace('_', ' ')} changing from {candidate.previous_date} to {candidate.current_date} alongside a later term. Verify that entry and correct the specific term through Edit Booking; fee review does not change payment dates.</Alert>)}
          <Typography fontWeight={700}>Catalog proposal — saved historical rates are retained</Typography>
          <DeductionPreview state={data.audit.after} />
          <TextField label="Reason for review, recovery or reversal" value={reason} onChange={(e) => { setReason(e.target.value); setPendingRequest(null); }} required fullWidth multiline />
          <Button variant="outlined" disabled={busy || !reason.trim()} onClick={() => mutate('deduction-review', { snapshot_hash: data.audit.snapshot_hash })}>Confirm reviewed service fees</Button>
          <Typography fontWeight={700}>Recover pending service deduction</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField select label="Service" value={form.service_key} onChange={(e) => change('service_key', e.target.value)} sx={{ minWidth: 220, flex: 1 }}>{data.state.services.map((service) => <MenuItem key={service.service_key} value={service.service_key}>{service.service_name} · Pending {currency(service.pending)}</MenuItem>)}</TextField>
            <TextField select label="Originating term" value={form.term_key} onChange={(e) => change('term_key', e.target.value)} sx={{ minWidth: 160 }}>{data.state.terms.map((term) => <MenuItem key={term.term_key} value={term.term_key}>Term {TERM_KEYS.indexOf(term.term_key) + 1}</MenuItem>)}</TextField>
            <TextField select label="Score period" value={form.period} onChange={(e) => change('period', e.target.value)} sx={{ minWidth: 170 }}><MenuItem value="original">Original month</MenuItem><MenuItem value="current">Current month</MenuItem></TextField>
            <TextField label="Amount" type="number" value={form.amount} placeholder="Maximum pending" onChange={(e) => change('amount', e.target.value)} inputProps={{ min: 0, step: '0.01' }} />
          </Stack>
          <Button disabled={busy || !form.service_key} onClick={showPreview}>Preview capped recovery</Button>
          {preview && <Alert severity="info">Recover {currency(preview.amount)} in {preview.month}; pending afterwards {currency(preview.pending_after)}. {preview.participants.map((person) => `${person.user_name}: ${currency(person.amount)} (available score ${currency(person.available)})`).join(' · ')}</Alert>}
          <Button variant="contained" disabled={busy || !preview?.amount || !reason.trim()} onClick={() => mutate('deduction-recoveries')}>Post reviewed recovery</Button>
          {(data.recoveries || []).filter((event) => event.kind !== 'reversal' && !reversed.has(event.id)).map((event) => <Box key={event.id}><Typography>{event.service_name} · {currency(event.amount)} · {event.month} · {event.reason}</Typography><Button disabled={busy || !reason.trim()} onClick={() => mutate(`deduction-recoveries/${event.id}/reverse`)}>Reverse recovery</Button></Box>)}
        </>}
        <Typography fontWeight={700}>Financial history</Typography>
        {data.events.map((event) => <Box key={event.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
          <Typography>{event.kind} · {event.actor_name} · {new Date(event.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</Typography>
          <Typography variant="body2">{event.reason}</Typography>
          {event.after && <Typography variant="body2">Applied {currency(event.before?.applied)} → {currency(event.after.applied)} · Pending {currency(event.before?.pending)} → {currency(event.after.pending)}</Typography>}
        </Box>)}
        <Stack direction="row"><Button disabled={eventPage <= 1 || busy} onClick={() => setEventPage(eventPage - 1)}>Previous history</Button><Button disabled={eventPage * 20 >= data.pagination.total || busy} onClick={() => setEventPage(eventPage + 1)}>Next history</Button></Stack>
      </>}
    </Stack></DialogContent>
    <DialogActions>{!bookingId && selected && <Button onClick={() => { setSelected(''); setData(null); setPreview(null); }}>All bookings</Button>}<Button onClick={onClose} disabled={busy}>Close</Button></DialogActions>
  </Dialog>;
}
