import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { requireAuth } from '@/lib/auth/authorization';
import { getClientProfileForUser } from '@/lib/auth/client-profile';
import { INVOICE_STATUSES } from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { renderInvoicePdf, type InvoicePdfModel } from '@/lib/billing/pdf';
import { Invoice } from '@/models/Invoice';
import { BillingSetting } from '@/models/BillingSetting';
import { Client } from '@/models/Client';
import { USER_ROLES } from '@/types/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  const { id } = await context.params;

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  await connectDB();

  const invoice = await Invoice.findById(id)
    .populate('projectId', 'title projectCode')
    .populate('dealId', 'dealCode')
    .populate('clientId', 'name companyName email phone billingAddress taxId')
    .lean()
    .exec();

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  // Authorization check
  if (user.role === USER_ROLES.CLIENT) {
    const clientProfile = await getClientProfileForUser(user.id);
    const invoiceClientId =
      (invoice.clientId as any)?._id?.toString?.() ||
      (invoice.clientId as any)?.toString?.();

    if (!clientProfile || invoiceClientId !== clientProfile.id) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    if (invoice.status !== INVOICE_STATUSES.ISSUED) {
      return NextResponse.json(
        { error: 'This invoice has not been issued yet or is unavailable.' },
        { status: 403 }
      );
    }
  } else if (user.role !== USER_ROLES.ADMIN) {
    return NextResponse.json(
      { error: 'You do not have permission to view billing documents.' },
      { status: 403 }
    );
  }

  // Fetch current default seller details if snapshot missing (e.g. draft preview)
  let sellerSnapshot = invoice.sellerSnapshot;
  if (!sellerSnapshot) {
    const settings = await BillingSetting.findOne({ key: 'primary' }).lean().exec();
    sellerSnapshot = {
      companyName: settings?.companyName || 'Arclivo Labs',
      legalName: settings?.legalName || 'Arclivo Labs',
      address: settings?.address || '',
      email: settings?.email || '',
      phone: settings?.phone || '',
      website: settings?.website || '',
      taxId: settings?.taxRegistrationNumber || null,
      taxLabel: settings?.taxLabel || 'GSTIN',
    };
  }

  // Customer snapshot
  let customerSnapshot = invoice.customerSnapshot;
  if (!customerSnapshot && invoice.clientId) {
    const c: any = invoice.clientId;
    customerSnapshot = {
      clientName: c.name || 'Client',
      companyName: c.companyName || null,
      email: c.email || null,
      phone: c.phone || null,
      billingAddress: c.billingAddress || null,
      taxId: c.taxId || null,
    };
  }

  const pdfModel: InvoicePdfModel = {
    invoiceCode: invoice.invoiceCode,
    invoiceNumber: invoice.invoiceNumber || null,
    invoiceType: invoice.invoiceType,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    description: invoice.description,
    terms: invoice.terms,
    notes: invoice.notes,
    billingInstructions: invoice.billingInstructions,
    seller: {
      companyName: sellerSnapshot.companyName,
      legalName: sellerSnapshot.legalName,
      address: sellerSnapshot.address,
      email: sellerSnapshot.email,
      phone: sellerSnapshot.phone,
      website: sellerSnapshot.website,
      taxId: sellerSnapshot.taxId,
      taxLabel: sellerSnapshot.taxLabel,
    },
    customer: {
      clientName: customerSnapshot?.clientName || 'Client',
      companyName: customerSnapshot?.companyName || null,
      email: customerSnapshot?.email || null,
      phone: customerSnapshot?.phone || null,
      billingAddress: customerSnapshot?.billingAddress || null,
      taxId: customerSnapshot?.taxId || null,
    },
    projectTitle: (invoice.projectId as any)?.title || null,
    projectCode: (invoice.projectId as any)?.projectCode || null,
    dealCode: (invoice.dealId as any)?.dealCode || null,
    lineItems: (invoice.lineItems || []).map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unitPriceMinor: li.unitPriceMinor,
      discountMinor: li.discountMinor,
      taxRate: li.taxRate,
      taxMinor: li.taxMinor,
      lineTotalMinor: li.lineTotalMinor,
    })),
    subtotalMinor: invoice.subtotalMinor,
    discountMinor: invoice.discountMinor,
    taxMinor: invoice.taxMinor,
    totalMinor: invoice.totalMinor,
    amountPaidMinor: invoice.amountPaidMinor || 0,
    amountDueMinor: invoice.amountDueMinor,
    taxDetails: invoice.taxDetails,
  };

  const pdf = await renderInvoicePdf(pdfModel);

  const filename = `${invoice.invoiceNumber || invoice.invoiceCode}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.byteLength),
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
