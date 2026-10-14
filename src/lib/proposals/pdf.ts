/**
 * Branded quotation / proposal PDF generator (Part 9).
 *
 * Renders directly from an IMMUTABLE `ProposalVersion` snapshot, so a PDF
 * can never show a price that the customer was not actually sent. Internal
 * notes, revision requests, admin triage notes and any other internal-only
 * field are deliberately NOT part of the render model below - they cannot
 * leak into a customer document even by accident.
 *
 * Streams straight to the HTTP response; nothing is written to disk. That
 * matters for serverless deployments where the local filesystem is
 * ephemeral - there is no PDF file to keep, so nothing can go stale.
 *
 * Server-only: the caller must have already authorized the request.
 */

import 'server-only';

import PDFDocument from 'pdfkit';

import { companyProfile } from '@/config/company';
import {
  DELIVERY_METHOD_LABELS,
  PROPOSAL_STATUS_LABELS,
  TERMS_FIELD_LABELS,
  TERMS_FIELDS,
  type DeliveryMethod,
} from '@/lib/constants/proposals';
import { formatDate } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';
import type { ProposalDetail, ProposalVersionView } from '@/types/proposals';

/** A4 at 72dpi. */
const PAGE_SIZE = 'A4' as const;
const MARGIN = 45;
const CONTENT_WIDTH = 595.28 - MARGIN * 2;

/** Brand colours, kept close to the app palette. */
const COLORS = {
  primary: '#1d4ed8',
  heading: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  border: '#e2e8f0',
  tableHeader: '#f1f5f9',
  accent: '#f8fafc',
} as const;

/**
 * Everything the PDF needs. Built from a ProposalDetail + one version by
 * `buildPdfModel`, which is the single place that decides what a customer
 * is allowed to see.
 */
export interface QuotationPdfInput {
  proposalCode: string;
  versionNumber: number;
  /** 'Proposal / Quotation' etc. */
  documentTitle: string;
  statusLabel: string;
  title: string;
  overview: string | null;
  preparedFor: {
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    /** 'Lead' or 'Client', printed as a neutral label. */
    kindLabel: string;
    code: string | null;
  };
  issueDate: Date | null;
  validUntil: Date | null;
  scope: ProposalVersionView['scope'];
  deliverables: string[];
  lineItems: ProposalVersionView['lineItems'];
  subtotalMinor: number;
  lineDiscountTotalMinor: number;
  proposalDiscount: ProposalVersionView['proposalDiscount'];
  proposalTax: ProposalVersionView['proposalTax'];
  lineTaxTotalMinor: number;
  taxMinor: number;
  grandTotalMinor: number;
  currency: string;
  paymentMilestones: ProposalVersionView['paymentMilestones'];
  timeline: ProposalVersionView['timeline'];
  terms: Record<string, string | null>;
  delivery: {
    method: DeliveryMethod | null;
    recipient: string | null;
    recipientDetail: string | null;
    deliveredAt: Date | null;
  } | null;
  acceptance: ProposalVersionView['acceptance'];
}

/**
 * Build the PDF render model.
 *
 * Note what is NOT passed in: internal notes, admin notes, the lead status,
 * assignee, the change summary of internal revisions and the revision
 * request thread. This function is the reason a customer PDF cannot contain
 * internal information.
 */
export function buildPdfModel(
  detail: ProposalDetail,
  version: ProposalVersionView
): QuotationPdfInput {
  const isClient = Boolean(detail.clientId);

  return {
    proposalCode: detail.proposalCode,
    versionNumber: version.version,
    documentTitle: version.status === 'SENT' ? 'Quotation' : 'Proposal',
    statusLabel: PROPOSAL_STATUS_LABELS[version.status] ?? version.status,
    title: version.title,
    overview: version.overview,
    preparedFor: {
      name: isClient ? (detail.clientName ?? '') : (detail.leadName ?? ''),
      company: isClient ? detail.clientCompany : detail.leadCompany,
      email: detail.clientEmail,
      phone: detail.clientPhone,
      address: detail.clientAddress,
      kindLabel: isClient ? 'Client' : 'Prospect',
      code: isClient ? detail.clientCode : detail.leadCode,
    },
    issueDate: version.issueDate,
    validUntil: version.validUntil,
    scope: version.scope,
    deliverables: version.deliverables,
    lineItems: version.lineItems,
    subtotalMinor: version.subtotalMinor,
    lineDiscountTotalMinor: version.lineDiscountTotalMinor,
    proposalDiscount: version.proposalDiscount,
    proposalTax: version.proposalTax,
    lineTaxTotalMinor: version.lineTaxTotalMinor,
    taxMinor: version.taxMinor,
    grandTotalMinor: version.grandTotalMinor,
    currency: version.currency,
    paymentMilestones: version.paymentMilestones,
    timeline: version.timeline,
    terms: version.terms,
    delivery: version.delivery
      ? {
          method: version.delivery.method,
          recipient: version.delivery.recipient,
          recipientDetail: version.delivery.recipientDetail,
          deliveredAt: version.delivery.deliveredAt,
        }
      : null,
    acceptance: version.acceptance,
  };
}

/* -------------------------------------------------------------------------- */
/* Rendering helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A tiny layout engine on top of PDFKit.
 *
 * Tracks the y position and starts a new page whenever the next block
 * would overflow the printable area. This is what keeps long descriptions
 * and long tables from overlapping or running off the bottom of the sheet.
 */
class Layout {
  readonly doc: PDFKit.PDFDocument;
  y = MARGIN;
  pageNumber = 1;

  constructor(doc: PDFKit.PDFDocument) {
    this.doc = doc;
  }

  /** Printable bottom edge. */
  get bottom(): number {
    // Leave room for the footer band.
    return this.doc.page.height - MARGIN - 28;
  }

  /** Start a new page when `needed` px would not fit. */
  ensure(needed: number): void {
    if (this.y + needed > this.bottom) {
      this.doc.addPage();
      this.y = MARGIN;
      this.pageNumber += 1;
    }
  }

  text(
    value: string,
    options: PDFKit.Mixins.TextOptions & { gap?: number } = {}
  ): void {
    const { gap = 4, ...textOptions } = options;
    const height =
      this.doc.heightOfString(value, { width: options.width ?? CONTENT_WIDTH, ...textOptions }) + 2;
    this.ensure(height + gap);
    this.doc.text(value, MARGIN, this.y, textOptions);
    this.y += height + gap;
  }

  space(amount: number): void {
    this.y += amount;
  }

  rule(): void {
    this.ensure(10);
    this.doc
      .moveTo(MARGIN, this.y)
      .lineTo(MARGIN + CONTENT_WIDTH, this.y)
      .lineWidth(0.75)
      .strokeColor(COLORS.border)
      .stroke();
    this.space(10);
  }
}

/** Section heading with a coloured accent bar. */
function sectionHeading(layout: Layout, title: string): void {
  layout.ensure(34);
  layout.doc
    .roundedRect(MARGIN, layout.y, 3, 14, 1)
    .fillColor(COLORS.primary)
    .fill();
  layout.doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.heading)
    .text(title.toUpperCase(), MARGIN + 10, layout.y + 2, { width: CONTENT_WIDTH - 10 });
  layout.y += 20;
  layout.space(4);
}

/** Bulleted list with wrapping, kept inside the printable area. */
function bulletList(layout: Layout, items: string[], emptyLabel = 'None specified.'): void {
  if (items.length === 0) {
    layout.text(emptyLabel, {
      font: 'Helvetica-Oblique',
      fontSize: 9,
      color: COLORS.muted,
      gap: 8,
    });
    return;
  }
  for (const item of items) {
    const fontSize = 9.5;
    const width = CONTENT_WIDTH - 14;
    const height = layout.doc.heightOfString(item, { width, fontSize }) + 3;
    layout.ensure(height + 3);
    layout.doc
      .circle(MARGIN + 3, layout.y + 4, 1.6)
      .fillColor(COLORS.muted)
      .fill();
    layout.doc
      .font('Helvetica')
      .fontSize(fontSize)
      .fillColor(COLORS.body)
      .text(item, MARGIN + 14, layout.y, { width });
    layout.y += height + 3;
  }
  layout.space(6);
}

/** Key/value line used for the header block and party details. */
function keyValue(layout: Layout, label: string, value: string | null | undefined): void {
  if (!value) {
    return;
  }
  const fontSize = 9.5;
  layout.ensure(15);
  layout.doc
    .font('Helvetica-Bold')
    .fontSize(fontSize)
    .fillColor(COLORS.muted)
    .text(`${label}:`, MARGIN, layout.y, { width: 120, continued: false });
  layout.doc
    .font('Helvetica')
    .fontSize(fontSize)
    .fillColor(COLORS.body)
    .text(value, MARGIN + 122, layout.y - 11, { width: CONTENT_WIDTH - 122 });
  layout.y += 14;
}

/* -------------------------------------------------------------------------- */
/* Pricing table                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Draw the pricing table.
 *
 * Each row is measured with `heightOfString` before it is written, so a long
 * service description wraps inside its own cell instead of colliding with
 * the next row. Column widths are fixed and sum to the printable width.
 */
function pricingTable(layout: Layout, input: QuotationPdfInput): void {
  const columns = {
    service: 200,
    qty: 60,
    rate: 80,
    discount: 60,
    tax: 45,
    total: CONTENT_WIDTH - 200 - 60 - 80 - 60 - 45,
  };

  const header = () => {
    layout.ensure(24);
    const top = layout.y;
    layout.doc
      .rect(MARGIN, top, CONTENT_WIDTH, 20)
      .fillColor(COLORS.tableHeader)
      .fill();
    let x = MARGIN + 6;
    layout.doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.heading);
    layout.doc.text('SERVICE', x, top + 6, { width: columns.service - 6 });
    x += columns.service;
    layout.doc.text('QTY', x, top + 6, { width: columns.qty - 6, align: 'right' });
    x += columns.qty;
    layout.doc.text('RATE', x, top + 6, { width: columns.rate - 6, align: 'right' });
    x += columns.rate;
    layout.doc.text('DISC.', x, top + 6, { width: columns.discount - 6, align: 'right' });
    x += columns.discount;
    layout.doc.text('TAX', x, top + 6, { width: columns.tax - 6, align: 'right' });
    x += columns.tax;
    layout.doc.text('TOTAL', x, top + 6, { width: columns.total - 6, align: 'right' });
    layout.y = top + 20;
  };

  header();

  for (const item of input.lineItems) {
    const description = item.description ? `\n${item.description}` : '';
    const cellHeight = Math.max(
      layout.doc.heightOfString(`${item.serviceName}${description}`, {
        width: columns.service - 12,
        fontSize: 9,
      }),
      18
    );
    // Keep a row intact on one page: measure it plus the row it follows.
    if (layout.y + cellHeight + 8 > layout.bottom) {
      layout.doc.addPage();
      layout.y = MARGIN;
      layout.pageNumber += 1;
      header();
    }

    const top = layout.y;
    let x = MARGIN + 6;
    const fontSize = 9;

    layout.doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(COLORS.body);
    layout.doc.text(item.serviceName, x, top + 4, { width: columns.service - 12 });
    if (item.description) {
      layout.doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(item.description, x, top + 4 + layout.doc.heightOfString(item.serviceName, {
          width: columns.service - 12,
          fontSize,
        }), { width: columns.service - 12 });
    }

    x += columns.service;
    layout.doc
      .font('Helvetica')
      .fontSize(fontSize)
      .fillColor(COLORS.body)
      .text(`${trimNumber(item.quantity)} ${item.unit}`, x, top + 4, {
        width: columns.qty - 6,
        align: 'right',
      });
    x += columns.qty;
    layout.doc.text(formatMinor(item.unitPriceMinor, input.currency), x, top + 4, {
      width: columns.rate - 6,
      align: 'right',
    });
    x += columns.rate;
    layout.doc.text(
      item.discountMinor > 0 ? `-${formatMinor(item.discountMinor, input.currency)}` : '—',
      x,
      top + 4,
      { width: columns.discount - 6, align: 'right' }
    );
    x += columns.discount;
    layout.doc.text(
      item.taxRatePercent !== null ? `${trimNumber(item.taxRatePercent)}%` : '—',
      x,
      top + 4,
      { width: columns.tax - 6, align: 'right' }
    );
    x += columns.tax;
    layout.doc
      .font('Helvetica-Bold')
      .text(formatMinor(item.lineTotalMinor, input.currency), x, top + 4, {
        width: columns.total - 6,
        align: 'right',
      });

    layout.y = top + cellHeight + 6;
    layout.doc
      .moveTo(MARGIN, layout.y)
      .lineTo(MARGIN + CONTENT_WIDTH, layout.y)
      .lineWidth(0.5)
      .strokeColor(COLORS.border)
      .stroke();
  }

  layout.space(8);
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/** Totals block, right aligned, with the grand total emphasised. */
function totalsBlock(layout: Layout, input: QuotationPdfInput): void {
  const rows: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: 'Subtotal', value: formatMinor(input.subtotalMinor, input.currency) },
  ];

  if (input.lineDiscountTotalMinor > 0) {
    rows.push({
      label: 'Line discounts',
      value: `-${formatMinor(input.lineDiscountTotalMinor, input.currency)}`,
    });
  }
  if (input.proposalDiscount.amountMinor > 0) {
    rows.push({
      label:
        input.proposalDiscount.type === 'PERCENTAGE'
          ? `Discount (${trimNumber(input.proposalDiscount.valueMinor)}%)`
          : 'Discount',
      value: `-${formatMinor(input.proposalDiscount.amountMinor, input.currency)}`,
    });
  }

  // Tax is printed ONLY when tax was actually configured. A quotation with
  // no tax never invents a tax line, and no tax registration number is
  // printed unless one is configured in `src/config/company.ts`.
  if (input.lineTaxTotalMinor > 0) {
    rows.push({
      label: 'Tax on line items',
      value: formatMinor(input.lineTaxTotalMinor, input.currency),
    });
  }
  if (input.proposalTax.amountMinor > 0) {
    rows.push({
      label: input.proposalTax.label ?? 'Tax',
      value: formatMinor(input.proposalTax.amountMinor, input.currency),
    });
  }

  rows.push({
    label: 'Grand Total',
    value: formatMinor(input.grandTotalMinor, input.currency),
    bold: true,
  });

  const boxWidth = 260;
  const boxX = MARGIN + CONTENT_WIDTH - boxWidth;

  for (const row of rows) {
    const isTotal = Boolean(row.bold);
    layout.ensure(isTotal ? 26 : 17);
    const top = layout.y;

    if (isTotal) {
      layout.doc
        .rect(boxX - 8, top - 3, boxWidth + 8, 21)
        .fillColor(COLORS.accent)
        .fill();
      layout.doc
        .moveTo(boxX - 8, top - 3)
        .lineTo(boxX - 8, top + 18)
        .lineWidth(2)
        .strokeColor(COLORS.primary)
        .stroke();
    }

    layout.doc
      .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isTotal ? 11 : 9.5)
      .fillColor(isTotal ? COLORS.heading : COLORS.body)
      .text(row.label, boxX, top + 2, { width: boxWidth - 110 });
    layout.doc
      .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(isTotal ? 11 : 9.5)
      .fillColor(isTotal ? COLORS.heading : COLORS.body)
      .text(row.value, boxX, top + 2, { width: boxWidth - 6, align: 'right' });

    layout.y = top + (isTotal ? 22 : 15);
  }
  layout.space(10);
}

/* -------------------------------------------------------------------------- */
/* Document                                                                   */
/* -------------------------------------------------------------------------- */

/** Branded header drawn on page 1. */
function header(layout: Layout, input: QuotationPdfInput): void {
  const doc = layout.doc;
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.primary);
  doc.text(companyProfile.displayName, MARGIN, layout.y, { characterSpacing: 1 });
  layout.y += 16;

  if (companyProfile.tagline) {
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
    doc.text(companyProfile.tagline.toUpperCase(), MARGIN, layout.y, { characterSpacing: 0.6 });
    layout.y += 14;
  }
  layout.y += 6;

  doc.moveTo(MARGIN, layout.y).lineTo(MARGIN + CONTENT_WIDTH, layout.y).lineWidth(2).strokeColor(COLORS.primary).stroke();
  layout.y += 14;

  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.heading);
  doc.text(input.documentTitle.toUpperCase(), MARGIN, layout.y, { characterSpacing: 0.8 });
  layout.y += 20;

  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.body);
  doc.text(input.title, MARGIN, layout.y, { width: CONTENT_WIDTH - 170 });
  layout.y += layout.doc.heightOfString(input.title, { width: CONTENT_WIDTH - 170, fontSize: 11 }) + 4;

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(
      `Quotation No: ${input.proposalCode}`,
      MARGIN + CONTENT_WIDTH - 170,
      layout.y - 18,
      { width: 170, align: 'right' }
    )
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(`Version: ${input.versionNumber}`, MARGIN + CONTENT_WIDTH - 170, layout.y - 4, {
      width: 170,
      align: 'right',
    });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(`Status: ${input.statusLabel}`, MARGIN + CONTENT_WIDTH - 170, layout.y + 10, {
      width: 170,
      align: 'right',
    });

  layout.space(10);
  layout.rule();
}

/** Footer with page number, printed on every page. */
function footer(layout: Layout): void {
  const doc = layout.doc;
  const y = doc.page.height - MARGIN - 12;

  doc.moveTo(MARGIN, y - 6).lineTo(MARGIN + CONTENT_WIDTH, y - 6).lineWidth(0.5).strokeColor(COLORS.border).stroke();

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
  doc.text(companyProfile.footerNote, MARGIN, y, { width: CONTENT_WIDTH - 90 });

  doc.text(`Page ${layout.pageNumber}`, MARGIN, y, {
    width: CONTENT_WIDTH,
    align: 'right',
  });
}

/**
 * Render the quotation.
 *
 * Returns the finished buffer. Nothing is persisted: the PDF is generated
 * from the immutable version snapshot on every request, which is why an
 * ephemeral deployment filesystem is not a problem.
 */
export function renderQuotationPdf(input: QuotationPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PAGE_SIZE,
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title: `${input.documentTitle} ${input.proposalCode} (Version ${input.versionNumber})`,
        Author: companyProfile.legalName,
        Subject: input.title,
        Creator: `${companyProfile.legalName} quotation generator`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const layout = new Layout(doc);

    header(layout, input);

    /* ------------------------- Quotation meta ------------------------- */
    sectionHeading(layout, 'Quotation details');
    keyValue(layout, 'Quotation No', input.proposalCode);
    keyValue(layout, 'Version', String(input.versionNumber));
    keyValue(layout, 'Issue Date', formatDate(input.issueDate));
    keyValue(layout, 'Valid Until', formatDate(input.validUntil));
    keyValue(layout, 'Currency', input.currency);
    layout.space(8);

    /* ---------------------------- Prepared for ------------------------ */
    sectionHeading(layout, 'Prepared for');
    keyValue(layout, input.preparedFor.kindLabel, input.preparedFor.name);
    keyValue(layout, 'Company', input.preparedFor.company);
    keyValue(layout, 'Reference', input.preparedFor.code);
    keyValue(layout, 'Email', input.preparedFor.email);
    keyValue(layout, 'Phone', input.preparedFor.phone);
    keyValue(layout, 'Address', input.preparedFor.address);
    layout.space(8);

    /* --------------------------- Project overview -------------------- */
    if (input.overview) {
      sectionHeading(layout, 'Project overview');
      layout.text(input.overview, { fontSize: 9.5, color: COLORS.body, lineGap: 2 });
      layout.space(4);
    }

    /* ------------------------------- Scope ---------------------------- */
    if (input.scope.summary) {
      sectionHeading(layout, 'Scope of work');
      layout.text(input.scope.summary, { fontSize: 9.5, color: COLORS.body, lineGap: 2 });
      layout.space(6);
    }

    if (input.scope.includedFeatures.length > 0) {
      sectionHeading(layout, 'Included features');
      bulletList(layout, input.scope.includedFeatures);
    }
    if (input.scope.excludedFeatures.length > 0) {
      sectionHeading(layout, 'Excluded features');
      bulletList(layout, input.scope.excludedFeatures);
    }
    if (input.scope.dependencies.length > 0) {
      sectionHeading(layout, 'Dependencies');
      bulletList(layout, input.scope.dependencies);
    }
    if (input.scope.customerResponsibilities.length > 0) {
      sectionHeading(layout, 'Customer responsibilities');
      bulletList(layout, input.scope.customerResponsibilities);
    }
    if (input.deliverables.length > 0) {
      sectionHeading(layout, 'Deliverables');
      bulletList(layout, input.deliverables);
    }

    /* ------------------------------ Pricing --------------------------- */
    sectionHeading(layout, 'Pricing');
    pricingTable(layout, input);
    totalsBlock(layout, input);

    /* -------------------------- Payment schedule ---------------------- */
    if (input.paymentMilestones.length > 0) {
      sectionHeading(layout, 'Payment milestones');
      layout.text(
        'These are the planned payment milestones for this engagement. They are not receipts of payment.',
        { font: 'Helvetica-Oblique', fontSize: 8.5, color: COLORS.muted, gap: 6 }
      );
      for (const milestone of input.paymentMilestones) {
        const amount = formatMinor(milestone.amountMinor, input.currency);
        const share = formatMinor(
          input.grandTotalMinor > 0
            ? Math.round((milestone.amountMinor / input.grandTotalMinor) * 100)
            : 0,
          input.currency
        );
        layout.ensure(30);
        layout.doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor(COLORS.body)
          .text(`${milestone.sequence}. ${milestone.name}`, MARGIN, layout.y, {
            width: CONTENT_WIDTH - 170,
          });
        layout.doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor(COLORS.heading)
          .text(amount, MARGIN, layout.y, { width: CONTENT_WIDTH, align: 'right' });
        layout.y += 13;
        layout.doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(COLORS.muted)
          .text(
            [
              milestone.type === 'PERCENTAGE'
                ? `${trimNumber(milestone.valueMinor)}% of the project value`
                : 'Fixed amount',
              milestone.dueDate ? `Planned by ${formatDate(milestone.dueDate)}` : null,
              milestone.condition,
            ]
              .filter(Boolean)
              .join(' · '),
            MARGIN + 12,
            layout.y,
            { width: CONTENT_WIDTH - 12 }
          );
        layout.y += layout.doc.heightOfString(
          [
            milestone.type === 'PERCENTAGE'
              ? `${trimNumber(milestone.valueMinor)}% of the project value`
              : 'Fixed amount',
            milestone.condition,
          ]
            .filter(Boolean)
            .join(' · '),
          { width: CONTENT_WIDTH - 12, fontSize: 8.5 }
        ) + 6;
        void share;
      }
      layout.space(8);
    }

    /* ------------------------- Timeline / delivery -------------------- */
    if (
      input.timeline.estimatedDuration ||
      input.timeline.expectedStartDate ||
      input.timeline.milestones.length > 0 ||
      input.timeline.revisionAllowance ||
      input.timeline.supportPeriod ||
      input.timeline.deliveryConditions
    ) {
      sectionHeading(layout, 'Estimated timeline & delivery');
      keyValue(layout, 'Estimated duration', input.timeline.estimatedDuration);
      keyValue(layout, 'Expected start', formatDate(input.timeline.expectedStartDate));
      keyValue(layout, 'Revision allowance', input.timeline.revisionAllowance);
      keyValue(layout, 'Support period', input.timeline.supportPeriod);
      layout.space(4);
      if (input.timeline.milestones.length > 0) {
        bulletList(
          layout,
          input.timeline.milestones.map(
            (milestone) =>
              `${milestone.sequence}. ${milestone.name}${milestone.description ? ` — ${milestone.description}` : ''}`
          )
        );
      }
      if (input.timeline.deliveryConditions) {
        layout.text(input.timeline.deliveryConditions, {
          fontSize: 9.5,
          color: COLORS.body,
          lineGap: 2,
        });
      }
      layout.space(6);
    }

    /* ------------------------- Terms & conditions --------------------- */
    const termsWithContent = TERMS_FIELDS.filter(
      (field) => (input.terms[field] ?? '').trim().length > 0
    );
    if (termsWithContent.length > 0) {
      sectionHeading(layout, 'Terms & conditions');
      for (const field of termsWithContent) {
        layout.text(`${TERMS_FIELD_LABELS[field]}`, {
          font: 'Helvetica-Bold',
          fontSize: 9,
          color: COLORS.muted,
          gap: 2,
        });
        layout.text(input.terms[field] ?? '', {
          fontSize: 9,
          color: COLORS.body,
          lineGap: 1.5,
          gap: 8,
        });
      }
    }

    /* --------------------------- Acceptance --------------------------- */
    sectionHeading(layout, 'Acceptance');
    if (input.acceptance) {
      keyValue(layout, 'Accepted by', input.acceptance.acceptedBy);
      keyValue(layout, 'Accepted on', formatDate(input.acceptance.acceptedAt));
      keyValue(layout, 'Confirmation', input.acceptance.method.replace(/_/g, ' ').toLowerCase());
      keyValue(layout, 'Reference', input.acceptance.evidence);
      if (input.acceptance.notes) {
        layout.text(input.acceptance.notes, { fontSize: 9, color: COLORS.body, lineGap: 1.5 });
      }
    } else {
      layout.text(
        'To accept this offer, please confirm in writing (email or WhatsApp) quoting the quotation number and version above. Arclivo Labs will record the confirmation and issue a final copy.',
        { fontSize: 9, color: COLORS.body, lineGap: 2 }
      );
      layout.space(14);
      layout.doc
        .moveTo(MARGIN + CONTENT_WIDTH / 2, layout.y)
        .lineTo(MARGIN + CONTENT_WIDTH, layout.y)
        .lineWidth(0.75)
        .strokeColor(COLORS.muted)
        .stroke();
      layout.doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text('Customer signature / confirmation', MARGIN + CONTENT_WIDTH / 2, layout.y + 4, {
          width: CONTENT_WIDTH / 2,
        });
      layout.y += 22;
    }
    layout.space(4);

    /* ------------------------------ Footer ---------------------------- */
    // Company contact block, printed only with configured values so the
    // document never states an address or tax id we do not have.
    const contactLine = [
      companyProfile.email,
      companyProfile.phone,
      companyProfile.website,
    ]
      .filter(Boolean)
      .join('  ·  ');
    if (contactLine) {
      layout.text(contactLine, { fontSize: 8.5, color: COLORS.muted, gap: 2 });
    }
    if (companyProfile.taxId) {
      layout.text(`${companyProfile.taxIdLabel}: ${companyProfile.taxId}`, {
        fontSize: 8.5,
        color: COLORS.muted,
        gap: 2,
      });
    }
    if (companyProfile.registeredAddress) {
      layout.text(companyProfile.registeredAddress, {
        fontSize: 8.5,
        color: COLORS.muted,
        gap: 2,
      });
    }

    footer(layout);
    doc.end();
  });
}

/** Delivery label helper reused by the UI to match the PDF wording. */
export function describeDelivery(method: DeliveryMethod): string {
  return DELIVERY_METHOD_LABELS[method];
}
