import React, { useState, useEffect } from 'react';
import { X, Send, Loader } from 'lucide-react';
import { apiUrl } from './LoginSignup';
import { enqueueSnackbar } from 'notistack';

const DocumentEmailModal = ({ isOpen, onClose, documentType, bookingEmail, generatePdfBase64, filename }) => {
    const [recipient, setRecipient] = useState(bookingEmail || '');
    const [cc, setCc] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isSending, setIsSending] = useState(false);

    const userSession = JSON.parse(localStorage.getItem('userSession'));

    useEffect(() => {
        if (isOpen) {
            setRecipient(bookingEmail || '');
            setSubject(`Your ${documentType} from Farsight`);
            setBody(`Dear Client,\n\nPlease find your attached ${documentType}.\n\nThank you for choosing Farsight.`);
            // Fetch default CC from profile
            fetchProfile();
        }
    }, [isOpen, bookingEmail, documentType]);

    const fetchProfile = async () => {
        try {
            const res = await fetch(`${apiUrl}/company`, {
                headers: {
                    'Authorization': userSession?.token,
                    'user-role': userSession?.user_role,
                }
            });
            const data = await res.json();
            if (res.ok && data) {
                setCc(data.default_cc || '');
                const cName = data.company_name || 'Our Company';
                setSubject(`Your ${documentType} from ${cName}`);
                setBody(`Dear Client,\n\nPlease find your attached ${documentType}.\n\nThank you for choosing ${cName}.`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSend = async () => {
        if (!recipient) {
            enqueueSnackbar('Recipient email is required.', { variant: 'warning' });
            return;
        }

        setIsSending(true);
        try {
            const base64Pdf = await generatePdfBase64();
            if (!base64Pdf) throw new Error("Could not generate PDF.");

            const payload = {
                recipientEmail: recipient,
                ccEmails: cc,
                subject: subject,
                bodyHtml: body.replace(/\n/g, '<br/>'),
                documentDataUrl: base64Pdf,
                documentFilename: filename || `${documentType}.pdf`
            };

            const res = await fetch(`${apiUrl}/document-mail/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': userSession?.token,
                    'user-role': userSession?.user_role,
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                enqueueSnackbar('Document sent successfully!', { variant: 'success' });
                onClose();
            } else {
                enqueueSnackbar(data.message || `Failed to send (HTTP ${res.status}).`, { variant: 'error' });
            }
        } catch (error) {
            console.error(error);
            enqueueSnackbar(error.message || 'An error occurred during dispatch.', { variant: 'error' });
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-800">Send {documentType} via Email</h2>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">To (Recipient)</label>
                        <input
                            type="email"
                            value={recipient}
                            onChange={e => setRecipient(e.target.value)}
                            className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="client@mail.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CC (Internal Copies)</label>
                        <input
                            type="text"
                            value={cc}
                            onChange={e => setCc(e.target.value)}
                            className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="sales@company.com"
                        />
                        <p className="text-xs text-gray-500 mt-1">Comma-separated emails.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            className="w-full border border-gray-300 rounded-md p-2 h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        ></textarea>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-md transition-colors font-medium"
                        disabled={isSending}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isSending || !recipient}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                    >
                        {isSending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Confirm & Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DocumentEmailModal;
