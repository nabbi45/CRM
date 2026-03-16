import { InvoiceData } from '../types/invoice';

const API_BASE = '/api';

export const saveInvoiceToDatabase = async (invoiceData: InvoiceData): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceData),
    });

    if (!response.ok) {
      throw new Error('Failed to save invoice');
    }

    const result = await response.json();
    return result.id;
  } catch (error) {
    console.error('Error saving invoice:', error);
    throw error;
  }
};

export const getInvoices = async (): Promise<InvoiceData[]> => {
  try {
    const response = await fetch(`${API_BASE}/invoices`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch invoices');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
};