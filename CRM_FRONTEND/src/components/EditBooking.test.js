import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EditBooking from './EditBooking';
jest.mock('./LoginSignup', () => ({ apiUrl: 'https://crm.test' }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('notistack', () => ({ enqueueSnackbar: jest.fn() }));
jest.mock('./Servicesdropdown', () => () => null);
const booking = { _id: 'booking', user_id: 'owner', bdm: 'Owner', branch_name: 'Delhi', company_name: 'Company', contact_person: 'Client', contact_no: 9999999999, email: 'client@test.invalid', date: '2026-10-01', total_amount: 10000, services: [], term_1: 1000, term_2: 2000, payment_date: '2026-10-01', bank: 'Cash', __editTermKey: 'term_2', term_shares: { term_2: { creator: { user_id: 'owner', user_name: 'Owner' }, payment_date: '2026-10-20', payment_mode: 'Cash', shared_with: [] } } };
beforeEach(() => {
  localStorage.setItem('userSession', JSON.stringify({ user_id: 'dev', user_role: 'dev', name: 'Dev', token: 'test' }));
  global.fetch = jest.fn().mockImplementation(async (url, options) => ({ ok: true, json: async () => options?.method === 'PATCH' ? { message: 'Saved' } : url.includes('/company') ? { branches: 'Delhi' } : { users: [] } }));
});
afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

test('editing Term 2 loads its date and submits only its amount with an explicit term key', async () => {
  const onClose = jest.fn();
  render(<EditBooking initialData={booking} onClose={onClose} />);
  const date = await screen.findByLabelText('Payment Date');
  expect(date).toHaveValue('2026-10-20');
  expect(screen.getByLabelText('Received Amount')).toHaveValue('2000');
  fireEvent.change(date, { target: { value: '2026-11-03' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update' }));
  await waitFor(() => expect(global.fetch.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(true));
  const [, options] = global.fetch.mock.calls.find(([, request]) => request?.method === 'PATCH');
  const payload = JSON.parse(options.body);
  expect(payload.edit_term_key).toBe('term_2'); expect(payload.term_2).toBe(2000);
  expect(payload).not.toHaveProperty('term_1'); expect(payload).not.toHaveProperty('date');
  expect(payload.term_shares.term_2.payment_date).toBe('2026-11-03');
  expect(booking.payment_date).toBe('2026-10-01');
});
