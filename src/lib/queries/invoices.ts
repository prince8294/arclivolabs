import 'server-only';

import { Types } from 'mongoose';

import {
  BILLING_MILESTONE_STATUSES,
  INVOICE_STATUSES,
  INVOICE_PAYMENT_STATUSES,
  type InvoiceStatus,
  type InvoiceType,
} from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { BillingSchedule, type IBillingSchedule } from '@/models/BillingSchedule';
import { BillingSetting, type IBillingSetting } from '@/models/BillingSetting';
import { Client } from '@/models/Client';
import { Deal } from '@/models/Deal';
import { Invoice, type IInvoice } from '@/models/Invoice';
import { InvoiceActivity, type IInvoiceActivity } from '@/models/InvoiceActivity';
import { Project } from '@/models/Project';
import { escapeRegExp } from '@/lib/utils/regex';

export interface InvoicesFilterParams {
  page?: number;
  limit?: number;
  status?: string;
  invoiceType?: string;
  clientId?: string;
  dealId?: string;
  projectId?: string;
  currency?: string;
  overdue?: boolean;
  search?: string;
}

export interface InvoicesListResult {
  invoices: Array<IInvoice & { clientName?: string; projectName?: string; dealCode?: string }>;
  total: number;
  page: number;
  totalPages: number;
}

export async function getInvoicesList(params: InvoicesFilterParams): Promise<InvoicesListResult> {
  await connectDB();

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};

  if (params.status && Object.values(INVOICE_STATUSES).includes(params.status as InvoiceStatus)) {
    query.status = params.status;
  }

  if (params.invoiceType && ['STANDARD', 'MILESTONE', 'FINAL'].includes(params.invoiceType)) {
    query.invoiceType = params.invoiceType;
  }

  if (params.clientId && Types.ObjectId.isValid(params.clientId)) {
    query.clientId = new Types.ObjectId(params.clientId);
  }

  if (params.dealId && Types.ObjectId.isValid(params.dealId)) {
    query.dealId = new Types.ObjectId(params.dealId);
  }

  if (params.projectId && Types.ObjectId.isValid(params.projectId)) {
    query.projectId = new Types.ObjectId(params.projectId);
  }

  if (params.currency) {
    query.currency = params.currency.toUpperCase();
  }

  if (params.overdue) {
    query.status = INVOICE_STATUSES.ISSUED;
    query.dueDate = { $lt: new Date() };
    query.amountDueMinor = { $gt: 0 };
  }

  if (params.search && params.search.trim()) {
    const escaped = escapeRegExp(params.search.trim());
    query.$or = [
      { invoiceNumber: { $regex: escaped, $options: 'i' } },
      { invoiceCode: { $regex: escaped, $options: 'i' } },
      { 'customerSnapshot.clientName': { $regex: escaped, $options: 'i' } },
      { 'customerSnapshot.companyName': { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [invoices, total] = await Promise.all([
    Invoice.find(query)
      .populate('clientId', 'name companyName clientCode')
      .populate('projectId', 'title projectCode')
      .populate('dealId', 'dealCode title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    Invoice.countDocuments(query).exec(),
  ]);

  const mapped = invoices.map((inv: any) => ({
    ...inv,
    clientName: inv.customerSnapshot?.clientName || inv.clientId?.name || 'Client',
    projectName: inv.projectId?.title || null,
    dealCode: inv.dealId?.dealCode || null,
  }));

  return {
    invoices: mapped,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getInvoiceById(id: string) {
  await connectDB();

  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  const invoice = await Invoice.findById(id)
    .populate('clientId', 'name companyName clientCode email phone billingAddress')
    .populate('dealId', 'dealCode title agreedAmountMinor currency paymentPlanSnapshot')
    .populate('projectId', 'projectCode title')
    .populate('issuedBy', 'name email role')
    .populate('voidedBy', 'name email role')
    .populate('createdBy', 'name email role')
    .lean()
    .exec();

  if (!invoice) {
    return null;
  }

  const activities = await InvoiceActivity.find({ invoiceId: new Types.ObjectId(id) })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return {
    ...invoice,
    activities,
  };
}

export async function getBillingOverviewStats() {
  await connectDB();

  const now = new Date();

  const [
    totalIssuedCount,
    issuedInvoicesSum,
    draftCount,
    voidCount,
    overdueCount,
  ] = await Promise.all([
    Invoice.countDocuments({ status: INVOICE_STATUSES.ISSUED }).exec(),
    Invoice.aggregate([
      { $match: { status: INVOICE_STATUSES.ISSUED } },
      {
        $group: {
          _id: '$currency',
          totalAmountMinor: { $sum: '$totalMinor' },
          totalDueMinor: { $sum: '$amountDueMinor' },
          count: { $sum: 1 },
        },
      },
    ]),
    Invoice.countDocuments({ status: INVOICE_STATUSES.DRAFT }).exec(),
    Invoice.countDocuments({ status: INVOICE_STATUSES.VOID }).exec(),
    Invoice.countDocuments({
      status: INVOICE_STATUSES.ISSUED,
      dueDate: { $lt: now },
      amountDueMinor: { $gt: 0 },
    }).exec(),
  ]);

  // INR sum or default currency
  const inrStats = issuedInvoicesSum.find((item) => item._id === 'INR') || {
    totalAmountMinor: 0,
    totalDueMinor: 0,
    count: 0,
  };

  return {
    totalIssuedCount,
    totalInvoicedMinor: inrStats.totalAmountMinor,
    totalDueMinor: inrStats.totalDueMinor,
    currencyBreakdowns: issuedInvoicesSum,
    draftCount,
    voidCount,
    overdueCount,
  };
}

export async function getBillingSchedulesList(params?: {
  clientId?: string;
  projectId?: string;
  dealId?: string;
}) {
  await connectDB();

  const query: Record<string, unknown> = {};

  if (params?.clientId && Types.ObjectId.isValid(params.clientId)) {
    query.clientId = new Types.ObjectId(params.clientId);
  }
  if (params?.projectId && Types.ObjectId.isValid(params.projectId)) {
    query.projectId = new Types.ObjectId(params.projectId);
  }
  if (params?.dealId && Types.ObjectId.isValid(params.dealId)) {
    query.dealId = new Types.ObjectId(params.dealId);
  }

  const schedules = await BillingSchedule.find(query)
    .populate('dealId', 'dealCode title agreedAmountMinor currency')
    .populate('clientId', 'name companyName clientCode')
    .populate('projectId', 'title projectCode')
    .populate('milestones.linkedInvoiceId', 'invoiceNumber invoiceCode status')
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return schedules;
}

export async function getBillingSettings(): Promise<IBillingSetting> {
  await connectDB();

  let settings = await BillingSetting.findOne({ key: 'primary' }).lean().exec();

  if (!settings) {
    const defaultDoc = await BillingSetting.create({
      key: 'primary',
      companyName: 'Arclivo Labs',
      legalName: 'Arclivo Labs',
      address: '',
      email: '',
      phone: '',
      website: '',
      taxEnabled: false,
      taxLabel: 'GSTIN',
      defaultTaxRate: 0,
      sellerState: '',
      defaultPaymentTerms: 'Payment due within 15 days of invoice date.',
      invoiceFooterNote: 'Thank you for choosing Arclivo Labs.',
    });
    settings = defaultDoc.toObject();
  }

  return settings as IBillingSetting;
}

/**
 * CLIENT PORTAL: fetch issued invoices for the authenticated client.
 * Never leaks drafts, voids, or another client's records.
 */
export async function getClientInvoices(clientId: string) {
  await connectDB();

  if (!Types.ObjectId.isValid(clientId)) {
    return [];
  }

  const invoices = await Invoice.find({
    clientId: new Types.ObjectId(clientId),
    status: INVOICE_STATUSES.ISSUED,
  })
    .populate('projectId', 'title projectCode')
    .populate('dealId', 'dealCode title')
    .sort({ issueDate: -1 })
    .lean()
    .exec();

  return invoices;
}

/**
 * CLIENT PORTAL: fetch a single issued invoice for the authenticated client.
 */
export async function getClientInvoiceDetail(invoiceId: string, clientId: string) {
  await connectDB();

  if (!Types.ObjectId.isValid(invoiceId) || !Types.ObjectId.isValid(clientId)) {
    return null;
  }

  const invoice = await Invoice.findOne({
    _id: new Types.ObjectId(invoiceId),
    clientId: new Types.ObjectId(clientId),
    status: INVOICE_STATUSES.ISSUED,
  })
    .populate('projectId', 'title projectCode')
    .populate('dealId', 'dealCode title')
    .lean()
    .exec();

  return invoice;
}

/**
 * Deal billing summary for Deal pages.
 */
export async function getDealBillingSummary(dealId: string) {
  await connectDB();

  if (!Types.ObjectId.isValid(dealId)) {
    return null;
  }

  const deal = await Deal.findById(dealId).lean().exec();
  if (!deal) return null;

  const invoices = await Invoice.find({
    dealId: new Types.ObjectId(dealId),
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const activeInvoices = invoices.filter((i) => i.status !== INVOICE_STATUSES.VOID);
  const totalInvoicedMinor = activeInvoices.reduce((sum, i) => sum + (i.totalMinor || 0), 0);
  const totalPaidMinor = activeInvoices.reduce((sum, i) => sum + (i.amountPaidMinor || 0), 0);
  const totalDueMinor = activeInvoices.reduce((sum, i) => sum + (i.amountDueMinor || 0), 0);
  const remainingUnbilledMinor = Math.max(0, deal.agreedAmountMinor - totalInvoicedMinor);

  const billingSchedule = await BillingSchedule.findOne({ dealId: new Types.ObjectId(dealId) }).lean().exec();

  return {
    deal,
    invoices,
    totalInvoicedMinor,
    totalPaidMinor,
    totalDueMinor,
    remainingUnbilledMinor,
    billingSchedule,
  };
}

/**
 * Project billing summary for Project pages.
 */
export async function getProjectBillingSummary(projectId: string) {
  await connectDB();

  if (!Types.ObjectId.isValid(projectId)) {
    return null;
  }

  const project = await Project.findById(projectId).lean().exec();
  if (!project) return null;

  const invoices = await Invoice.find({
    projectId: new Types.ObjectId(projectId),
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const activeInvoices = invoices.filter((i) => i.status !== INVOICE_STATUSES.VOID);
  const totalInvoicedMinor = activeInvoices.reduce((sum, i) => sum + (i.totalMinor || 0), 0);
  const totalPaidMinor = activeInvoices.reduce((sum, i) => sum + (i.amountPaidMinor || 0), 0);
  const totalDueMinor = activeInvoices.reduce((sum, i) => sum + (i.amountDueMinor || 0), 0);

  let agreedAmountMinor: number | null = null;
  let remainingUnbilledMinor: number | null = null;

  if (project.dealId) {
    const deal = await Deal.findById(project.dealId).select('agreedAmountMinor').lean().exec();
    if (deal) {
      agreedAmountMinor = deal.agreedAmountMinor;
      remainingUnbilledMinor = Math.max(0, deal.agreedAmountMinor - totalInvoicedMinor);
    }
  }

  return {
    project,
    invoices,
    totalInvoicedMinor,
    totalPaidMinor,
    totalDueMinor,
    agreedAmountMinor,
    remainingUnbilledMinor,
  };
}

/**
 * Client billing summary for Client detail page.
 */
export async function getClientBillingSummary(clientId: string) {
  await connectDB();

  if (!Types.ObjectId.isValid(clientId)) {
    return null;
  }

  const invoices = await Invoice.find({
    clientId: new Types.ObjectId(clientId),
  })
    .populate('projectId', 'title projectCode')
    .populate('dealId', 'dealCode')
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  const issuedInvoices = invoices.filter((i) => i.status === INVOICE_STATUSES.ISSUED);
  const totalInvoicedMinor = issuedInvoices.reduce((sum, i) => sum + (i.totalMinor || 0), 0);
  const totalPaidMinor = issuedInvoices.reduce((sum, i) => sum + (i.amountPaidMinor || 0), 0);
  const currentOutstandingMinor = issuedInvoices.reduce((sum, i) => sum + (i.amountDueMinor || 0), 0);

  return {
    invoices,
    issuedInvoicesCount: issuedInvoices.length,
    totalInvoicedMinor,
    totalPaidMinor,
    currentOutstandingMinor,
  };
}
