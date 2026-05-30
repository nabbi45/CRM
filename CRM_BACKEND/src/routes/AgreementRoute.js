import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BookingModel } from "../models/bookingModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const AgreementRoute = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGREEMENT_TEMPLATE_CANDIDATES = [
  path.resolve(process.cwd(), "src/utils/ALL AGREEMENT.md"),
  path.resolve(__dirname, "../utils/ALL AGREEMENT.md"),
];
const NOTARY_THRESHOLD = 17700;
const REPORT_SERVICE_SUFFIXES = [
  "code",
  "report",
  "registration",
  "incorporation",
  "certificate",
  "license",
  "dsc",
];

let cachedSections = null;
let cachedMtimeMs = 0;

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString("en-GB");
  return date.toLocaleDateString("en-GB");
};

const formatAmount = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
  }).format(toNumber(value));

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const repairMojibake = (value = "") =>
  String(value)
    .replace(/â€œ/g, "“")
    .replace(/â€/g, "”")
    .replace(/â€™/g, "’")
    .replace(/â€˜/g, "‘")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â‚¹/g, "₹")
    .replace(/Â/g, "");

const normalizeHeading = (value = "") =>
  value
    .toLowerCase()
    .replace(/\(1\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeService = (service = "") =>
  String(service)
    .toLowerCase()
    .replace(/[^a-z0-9]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isReportService = (service = "") => {
  const normalized = normalizeService(service);
  return REPORT_SERVICE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
};

const splitAgreementSections = () => {
  const templatePath = AGREEMENT_TEMPLATE_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!templatePath) {
    throw new Error("Agreement template file not found in CRM_BACKEND/src/utils.");
  }

  const stat = fs.statSync(templatePath);
  if (cachedSections && cachedMtimeMs === stat.mtimeMs) return cachedSections;

  const markdown = fs.readFileSync(templatePath, "utf8").replace(/\r\n/g, "\n");
  const sections = [];
  const headingRegex = /^#\s+(.+)$/gm;
  const matches = [...markdown.matchAll(headingRegex)];

  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    const title = match[1].trim();
    sections.push({
      title,
      normalizedTitle: normalizeHeading(title),
      markdown: markdown.slice(start, end).trim(),
    });
  });

  cachedSections = sections;
  cachedMtimeMs = stat.mtimeMs;
  return sections;
};

const getAgreementTypeFromServices = (services = []) => {
  const serviceList = Array.isArray(services) ? services.filter(Boolean) : [];
  if (!serviceList.length) return "CONSULTANCY";

  const reportOnly = serviceList.every(isReportService);
  return reportOnly ? "REPORTS" : "CONSULTANCY";
};

const selectTemplateSection = (booking) => {
  const sections = splitAgreementSections();
  const totalAmount = toNumber(booking.total_amount);
  const isNotary = totalAmount > NOTARY_THRESHOLD;
  const receivedAmount = ["term_1", "term_2", "term_3"].reduce(
    (sum, term) => sum + toNumber(booking[term]),
    0
  );
  const isNoPending = receivedAmount >= totalAmount && totalAmount > 0;
  const isRefundable = Boolean(booking.is_refundable) || toNumber(booking.refundable_percentage) > 0;
  const agreementType = getAgreementTypeFromServices(booking.services);

  const matchedSection = sections.find((section) => {
    const title = section.normalizedTitle;
    const titleHasRefundable = title.includes("refundable");
    const titleHasNoPending = title.includes("no pending");
    const titleHasWithoutNotary = title.includes("without notary");
    const titleHasNotary = title.includes("notary") && !titleHasWithoutNotary;

    return (
      title.includes(agreementType.toLowerCase()) &&
      titleHasRefundable === isRefundable &&
      titleHasNoPending === isNoPending &&
      (isNotary ? titleHasNotary : titleHasWithoutNotary)
    );
  });

  if (!matchedSection) {
    throw new Error(
      `No agreement template found for ${agreementType}, ${isNotary ? "notary" : "without notary"}, ${isNoPending ? "no pending" : "pending"}, ${isRefundable ? "refundable" : "non-refundable"}`
    );
  }

  return {
    section: matchedSection,
    meta: {
      templateTitle: matchedSection.title,
      agreementType,
      isNotary,
      isNoPending,
      isRefundable,
      notaryThreshold: NOTARY_THRESHOLD,
    },
  };
};

const buildPlaceholderMap = (booking) => {
  const terms = [toNumber(booking.term_1), toNumber(booking.term_2), toNumber(booking.term_3)];
  const receivedAmount = terms.reduce((sum, value) => sum + value, 0);
  const totalAmount = toNumber(booking.total_amount);
  const pendingAmount = Math.max(totalAmount - receivedAmount, 0);
  const afterDisbursement = String(booking.after_disbursement || "").match(/[\d.]+/)?.[0] || "";
  const services = Array.isArray(booking.services) ? booking.services.join(", ") : "";
  const agreementDate = formatDate(new Date());

  return {
    agreementdate: agreementDate,
    companyname: booking.company_name || booking.contact_person || "",
    clientname: booking.contact_person || booking.company_name || "",
    state: booking.state || "",
    services,
    totalamount: formatAmount(totalAmount),
    receivedamount: formatAmount(receivedAmount || toNumber(booking.term_1)),
    pendingamount: formatAmount(pendingAmount),
    percentage: afterDisbursement,
    refundablepercentage: formatAmount(toNumber(booking.refundable_percentage)),
  };
};

const replacePlaceholders = (markdown, booking) => {
  const placeholders = buildPlaceholderMap(booking);
  return markdown.replace(/\{\{([^}]+)\}\}/g, (match, rawKey) => {
    const normalizedKey = String(rawKey)
      .replace(/\\/g, "")
      .replace(/_/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();

    return placeholders[normalizedKey] ?? match;
  });
};

const cleanMarkdownLine = (line = "") =>
  repairMojibake(line)
    .replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, "$1")
    .trimEnd();

const renderInlineMarkdown = (value = "") => {
  let html = escapeHtml(cleanMarkdownLine(value));
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
};

const renderTable = (lines) => {
  const rows = lines
    .filter((line) => !/^\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line.trim()))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => renderInlineMarkdown(cell.trim()))
    );

  if (!rows.length) return "";

  return `<table class="agreement-table"><tbody>${rows
    .map(
      (cells) =>
        `<tr>${cells.map((cell) => `<td>${cell || "&nbsp;"}</td>`).join("")}</tr>`
    )
    .join("")}</tbody></table>`;
};

const isFooterMarkerLine = (line = "") => {
  const normalized = cleanMarkdownLine(line)
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return normalized === "service provider service receiver";
};

const splitMarkdownIntoPages = (markdown) => {
  const pages = [];
  let currentLines = [];

  markdown.split("\n").forEach((line) => {
    if (isFooterMarkerLine(line)) {
      if (currentLines.some((entry) => entry.trim())) {
        pages.push({ markdown: currentLines.join("\n").trim(), showFooter: true });
      }
      currentLines = [];
      return;
    }

    currentLines.push(line);
  });

  if (currentLines.some((entry) => entry.trim())) {
    pages.push({ markdown: currentLines.join("\n").trim(), showFooter: true });
  }

  return pages;
};

const markdownToHtml = (markdown) => {
  const lines = markdown.split("\n");
  const html = [];
  let paragraph = [];
  let list = [];
  let table = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      const isAgreementTitle = /^\*\*[A-Z\s()]+\*\*$/.test(text);
      const isUndertaking = /^\*\*UNDERTAKING\*\*$/i.test(text);
      if (isAgreementTitle) {
        html.push(`<h1>${renderInlineMarkdown(text)}</h1>`);
      } else if (isUndertaking) {
        html.push(`<h2 class="page-break">${renderInlineMarkdown(text)}</h2>`);
      } else {
        html.push(`<p>${renderInlineMarkdown(text)}</p>`);
      }
    }
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  const flushTable = () => {
    if (!table.length) return;
    html.push(renderTable(table));
    table = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      flushTable();
      return;
    }

    if (line.startsWith("|")) {
      flushParagraph();
      flushList();
      table.push(line);
      return;
    }

    flushTable();

    if (/^#{2,6}\s+/.test(line)) {
      flushParagraph();
      flushList();
      const headingText = line.replace(/^#{2,6}\s+/, "").trim();
      if (!headingText) return;
      const level = Math.min((line.match(/^#+/)?.[0].length || 2) + 1, 4);
      html.push(`<h${level}>${renderInlineMarkdown(headingText)}</h${level}>`);
      return;
    }

    if (/^#{2,6}\s*$/.test(line)) {
      return;
    }

    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^[-*]\s+/, ""));
      return;
    }

    paragraph.push(line);
  });

  flushParagraph();
  flushList();
  flushTable();

  return html.join("\n");
};

const buildAgreementHtml = (markdown, meta) => {
  const pages = splitMarkdownIntoPages(markdown);
  const pageHtml = pages
    .map(({ markdown: pageMarkdown, showFooter }, index) => {
      const bodyHtml = markdownToHtml(pageMarkdown);
      return `
        <section class="agreement-page ${index < pages.length - 1 ? "agreement-page-break" : ""}">
          <div class="agreement-page-content">
            ${bodyHtml}
          </div>
          ${showFooter ? `
            <div class="agreement-page-footer">
              <span>Service Provider</span>
              <span>Service Receiver</span>
            </div>
          ` : ""}
        </section>
      `;
    })
    .join("");

  return `
    <article class="agreement-document">
      <style>
        .agreement-document {
          font-family: "Times New Roman", Times, serif;
          color: #000000;
          background: #ffffff;
          max-width: 210mm;
          margin: 0 auto;
          line-height: 1.5;
          font-size: 13.5px;
          font-weight: 400;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }
        .agreement-page {
          min-height: 267mm;
          padding: 18mm 20mm 16mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #ffffff;
        }
        .agreement-page-break {
          page-break-after: always;
          break-after: page;
        }
        .agreement-page-content {
          flex: 1 1 auto;
        }
        .agreement-page-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 18mm;
          padding-top: 8mm;
          font-size: 13px;
          font-weight: 700;
        }
        .agreement-document h1 {
          text-align: center;
          font-size: 18px;
          margin: 0 0 22px;
          text-transform: uppercase;
          letter-spacing: 0;
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 4px;
        }
        .agreement-document h2,
        .agreement-document h3,
        .agreement-document h4 {
          font-size: 14px;
          margin: 18px 0 10px;
          text-transform: uppercase;
          letter-spacing: 0;
          font-weight: 700;
        }
        .agreement-document p {
          margin: 0 0 12px;
          text-align: justify;
        }
        .agreement-document ul {
          margin: 0 0 12px 22px;
          padding: 0;
        }
        .agreement-document li {
          margin: 0 0 6px;
          text-align: justify;
        }
        .agreement-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0 16px;
          page-break-inside: avoid;
        }
        .agreement-table td {
          width: 50%;
          border: 1px solid #000000;
          padding: 10px 8px;
          vertical-align: top;
          font-size: 13.5px;
        }
        .agreement-document a {
          color: #000000;
          text-decoration: underline;
        }
        .agreement-document strong {
          font-weight: 700;
        }
        .agreement-document .page-break {
          page-break-before: always;
          break-before: page;
          padding-top: 0;
          text-align: left;
        }
        @media print {
          .agreement-document {
            padding: 0;
            max-width: none;
          }
          .agreement-page {
            min-height: 267mm;
          }
        }
      </style>
      ${pageHtml}
    </article>
  `;
};

AgreementRoute.get("/:bookingId", authenticateUser, async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.bookingId).lean();
    if (!booking) {
      return res.status(404).send({ message: "Booking not found" });
    }

    const { section, meta } = selectTemplateSection(booking);
    const filledMarkdown = replacePlaceholders(section.markdown, booking);
    const agreementHtml = buildAgreementHtml(filledMarkdown, meta);

    return res.status(200).send({
      agreementHtml,
      template: meta,
    });
  } catch (error) {
    console.error("Error generating agreement:", error);
    return res.status(500).send({
      message: error.message || "Error generating agreement HTML",
    });
  }
});

export default AgreementRoute;
