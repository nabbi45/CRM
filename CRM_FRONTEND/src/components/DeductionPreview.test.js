import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeductionPreview, { previewFinancials } from './DeductionPreview';
const catalog = [{ _id: 'startup', name: 'Startup India', deduction: 2700 }, { _id: 'registration', name: 'MP Registration', deduction: 17200 }];
const booking = { user_id: 'A', bank: 'Bank', term_1: 5900, services: ['Startup India', 'MP Registration'] };

test('employees see official, applied and pending deductions without an amount input', () => {
  render(<DeductionPreview booking={booking} catalog={catalog} />);
  const table = screen.getByRole('table', { name: 'Service deduction preview' });
  const row = within(table).getByText('MP Registration').closest('tr');
  expect(row).toHaveTextContent('17,200'); expect(row).toHaveTextContent('2,300'); expect(row).toHaveTextContent('14,900');
  expect(screen.getByText(/Net credit/)).toHaveTextContent('Net credit ₹0');
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('pending balance will be deducted from later payments');
});

test('continuation previews preserve legacy allocations and apply pending fees to the next term', () => {
  const source = { ...booking, bank: 'Cash', service_deductions_snapshot: [{ service_name: 'Startup India', deduction: 2700 }, { service_name: 'MP Registration', deduction: 17200 }] };
  const state = previewFinancials({ ...source, term_2: 20000 }, catalog, source, 'term_2');
  expect(state.terms[0].applied).toBe(5900); expect(state.terms[1].applied).toBe(14000); expect(state.pending).toBe(0);
});
