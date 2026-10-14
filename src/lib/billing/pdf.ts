import 'server-only';

import PDFDocument from 'pdfkit';

import {
  INVOICE_STATUSES,
  INVOICE_TYPE_LABELS,
  TAX_TREATMENTS,
  type InvoiceStatus,
  type InvoiceType,
} from '@/lib/constants/enums';
import { formatDate } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';
import type { IInvoice, IInvoiceLineItem } from '@/models/Invoice';

const PAGE_SIZE = 'A4' as const;
const MARGIN = 45;
const CONTENT_WIDTH = 595.28 - MARGIN * 2;
const PAGE_HEIGHT = 841.89;

const COLORS = {
  primary: '#1d4ed8',
  heading: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  border: '#e2e8f0',
  tableHeader: '#f1f5f9',
  accent: '#f8fafc',
  draftWatermark: '#cbd5e1',
  voidWatermark: '#fca5a5',
  success: '#16a34a',
  destructive: '#dc2626',
} as const;

export interface InvoicePdfModel {
  invoiceCode: string;
  invoiceNumber: string | null;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  description?: string | null;
  terms?: string | null;
  notes?: string | null;
  billingInstructions?: string | null;

  seller: {
    companyName: string;
    legalName: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    taxId?: string | null;
    taxLabel?: string | null;
  };

  customer: {
    clientName: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    billingAddress?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
    } | null;
    taxId?: string | null;
  };

  projectTitle?: string | null;
  projectCode?: string | null;
  dealCode?: string | null;
  milestoneTitle?: string | null;

  lineItems: Array<{
    description: string;
    quantity: number;
    unit?: string | null;
    unitPriceMinor: number;
    discountMinor: number;
    taxRate?: number | null;
    taxMinor: number;
    lineTotalMinor: number;
  }>;

  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  amountDueMinor: number;

  taxDetails?: {
    taxEnabled: boolean;
    taxTreatment: string;
    taxLabel?: string | null;
    taxRate?: number | null;
    cgstMinor?: number;
    sgstMinor?: number;
    igstMinor?: number;
    sellerState?: string | null;
    placeOfSupply?: string | null;
  } | null;
}

class PdfLayout {
  doc: InstanceType<typeof PDFDocument>;
  y: number;
  pageNumber: number;

  constructor(doc: InstanceType<typeof PDFDocument>) {
    this.doc = doc;
    this.y = MARGIN;
    this.pageNumber = 1;
  }

  ensureSpace(needed: number) {
    if (this.y + needed > PAGE_HEIGHT - MARGIN - 35) {
      this.doc.addPage();
      this.pageNumber++;
      this.y = MARGIN;
    }
  }

  space(amount: number) {
    this.y += amount;
  }
}

export function renderInvoicePdf(model: InvoicePdfModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PAGE_SIZE,
      margin: MARGIN,
      autoFirstPage: true,
      bufferPages: true,
      info: {
        Title: `Invoice ${model.invoiceNumber || model.invoiceCode}`,
        Author: model.seller.companyName || 'Arclivo Labs',
        Subject: `Invoice for ${model.customer.clientName}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const layout = new PdfLayout(doc);

    // Draft / Void Watermark
    if (model.status === INVOICE_STATUSES.DRAFT) {
      doc.save();
      doc.font('Helvetica-Bold').fontSize(50).fillColor(COLORS.draftWatermark).opacity(0.35);
      doc.rotate(-30, { origin: [300, 420] });
      doc.text('DRAFT — NOT ISSUED', 40, 400, { align: 'center', width: 500 });
      doc.restore();
    } else if (model.status === INVOICE_STATUSES.VOID) {
      doc.save();
      doc.font('Helvetica-Bold').fontSize(70).fillColor(COLORS.voidWatermark).opacity(0.35);
      doc.rotate(-30, { origin: [300, 420] });
      doc.text('VOID', 40, 400, { align: 'center', width: 500 });
      doc.restore();
    }

    // Top Header: Seller Brand & Document Title
    const headerTop = layout.y;

    // Left: Arclivo Labs brand
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor(COLORS.heading)
      .text(model.seller.companyName || 'ARCLIVO LABS', MARGIN, headerTop);

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text('Digital Product & Engineering Agency', MARGIN, headerTop + 24);

    // Right: INVOICE title & number
    const displayNum = model.invoiceNumber || model.invoiceCode;
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(COLORS.primary)
      .text(model.status === INVOICE_STATUSES.DRAFT ? 'DRAFT INVOICE' : 'INVOICE', MARGIN, headerTop, {
        align: 'right',
        width: CONTENT_WIDTH,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLORS.heading)
      .text(`Invoice No: ${displayNum}`, MARGIN, headerTop + 24, {
        align: 'right',
        width: CONTENT_WIDTH,
      });

    const typeLabel = INVOICE_TYPE_LABELS[model.invoiceType] || model.invoiceType;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(`Type: ${typeLabel}`, MARGIN, headerTop + 38, {
        align: 'right',
        width: CONTENT_WIDTH,
      });

    layout.y = headerTop + 65;

    // Meta bar: Issue Date, Due Date, Currency, Status
    doc
      .rect(MARGIN, layout.y, CONTENT_WIDTH, 26)
      .fillColor(COLORS.tableHeader)
      .fill();

    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(COLORS.heading)
      .text(`Issue Date: ${formatDate(model.issueDate)}`, MARGIN + 12, layout.y + 8);

    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(COLORS.heading)
      .text(`Due Date: ${formatDate(model.dueDate)}`, MARGIN + 150, layout.y + 8);

    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(COLORS.heading)
      .text(`Currency: ${model.currency}`, MARGIN + 280, layout.y + 8);

    const statusText = `Status: ${model.status}`;
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(
        model.status === INVOICE_STATUSES.ISSUED
          ? COLORS.success
          : model.status === INVOICE_STATUSES.VOID
            ? COLORS.destructive
            : COLORS.muted
      )
      .text(statusText, MARGIN, layout.y + 8, {
        align: 'right',
        width: CONTENT_WIDTH - 12,
      });

    layout.y += 38;

    // Parties Box: Bill From & Bill To
    const partiesTop = layout.y;
    const colWidth = (CONTENT_WIDTH - 20) / 2;

    // BILL FROM
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.primary)
      .text('BILL FROM', MARGIN, partiesTop);

    let fromY = partiesTop + 14;
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLORS.heading)
      .text(model.seller.legalName || model.seller.companyName, MARGIN, fromY);
    fromY += 14;

    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.body);
    if (model.seller.address) {
      doc.text(model.seller.address, MARGIN, fromY, { width: colWidth });
      fromY += doc.heightOfString(model.seller.address, { width: colWidth }) + 3;
    }
    if (model.seller.email) {
      doc.text(`Email: ${model.seller.email}`, MARGIN, fromY);
      fromY += 12;
    }
    if (model.seller.phone) {
      doc.text(`Phone: ${model.seller.phone}`, MARGIN, fromY);
      fromY += 12;
    }
    if (model.seller.taxId) {
      const label = model.seller.taxLabel || 'GSTIN';
      doc.text(`${label}: ${model.seller.taxId}`, MARGIN, fromY);
      fromY += 12;
    }

    // BILL TO
    const rightColX = MARGIN + colWidth + 20;
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.primary)
      .text('BILL TO', rightColX, partiesTop);

    let toY = partiesTop + 14;
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLORS.heading)
      .text(model.customer.clientName, rightColX, toY);
    toY += 14;

    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.body);
    if (model.customer.companyName) {
      doc.text(model.customer.companyName, rightColX, toY, { width: colWidth });
      toY += 12;
    }
    if (model.customer.billingAddress) {
      const addr = model.customer.billingAddress;
      const addrParts = [
        addr.line1,
        addr.line2,
        [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', '),
        addr.country,
      ].filter(Boolean);
      if (addrParts.length > 0) {
        const fullAddr = addrParts.join('\n');
        doc.text(fullAddr, rightColX, toY, { width: colWidth });
        toY += doc.heightOfString(fullAddr, { width: colWidth }) + 3;
      }
    }
    if (model.customer.email) {
      doc.text(`Email: ${model.customer.email}`, rightColX, toY);
      toY += 12;
    }
    if (model.customer.phone) {
      doc.text(`Phone: ${model.customer.phone}`, rightColX, toY);
      toY += 12;
    }
    if (model.customer.taxId) {
      doc.text(`Tax ID: ${model.customer.taxId}`, rightColX, toY);
      toY += 12;
    }

    layout.y = Math.max(fromY, toY) + 12;

    // Optional References: Project, Deal, Milestone
    const refs: string[] = [];
    if (model.projectCode || model.projectTitle) {
      refs.push(`Project: ${model.projectCode ? `[${model.projectCode}] ` : ''}${model.projectTitle || ''}`);
    }
    if (model.dealCode) {
      refs.push(`Deal Ref: ${model.dealCode}`);
    }
    if (model.milestoneTitle) {
      refs.push(`Milestone: ${model.milestoneTitle}`);
    }

    if (refs.length > 0) {
      layout.ensureSpace(24);
      doc
        .rect(MARGIN, layout.y, CONTENT_WIDTH, 20)
        .fillColor(COLORS.accent)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .fillAndStroke();

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(refs.join('   |   '), MARGIN + 8, layout.y + 6);

      layout.y += 28;
    }

    // Line Items Table
    layout.ensureSpace(50);

    const colWDesc = 240;
    const colWQty = 45;
    const colWRate = 75;
    const colWDisc = 65;
    const colWTotal = CONTENT_WIDTH - (colWDesc + colWQty + colWRate + colWDisc);

    // Table Header
    doc
      .rect(MARGIN, layout.y, CONTENT_WIDTH, 20)
      .fillColor(COLORS.tableHeader)
      .fill();

    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.heading);
    doc.text('DESCRIPTION', MARGIN + 8, layout.y + 6, { width: colWDesc });
    doc.text('QTY', MARGIN + colWDesc, layout.y + 6, { width: colWQty, align: 'center' });
    doc.text('RATE', MARGIN + colWDesc + colWQty, layout.y + 6, { width: colWRate, align: 'right' });
    doc.text('DISC', MARGIN + colWDesc + colWQty + colWRate, layout.y + 6, { width: colWDisc, align: 'right' });
    doc.text('AMOUNT', MARGIN + colWDesc + colWQty + colWRate + colWDisc, layout.y + 6, {
      width: colWTotal - 8,
      align: 'right',
    });

    layout.y += 22;

    // Items
    for (const item of model.lineItems) {
      const itemDescHeight = doc.heightOfString(item.description, {
        width: colWDesc - 8,
        font: 'Helvetica',
        size: 8.5,
      });
      const rowHeight = Math.max(22, itemDescHeight + 10);

      layout.ensureSpace(rowHeight);

      // Bottom separator
      doc
        .moveTo(MARGIN, layout.y + rowHeight)
        .lineTo(MARGIN + CONTENT_WIDTH, layout.y + rowHeight)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(COLORS.heading)
        .text(item.description, MARGIN + 8, layout.y + 5, { width: colWDesc - 8 });

      doc.text(String(item.quantity), MARGIN + colWDesc, layout.y + 5, {
        width: colWQty,
        align: 'center',
      });

      doc.text(
        formatMinor(item.unitPriceMinor, model.currency),
        MARGIN + colWDesc + colWQty,
        layout.y + 5,
        { width: colWRate, align: 'right' }
      );

      doc.text(
        item.discountMinor > 0 ? `-${formatMinor(item.discountMinor, model.currency)}` : '—',
        MARGIN + colWDesc + colWQty + colWRate,
        layout.y + 5,
        { width: colWDisc, align: 'right' }
      );

      doc
        .font('Helvetica-Bold')
        .text(
          formatMinor(item.lineTotalMinor, model.currency),
          MARGIN + colWDesc + colWQty + colWRate + colWDisc,
          layout.y + 5,
          { width: colWTotal - 8, align: 'right' }
        );

      layout.y += rowHeight;
    }

    // Totals Section
    layout.ensureSpace(120);
    layout.space(10);

    const totalsX = MARGIN + CONTENT_WIDTH - 240;
    const totalsWidth = 240;

    const renderTotalLine = (label: string, amountStr: string, bold = false, color: string = COLORS.heading) => {
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 9.5 : 8.5)
        .fillColor(color)
        .text(label, totalsX, layout.y, { width: 120 });

      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 9.5 : 8.5)
        .fillColor(color)
        .text(amountStr, totalsX + 120, layout.y, { width: 120, align: 'right' });

      layout.y += bold ? 18 : 14;
    };

    renderTotalLine('Subtotal:', formatMinor(model.subtotalMinor, model.currency));

    if (model.discountMinor > 0) {
      renderTotalLine('Total Discount:', `-${formatMinor(model.discountMinor, model.currency)}`, false, COLORS.muted);
    }

    if (model.taxDetails?.taxEnabled && model.taxMinor > 0) {
      if (model.taxDetails.taxTreatment === TAX_TREATMENTS.CGST_SGST) {
        renderTotalLine(`CGST:`, formatMinor(model.taxDetails.cgstMinor ?? 0, model.currency));
        renderTotalLine(`SGST:`, formatMinor(model.taxDetails.sgstMinor ?? 0, model.currency));
      } else if (model.taxDetails.taxTreatment === TAX_TREATMENTS.IGST) {
        renderTotalLine(`IGST (${model.taxDetails.taxRate ?? 0}%):`, formatMinor(model.taxMinor, model.currency));
      } else {
        const label = model.taxDetails.taxLabel || 'Tax';
        renderTotalLine(`${label}:`, formatMinor(model.taxMinor, model.currency));
      }
    } else {
      renderTotalLine('Tax:', formatMinor(0, model.currency));
    }

    // Divider line
    doc
      .moveTo(totalsX, layout.y)
      .lineTo(totalsX + totalsWidth, layout.y)
      .strokeColor(COLORS.heading)
      .lineWidth(1)
      .stroke();
    layout.space(4);

    renderTotalLine(
      'TOTAL DUE:',
      formatMinor(model.totalMinor, model.currency),
      true,
      COLORS.primary
    );

    // Terms & Instructions
    layout.ensureSpace(90);
    layout.space(15);

    const instructionsTop = layout.y;

    if (model.terms || model.billingInstructions || model.notes) {
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(COLORS.primary)
        .text('PAYMENT TERMS & INSTRUCTIONS', MARGIN, instructionsTop);

      let textY = instructionsTop + 14;
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.body);

      if (model.terms) {
        doc.text(model.terms, MARGIN, textY, { width: CONTENT_WIDTH });
        textY += doc.heightOfString(model.terms, { width: CONTENT_WIDTH }) + 4;
      }

      if (model.billingInstructions) {
        doc.text(model.billingInstructions, MARGIN, textY, { width: CONTENT_WIDTH });
        textY += doc.heightOfString(model.billingInstructions, { width: CONTENT_WIDTH }) + 4;
      }

      if (model.notes) {
        doc.text(`Notes: ${model.notes}`, MARGIN, textY, { width: CONTENT_WIDTH });
        textY += doc.heightOfString(`Notes: ${model.notes}`, { width: CONTENT_WIDTH }) + 4;
      }

      layout.y = textY + 10;
    }

    // Footer on all pages
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(i);
      const footerY = PAGE_HEIGHT - MARGIN - 12;

      doc
        .moveTo(MARGIN, footerY - 8)
        .lineTo(MARGIN + CONTENT_WIDTH, footerY - 8)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();

      const footerLine = [
        model.seller.companyName,
        model.seller.website,
        model.seller.email,
      ].filter(Boolean).join('  ·  ');

      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(footerLine, MARGIN, footerY, { width: CONTENT_WIDTH - 80 });

      doc.text(`Page ${i + 1} of ${pageRange.count}`, MARGIN, footerY, {
        width: CONTENT_WIDTH,
        align: 'right',
      });
    }

    doc.end();
  });
}
