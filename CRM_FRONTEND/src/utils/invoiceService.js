import { apiUrl } from "../components/LoginSignup";

export const saveInvoiceToDatabase = async (invoiceData) => {
  try {
    const userSession = JSON.parse(localStorage.getItem('userSession'));
    const response = await fetch(`${apiUrl}/documents/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": userSession?.token,
        "user-role": userSession?.user_role,
      },
      body: JSON.stringify({
        bookingId: null, // Since we don't have a booking ID for manual invoices
        title: invoiceData.invoiceNumber,
        type: 'Invoice',
        invoiceData: invoiceData,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save invoice`);
    }

    const data = await response.json();
    return data.document._id;
  } catch (error) {
    console.error('Error saving invoice:', error);

    // Fallback: save to localStorage if API fails
    const invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
    const newInvoice = {
      ...invoiceData,
      _id: Date.now().toString(),
      createdAt: new Date()
    };
    invoices.push(newInvoice);
    localStorage.setItem('invoices', JSON.stringify(invoices));

    return newInvoice._id;
  }
};

export const getInvoices = async () => {
  try {
    const userSession = JSON.parse(localStorage.getItem('userSession'));
    const response = await fetch(`${apiUrl}/documents/all`, {
      headers: {
        "Authorization": userSession?.token,
        "user-role": userSession?.user_role,
      }
    });

    if (!response.ok) throw new Error('Failed to fetch invoices');

    const data = await response.json();
    // The DB returns multiple types. Filter for Invoice and map them to their old shape if UI expects it.
    const allDocs = data.documents || [];
    return allDocs.filter(d => d.type === 'Invoice').map(d => ({ ...d.invoiceData, _id: d._id, createdAt: d.createdAt }));
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return JSON.parse(localStorage.getItem('invoices') || '[]');
  }
};
