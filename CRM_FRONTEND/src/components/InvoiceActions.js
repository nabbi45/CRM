import React, { useState } from 'react';
import { Download, Save, ArrowLeft, Mail } from 'lucide-react';
import { downloadInvoiceAsPDF } from '../utils/invoiceGenerator';
import { generatePDFBase64FromElement } from '../utils/pdfGenerator';
import { saveInvoiceToDatabase } from '../utils/invoiceService';
import DocumentEmailModal from './DocumentEmailModal';
import { useColorMode } from '../context/AppThemeProvider';

function InvoiceActions({ invoice, onBack }) {
  const { mode } = useColorMode();
  const isDark = mode === 'dark';
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const filename = `Proforma_Invoice_${invoice.invoiceNumber}.pdf`;
      await downloadInvoiceAsPDF('invoice-preview', filename);

      // Auto-save to database when downloading
      if (!saved) {
        await handleSave();
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('Error downloading invoice. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveInvoiceToDatabase(invoice);
      setSaved(true);
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Error saving invoice to database. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-lg shadow-lg p-6 max-w-4xl mx-auto mt-6 ${isDark ? 'bg-slate-900 border border-slate-700 text-slate-100' : 'bg-white'}`}>
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <button
          onClick={onBack}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-colors ${isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Form</span>
        </button>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-colors ${saved
                ? 'bg-green-100 text-green-700 cursor-default'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            <Save className="w-5 h-5" />
            <span>
              {saving ? 'Saving...' : saved ? 'Saved to Database' : 'Save to Database'}
            </span>
          </button>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            <span>{downloading ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
          >
            <Mail className="w-5 h-5" />
            <span>Send via Email</span>
          </button>
        </div>
      </div>

      <div className={`mt-4 text-sm text-center ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
        <p>
          Invoice Number: <span className="font-semibold">{invoice.invoiceNumber}</span>
        </p>
        <p className="mt-1">
          {saved
            ? 'Invoice saved to database and ready for download'
            : 'Click download to save and generate PDF'}
        </p>
      </div>

      {showEmailModal && (
        <DocumentEmailModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          documentType="Invoice"
          bookingEmail={invoice.clientEmail || ''}
          filename={`Proforma_Invoice_${invoice.invoiceNumber}.pdf`}
          generatePdfBase64={async () => {
            return await generatePDFBase64FromElement('invoice-preview');
          }}
        />
      )}
    </div>
  );
}

export default InvoiceActions;
