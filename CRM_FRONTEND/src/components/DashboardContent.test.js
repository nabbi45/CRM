import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardContent from './DashboardContent';
import { requestJson } from '../utils/requestJson';
import { buildDashboardSummary } from '../utils/dashboardSummary';
import { Chart } from 'chart.js/auto';
jest.mock('./LoginSignup', () => ({ apiUrl: 'https://crm.test' }));
jest.mock('../utils/requestJson', () => ({ requestJson: jest.fn() }));
jest.mock('notistack', () => ({ enqueueSnackbar: jest.fn() }));
jest.mock('chart.js/auto', () => ({ Chart: jest.fn().mockImplementation(() => ({ destroy: jest.fn() })) }));
jest.mock('./Loader', () => () => <span>Loading dashboard</span>);
jest.mock('./PaymentReminders', () => () => null);
jest.mock('./Popup', () => () => null);
jest.mock('./EditBooking', () => () => null);
beforeEach(() => {
  Chart.mockImplementation(() => ({ destroy: jest.fn() }));
  localStorage.setItem('userSession', JSON.stringify({ user_id: 'admin', user_role: 'admin', token: 'test-token' }));
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ branches: '' }) });
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({}));
});
afterEach(() => { jest.clearAllMocks(); localStorage.clear(); });
test('a timed out summary shows a retryable error, not zero-valued dashboard cards', async () => {
  requestJson.mockRejectedValueOnce(new Error('The server is taking too long to respond. Please retry.'));
  render(<DashboardContent />);
  const error = await screen.findByRole('alert');
  expect(error).toHaveTextContent('Dashboard could not load');
  expect(screen.queryByText(/^Revenue - /)).not.toBeInTheDocument();
  const summary = buildDashboardSummary({ bookings: [], session: { user_id: 'admin' }, isAdmin: true });
  requestJson.mockResolvedValueOnce({ summary });
  fireEvent.click(screen.getByRole('button', { name: 'Retry dashboard' }));
  await screen.findByText(/^Revenue - /);
  expect(screen.queryByText('Dashboard could not load')).not.toBeInTheDocument();
});
test('empty current month explains the period and can retrieve earlier payments', async () => {
  const current = buildDashboardSummary({ bookings: [], session: { user_id: 'admin' }, isAdmin: true });
  requestJson.mockResolvedValueOnce({ summary: current });
  render(<DashboardContent />);
  await screen.findByText(/No recorded payments in/);
  const previous = new Date(`${current.period}-01T00:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const month = previous.toISOString().slice(0, 7);
  const summary = buildDashboardSummary({
    bookings: [{ _id: 'previous-payment', user_id: 'admin', bdm: 'Admin', bank: 'Cash', term_1: 1000, payment_date: `${month}-14` }],
    session: { user_id: 'admin' }, isAdmin: true, month,
  });
  requestJson.mockResolvedValueOnce({ summary });
  fireEvent.click(screen.getByRole('button', { name: 'View previous month' }));
  await screen.findByText('Bookings with payments');
  expect(requestJson).toHaveBeenLastCalledWith(`/dashboard/summary?month=${month}`, 'test-token');
  expect(screen.getByLabelText('Dashboard month')).toHaveValue(month);
  expect(screen.queryByText(/No recorded payments in/)).not.toBeInTheDocument();
});
