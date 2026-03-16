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

export const downloadInvoiceAsPDF = async (elementId, filename) => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Invoice element not found');
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
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

    const imgData = canvas.toDataURL('image/png');
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
      pdf.addImage(imgData, 'PNG', xOffset, 0, scaledWidth, scaledHeight);
    } else {
      const yOffset = (pdfHeight - imgHeight) / 2;
      pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};
