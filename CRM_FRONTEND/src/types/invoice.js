// CompanyData example object
const companyData = {
  name: '',
  address: '',
  email: '',
  phone: '',
  gstNumber: '',
  logo: '',
  watermark: '',
  digitalStamp: '',
  letterhead: ''
};

// CompanyDetails example object
const companyDetails = {
  name: '',
  email: '',
  phone: '',
  gstPan: '',
  streetAddress: '',
  city: '',
  region: '',
  postcode: '',
  logo: '',
  watermark: '',
  digitalStamp: ''
};

// ClientData example object
const clientData = {
  companyName: '',
  name: '',
  email: '',
  streetAddress: '',
  cityRegionPostcode: '',
  gstNumber: ''
};

// InvoiceItem example array
const invoiceItems = [
  {
    id: '',
    description: '',
    quantity: 0,
    rate: 0,
    amount: 0
  }
];

// InvoiceData example object
const invoiceData = {
  _id: '',
  invoiceNumber: '',
  date: '',
  companyDetails: { ...companyDetails },
  clientCompanyName: '',
  clientName: '',
  clientEmail: '',
  clientAddress: '',
  clientGstNumber: '',
  items: [...invoiceItems],
  subtotal: 0,
  gstRate: 18,
  gstAmount: 0,
  total: 0,
  includeGst: true,
  createdAt: new Date()
};

// InvoiceFormData example object
const invoiceFormData = {
  clientData: { ...clientData },
  serviceFee: '',
  addGst: true,
  gstPercent: 18
};

// Export if using modules
export {
  companyData,
  companyDetails,
  clientData,
  invoiceItems,
  invoiceData,
  invoiceFormData
};
