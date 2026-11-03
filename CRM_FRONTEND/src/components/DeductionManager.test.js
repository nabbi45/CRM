import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeductionManager from './DeductionManager';
jest.mock('./LoginSignup', () => ({ apiUrl: 'https://crm.test' }));
const state = { official: 100, applied: 20, pending: 80, services: [{ service_key: 'fee', service_name: 'Service', official: 100, applied: 20, pending: 80 }], terms: [{ term_key: 'term_1', applied: 20, net: 0 }] };
const detail = { financial_revision: 1, state, audit: { flags: [], after: state, snapshot_hash: 'hash' }, events: [], pagination: { total: 0 }, recoveries: [] };
beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => detail }); });
afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

test('employees have read-only deduction history without recovery inputs', async () => {
  localStorage.setItem('userSession', JSON.stringify({ user_role: 'employee', token: 'test' }));
  render(<DeductionManager open bookingId="booking" onClose={() => {}} />);
  await screen.findByText('Financial history');
  expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
  expect(screen.queryByText('Post reviewed recovery')).not.toBeInTheDocument();
});

test('director must preview the capped recovery and supply a reason before posting', async () => {
  localStorage.setItem('userSession', JSON.stringify({ user_role: 'director', token: 'test' }));
  render(<DeductionManager open bookingId="booking" onClose={() => {}} />);
  await screen.findByText('Recover pending service deduction');
  expect(screen.getByRole('button', { name: 'Post reviewed recovery' })).toBeDisabled();
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ amount: 25, month: '2026-10', pending_after: 55, participants: [{ user_name: 'Employee', amount: 25, available: 25 }] }) });
  fireEvent.click(screen.getByRole('button', { name: 'Preview capped recovery' }));
  await screen.findByText(/available score/);
  expect(screen.getByRole('button', { name: 'Post reviewed recovery' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Reason for review/), { target: { value: 'Verified pending fee' } });
  expect(screen.getByRole('button', { name: 'Post reviewed recovery' })).toBeEnabled();
});
