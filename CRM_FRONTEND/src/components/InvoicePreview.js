import React from 'react';
import { format } from 'date-fns';

function InvoicePreview({ invoice }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  return (
    <div className="bg-white shadow-lg max-w-4xl mx-auto overflow-hidden">
      <div id="invoice-preview" className="relative bg-white" style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}>
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          style={{
            backgroundImage: `url(${invoice.companyDetails.watermark})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundSize: '300px 300px',
            opacity: 0.05
          }}
        />

        <div className="relative z-20 h-full flex flex-col">
          <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-blue-600">
            <div className="flex items-center space-x-4">
              <img
                src={invoice.companyDetails.logo}
                alt="Growthera Ventures Logo"
                className="w-64 h-32 object-contain"
              />
            </div>
            <div className="text-right text-gray-600 text-sm">
              <div className="font-bold text-base">{invoice.companyDetails.name}</div>
              <div className="mt-1">{invoice.companyDetails.phone}</div>
              <div>{invoice.companyDetails.email}</div>
              <div className="mt-1">
                {invoice.companyDetails.streetAddress}, {invoice.companyDetails.city}, {invoice.companyDetails.region} {invoice.companyDetails.postcode}
              </div>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-blue-600 tracking-wider">PROFORMA INVOICE</h2>
          </div>

          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-gray-700 font-medium">Invoice #: {invoice.invoiceNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-700 font-medium">Date: {formatDate(invoice.date)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-base font-bold text-gray-800 mb-3">From:</h3>
              <div className="text-gray-700 space-y-1 text-sm">
                <p className="font-semibold">{invoice.companyDetails.name}</p>
                <p>{invoice.companyDetails.streetAddress}</p>
                <p>{invoice.companyDetails.city}, {invoice.companyDetails.region} {invoice.companyDetails.postcode}</p>
                <p>Phone: {invoice.companyDetails.phone}</p>
                <p>Email: {invoice.companyDetails.email}</p>
                <p>GST/PAN: {invoice.companyDetails.gstNumber}</p>
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800 mb-3">To:</h3>
              <div className="text-gray-700 space-y-1 text-sm">
                <p className="font-semibold">{invoice.clientCompanyName}</p>
                <p>{invoice.clientName}</p>
                <p>{invoice.clientAddress}</p>
                <p>Email: {invoice.clientEmail}</p>
                {invoice.clientGstNumber && <p>GST/PAN: {invoice.clientGstNumber}</p>}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-blue-50">
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-800">Description</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-800">Quantity</th>
                  <th className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-800">Rate (₹)</th>
                  <th className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-800">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="border border-gray-300 px-4 py-3 text-gray-700">{item.description}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center text-gray-700">{item.quantity}</td>
                    <td className="border border-gray-300 px-4 py-3 text-right text-gray-700">{item.rate.toFixed(2)}</td>
                    <td className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-700">{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 2 - invoice.items.length) }).map((_, index) => (
                  <tr key={`empty-${index}`}>
                    <td className="border border-gray-300 px-4 py-3">&nbsp;</td>
                    <td className="border border-gray-300 px-4 py-3">&nbsp;</td>
                    <td className="border border-gray-300 px-4 py-3">&nbsp;</td>
                    <td className="border border-gray-300 px-4 py-3">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bank Account Details Section */}
          <div className="mb-8">
            <h3 className="text-base font-bold text-gray-800 mb-3">Bank Details</h3>
            <div className="text-gray-700 space-y-1 text-sm">
              <p>Bank Account Number: {invoice.companyDetails.bankAccountNumber}</p>
              <p>IFSC Code: {invoice.companyDetails.ifscCode}</p>
              <p>Account Holder Name: {invoice.companyDetails.accountHolderName}</p>
              <p>Bank Name: {invoice.companyDetails.bankName}</p>
            </div>
          </div>

          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-700 font-medium">Subtotal:</span>
                  <span className="font-bold">₹{invoice.subtotal.toFixed(2)}</span>
                </div>
                {invoice.includeGst && (
                  <div className="flex justify-between items-center py-1 border-b border-gray-300">
                    <span className="text-gray-700 font-medium">GST ({invoice.gstRate}%):</span>
                    <span className="font-bold">₹{invoice.gstAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-b-2 border-gray-800">
                  <span className="text-lg font-bold text-gray-800">Total:</span>
                  <span className="text-xl font-bold text-gray-800">₹{invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mb-8">
            <div className="text-center">
              <div className="w-40 h-16 border-b border-gray-300 mb-2 flex items-end justify-center">
                {invoice.companyDetails.digitalStamp && (
                  <img 
                    src={invoice.companyDetails.digitalStamp} 
                    alt="Digital Stamp" 
                    className="w-24 h-24 object-contain opacity-70"
                  />
                )}
              </div>
              <p className="text-gray-600 text-xs">Authorized Signature</p>
            </div>
          </div>

          <div className="mt-auto text-center space-y-1 pt-4 border-t border-gray-200">
            <p className="text-gray-700 font-medium text-sm">Thank you for your business!</p>
            <p className="text-gray-500 text-xs">This is a computer-generated performa invoice and does not require a signature.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvoicePreview;
