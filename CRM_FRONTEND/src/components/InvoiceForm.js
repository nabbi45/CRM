import React, { useState } from 'react';
import { Building2, Mail, MapPin, FileText, Plus, Trash2, Download, Eye } from 'lucide-react';
import { saveInvoiceToDatabase } from '../utils/invoiceService';
import { format } from 'date-fns';

import { apiUrl } from './LoginSignup';
import { useColorMode } from '../context/AppThemeProvider';

function InvoiceForm({ onPreview, onDownload }) {
  const { mode } = useColorMode();
  const isDark = mode === 'dark';
  const [clientCompanyName, setClientCompanyName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientStreetAddress, setClientStreetAddress] = useState('');
  const [clientCity, setClientCity] = useState('');
  const [clientRegion, setClientRegion] = useState('');
  const [clientPostcode, setClientPostcode] = useState('');
  const [clientGstNumber, setClientGstNumber] = useState('');
  const [companyDetails, setCompanyDetails] = useState({
    name: 'Your Company',
    email: 'support@company.com',
    phone: '+91 0000000000',
    gstPan: 'N/A',
    streetAddress: 'Loading address...',
    city: '',
    region: '',
    postcode: '',
    logo: null,
    digitalStamp: null,
    bankAccountNumber: "0000000000",
    ifscCode: "IFSC0000000",
    accountHolderName: "Company Account Name",
    bankName: "Bank Name"
  });

  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userSession = JSON.parse(localStorage.getItem('userSession'));
        const res = await fetch(`${apiUrl}/company`, {
          headers: { 'Authorization': userSession?.token, 'user-role': userSession?.user_role }
        });
        const data = await res.json();
        if (res.ok && data && data.company_name) {
          setCompanyDetails({
            ...companyDetails,
            name: data.company_name,
            email: data.email || companyDetails.email,
            phone: data.contact_number || companyDetails.phone,
            gstPan: data.gst_number || data.pan_number || companyDetails.gstPan,
            streetAddress: data.address || companyDetails.streetAddress,
            city: '', region: '', postcode: '', // Address usually contains everything now
            logo: data.logo_url || companyDetails.logo,
            digitalStamp: data.seal_url || companyDetails.digitalStamp,
            bankAccountNumber: data.account_number || companyDetails.bankAccountNumber,
            ifscCode: data.ifsc_code || companyDetails.ifscCode,
            accountHolderName: data.account_name || companyDetails.accountHolderName,
            bankName: data.bank_name || companyDetails.bankName
          });
        }
      } catch (err) { console.error('Error fetching company profile:', err); }
    };
    fetchProfile();
  }, []);

  const [invoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [items, setItems] = useState([
    { id: '1', description: '', quantity: 1, rate: 0, amount: 0 }
  ]);
  const [includeGst, setIncludeGst] = useState(false);
  const [gstRate, setGstRate] = useState(18);

  const addItem = () => {
    const newItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            updatedItem.amount = updatedItem.quantity * updatedItem.rate;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const gstAmount = includeGst ? (subtotal * gstRate) / 100 : 0;
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, total };
  };

  const { subtotal, gstAmount, total } = calculateTotals();

  const generateInvoiceData = () => ({
    invoiceNumber: `PI-${Date.now()}`,
    date: invoiceDate,
    companyDetails: companyDetails,
    clientCompanyName,
    clientName,
    clientEmail,
    clientAddress: `${clientStreetAddress}, ${clientCity}, ${clientRegion} ${clientPostcode}`,
    clientGstNumber,
    items,
    subtotal,
    gstRate,
    gstAmount,
    total,
    includeGst
  });

  const handlePreview = () => {
    onPreview(generateInvoiceData());
  };

  const handleDownload = async () => {
    const invoiceData = generateInvoiceData();
    try {
      await saveInvoiceToDatabase(invoiceData);
      onDownload(invoiceData);
    } catch (error) {
      console.error('Error saving invoice:', error);
      onDownload(invoiceData);
    }
  };

  const isFormValid = () => {
    return (
      clientCompanyName &&
      clientName &&
      clientEmail &&
      clientStreetAddress &&
      clientCity &&
      clientRegion &&
      clientPostcode &&
      clientGstNumber &&
      items.some(item => item.description && item.quantity > 0 && item.rate > 0)
    );
  };

  return (
    <div className={`max-w-4xl mx-auto p-6 rounded-lg shadow-lg ${isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
      <div className="mb-8">
        <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>Create Proforma Invoice</h1>
        <p className={`${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Generate professional invoices for {companyDetails.name}</p>
      </div>

      {/* Growthera Company Details Display (Read-only) */}
      <div className={`mb-8 p-6 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'}`}>
        <div className="flex items-center mb-4">
          <Building2 className={`w-5 h-5 mr-2 ${isDark ? 'text-red-400' : 'text-blue-600'}`} />
          <h2 className={`text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>Company Details</h2>
        </div>

        <div className="flex items-start space-x-6">
          <div className="flex-shrink-0">
            {companyDetails.logo ? (
              <img
                src={companyDetails.logo}
                alt="Company Logo"
                className="w-24 h-24 object-contain"
              />
            ) : (
              <div className="w-24 h-24 bg-gray-100 flex items-center justify-center rounded-md border border-gray-200">
                <Building2 className="w-8 h-8 text-gray-300" />
              </div>
            )}
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Company Name</p>
              <p className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{companyDetails.name}</p>
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Contact</p>
              <p className={`font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{companyDetails.phone}</p>
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Email</p>
              <p className={`font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{companyDetails.email}</p>
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>GST/PAN</p>
              <p className={`font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{companyDetails.gstPan}</p>
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Address</p>
              <p className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                {companyDetails.streetAddress} {companyDetails.city && `, ${companyDetails.city}`}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0">
            {companyDetails.digitalStamp ? (
              <img
                src={companyDetails.digitalStamp}
                alt="Digital Stamp"
                className="w-20 h-20 object-contain border rounded-lg bg-white p-1"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-50 flex items-center justify-center rounded-lg border border-dashed border-gray-300">
                <span className="text-xs text-gray-400 text-center">No Stamp</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Client Details */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Mail className="w-5 h-5 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Client Details</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Name *
            </label>
            <input
              type="text"
              value={clientCompanyName}
              onChange={(e) => setClientCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter client company name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Person Name *
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter contact person name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="client@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GST Number/PAN *
            </label>
            <input
              type="text"
              value={clientGstNumber}
              onChange={(e) => setClientGstNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter GST number or PAN"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Street Address *
            </label>
            <input
              type="text"
              value={clientStreetAddress}
              onChange={(e) => setClientStreetAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter street address"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City *
            </label>
            <input
              type="text"
              value={clientCity}
              onChange={(e) => setClientCity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter city"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Region *
            </label>
            <input
              type="text"
              value={clientRegion}
              onChange={(e) => setClientRegion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter region/state"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Postcode *
            </label>
            <input
              type="text"
              value={clientPostcode}
              onChange={(e) => setClientPostcode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter postcode"
              required
            />
          </div>
        </div>
      </div>

      {/* Invoice Date Display (Read-only) */}
      <div className={`mb-8 p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
        <div className="flex items-center">
          <MapPin className={`w-5 h-5 mr-2 ${isDark ? 'text-red-400' : 'text-blue-600'}`} />
          <span className={`text-sm font-medium mr-4 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Invoice Date:</span>
          <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{format(new Date(invoiceDate), 'dd/MM/yyyy')}</span>
        </div>
      </div>

      {/* Items */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <FileText className="w-5 h-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Items/Services</h2>
          </div>
          <button
            onClick={addItem}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border border-gray-200 rounded-lg">
              <div className="md:col-span-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter item description"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate (₹)
                </label>
                <input
                  type="number"
                  value={item.rate}
                  onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={item.amount.toFixed(2)}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>

              <div className="md:col-span-1 flex items-end">
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GST Options */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">GST Options</h3>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeGst}
              onChange={(e) => setIncludeGst(e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Include GST</span>
          </label>
        </div>

        {includeGst && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GST Rate (%)
              </label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className={`mb-8 p-6 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
        <div className="space-y-2 max-w-md ml-auto">
          <div className="flex justify-between">
            <span className={isDark ? 'text-slate-300' : 'text-gray-600'}>Subtotal:</span>
            <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>₹{subtotal.toFixed(2)}</span>
          </div>
          {includeGst && (
            <div className="flex justify-between">
              <span className={isDark ? 'text-slate-300' : 'text-gray-600'}>GST ({gstRate}%):</span>
              <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>₹{gstAmount.toFixed(2)}</span>
            </div>
          )}
          <div className={`flex justify-between text-lg font-bold border-t pt-2 ${isDark ? 'border-slate-600 text-slate-100' : ''}`}>
            <span>Total:</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end">
        <button
          onClick={handlePreview}
          disabled={!isFormValid()}
          className="flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Eye className="w-4 h-4 mr-2" />
          Preview Invoice
        </button>

        <button
          onClick={handleDownload}
          disabled={!isFormValid()}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          Download PDF
        </button>
      </div>
    </div>
  );
}

export default InvoiceForm;
