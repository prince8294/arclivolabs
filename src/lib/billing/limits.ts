import 'server-only';

import { Types } from 'mongoose';

import { INVOICE_STATUSES } from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { Deal } from '@/models/Deal';
import { Invoice } from '@/models/Invoice';
import { BillingSchedule } from '@/models/BillingSchedule';

export interface DealBillingLimits {
  dealId: string;
  dealCode: string;
  agreedAmountMinor: number;
  currency: string;
  totalInvoicedMinor: number;
  remainingUnbilledMinor: number;
  invoiceCount: number;
}

/**
 * Calculate total active invoiced amounts for a Deal (issued and draft, excluding voided).
 */
export async function getDealBillingLimits(dealId: string): Promise<DealBillingLimits | null> {
  await connectDB();

  if (!Types.ObjectId.isValid(dealId)) {
    return null;
  }

  const deal = await Deal.findById(dealId)
    .select('dealCode agreedAmountMinor currency')
    .lean()
    .exec();

  if (!deal) {
    return null;
  }

  const activeInvoices = await Invoice.find({
    dealId: new Types.ObjectId(dealId),
    status: { $in: [INVOICE_STATUSES.DRAFT, INVOICE_STATUSES.ISSUED] },
  })
    .select('totalMinor')
    .lean()
    .exec();

  const totalInvoicedMinor = activeInvoices.reduce(
    (acc, inv) => acc + (inv.totalMinor || 0),
    0
  );

  const remainingUnbilledMinor = Math.max(0, deal.agreedAmountMinor - totalInvoicedMinor);

  return {
    dealId: deal._id.toString(),
    dealCode: deal.dealCode,
    agreedAmountMinor: deal.agreedAmountMinor,
    currency: deal.currency,
    totalInvoicedMinor,
    remainingUnbilledMinor,
    invoiceCount: activeInvoices.length,
  };
}

/**
 * Validates that adding or updating an invoice with `currentInvoiceTotalMinor`
 * does not exceed the agreed deal amount.
 */
export async function validateDealBillingLimit(
  dealId: string,
  currentInvoiceTotalMinor: number,
  excludeInvoiceId?: string
): Promise<{ allowed: boolean; message?: string }> {
  await connectDB();

  const deal = await Deal.findById(dealId)
    .select('dealCode agreedAmountMinor currency')
    .lean()
    .exec();

  if (!deal) {
    return { allowed: false, message: 'Deal not found.' };
  }

  const filter: Record<string, unknown> = {
    dealId: new Types.ObjectId(dealId),
    status: { $in: [INVOICE_STATUSES.DRAFT, INVOICE_STATUSES.ISSUED] },
  };

  if (excludeInvoiceId && Types.ObjectId.isValid(excludeInvoiceId)) {
    filter._id = { $ne: new Types.ObjectId(excludeInvoiceId) };
  }

  const otherInvoices = await Invoice.find(filter)
    .select('totalMinor')
    .lean()
    .exec();

  const previouslyInvoicedMinor = otherInvoices.reduce(
    (acc, inv) => acc + (inv.totalMinor || 0),
    0
  );

  const resultingTotal = previouslyInvoicedMinor + currentInvoiceTotalMinor;

  if (resultingTotal > deal.agreedAmountMinor) {
    return {
      allowed: false,
      message: `Invoice amount exceeds agreed Deal value. Agreed: ${deal.currency} ${(deal.agreedAmountMinor / 100).toFixed(2)}, Previously invoiced: ${deal.currency} ${(previouslyInvoicedMinor / 100).toFixed(2)}, Available to bill: ${deal.currency} ${(Math.max(0, deal.agreedAmountMinor - previouslyInvoicedMinor) / 100).toFixed(2)}.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if a billing milestone has already been billed with an active invoice.
 */
export async function checkMilestoneAlreadyBilled(
  dealId: string,
  milestoneId: string,
  excludeInvoiceId?: string
): Promise<{ alreadyBilled: boolean; message?: string }> {
  await connectDB();

  const filter: Record<string, unknown> = {
    dealId: new Types.ObjectId(dealId),
    billingMilestoneId: new Types.ObjectId(milestoneId),
    status: { $in: [INVOICE_STATUSES.DRAFT, INVOICE_STATUSES.ISSUED] },
  };

  if (excludeInvoiceId && Types.ObjectId.isValid(excludeInvoiceId)) {
    filter._id = { $ne: new Types.ObjectId(excludeInvoiceId) };
  }

  const existing = await Invoice.findOne(filter).select('invoiceCode invoiceNumber status').lean().exec();

  if (existing) {
    const code = existing.invoiceNumber || existing.invoiceCode;
    return {
      alreadyBilled: true,
      message: `This milestone is already linked to active invoice ${code} (${existing.status}). Cannot double-bill the same milestone.`,
    };
  }

  return { alreadyBilled: false };
}
