import React, { useState, useEffect } from 'react';
import { X, Download, Loader, Mail, Edit2, Save, Eye, FileText } from 'lucide-react';

const AgreementPreview = ({ 
  agreementHtml, 
  isLoading, 
  onClose, 
  onDownload, 
  onSendEmail,
  onSave 
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedHtml, setEditedHtml] = useState(agreementHtml);
  const [hasChanges, setHasChanges] = useState(false);

  // Update editedHtml when agreementHtml prop changes
  useEffect(() => {
    setEditedHtml(agreementHtml);
    setHasChanges(false);
  }, [agreementHtml]);

  const handleToggleEdit = () => {
    if (isEditMode && hasChanges) {
      // Switching from edit to view - save changes
      if (onSave) {
        onSave(editedHtml);
      }
    }
    setIsEditMode(!isEditMode);
  };

  const handleHtmlChange = (e) => {
    setEditedHtml(e.target.value);
    setHasChanges(e.target.value !== agreementHtml);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(editedHtml);
    }
    setHasChanges(false);
    setIsEditMode(false);
  };

  const handleDownload = () => {
    // Pass the edited HTML if in edit mode or has changes
    const htmlToUse = hasChanges || isEditMode ? editedHtml : agreementHtml;
    onDownload(htmlToUse);
  };

  const handleSendEmail = () => {
    // Pass the edited HTML if in edit mode or has changes
    const htmlToUse = hasChanges || isEditMode ? editedHtml : agreementHtml;
    onSendEmail(htmlToUse);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {isEditMode ? 'Edit Agreement' : 'Agreement Preview'}
            </h2>
            {hasChanges && (
              <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">
                Modified
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Edit/Save Button */}
            <button
              onClick={handleToggleEdit}
              disabled={isLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isEditMode 
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isEditMode ? (
                <>
                  <Eye className="h-4 w-4" />
                  Preview
                </>
              ) : (
                <>
                  <Edit2 className="h-4 w-4" />
                  Edit
                </>
              )}
            </button>

            {/* Save Button (only in edit mode) */}
            {isEditMode && (
              <button
                onClick={handleSave}
                disabled={isLoading || !hasChanges}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            )}

            {/* Send Email Button */}
            {onSendEmail && (
              <button
                onClick={handleSendEmail}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Mail className="h-4 w-4" />
                Send via Email
              </button>
            )}

            {/* Download Button */}
            <button
              onClick={handleDownload}
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

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-2"
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
              <span className="ml-3 text-gray-600 dark:text-gray-400">Generating agreement...</span>
            </div>
          ) : isEditMode ? (
            /* Edit Mode - Textarea */
            <div className="h-full">
              <div className="mb-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FileText className="h-4 w-4" />
                <span>Edit the HTML content below. Click "Save" to apply changes or "Preview" to see the result.</span>
              </div>
              <textarea
                value={editedHtml}
                onChange={handleHtmlChange}
                className="w-full h-[calc(100%-2rem)] p-4 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                spellCheck={false}
              />
            </div>
          ) : (
            /* Preview Mode */
            <div
              id="agreement-content"
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 shadow-inner min-h-[400px] text-gray-900 dark:text-gray-100"
              dangerouslySetInnerHTML={{ __html: editedHtml }}
            />
          )}
        </div>

        {/* Footer Status Bar */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-xl flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span>
              Mode: <span className="font-medium text-gray-900 dark:text-white">{isEditMode ? 'Editing' : 'Preview'}</span>
            </span>
            {hasChanges && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {editedHtml.length.toLocaleString()} characters
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgreementPreview;
