import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generatePDF = async (htmlContent, filename = 'agreement') => {
  try {
    // Create a temporary div to render the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '794px'; // A4 at 96dpi = 794px
    tempDiv.style.backgroundColor = 'white';
    tempDiv.style.padding = '40px';
    document.body.appendChild(tempDiv);

    // Wait for any fonts to load
    await document.fonts.ready;

    // Pre-convert all cross-origin images to base64 data URLs (fixes CORS + stretching)
    const images = Array.from(tempDiv.querySelectorAll('img'));
    await Promise.all(images.map(async (img) => {
      if (!img.src || img.src.startsWith('data:')) return;
      await new Promise((resolve) => {
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        tempImg.onload = () => {
          const c = document.createElement('canvas');
          c.width = tempImg.naturalWidth;
          c.height = tempImg.naturalHeight;
          c.getContext('2d').drawImage(tempImg, 0, 0);
          try {
            img.src = c.toDataURL('image/png');
            // Fix dimensions to natural aspect ratio
            const ratio = tempImg.naturalWidth / tempImg.naturalHeight;
            const maxW = 200, maxH = 80;
            if (ratio > maxW / maxH) {
              img.style.width = maxW + 'px';
              img.style.height = (maxW / ratio) + 'px';
            } else {
              img.style.height = maxH + 'px';
              img.style.width = (maxH * ratio) + 'px';
            }
          } catch (e) { /* tainted, skip */ }
          resolve();
        };
        tempImg.onerror = resolve;
        tempImg.src = img.src.includes('?') ? `${img.src}&_cb=${Date.now()}` : `${img.src}?_cb=${Date.now()}`;
      });
    }));

    await new Promise(r => setTimeout(r, 100)); // Let DOM settle

    // Generate canvas from HTML
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      height: tempDiv.scrollHeight,
    });

    // Clean up
    document.body.removeChild(tempDiv);

    // PDF dimensions
    const pdfWidth = 210; // A4 width in mm
    const pdfPageHeight = 297; // A4 height in mm

    // Calculate the canvas pixel height that corresponds to one A4 page
    const pixelsPerMm = canvas.width / pdfWidth;
    const pageCanvasHeight = Math.floor(pdfPageHeight * pixelsPerMm);
    const totalPages = Math.ceil(canvas.height / pageCanvasHeight);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      // Calculate the slice of canvas for this page
      const srcY = page * pageCanvasHeight;
      const srcH = Math.min(pageCanvasHeight, canvas.height - srcY);

      // Create a canvas for this page slice
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = srcH;
      const ctx = pageCanvas.getContext('2d');

      // Fill white background (in case of any transparency)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      // Draw the slice of the full canvas onto the page canvas
      ctx.drawImage(
        canvas,
        0, srcY, canvas.width, srcH,       // source rect
        0, 0, pageCanvas.width, pageCanvas.height  // dest rect
      );

      const pageImgData = pageCanvas.toDataURL('image/png');
      const sliceHeightMm = (srcH / pixelsPerMm);

      pdf.addImage(pageImgData, 'PNG', 0, 0, pdfWidth, sliceHeightMm);
    }

    // Save the PDF
    pdf.save(`${filename}.pdf`);

    return Promise.resolve();
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};

// Generate PDF as Base64 data URL (for email attachment)
export const generatePDFBase64 = async (htmlContent) => {
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '794px';
    tempDiv.style.backgroundColor = 'white';
    tempDiv.style.padding = '40px';
    document.body.appendChild(tempDiv);

    await document.fonts.ready;

    const images = Array.from(tempDiv.querySelectorAll('img'));
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = () => resolve();
      });
    }));

    const canvas = await html2canvas(tempDiv, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      height: tempDiv.scrollHeight,
    });

    document.body.removeChild(tempDiv);

    const pdfWidth = 210;
    const pdfPageHeight = 297;
    const pixelsPerMm = canvas.width / pdfWidth;
    const pageCanvasHeight = Math.floor(pdfPageHeight * pixelsPerMm);
    const totalPages = Math.ceil(canvas.height / pageCanvasHeight);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

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
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, pageCanvas.width, pageCanvas.height);

      const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.8);
      const sliceHeightMm = srcH / pixelsPerMm;
      pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfWidth, sliceHeightMm);
    }

    return pdf.output('datauristring');
  } catch (error) {
    console.error('Error generating PDF base64:', error);
    throw new Error('Failed to generate PDF for email.');
  }
};

// Generate PDF base64 from a DOM element (for invoices)
export const generatePDFBase64FromElement = async (elementId) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Element not found');

  try {
    const canvas = await html2canvas(element, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.8);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = 297;
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    if (imgHeight > pdfHeight) {
      const scaleFactor = pdfHeight / imgHeight;
      const scaledWidth = imgWidth * scaleFactor;
      const scaledHeight = pdfHeight;
      const xOffset = (pdfWidth - scaledWidth) / 2;
      pdf.addImage(imgData, 'JPEG', xOffset, 0, scaledWidth, scaledHeight);
    } else {
      const yOffset = (pdfHeight - imgHeight) / 2;
      pdf.addImage(imgData, 'JPEG', 0, yOffset, imgWidth, imgHeight);
    }

    return pdf.output('datauristring');
  } catch (error) {
    console.error('Error generating PDF base64 from element:', error);
    throw new Error('Failed to generate PDF for email.');
  }
};

// Alternative method using direct HTML to PDF conversion (if needed)
export const generatePDFFromHTML = async (htmlContent, filename = 'agreement') => {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Simple HTML to PDF conversion (limited styling support)
    pdf.html(htmlContent, {
      callback: function (pdf) {
        pdf.save(`${filename}.pdf`);
      },
      x: 10,
      y: 10,
      width: 190,
      windowWidth: 800
    });

    return Promise.resolve();
  } catch (error) {
    console.error('Error generating PDF from HTML:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};