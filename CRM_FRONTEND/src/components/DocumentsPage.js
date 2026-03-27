import React, { useEffect, useState } from 'react';
import { apiUrl } from './LoginSignup';
import { useColorMode } from '../context/AppThemeProvider';
import { FileText, Download, Eye, Loader, Trash2 } from 'lucide-react';
import { generatePDF } from '../utils/pdfGenerator';
import AgreementPreview from '../components/AgreementPreview';
import InvoicePreview from '../components/InvoicePreview';

const DocumentsPage = () => {
    const { mode } = useColorMode();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const userSession = JSON.parse(localStorage.getItem('userSession'));
    const isAdmin = ['admin', 'superadmin', 'manager', 'director'].includes(userSession?.user_role?.toLowerCase() || '');

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const res = await fetch(`${apiUrl}/documents/all`, {
                headers: { 'Authorization': userSession?.token, 'user-role': userSession?.user_role }
            });
            const data = await res.json();
            if (res.ok) {
                setDocuments(data.documents);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = (doc) => {
        setSelectedDoc(doc);
    };

    const closePreview = () => {
        setSelectedDoc(null);
    };

    const handleDownload = async (doc) => {
        if (doc.type === 'Agreement') {
            await generatePDF(doc.htmlContent, doc.title || `Agreement-${doc.bookingId?._id || ''}`);
        } else {
            // It's an Invoice. The PDF generation expects the invoiceData payload
            setSelectedDoc(doc); // Show preview, user can download from preview
        }
    };

    const handleDelete = async (docId) => {
        if (!window.confirm("Are you sure you want to delete this document?")) return;
        try {
            const res = await fetch(`${apiUrl}/documents/${docId}`, {
                method: 'DELETE',
                headers: { 'Authorization': userSession?.token, 'user-role': userSession?.user_role }
            });
            if (res.ok) {
                setDocuments(prev => prev.filter(d => d._id !== docId));
            } else {
                alert("Failed to delete document or unauthorized.");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting document.");
        }
    };

    const filteredDocuments = documents.filter(doc => {
        const searchRegex = new RegExp(searchTerm, 'i');
        const clientName = doc.bookingId?.company_name || doc.invoiceData?.clientCompanyName || '';
        const personName = doc.bookingId?.contact_person || doc.invoiceData?.clientName || '';
        const title = doc.title || '';
        const dateStr = new Date(doc.createdAt).toLocaleDateString();

        return searchRegex.test(clientName) || searchRegex.test(personName) || searchRegex.test(title) || searchRegex.test(dateStr);
    });

    return (
        <div style={{ padding: '20px', color: mode === 'light' ? '#0f172a' : '#f8fafc' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '8px', color: '#111827' }}>Generated Documents</h2>
            <p style={{ marginBottom: '16px', color: mode === 'light' ? '#64748b' : '#94a3b8' }}>View and download all generated Invoices and Agreements</p>

            <div style={{ marginBottom: '24px' }}>
                <input
                    type="text"
                    placeholder="Search by company, person, date, or title..."
                    style={{
                        width: '100%',
                        maxWidth: '500px',
                        padding: '10px 15px',
                        borderRadius: '8px',
                        border: `1px solid ${mode === 'light' ? '#e2e8f0' : '#334155'}`,
                        backgroundColor: mode === 'light' ? '#fff' : '#1e293b',
                        color: mode === 'light' ? '#0f172a' : '#f8fafc',
                        outline: 'none'
                    }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <Loader className="animate-spin text-blue-500" size={32} />
                </div>
            ) : filteredDocuments.length === 0 ? (
                <p>No documents found matching your search.</p>
            ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                    {filteredDocuments.map((doc) => (
                        <div key={doc._id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px 20px', borderRadius: '8px',
                            backgroundColor: mode === 'light' ? '#fff' : '#1e293b',
                            border: `1px solid ${mode === 'light' ? '#e2e8f0' : '#334155'}`,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <FileText color="#111827" size={28} />
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{doc.title || `${doc.type} Document`}</h3>
                                    <p style={{ fontSize: '0.85rem', color: mode === 'light' ? '#64748b' : '#94a3b8' }}>
                                        Type: <span style={{ fontWeight: '600', color: doc.type === 'Invoice' ? '#10b981' : '#f59e0b' }}>{doc.type}</span> |
                                        Generated: {new Date(doc.createdAt).toLocaleDateString()} |
                                        Client: {doc.bookingId?.company_name || doc.invoiceData?.clientCompanyName || 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => handlePreview(doc)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#e2e8f0', color: '#0f172a', fontWeight: '500' }}>
                                    <Eye size={16} /> View
                                </button>
                                <button
                                    onClick={() => handleDownload(doc)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#111827', color: '#fff', fontWeight: '500' }}>
                                    <Download size={16} /> Download
                                </button>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDelete(doc._id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#ef4444', color: '#fff', fontWeight: '500' }}>
                                        <Trash2 size={16} /> Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedDoc && selectedDoc.type === 'Agreement' && (
                <AgreementPreview
                    agreementHtml={selectedDoc.htmlContent}
                    onClose={closePreview}
                    onDownload={() => handleDownload(selectedDoc)}
                />
            )}

            {selectedDoc && selectedDoc.type === 'Invoice' && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', justifyContent: 'center', paddingTop: '50px', overflowY: 'auto' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '900px' }}>
                        <button onClick={closePreview} style={{ position: 'absolute', top: '10px', right: '10px', background: 'red', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px' }}>Close</button>
                        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px' }}>
                            <InvoicePreview invoice={selectedDoc.invoiceData} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentsPage;
