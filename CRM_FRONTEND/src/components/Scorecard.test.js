import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Scorecard from './Scorecard';
jest.mock('./LoginSignup', () => ({ apiUrl: 'https://crm.test' }));
jest.mock('./Loader', () => () => <span>Loading</span>);
jest.mock('./DeductionManager', () => () => null);
afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

test('scorecard credit minus applied deductions, recovery and refund equals the final score once', async () => {
  localStorage.setItem('userSession', JSON.stringify({ user_id: 'A', name: 'Employee', user_role: 'employee', token: 'test' }));
  const date = new Date().toISOString();
  const booking = { _id: 'booking', user_id: 'A', bdm: 'Employee', company_name: 'Client', bank: 'Cash', term_1: 1000, payment_date: date, financial_version: 2,
    services: ['Service'], service_deductions_snapshot: [{ service_name: 'Service', service_key: 'fee', deduction: 2000 }],
    deduction_baseline: [{ term_key: 'term_1', allocations: [{ service_key: 'fee', amount: 400 }] }],
    deduction_recoveries: [{ id: 'recovery', kind: 'recovery', service_key: 'fee', service_name: 'Service', amount: 100, effective_date: date, participants: [{ user_id: 'A', user_name: 'Employee', amount: 100 }], reason: 'Reviewed fee' }],
    refund_adjustments: [{ amount: 50, refund_date: date }],
  };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ bookings: [booking] }) });
  render(<Scorecard />);
  fireEvent.click(await screen.findByRole('button', { name: 'View History' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Credit before deductions').parentElement).toHaveTextContent('1,000');
  expect(within(dialog).getByText('Deductions').parentElement).toHaveTextContent('550');
  expect(within(dialog).getByText('Net').parentElement).toHaveTextContent('450');
});
