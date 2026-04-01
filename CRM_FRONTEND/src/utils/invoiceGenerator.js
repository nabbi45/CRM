import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateInvoiceNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-4);
  return `PI-${year}${month}${day}-${time}`;
};

export const calculateGST = (serviceFee, gstPercent) => {
  return (serviceFee * gstPercent) / 100;
};

export const calculateTotal = (serviceFee, gstAmount) => {
  return serviceFee + gstAmount;
};

/**
 * Converts a remote image URL to a base64 data URL.
 * This bypasses CORS restrictions by drawing the image into a canvas.
 */
const toDataUrl = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      try {
        resolve({ dataUrl: canvas.toDataURL('image/png'), naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
      } catch (e) {
        resolve(null); // tainted canvas — skip
      }
    };
    img.onerror = () => resolve(null);
    // Cache-bust to force fresh CORS fetch
    img.src = url.includes('?') ? `${url}&_cb=${Date.now()}` : `${url}?_cb=${Date.now()}`;
  });
};

/**
 * Downloads an invoice DOM element as a PDF.
 * Fixes:
 * 1. CORS error: pre-converts all external images to base64 data URLs
 * 2. Logo stretching: sets explicit pixel dimensions based on natural image aspect ratio
 */
export const downloadInvoiceAsPDF = async (elementId, filename) => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Invoice element not found. Please wait for the preview to load.');
  }

  // Step 1: Pre-process all <img> tags — replace src with base64 and fix dimensions
  const images = Array.from(element.querySelectorAll('img'));
  const originals = images.map(img => ({ src: img.src, style: img.getAttribute('style') || '' }));

  await Promise.all(images.map(async (img) => {
    if (!img.src || img.src.startsWith('data:')) return;

    const result = await toDataUrl(img.src);
    if (!result) return;

    const { dataUrl, naturalWidth, naturalHeight } = result;

    // Replace with data URL so html2canvas can render it
    img.src = dataUrl;

    // Compute proper display size respecting aspect ratio
    const maxW = 200;
    const maxH = 80;
    const ratio = naturalWidth / naturalHeight;
    let displayW, displayH;
    if (ratio > maxW / maxH) {
      displayW = maxW;
      displayH = maxW / ratio;
    } else {
      displayH = maxH;
      displayW = maxH * ratio;
    }

    img.style.cssText = `width:${displayW}px;height:${displayH}px;object-fit:contain;display:block;`;
  }));

  // Small wait for DOM to settle after src changes
  await new Promise(r => setTimeout(r, 100));

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = 297;
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    if (imgHeight > pdfHeight) {
      // Multi-page: slice into pages
      const pageCanvasHeight = Math.floor(pdfHeight * (canvas.width / pdfWidth));
      const totalPages = Math.ceil(canvas.height / pageCanvasHeight);
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();
        const srcY = page * pageCanvasHeight;
        const srcH = Math.min(pageCanvasHeight, canvas.height - srcY);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcH;
        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        const pageImg = pageCanvas.toDataURL('image/png');
        const sliceH = (srcH * pdfWidth) / canvas.width;
        pdf.addImage(pageImg, 'PNG', 0, 0, pdfWidth, sliceH);
      }
    } else {
      const yOffset = (pdfHeight - imgHeight) / 2;
      pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  } finally {
    // Restore original img src and styles
    images.forEach((img, i) => {
      img.src = originals[i].src;
      img.setAttribute('style', originals[i].style);
    });
  }
};
