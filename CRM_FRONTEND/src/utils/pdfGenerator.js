import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const findSafePageBreak = (canvas, startY, targetEndY) => {
  const ctx = canvas.getContext('2d');
  const searchRadius = 140;
  const minSliceHeight = 500;
  const fromY = Math.max(startY + minSliceHeight, targetEndY - searchRadius);
  const toY = Math.min(canvas.height - 1, targetEndY + 40);

  const isMostlyWhiteRow = (y) => {
    const data = ctx.getImageData(0, y, canvas.width, 1).data;
    let darkPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) darkPixels += 1;
      if (darkPixels > canvas.width * 0.01) return false;
    }
    return true;
  };

  for (let y = targetEndY; y >= fromY; y -= 1) {
    if (isMostlyWhiteRow(y) && isMostlyWhiteRow(Math.max(0, y - 8))) return y;
  }

  for (let y = targetEndY + 1; y <= toY; y += 1) {
    if (isMostlyWhiteRow(y) && isMostlyWhiteRow(Math.max(0, y - 8))) return y;
  }

  return targetEndY;
};

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

    // Wait for all images to load fully before capturing
    const images = Array.from(tempDiv.querySelectorAll('img'));
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = () => {
          console.warn('Image failed to load for PDF rendering:', img.src);
          resolve();
        };
      });
    }));

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
    const pageMargin = 10;
    const printableWidth = pdfWidth - pageMargin * 2;
    const printableHeight = pdfPageHeight - pageMargin * 2;

    // Calculate the canvas pixel height that corresponds to one A4 page
    const pixelsPerMm = canvas.width / printableWidth;
    const pageCanvasHeight = Math.floor(printableHeight * pixelsPerMm);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let page = 0;
    let srcY = 0;
    while (srcY < canvas.height) {
      if (page > 0) pdf.addPage();

      // Calculate the slice of canvas for this page
      const targetEndY = Math.min(srcY + pageCanvasHeight, canvas.height);
      const safeEndY = targetEndY < canvas.height ? findSafePageBreak(canvas, srcY, targetEndY) : targetEndY;
      const srcH = Math.min(Math.max(safeEndY - srcY, 1), canvas.height - srcY);

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

      pdf.addImage(pageImgData, 'PNG', pageMargin, pageMargin, printableWidth, sliceHeightMm);
      srcY += srcH;
      page += 1;
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
    const pageMargin = 10;
    const printableWidth = pdfWidth - pageMargin * 2;
    const printableHeight = pdfPageHeight - pageMargin * 2;
    const pixelsPerMm = canvas.width / printableWidth;
    const pageCanvasHeight = Math.floor(printableHeight * pixelsPerMm);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let page = 0;
    let srcY = 0;
    while (srcY < canvas.height) {
      if (page > 0) pdf.addPage();
      const targetEndY = Math.min(srcY + pageCanvasHeight, canvas.height);
      const safeEndY = targetEndY < canvas.height ? findSafePageBreak(canvas, srcY, targetEndY) : targetEndY;
      const srcH = Math.min(Math.max(safeEndY - srcY, 1), canvas.height - srcY);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = srcH;
      const ctx = pageCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, pageCanvas.width, pageCanvas.height);

      const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.8);
      const sliceHeightMm = srcH / pixelsPerMm;
      pdf.addImage(pageImgData, 'JPEG', pageMargin, pageMargin, printableWidth, sliceHeightMm);
      srcY += srcH;
      page += 1;
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
