

export const jsonToCSV = (data, selectedFields) => {
  if (!Array.isArray(data) || data.length === 0) return "";

  const headers = [];
  const rows = [];

  // Dynamically build the headers based on selected fields
  if (selectedFields.companyName) headers.push("Company Name");
  if (selectedFields.bdmName) headers.push("BDM Name");
  if (selectedFields.contactNo) headers.push("Contact No.");
  if (selectedFields.email) headers.push("Email");
  if (selectedFields.bookingDate) headers.push("Booking Date");
  if (selectedFields.paymentDate) headers.push("Payment Date");
  if (selectedFields.totalPayment) headers.push("Total Payment");
  if (selectedFields.receivedPayment) headers.push("Received Payment");
  if (selectedFields.afterDisbursement) headers.push("After Disbursement:1%");
  if (selectedFields.remark) headers.push("Remark");
  if (selectedFields.services) headers.push("Services");
  if (selectedFields.gst) headers.push("GST");
  if (selectedFields.state) headers.push("State");
  if (selectedFields.pan) headers.push("PAN");
  if (selectedFields.termType) headers.push("Term Type");

  // Dynamically create the rows based on selected fields
  data.forEach((item) => {
    const row = [];

    if (selectedFields.companyName)
      row.push(escapeCSVValue(item.company_name || "N/A"));
    if (selectedFields.bdmName) row.push(escapeCSVValue(item.bdm || "N/A"));
    if (selectedFields.contactNo)
      row.push(escapeCSVValue(item.contact_no || "N/A"));
    if (selectedFields.email) row.push(escapeCSVValue(item.email || "N/A"));
    if (selectedFields.bookingDate)
      row.push(
        escapeCSVValue(
          item.date ? new Date(item.date).toLocaleDateString("en-GB") : "N/A"
        )
      );
    if (selectedFields.paymentDate)
      row.push(
        escapeCSVValue(
          item.payment_date ? new Date(item.payment_date).toLocaleDateString("en-GB") : "N/A"
        )
      );
    if (selectedFields.totalPayment)
      row.push(escapeCSVValue(item.total_amount || 0));
    if (selectedFields.receivedPayment) {
      const receivedAmount =
        (item.term_1 || 0) + (item.term_2 || 0) + (item.term_3 || 0);
      row.push(escapeCSVValue(receivedAmount));
    }
    if (selectedFields.afterDisbursement)
      row.push(escapeCSVValue(item.after_disbursement || "N/A"));
    if (selectedFields.remark) row.push(escapeCSVValue(item.remark || "N/A"));

    if (selectedFields.services) {
      // Join services into a single string and ensure it's properly escaped
      const servicesList = Array.isArray(item.services)
        ? item.services.join(", ")
        : item.services || "N/A";
      row.push(escapeCSVValue(servicesList)); // Ensure services go into one column
    }

    if (selectedFields.gst) row.push(escapeCSVValue(item.gst || "N/A"));
    if (selectedFields.state) row.push(escapeCSVValue(item.state || "N/A"));
    if (selectedFields.pan) row.push(escapeCSVValue(item.pan || "N/A"));
    // ✅ Term Type field logic
    if (selectedFields.termType) {
      let termType = "N/A";
      const termsFilled = [
        item.term_1 ? "Term 1" : null,
        item.term_2 ? "Term 2" : null,
        item.term_3 ? "Term 3" : null,
      ].filter(Boolean);

      if (termsFilled.length === 1) {
        termType = termsFilled[0];
      } else if (termsFilled.length > 1) {
        termType = "Multiple Terms";
      }

      row.push(escapeCSVValue(termType));
    }
    rows.push(row.join(","));
  });

  // Combine headers and rows to form CSV
  return [headers.join(","), ...rows].join("\n");
};

// Function to escape values for CSV (e.g., to handle commas inside values)
const escapeCSVValue = (value) => {
  if (
    typeof value === "string" &&
    (value.includes(",") || value.includes("\n") || value.includes('"'))
  ) {
    return `"${value.replace(/"/g, '""')}"`; // Double quotes for values containing commas or newlines
  }
  return value;
};

// Optional: Download the CSV file
export const downloadCSV = (csvContent, fileName = "data.csv") => {
  const link = document.createElement("a");
  link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
  link.target = "_blank";
  link.download = fileName;
  link.click();
};
