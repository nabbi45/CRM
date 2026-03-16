import React from 'react';
import { X, Download, Loader, Mail } from 'lucide-react';

const AgreementPreview = ({ agreementHtml, isLoading, onClose, onDownload, onSendEmail }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Agreement Preview</h2>
          <div className="flex items-center gap-3">
            {onSendEmail && (
              <button
                onClick={onSendEmail}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Mail className="h-4 w-4" />
                Send via Email
              </button>
            )}
            <button
              onClick={onDownload}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-3 text-gray-600">Generating agreement...</span>
            </div>
          ) : (
            <div
              id="agreement-content"
              className="bg-white border border-gray-200 rounded-lg p-8 shadow-inner"
              dangerouslySetInnerHTML={{ __html: agreementHtml }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AgreementPreview;
