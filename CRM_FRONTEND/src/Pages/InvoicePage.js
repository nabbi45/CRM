import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import InvoiceForm from '../components/InvoiceForm';
import InvoicePreview from '../components/InvoicePreview';
import InvoiceActions from '../components/InvoiceActions';
import { downloadInvoiceAsPDF } from '../utils/invoiceGenerator';
import { useColorMode } from '../context/AppThemeProvider';

function InvoicePage() {
  const { mode } = useColorMode();
  const isDark = mode === 'dark';
  const [currentStep, setCurrentStep] = useState('form');
  const [invoiceData, setInvoiceData] = useState(null);

  const handlePreview = (data) => {
    setInvoiceData(data);
    setCurrentStep('preview');
  };

  const handleDownload = async (data) => {
    try {
      // Store data and switch to preview — the invoice-preview DOM element must exist
      setInvoiceData(data);
      setCurrentStep('preview');
      // Wait for the preview to render before auto-downloading
      setTimeout(async () => {
        try {
          const filename = `Proforma_Invoice_${data.invoiceNumber}.pdf`;
          await downloadInvoiceAsPDF('invoice-preview', filename);
        } catch (error) {
          console.error('Auto-download failed:', error);
        }
      }, 600);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('Error downloading invoice. Please try again.');
    }
  };

  const handleBackToForm = () => {
    setCurrentStep('form');
    setInvoiceData(null);
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'}`}>
      {/* Header */}
      <header className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white'} shadow-sm border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-3 rounded-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>Proforma Invoice Generator</h1>
              <p className={`${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Create professional invoices with ease</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentStep === 'form' && (
          <InvoiceForm onPreview={handlePreview} onDownload={handleDownload} />
        )}

        {currentStep === 'preview' && invoiceData && (
          <div className="space-y-6">
            <InvoicePreview invoice={invoiceData} />
            <InvoiceActions invoice={invoiceData} onBack={handleBackToForm} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={`${isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-gray-50'} border-t mt-16`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className={`text-center ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
            <p>&copy; 2026 Farsight. All rights reserved.</p>
            <p className="mt-2 text-sm">Professional Invoice Generation System</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default InvoicePage;
