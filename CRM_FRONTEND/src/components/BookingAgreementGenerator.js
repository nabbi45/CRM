import React, { useState, useEffect } from 'react';
import { Search, FileText, Download, Eye, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { generatePDF, generatePDFBase64 } from '../utils/pdfGenerator';
import bookingAPI from '../api/bookingAPI';
import AgreementPreview from './AgreementPreview';
import DocumentEmailModal from './DocumentEmailModal';
import { enqueueSnackbar } from 'notistack';
import { apiUrl } from "./LoginSignup";

const BookingAgreementGenerator = () => {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    const [bookings, setBookings] = useState([]);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [agreementHtml, setAgreementHtml] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingBookings, setIsLoadingBookings] = useState(true);
    const [error, setError] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [downloadHistory, setDownloadHistory] = useState([]);
    const [templateMeta, setTemplateMeta] = useState(null);

    const loadAgreements = async () => {
        try {
            const userSession = JSON.parse(localStorage.getItem("userSession"));
            const res = await fetch(`${apiUrl}/documents/all`, {
                headers: { "Authorization": userSession?.token }
            });
            const data = await res.json();
            if (res.ok && data.documents) {
                const agreements = data.documents
                    .filter(d => d.type === 'Agreement')
                    .map(d => ({
                        bookingId: d.bookingId?._id || d.bookingId,
                        companyName: d.bookingId?.company_name || 'N/A',
                        downloadedAt: d.createdAt
                    }));
                setDownloadHistory(agreements);
            }
        } catch (err) { /* Silent fail - not critical */ }
    };

    // Load bookings from backend
    useEffect(() => {
        loadBookings();
        loadAgreements();
    }, []);

    const loadBookings = async () => {
        try {
            setIsLoadingBookings(true);

            // Get userSession from localStorage
            const userSession = JSON.parse(localStorage.getItem("userSession"));
            if (!userSession || !userSession.token) {
                throw new Error('User is not authenticated. Please log in.');
            }

            // API request with authorization token
            const response = await fetch(`${apiUrl}/booking/all`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `${userSession.token}`,  // Use token from userSession
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch bookings. Status: ${response.status}`);
            }

            const data = await response.json();

            // Handle data
            if (data && Array.isArray(data.Allbookings)) {
                setBookings(data.Allbookings);
                setError(null);
            } else if (data && Array.isArray(data)) {
                setBookings(data);
                setError(null);
            } else if (data && data.bookings && Array.isArray(data.bookings)) {
                setBookings(data.bookings);
                setError(null);
            } else {
                let textData;
                try { textData = JSON.stringify(data); } catch (e) { textData = String(data); }
                throw new Error(`Invalid response format. Expected an array of bookings. Received: ${textData}`);
            }
        } catch (error) {
            setError(`Failed to load bookings. Please try again. ${error.message}`);
        } finally {
            setIsLoadingBookings(false);
        }
    };



    const handleBookingSelect = async (booking) => {
        try {
            setIsLoading(true);
            setError(null);
            setSelectedBooking(booking);

            // Fetch agreement HTML from backend
            const response = await bookingAPI.generateAgreement(booking._id); // Generate agreement from backend
            setAgreementHtml(response.data.agreementHtml);
            setTemplateMeta(response.data.template || null);
            setShowPreview(true);
        } catch (err) {
            setTemplateMeta(null);
            setError(`Failed to generate agreement preview. ${err.message || 'Please try again.'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadPDF = async (customHtmlContent = null) => {
        if (!selectedBooking || !agreementHtml) return;

        // Use custom HTML if provided, otherwise use the original
        const htmlToUse = customHtmlContent || agreementHtml;

        try {
            setIsLoading(true);
            await generatePDF(htmlToUse, `Booking-Agreement-${selectedBooking._id}`);

            // Save to database
            const userSession = JSON.parse(localStorage.getItem("userSession"));
            await fetch(`${apiUrl}/documents/save`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": userSession?.token,
                },
                body: JSON.stringify({
                    bookingId: selectedBooking._id,
                    title: `Booking-Agreement-${selectedBooking._id}`,
                    type: 'Agreement',
                    htmlContent: htmlToUse
                }),
            });

            // Refresh history
            const downloadEntry = {
                bookingId: selectedBooking._id,
                companyName: selectedBooking.company_name,
                downloadedAt: new Date().toISOString(),
            };
            setDownloadHistory(prev => [downloadEntry, ...prev]);

            setError(null);
            enqueueSnackbar('PDF downloaded successfully!', { variant: 'success' });
        } catch (err) {
            setError('Failed to generate PDF or save history. Please try again.');
            enqueueSnackbar('Failed to download PDF', { variant: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveAgreement = (editedHtml) => {
        setAgreementHtml(editedHtml);
        enqueueSnackbar('Agreement updated successfully!', { variant: 'success' });
    };

    const filteredBookings = bookings.filter((booking) => {
        const search = searchTerm.toLowerCase().trim();

        const checkIfMatches = (field) => field && field.toLowerCase().includes(search);

        return (
            checkIfMatches(booking.company_name) ||
            checkIfMatches(booking.contact_person) ||
            checkIfMatches(booking.email) ||
            checkIfMatches(booking.contact_no) ||
            checkIfMatches(booking.bdm) ||
            checkIfMatches(booking.branch_name) ||
            checkIfMatches(booking.state) ||
            checkIfMatches(booking.status) ||
            checkIfMatches(booking.pan) ||
            checkIfMatches(booking.gst) ||
            (booking.services && booking.services.some(service => checkIfMatches(service)))
        );
    });

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(amount);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Agreement Generator</h1>
                    <p className="text-gray-600">Select a booking to generate and download agreement PDFs</p>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <h3 className="text-sm font-medium text-red-800">Error</h3>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Booking List */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 sm:p-6 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">Bookings</h2>

                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by company, contact, email, phone, BDM..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="max-h-96 overflow-y-auto">
                                {isLoadingBookings ? (
                                    <div className="p-6 flex items-center justify-center">
                                        <Loader className="h-6 w-6 animate-spin text-blue-500" />
                                        <span className="ml-2 text-gray-600">Loading bookings...</span>
                                    </div>
                                ) : filteredBookings.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500">
                                        {searchTerm ? 'No bookings match your search.' : 'No bookings found.'}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {filteredBookings.map((booking) => (
                                            <div
                                                key={booking._id}
                                                onClick={() => handleBookingSelect(booking)}
                                                className={`p-4 cursor-pointer transition-all duration-200 hover:bg-blue-50 ${selectedBooking?._id === booking._id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-sm font-medium text-gray-900 truncate">
                                                            {booking.company_name || 'No Company Name'}
                                                        </h3>
                                                        <p className="text-sm text-gray-600 truncate">{booking.contact_person}</p>
                                                        <p className="text-xs text-gray-500 truncate">{booking.email}</p>
                                                        <p className="text-xs text-gray-500">Phone: {booking.contact_no}</p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            BDM: {booking.bdm} • {formatCurrency(booking.total_amount)}
                                                        </p>
                                                    </div>
                                                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${booking.status === 'Pending'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : booking.status === 'Completed'
                                                            ? 'bg-green-100 text-green-800'
                                                            : booking.status === 'In Progress'
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {booking.status}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Agreement Preview and Details */}
                    <div className="lg:col-span-2">
                        {!selectedBooking ? (
                            isMobile ? (
                                <div className="mb-2">
                                    <h3 className="text-lg font-semibold text-gray-900">Select a Booking</h3>
                                    <p className="text-sm text-gray-600">Choose a booking from the list to generate an agreement preview.</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-96 flex items-center justify-center">
                                    <div className="text-center">
                                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Booking</h3>
                                        <p className="text-gray-600">Choose a booking from the list to generate an agreement preview</p>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="space-y-6">
                                {/* Booking Details */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-semibold text-gray-900">Booking Details</h2>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setShowPreview(true)}
                                                disabled={isLoading}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <Eye className="h-4 w-4" />
                                                Preview
                                            </button>
                                            <button
                                                onClick={() => handleDownloadPDF()}
                                                disabled={isLoading || !agreementHtml}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {isLoading ? (
                                                    <Loader className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Download className="h-4 w-4" />
                                                )}
                                                Download PDF
                                            </button>
                                        </div>
                                    </div>

                                    {templateMeta && (
                                        <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                                            <div className="font-semibold">Selected template: {templateMeta.templateTitle}</div>
                                            <div className="mt-1 text-blue-800">
                                                {templateMeta.agreementType} / {templateMeta.isNotary ? 'Notary' : 'Without Notary'} / {templateMeta.isNoPending ? 'No Pending' : 'Pending'}{templateMeta.isRefundable ? ' / Refundable' : ''}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">Company Name</label>
                                                <p className="text-gray-900">{selectedBooking.company_name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">Contact Person</label>
                                                <p className="text-gray-900">{selectedBooking.contact_person}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">Email</label>
                                                <p className="text-gray-900">{selectedBooking.email}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">Contact Number</label>
                                                <p className="text-gray-900">{selectedBooking.contact_no}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">Services</label>
                                                <p className="text-gray-900">{selectedBooking.services?.join(', ') || 'N/A'}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">BDM</label>
                                                <p className="text-gray-900">{selectedBooking.bdm}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">Branch</label>
                                                <p className="text-gray-900">{selectedBooking.branch_name}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">Total Amount</label>
                                                <p className="text-gray-900 text-lg font-semibold">{formatCurrency(selectedBooking.total_amount)}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">Payment Date</label>
                                                <p className="text-gray-900">{selectedBooking.payment_date ? formatDate(selectedBooking.payment_date) : 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">State</label>
                                                <p className="text-gray-900">{selectedBooking.state}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Agreement Preview Modal */}
                                {showPreview && (
                                    <AgreementPreview
                                        agreementHtml={agreementHtml}
                                        isLoading={isLoading}
                                        onClose={() => setShowPreview(false)}
                                        onDownload={handleDownloadPDF}
                                        onSendEmail={(customHtml) => { 
                                            setShowPreview(false); 
                                            setShowEmailModal(true); 
                                            // Store the custom HTML for email
                                            if (customHtml) {
                                                setAgreementHtml(customHtml);
                                            }
                                        }}
                                        onSave={handleSaveAgreement}
                                    />
                                )}

                                {showEmailModal && (
                                    <DocumentEmailModal
                                        isOpen={showEmailModal}
                                        onClose={() => setShowEmailModal(false)}
                                        documentType="Agreement"
                                        bookingEmail={selectedBooking?.email || ''}
                                        filename={`Agreement-${selectedBooking?.company_name || selectedBooking?._id}.pdf`}
                                        generatePdfBase64={async () => {
                                            return await generatePDFBase64(agreementHtml);
                                        }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Download History */}
                {downloadHistory.length > 0 && (
                    <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Download History</h2>
                        <div className="space-y-2">
                            {downloadHistory.slice(0, 5).map((entry, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{entry.companyName}</p>
                                            <p className="text-xs text-gray-600">Booking ID: {entry.bookingId}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {new Date(entry.downloadedAt).toLocaleString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BookingAgreementGenerator;
