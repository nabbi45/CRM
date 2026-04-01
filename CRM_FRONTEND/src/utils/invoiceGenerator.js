import jsPDF from 'jspdf';

export const generateInvoiceNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-4);
  return `PI-${year}${month}${day}-${time}`;
};

export const calculateGST = (serviceFee, gstPercent) => (serviceFee * gstPercent) / 100;
export const calculateTotal = (serviceFee, gstAmount) => serviceFee + gstAmount;

/**
 * Fetch any image URL as a base64 data URL via the Fetch API.
 * Using fetch avoids the canvas taint (CORS) problem.
 * Returns { dataUrl, naturalWidth, naturalHeight } or null.
 */
const fetchImageInfo = async (url) => {
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'no-cache' });
    if (!response.ok) throw new Error('fetch failed');
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    // Now get natural dimensions
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 100, h: 100 });
      img.src = dataUrl;
    });
    return { dataUrl, naturalWidth: dims.w, naturalHeight: dims.h };
  } catch (e) {
    return null;
  }
};

/**
 * Compute display dimensions in mm that fit within maxW x maxH while keeping aspect ratio.
 */
const fitDimensions = (naturalW, naturalH, maxW, maxH) => {
  const ratio = naturalW / naturalH;
  if (ratio > maxW / maxH) {
    return { w: maxW, h: maxW / ratio };
  }
  return { w: maxH * ratio, h: maxH };
};

/**
 * Builds and downloads a proforma invoice as a well-formatted PDF
 * using jsPDF directly — no html2canvas, no logo stretching.
 */
export const downloadInvoiceAsPDF = async (_, filename, invoiceData) => {
  // NOTE: first arg (elementId) is ignored. We build from invoiceData.
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR;
  let y = 20;

  // ── LOGO ──────────────────────────────────────────────────────────────────
  const logoUrl = invoiceData?.companyDetails?.logo;
  if (logoUrl) {
    const logoInfo = await fetchImageInfo(logoUrl);
    if (logoInfo) {
      const { w, h } = fitDimensions(logoInfo.naturalWidth, logoInfo.naturalHeight, 55, 22);
      pdf.addImage(logoInfo.dataUrl, 'PNG', marginL, y, w, h);
    }
  }

  // ── COMPANY DETAILS (right column) ────────────────────────────────────────
  const comp = invoiceData?.companyDetails || {};
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(31, 41, 55);
  pdf.text(comp.name || '', pageW - marginR, y + 2, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(75, 85, 99);
  pdf.text(comp.phone || '', pageW - marginR, y + 7, { align: 'right' });
  pdf.text(comp.email || '', pageW - marginR, y + 12, { align: 'right' });
  if (comp.streetAddress) {
    const addrLines = pdf.splitTextToSize(comp.streetAddress, 80);
    pdf.text(addrLines, pageW - marginR, y + 17, { align: 'right' });
    y += addrLines.length * 4;
  }

  y = Math.max(y, 44);

  // ── BLUE DIVIDER ──────────────────────────────────────────────────────────
  pdf.setDrawColor(37, 99, 235);
  pdf.setLineWidth(0.6);
  pdf.line(marginL, y, pageW - marginR, y);
  y += 10;

  // ── TITLE ─────────────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(37, 99, 235);
  pdf.text('PROFORMA INVOICE', pageW / 2, y, { align: 'center' });
  y += 10;

  // ── INVOICE META ──────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(55, 65, 81);
  const dateStr = invoiceData?.date
    ? new Date(invoiceData.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
  pdf.text(`Invoice #: ${invoiceData?.invoiceNumber || ''}`, marginL, y);
  pdf.text(`Date: ${dateStr}`, pageW - marginR, y, { align: 'right' });
  y += 12;

  // ── FROM / TO ─────────────────────────────────────────────────────────────
  const colMid = marginL + contentW / 2 + 5;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(31, 41, 55);
  pdf.text('From:', marginL, y);
  pdf.text('To:', colMid, y);
  y += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(55, 65, 81);
  const fromLines = [
    comp.name || '',
    comp.streetAddress || '',
    comp.phone ? `Phone: ${comp.phone}` : '',
    comp.email ? `Email: ${comp.email}` : '',
  ].filter(Boolean);

  const toLines = [
    invoiceData?.clientCompanyName || '',
    invoiceData?.clientName || '',
    invoiceData?.clientAddress || '',
    invoiceData?.clientEmail ? `Email: ${invoiceData.clientEmail}` : '',
    invoiceData?.clientGstNumber ? `GST/PAN: ${invoiceData.clientGstNumber}` : '',
  ].filter(Boolean);

  const maxRows = Math.max(fromLines.length, toLines.length);
  for (let i = 0; i < maxRows; i++) {
    if (fromLines[i]) pdf.text(fromLines[i], marginL, y + i * 5);
    if (toLines[i]) pdf.text(toLines[i], colMid, y + i * 5);
  }
  y += maxRows * 5 + 10;

  // ── ITEMS TABLE ───────────────────────────────────────────────────────────
  const tblRight = pageW - marginR;
  const cols = {
    desc:  { x: marginL, w: 90, align: 'left' },
    qty:   { x: marginL + 90, w: 20, align: 'right' },
    rate:  { x: marginL + 110, w: 27, align: 'right' },
    amt:   { x: marginL + 137, w: 28, align: 'right' },
  };

  // Header row
  pdf.setFillColor(239, 246, 255);
  pdf.rect(marginL, y - 5, contentW, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(31, 41, 55);
  pdf.text('Description', cols.desc.x + 2, y);
  pdf.text('Qty', cols.qty.x + cols.qty.w, y, { align: 'right' });
  pdf.text('Rate (₹)', cols.rate.x + cols.rate.w, y, { align: 'right' });
  pdf.text('Amount (₹)', cols.amt.x + cols.amt.w, y, { align: 'right' });
  y += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(55, 65, 81);

  (invoiceData?.items || []).forEach((item) => {
    pdf.setDrawColor(209, 213, 219);
    pdf.setLineWidth(0.1);
    pdf.line(marginL, y - 3, tblRight, y - 3);
    pdf.text(String(item.description || ''), cols.desc.x + 2, y);
    pdf.text(String(item.quantity || 0), cols.qty.x + cols.qty.w, y, { align: 'right' });
    pdf.text(Number(item.rate || 0).toFixed(2), cols.rate.x + cols.rate.w, y, { align: 'right' });
    pdf.text(Number(item.amount || 0).toFixed(2), cols.amt.x + cols.amt.w, y, { align: 'right' });
    y += 7;
  });
  pdf.line(marginL, y - 3, tblRight, y - 3);
  y += 6;

  // ── TOTALS ────────────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.text(`Subtotal:`, tblRight - 50, y);
  pdf.text(`₹${Number(invoiceData?.subtotal || 0).toFixed(2)}`, tblRight, y, { align: 'right' });
  y += 6;

  if (invoiceData?.includeGst) {
    pdf.text(`GST (${invoiceData.gstRate}%):`, tblRight - 50, y);
    pdf.text(`₹${Number(invoiceData.gstAmount || 0).toFixed(2)}`, tblRight, y, { align: 'right' });
    y += 6;
  }

  pdf.setDrawColor(31, 41, 55);
  pdf.setLineWidth(0.5);
  pdf.line(tblRight - 65, y - 2, tblRight, y - 2);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(31, 41, 55);
  pdf.text('Total:', tblRight - 50, y + 4);
  pdf.text(`₹${Number(invoiceData?.total || 0).toFixed(2)}`, tblRight, y + 4, { align: 'right' });
  y += 14;

  // ── BANK DETAILS ──────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(31, 41, 55);
  pdf.text('Bank Details:', marginL, y);
  y += 5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(55, 65, 81);
  pdf.text(`Account: ${comp.bankAccountNumber || ''}  |  IFSC: ${comp.ifscCode || ''}`, marginL, y);
  y += 5;
  pdf.text(`Account Holder: ${comp.accountHolderName || ''}  |  Bank: ${comp.bankName || ''}`, marginL, y);
  y += 15;

  // ── DIGITAL STAMP (optional) ──────────────────────────────────────────────
  const stampUrl = invoiceData?.companyDetails?.digitalStamp;
  if (stampUrl) {
    try {
      const stampInfo = await fetchImageInfo(stampUrl);
      if (stampInfo) {
        const { w, h } = fitDimensions(stampInfo.naturalWidth, stampInfo.naturalHeight, 30, 30);
        pdf.addImage(stampInfo.dataUrl, 'PNG', pageW - marginR - w, y, w, h);
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text('Authorized Signature', pageW - marginR - w / 2, y + h + 4, { align: 'center' });
      }
    } catch (e) { /* skip stamp on error */ }
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, 272, pageW - marginR, 272);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(107, 114, 128);
  pdf.text('Thank you for your business!', pageW / 2, 277, { align: 'center' });
  pdf.text('This is a computer-generated proforma invoice and does not require a physical signature.', pageW / 2, 282, { align: 'center' });

  pdf.save(filename);
};
