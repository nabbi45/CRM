import React, { useEffect, useState } from 'react';
import { apiUrl } from './LoginSignup';
import { useColorMode } from '../context/AppThemeProvider';
import { FileText, Download, Eye, Loader, Trash2 } from 'lucide-react';
import { generatePDF } from '../utils/pdfGenerator';
import AgreementPreview from '../components/AgreementPreview';
import InvoicePreview from '../components/InvoicePreview';

const DocumentsPage = () => {
    const { mode } = useColorMode();
    const isDark = mode === 'dark';
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
        <div style={{ padding: '20px', color: isDark ? '#f8fafc' : '#0f172a', maxWidth: '100%', overflowX: 'hidden' }}>
            <style>{`
                .doc-card {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 16px 18px;
                    border-radius: 12px;
                }
                @media (min-width: 768px) {
                    .doc-card {
                        flex-direction: row;
                        align-items: center;
                    }
                }
            `}</style>
            <h2 style={{ fontSize: 'clamp(1.35rem, 4vw, 2rem)', marginBottom: '8px', color: isDark ? '#f8fafc' : '#111827' }}>Generated Documents</h2>
            <p style={{ marginBottom: '16px', color: isDark ? '#94a3b8' : '#64748b' }}>View and download all generated Invoices and Agreements</p>

            <div style={{ marginBottom: '24px' }}>
                <input
                    type="text"
                    placeholder="Search by company, person, date, or title..."
                    style={{
                        width: '100%',
                        maxWidth: '500px',
                        padding: '10px 15px',
                        borderRadius: '8px',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,0.35)'}`,
                        backgroundColor: isDark ? '#0f172a' : '#fff',
                        color: isDark ? '#f8fafc' : '#0f172a',
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
                        <div key={doc._id} className="doc-card" style={{
                            background: isDark
                                ? 'linear-gradient(140deg, rgba(15,23,42,1) 0%, rgba(30,41,59,1) 100%)'
                                : 'linear-gradient(140deg, rgba(255,255,255,1) 0%, rgba(255,248,246,1) 100%)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,0.26)'}`,
                            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.35)' : '0 4px 12px rgba(15,23,42,0.08)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <FileText color={isDark ? '#ff7a5f' : '#ff3b1f'} size={24} />
                                <div style={{ minWidth: 0 }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: 6 }}>{doc.title || `${doc.type} Document`}</h3>
                                    <p style={{ fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#64748b', margin: 0, lineHeight: 1.5 }}>
                                        Type: <span style={{ fontWeight: '600', color: doc.type === 'Invoice' ? '#22c55e' : '#f59e0b' }}>{doc.type}</span><br />
                                        Generated: {new Date(doc.createdAt).toLocaleDateString()}<br />
                                        Client: {doc.bookingId?.company_name || doc.invoiceData?.clientCompanyName || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => handlePreview(doc)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#e2e8f0', color: isDark ? '#f8fafc' : '#0f172a', fontWeight: '600' }}>
                                    <Eye size={16} /> View
                                </button>
                                <button
                                    onClick={() => handleDownload(doc)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: '#111827', color: '#fff', fontWeight: '600' }}>
                                    <Download size={16} /> Download
                                </button>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDelete(doc._id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: '#ef4444', color: '#fff', fontWeight: '600' }}>
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
                    <div style={{ position: 'relative', width: '100%', maxWidth: '900px', paddingInline: 10 }}>
                        <button onClick={closePreview} style={{ position: 'absolute', top: '10px', right: '10px', background: 'red', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px' }}>Close</button>
                        <div style={{ padding: '20px', backgroundColor: isDark ? '#0f172a' : '#fff', borderRadius: '8px', overflowX: 'auto' }}>
                            <InvoicePreview invoice={selectedDoc.invoiceData} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentsPage;
