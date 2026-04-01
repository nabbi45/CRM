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
    const [downloadingId, setDownloadingId] = useState(null);
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
            // Invoice: render it off-screen and download as PDF
            setDownloadingId(doc._id);
            try {
                const { default: jsPDF } = await import('jspdf');
                const { default: html2canvas } = await import('html2canvas');

                // Create a temp container to render the invoice
                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                container.style.top = '0';
                container.style.width = '794px';
                container.style.backgroundColor = 'white';
                document.body.appendChild(container);

                // Render InvoicePreview HTML manually based on invoice data
                const inv = doc.invoiceData;
                container.innerHTML = `
                    <div style="width:794px;padding:40px;background:#fff;font-family:Arial,sans-serif;box-sizing:border-box;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:20px;">
                            <div>${inv?.companyDetails?.logo ? `<img src="${inv.companyDetails.logo}" style="max-width:180px;max-height:70px;object-fit:contain;" crossorigin="anonymous"/>` : ''}</div>
                            <div style="text-align:right;font-size:13px;color:#374151;">
                                <div style="font-weight:700;font-size:14px;">${inv?.companyDetails?.name || ''}</div>
                                <div>${inv?.companyDetails?.phone || ''}</div>
                                <div>${inv?.companyDetails?.email || ''}</div>
                                <div>${inv?.companyDetails?.streetAddress || ''}</div>
                            </div>
                        </div>
                        <div style="text-align:center;margin-bottom:20px;"><h2 style="font-size:22px;font-weight:800;color:#2563eb;letter-spacing:2px;">PROFORMA INVOICE</h2></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:13px;">
                            <span>Invoice #: <b>${inv?.invoiceNumber || ''}</b></span>
                            <span>Date: <b>${inv?.date ? new Date(inv.date).toLocaleDateString('en-IN') : ''}</b></span>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:24px;font-size:13px;">
                            <div><b>From:</b><br/>${inv?.companyDetails?.name || ''}<br/>${inv?.companyDetails?.streetAddress || ''}<br/>Phone: ${inv?.companyDetails?.phone || ''}<br/>Email: ${inv?.companyDetails?.email || ''}</div>
                            <div><b>To:</b><br/>${inv?.clientCompanyName || ''}<br/>${inv?.clientName || ''}<br/>${inv?.clientAddress || ''}<br/>Email: ${inv?.clientEmail || ''}</div>
                        </div>
                        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
                            <thead><tr style="background:#eff6ff;">
                                <th style="border:1px solid #d1d5db;padding:10px;text-align:left;">Description</th>
                                <th style="border:1px solid #d1d5db;padding:10px;text-align:center;">Qty</th>
                                <th style="border:1px solid #d1d5db;padding:10px;text-align:right;">Rate (₹)</th>
                                <th style="border:1px solid #d1d5db;padding:10px;text-align:right;">Amount (₹)</th>
                            </tr></thead>
                            <tbody>${(inv?.items || []).map(item => `<tr><td style="border:1px solid #d1d5db;padding:10px;">${item.description}</td><td style="border:1px solid #d1d5db;padding:10px;text-align:center;">${item.quantity}</td><td style="border:1px solid #d1d5db;padding:10px;text-align:right;">${Number(item.rate).toFixed(2)}</td><td style="border:1px solid #d1d5db;padding:10px;text-align:right;">${Number(item.amount).toFixed(2)}</td></tr>`).join('')}</tbody>
                        </table>
                        <div style="display:flex;justify-content:flex-end;margin-bottom:24px;font-size:13px;">
                            <div style="width:240px;">
                                <div style="display:flex;justify-content:space-between;padding:4px 0;">Subtotal: <b>₹${Number(inv?.subtotal || 0).toFixed(2)}</b></div>
                                ${inv?.includeGst ? `<div style="display:flex;justify-content:space-between;padding:4px 0;">GST (${inv.gstRate}%): <b>₹${Number(inv.gstAmount || 0).toFixed(2)}</b></div>` : ''}
                                <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #111;font-size:15px;font-weight:800;">Total: <span>₹${Number(inv?.total || 0).toFixed(2)}</span></div>
                            </div>
                        </div>
                        <div style="margin-bottom:16px;font-size:13px;"><b>Bank Details:</b><br/>Account: ${inv?.companyDetails?.bankAccountNumber || ''} | IFSC: ${inv?.companyDetails?.ifscCode || ''}<br/>Holder: ${inv?.companyDetails?.accountHolderName || ''} | Bank: ${inv?.companyDetails?.bankName || ''}</div>
                        <div style="text-align:center;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px;">Thank you for your business!<br/>This is a computer-generated proforma invoice.</div>
                    </div>`;

                // Wait for images to load
                const images = Array.from(container.querySelectorAll('img'));
                await Promise.all(images.map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
                }));

                const canvas = await html2canvas(container, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
                document.body.removeChild(container);

                const pdfWidth = 210;
                const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                const pdf = new jsPDF('p', 'mm', 'a4');
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, imgHeight);
                pdf.save(`${doc.title || 'Invoice'}.pdf`);
            } catch (err) {
                console.error('Invoice PDF download error:', err);
                alert('Failed to download invoice. Please try again.');
            }
            setDownloadingId(null);
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
                        <div key={doc._id} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '16px 18px',
                            borderRadius: '12px',
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
                                    disabled={downloadingId === doc._id}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: downloadingId === doc._id ? 'wait' : 'pointer', backgroundColor: '#111827', color: '#fff', fontWeight: '600', opacity: downloadingId === doc._id ? 0.7 : 1 }}>
                                    {downloadingId === doc._id ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
                                    {downloadingId === doc._id ? 'Downloading...' : 'Download'}
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
