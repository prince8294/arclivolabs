'use server';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

import { requireRole } from '@/lib/auth/authorization';
import {
  BILLING_MILESTONE_STATUSES,
  INVOICE_ACTIVITY_TYPES,
  INVOICE_STATUSES,
  TAX_TREATMENTS,
} from '@/lib/constants/enums';
import { generateSequentialCode } from '@/lib/db/generate-code';
import connectDB from '@/lib/db/mongoose';
import {
  checkMilestoneAlreadyBilled,
  validateDealBillingLimit,
} from '@/lib/billing/limits';
import { calculateInvoicePricing } from '@/lib/billing/pricing';
import {
  BillingSettingSchemaValidation,
  CreateInvoiceDraftSchema,
  UpdateInvoiceDraftSchema,
  VoidInvoiceSchema,
  type BillingSettingInput,
  type CreateInvoiceDraftInput,
  type UpdateInvoiceDraftInput,
} from '@/lib/validations/invoice';
import { BillingSchedule } from '@/models/BillingSchedule';
import { BillingSetting } from '@/models/BillingSetting';
import { Client } from '@/models/Client';
import { Deal } from '@/models/Deal';
import { Invoice } from '@/models/Invoice';
import { InvoiceActivity } from '@/models/InvoiceActivity';
import { Project } from '@/models/Project';
import { createNotification } from '@/lib/notifications/create';
import { USER_ROLES } from '@/types/auth';

/**
 * Create a new Draft Invoice (Admin only).
 */
export async function createInvoiceDraftAction(rawInput: CreateInvoiceDraftInput) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  const validated = CreateInvoiceDraftSchema.safeParse(rawInput);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || 'Invalid invoice data.',
    };
  }

  const data = validated.data;

  // Verify Client
  const client = await Client.findById(data.clientId).lean().exec();
  if (!client) {
    return { success: false, error: 'Client not found.' };
  }

  // Recalculate Pricing Server-Side
  const pricing = calculateInvoicePricing(data.lineItems, {
    taxEnabled: data.taxEnabled,
    taxTreatment: data.taxTreatment,
    taxLabel: data.taxLabel,
    taxRate: data.taxRate,
    sellerState: data.sellerState,
    placeOfSupply: data.placeOfSupply,
  });

  // Verify Deal Limits if Deal is linked
  if (data.dealId) {
    const limitCheck = await validateDealBillingLimit(data.dealId, pricing.totalMinor);
    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.message };
    }

    if (data.billingMilestoneId) {
      const milestoneCheck = await checkMilestoneAlreadyBilled(
        data.dealId,
        data.billingMilestoneId
      );
      if (milestoneCheck.alreadyBilled) {
        return { success: false, error: milestoneCheck.message };
      }
    }
  }

  // Allocate sequential draft code
  const draftCode = await generateSequentialCode('invoice-draft', 'DFT');

  const invoice = await Invoice.create({
    invoiceCode: draftCode,
    clientId: new Types.ObjectId(data.clientId),
    dealId: data.dealId ? new Types.ObjectId(data.dealId) : null,
    projectId: data.projectId ? new Types.ObjectId(data.projectId) : null,
    billingMilestoneId: data.billingMilestoneId
      ? new Types.ObjectId(data.billingMilestoneId)
      : null,
    invoiceType: data.invoiceType,
    status: INVOICE_STATUSES.DRAFT,
    currency: data.currency,
    lineItems: pricing.lineItems,
    subtotalMinor: pricing.subtotalMinor,
    discountMinor: pricing.discountMinor,
    taxMinor: pricing.taxMinor,
    totalMinor: pricing.totalMinor,
    amountPaidMinor: 0,
    amountDueMinor: pricing.totalMinor,
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    description: data.description,
    terms: data.terms,
    notes: data.notes,
    billingInstructions: data.billingInstructions,
    taxDetails: pricing.taxDetails,
    createdBy: new Types.ObjectId(user.id),
    updatedBy: new Types.ObjectId(user.id),
  });

  // Record Activity
  await InvoiceActivity.create({
    invoiceId: invoice._id,
    activityType: INVOICE_ACTIVITY_TYPES.INVOICE_DRAFT_CREATED,
    performedBy: new Types.ObjectId(user.id),
    performerName: user.name || 'Admin',
    performerRole: user.role,
    description: `Created draft invoice ${draftCode}`,
    metadata: { totalMinor: pricing.totalMinor, currency: data.currency },
  });
  revalidatePath('/admin/invoices');
  revalidatePath('/admin/billing');

  return { success: true, invoiceId: invoice._id.toString(), invoiceCode: draftCode };
}

/**
 * Update an existing Draft Invoice (Admin only).
 * Issued invoices cannot be edited.
 */
export async function updateInvoiceDraftAction(invoiceId: string, rawInput: UpdateInvoiceDraftInput) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  if (!Types.ObjectId.isValid(invoiceId)) {
    return { success: false, error: 'Invalid invoice ID.' };
  }

  const existing = await Invoice.findById(invoiceId).exec();
  if (!existing) {
    return { success: false, error: 'Invoice not found.' };
  }

  if (existing.status !== INVOICE_STATUSES.DRAFT) {
    return {
      success: false,
      error: 'Issued or voided invoices are immutable and cannot be edited.',
    };
  }

  const validated = UpdateInvoiceDraftSchema.safeParse(rawInput);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || 'Invalid invoice data.',
    };
  }

  const data = validated.data;

  // Recalculate Pricing Server-Side
  const pricing = calculateInvoicePricing(data.lineItems, {
    taxEnabled: data.taxEnabled,
    taxTreatment: data.taxTreatment,
    taxLabel: data.taxLabel,
    taxRate: data.taxRate,
    sellerState: data.sellerState,
    placeOfSupply: data.placeOfSupply,
  });

  // Verify Deal Limits
  if (data.dealId) {
    const limitCheck = await validateDealBillingLimit(
      data.dealId,
      pricing.totalMinor,
      invoiceId
    );
    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.message };
    }

    if (data.billingMilestoneId) {
      const milestoneCheck = await checkMilestoneAlreadyBilled(
        data.dealId,
        data.billingMilestoneId,
        invoiceId
      );
      if (milestoneCheck.alreadyBilled) {
        return { success: false, error: milestoneCheck.message };
      }
    }
  }

  existing.clientId = new Types.ObjectId(data.clientId);
  existing.dealId = data.dealId ? new Types.ObjectId(data.dealId) : null;
  existing.projectId = data.projectId ? new Types.ObjectId(data.projectId) : null;
  existing.billingMilestoneId = data.billingMilestoneId
    ? new Types.ObjectId(data.billingMilestoneId)
    : null;
  existing.invoiceType = data.invoiceType;
  existing.currency = data.currency;
  existing.lineItems = pricing.lineItems as any;
  existing.subtotalMinor = pricing.subtotalMinor;
  existing.discountMinor = pricing.discountMinor;
  existing.taxMinor = pricing.taxMinor;
  existing.totalMinor = pricing.totalMinor;
  existing.amountDueMinor = pricing.totalMinor;
  existing.issueDate = data.issueDate;
  existing.dueDate = data.dueDate;
  existing.description = data.description;
  existing.terms = data.terms;
  existing.notes = data.notes;
  existing.billingInstructions = data.billingInstructions;
  existing.taxDetails = pricing.taxDetails;
  existing.updatedBy = new Types.ObjectId(user.id);

  await existing.save();

  await InvoiceActivity.create({
    invoiceId: existing._id,
    activityType: INVOICE_ACTIVITY_TYPES.INVOICE_UPDATED,
    performedBy: new Types.ObjectId(user.id),
    performerName: user.name || 'Admin',
    performerRole: user.role,
    description: `Updated draft invoice details and recalculated pricing`,
    metadata: { totalMinor: pricing.totalMinor },
  });

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath('/admin/invoices');
  revalidatePath('/admin/billing');

  return { success: true, invoiceId: existing._id.toString() };
}

/**
 * Issue an Invoice (Admin only).
 * Transition from DRAFT -> ISSUED.
 * Assigns immutable legal invoice number, freezes seller & customer snapshots.
 */
export async function issueInvoiceAction(invoiceId: string) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  if (!Types.ObjectId.isValid(invoiceId)) {
    return { success: false, error: 'Invalid invoice ID.' };
  }

  const invoice = await Invoice.findById(invoiceId).exec();
  if (!invoice) {
    return { success: false, error: 'Invoice not found.' };
  }

  if (invoice.status !== INVOICE_STATUSES.DRAFT) {
    return {
      success: false,
      error: `Invoice is already in ${invoice.status} status and cannot be re-issued.`,
    };
  }

  // Fetch Client for customer snapshot
  const client = await Client.findById(invoice.clientId).lean().exec();
  if (!client) {
    return { success: false, error: 'Client record not found.' };
  }

  // Fetch Billing Setting for seller snapshot
  let settings = await BillingSetting.findOne({ key: 'primary' }).lean().exec();
  if (!settings) {
    settings = {
      companyName: 'Arclivo Labs',
      legalName: 'Arclivo Labs',
      address: '',
      email: '',
      phone: '',
      website: '',
      taxRegistrationNumber: '',
      taxLabel: 'GSTIN',
    } as any;
  }

  // Verify Deal Limits
  if (invoice.dealId) {
    const limitCheck = await validateDealBillingLimit(
      invoice.dealId.toString(),
      invoice.totalMinor,
      invoiceId
    );
    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.message };
    }

    if (invoice.billingMilestoneId) {
      const milestoneCheck = await checkMilestoneAlreadyBilled(
        invoice.dealId.toString(),
        invoice.billingMilestoneId.toString(),
        invoiceId
      );
      if (milestoneCheck.alreadyBilled) {
        return { success: false, error: milestoneCheck.message };
      }
    }
  }

  // Allocate Annual Sequential Invoice Number: e.g. INV-2026-0001
  const issueYear = (invoice.issueDate || new Date()).getFullYear();
  const counterKey = `invoice-${issueYear}`;
  const counterPrefix = `INV-${issueYear}`;
  const invoiceNumber = await generateSequentialCode(counterKey, counterPrefix);

  // Freeze Snapshots
  const customerSnapshot = {
    clientName: client.name,
    companyName: client.companyName || null,
    email: client.email,
    phone: client.phone || null,
    billingAddress: client.billingAddress || null,
    taxId: client.taxId || null,
  };

  const sellerSnapshot = {
    companyName: settings?.companyName ?? 'Arclivo Labs',
    legalName: settings?.legalName ?? 'Arclivo Labs',
    address: settings?.address || null,
    email: settings?.email || null,
    phone: settings?.phone || null,
    website: settings?.website || null,
    taxId: settings?.taxRegistrationNumber || null,
    taxLabel: settings?.taxLabel || 'GSTIN',
  };

  invoice.invoiceNumber = invoiceNumber;
  invoice.status = INVOICE_STATUSES.ISSUED;
  invoice.issuedBy = new Types.ObjectId(user.id);
  invoice.issuedAt = new Date();
  invoice.customerSnapshot = customerSnapshot;
  invoice.sellerSnapshot = sellerSnapshot;
  invoice.updatedBy = new Types.ObjectId(user.id);

  await invoice.save();

  // If milestone invoice, mark BillingSchedule milestone as BILLED
  if (invoice.dealId && invoice.billingMilestoneId) {
    await BillingSchedule.updateOne(
      {
        dealId: invoice.dealId,
        'milestones._id': invoice.billingMilestoneId,
      },
      {
        $set: {
          'milestones.$.status': BILLING_MILESTONE_STATUSES.BILLED,
          'milestones.$.linkedInvoiceId': invoice._id,
          'milestones.$.billedAt': new Date(),
          updatedBy: new Types.ObjectId(user.id),
        },
      }
    ).exec();
  }

  // Record Activity
  await InvoiceActivity.create({
    invoiceId: invoice._id,
    activityType: INVOICE_ACTIVITY_TYPES.INVOICE_ISSUED,
    performedBy: new Types.ObjectId(user.id),
    performerName: user.name || 'Admin',
    performerRole: user.role,
    description: `Issued invoice ${invoiceNumber} to ${client.name}`,
    metadata: {
      invoiceNumber,
      totalMinor: invoice.totalMinor,
      currency: invoice.currency,
    },
  });

  if (client.userId) {
    await createNotification({
      recipientUserId: client.userId,
      type: 'INVOICE_ISSUED',
      title: 'Invoice issued',
      message: `${invoiceNumber} is now available.`,
      resourceType: 'Invoice',
      resourceId: invoice._id,
      resourceUrl: `/client/invoices/${invoice._id}`,
      idempotencyKey: `invoice-issued:${invoice._id}`,
    });
  }

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath('/admin/invoices');
  revalidatePath('/admin/billing');
  revalidatePath('/admin/billing/schedules');
  revalidatePath('/client/invoices');

  return { success: true, invoiceNumber };
}

/**
 * Void an Issued Invoice (Admin only).
 * Historical record is preserved. Invoice number is never reused.
 */
export async function voidInvoiceAction(rawInput: { invoiceId: string; reason: string }) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  const validated = VoidInvoiceSchema.safeParse(rawInput);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || 'Invalid void reason.',
    };
  }

  const { invoiceId, reason } = validated.data;

  const invoice = await Invoice.findById(invoiceId).exec();
  if (!invoice) {
    return { success: false, error: 'Invoice not found.' };
  }

  if (invoice.status === INVOICE_STATUSES.VOID) {
    return { success: false, error: 'Invoice is already voided.' };
  }

  if (invoice.status === INVOICE_STATUSES.DRAFT) {
    return {
      success: false,
      error: 'Draft invoices should be deleted, not voided.',
    };
  }

  // Prevent voiding if payment has been allocated (for Part 15 compatibility)
  if (invoice.amountPaidMinor > 0) {
    return {
      success: false,
      error: 'Cannot void an invoice with recorded payments without reconciliation.',
    };
  }

  invoice.status = INVOICE_STATUSES.VOID;
  invoice.voidedBy = new Types.ObjectId(user.id);
  invoice.voidedAt = new Date();
  invoice.voidReason = reason;
  invoice.updatedBy = new Types.ObjectId(user.id);

  await invoice.save();

  // If was linked to a billing milestone, reopen milestone to NOT_BILLED
  if (invoice.dealId && invoice.billingMilestoneId) {
    await BillingSchedule.updateOne(
      {
        dealId: invoice.dealId,
        'milestones._id': invoice.billingMilestoneId,
      },
      {
        $set: {
          'milestones.$.status': BILLING_MILESTONE_STATUSES.NOT_BILLED,
          'milestones.$.linkedInvoiceId': null,
          'milestones.$.billedAt': null,
          updatedBy: new Types.ObjectId(user.id),
        },
      }
    ).exec();
  }

  await InvoiceActivity.create({
    invoiceId: invoice._id,
    activityType: INVOICE_ACTIVITY_TYPES.INVOICE_VOIDED,
    performedBy: new Types.ObjectId(user.id),
    performerName: user.name || 'Admin',
    performerRole: user.role,
    description: `Voided invoice ${invoice.invoiceNumber || invoice.invoiceCode}: ${reason}`,
    metadata: { reason },
  });

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath('/admin/invoices');
  revalidatePath('/admin/billing');
  revalidatePath('/admin/billing/schedules');
  revalidatePath('/client/invoices');

  return { success: true };
}

/**
 * Delete a Draft Invoice (Admin only).
 * Only allowed for DRAFT invoices. Issued invoices can only be VOIDED.
 */
export async function deleteInvoiceDraftAction(invoiceId: string) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  if (!Types.ObjectId.isValid(invoiceId)) {
    return { success: false, error: 'Invalid invoice ID.' };
  }

  const invoice = await Invoice.findById(invoiceId).exec();
  if (!invoice) {
    return { success: false, error: 'Invoice not found.' };
  }

  if (invoice.status !== INVOICE_STATUSES.DRAFT) {
    return {
      success: false,
      error: 'Only draft invoices can be deleted. Issued invoices must be voided.',
    };
  }

  await Invoice.deleteOne({ _id: invoice._id }).exec();
  await InvoiceActivity.deleteMany({ invoiceId: invoice._id }).exec();

  revalidatePath('/admin/invoices');
  revalidatePath('/admin/billing');

  return { success: true };
}

/**
 * Save / Update Central Billing Settings (Admin only).
 */
export async function saveBillingSettingsAction(rawInput: BillingSettingInput) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  const validated = BillingSettingSchemaValidation.safeParse(rawInput);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || 'Invalid billing settings.',
    };
  }

  const data = validated.data;

  await BillingSetting.findOneAndUpdate(
    { key: 'primary' },
    {
      $set: {
        companyName: data.companyName,
        legalName: data.legalName,
        address: data.address || '',
        email: data.email || '',
        phone: data.phone || '',
        website: data.website || '',
        taxEnabled: data.taxEnabled,
        taxRegistrationNumber: data.taxRegistrationNumber || '',
        taxLabel: data.taxLabel || 'GSTIN',
        defaultTaxRate: data.defaultTaxRate,
        defaultTaxTreatment: data.defaultTaxTreatment,
        sellerState: data.sellerState || '',
        defaultPaymentTerms: data.defaultPaymentTerms || '',
        invoiceFooterNote: data.invoiceFooterNote || '',
        bankAccountDetails: data.bankAccountDetails || '',
        upiPaymentInstructions: data.upiPaymentInstructions || '',
        updatedBy: new Types.ObjectId(user.id),
      },
    },
    { upsert: true, new: true }
  ).exec();

  revalidatePath('/admin/billing/settings');
  revalidatePath('/admin/billing');

  return { success: true };
}

/**
 * Initialize or ensure BillingSchedule from Deal paymentPlanSnapshot.
 */
export async function initializeBillingScheduleFromDeal(dealId: string) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  if (!Types.ObjectId.isValid(dealId)) {
    return { success: false, error: 'Invalid Deal ID.' };
  }

  const deal = await Deal.findById(dealId).lean().exec();
  if (!deal) {
    return { success: false, error: 'Deal not found.' };
  }
  if (!deal.clientId) {
    return { success: false, error: 'Deal is not linked to a client.' };
  }

  const existing = await BillingSchedule.findOne({ dealId: deal._id }).exec();
  if (existing) {
    return { success: true, scheduleId: existing._id.toString() };
  }

  const project = await Project.findOne({ dealId: deal._id }).select('_id').lean().exec();

  const milestones = (deal.paymentPlanSnapshot || []).map((m, idx) => ({
    _id: new Types.ObjectId(),
    milestoneCode: `MS-${String(idx + 1).padStart(2, '0')}`,
    title: m.name,
    description: m.condition || null,
    amountMinor: m.amountMinor,
    percentage: deal.agreedAmountMinor > 0 ? Math.round((m.amountMinor / deal.agreedAmountMinor) * 100) : 0,
    billingCondition: m.condition || null,
    plannedDueDate: m.dueDate || null,
    status: BILLING_MILESTONE_STATUSES.NOT_BILLED,
  }));

  const schedule = await BillingSchedule.create({
    dealId: deal._id,
    clientId: deal.clientId,
    projectId: project ? (project as { _id: Types.ObjectId })._id : null,
    currency: deal.currency,
    totalScheduledMinor: deal.agreedAmountMinor,
    milestones,
    createdBy: new Types.ObjectId(user.id),
    updatedBy: new Types.ObjectId(user.id),
  });

  revalidatePath('/admin/billing/schedules');
  return { success: true, scheduleId: schedule._id.toString() };
}
