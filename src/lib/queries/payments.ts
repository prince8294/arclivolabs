import 'server-only';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import { Client } from '@/models/Client';
import { Invoice } from '@/models/Invoice';
import { Payment } from '@/models/Payment';
import { PaymentAllocation } from '@/models/PaymentAllocation';
import { PaymentReceipt } from '@/models/PaymentReceipt';
import { PaymentReceivingAccount } from '@/models/PaymentReceivingAccount';
import { PAYMENT_ALLOCATION_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '@/lib/constants/enums';

export interface PaymentListParams {
  clientId?: string;
  invoiceId?: string;
  receivingAccountId?: string;
  status?: string;
  method?: string;
  currency?: string;
  search?: string;
  submittedFrom?: string;
  submittedTo?: string;
  verifiedFrom?: string;
  verifiedTo?: string;
  page?: number;
  limit?: number;
}

const dateRange = (from?: string, to?: string) => {
  const range: { $gte?: Date; $lte?: Date } = {};
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) range.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) range.$lte = new Date(`${to}T23:59:59.999Z`);
  return Object.keys(range).length ? range : undefined;
};

export async function listPaymentsPage(params: PaymentListParams = {}) {
  await connectDB();
  const page = Math.max(1, Math.trunc(params.page || 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(params.limit || 20)));
  const filter: Record<string, unknown> = {};
  if (params.clientId && Types.ObjectId.isValid(params.clientId)) filter.clientId = new Types.ObjectId(params.clientId);
  if (params.invoiceId && Types.ObjectId.isValid(params.invoiceId)) filter.primaryInvoiceId = new Types.ObjectId(params.invoiceId);
  if (params.receivingAccountId && Types.ObjectId.isValid(params.receivingAccountId)) filter.receivingAccountId = new Types.ObjectId(params.receivingAccountId);
  if (params.status === 'PENDING_QUEUE') filter.status = { $in: [PAYMENT_STATUSES.SUBMITTED, PAYMENT_STATUSES.UNDER_REVIEW] };
  else if (params.status && Object.values(PAYMENT_STATUSES).includes(params.status as never)) filter.status = params.status;
  if (params.method && Object.values(PAYMENT_METHODS).includes(params.method as never)) filter.paymentMethod = params.method;
  if (params.currency && /^[A-Z]{3}$/.test(params.currency.toUpperCase())) filter.currency = params.currency.toUpperCase();
  const submittedRange = dateRange(params.submittedFrom, params.submittedTo); if (submittedRange) filter.submittedAt = submittedRange;
  const verifiedRange = dateRange(params.verifiedFrom, params.verifiedTo); if (verifiedRange) filter.verifiedAt = verifiedRange;

  const search = params.search?.trim();
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [clients, invoices, receipts] = await Promise.all([
      Client.find({ $or: [{ name: regex }, { companyName: regex }, { clientCode: regex }] }).select('_id').limit(100).lean(),
      Invoice.find({ $or: [{ invoiceNumber: regex }, { invoiceCode: regex }] }).select('_id').limit(100).lean(),
      PaymentReceipt.find({ receiptCode: regex }).select('paymentId').limit(100).lean(),
    ]);
    filter.$or = [
      { paymentCode: regex },
      { transactionReference: regex },
      { clientId: { $in: clients.map((row) => row._id) } },
      { primaryInvoiceId: { $in: invoices.map((row) => row._id) } },
      { _id: { $in: receipts.map((row) => row.paymentId) } },
    ];
  }

  const [rows, total] = await Promise.all([
    Payment.find(filter).sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('clientId', 'clientCode name companyName')
      .populate('primaryInvoiceId', 'invoiceCode invoiceNumber')
      .lean(),
    Payment.countDocuments(filter),
  ]);
  const paymentIds = rows.map((row) => row._id);
  const receipts = await PaymentReceipt.find({ paymentId: { $in: paymentIds } }).select('paymentId receiptCode status').lean();
  const receiptMap = new Map(receipts.map((row) => [row.paymentId.toString(), row]));
  const items = rows.map((row) => {
    const client = row.clientId as unknown as { _id: Types.ObjectId; clientCode?: string; name?: string; companyName?: string };
    const invoice = row.primaryInvoiceId as unknown as { _id: Types.ObjectId; invoiceCode?: string; invoiceNumber?: string | null };
    const receipt = receiptMap.get(row._id.toString());
    return { id: row._id.toString(), paymentCode: row.paymentCode, clientId: client?._id?.toString() ?? '', clientName: client?.companyName || client?.name || client?.clientCode || 'Client', invoiceId: invoice?._id?.toString() ?? '', invoiceNumber: invoice?.invoiceNumber || invoice?.invoiceCode || 'Invoice', amountMinor: row.amountMinor, currency: row.currency, method: row.paymentMethod, reference: row.transactionReference, status: row.status, submittedAt: row.submittedAt.toISOString(), verifiedAt: row.verifiedAt?.toISOString() ?? null, receipt: receipt ? { id: receipt._id.toString(), code: receipt.receiptCode, status: receipt.status } : null };
  });
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listPayments(scope: { clientId?: string; status?: string } = {}) {
  return (await listPaymentsPage({ ...scope, limit: 100 })).items;
}

export async function getPaymentDetail(id: string, clientId?: string) {
  if (!Types.ObjectId.isValid(id)) return null; await connectDB();
  const filter: Record<string, unknown> = { _id: new Types.ObjectId(id) }; if (clientId) filter.clientId = new Types.ObjectId(clientId);
  const payment = await Payment.findOne(filter).lean(); if (!payment) return null;
  const [allocations, receipt] = await Promise.all([PaymentAllocation.find({ paymentId: payment._id }).lean(), PaymentReceipt.findOne({ paymentId: payment._id }).lean()]);
  return { id: payment._id.toString(), paymentCode: payment.paymentCode, clientId: payment.clientId.toString(), primaryInvoiceId: payment.primaryInvoiceId.toString(), amountMinor: payment.amountMinor, currency: payment.currency, method: payment.paymentMethod, reference: payment.transactionReference, transactionDate: payment.transactionDate.toISOString(), status: payment.status, rejectionReason: payment.rejectionReason ?? null, reversalReason: payment.reversalReason ?? null, submittedAt: payment.submittedAt.toISOString(), verifiedAt: payment.verifiedAt?.toISOString() ?? null, allocations: allocations.map((row) => ({ id: row._id.toString(), invoiceId: row.invoiceId.toString(), amountMinor: row.amountMinor, status: row.status })), receipt: receipt ? { id: receipt._id.toString(), receiptCode: receipt.receiptCode, status: receipt.status } : null };
}

export async function listActiveReceivingAccounts() { await connectDB(); const rows = await PaymentReceivingAccount.find({ isActive: true }).sort({ isDefault: -1, displayName: 1 }).lean(); return rows.map((row) => ({ id: row._id.toString(), accountCode: row.accountCode, type: row.type, displayName: row.displayName, upiId: row.upiId ?? null, bankName: row.bankName ?? null, accountHolderName: row.accountHolderName, maskedAccountNumber: null, ifscCode: row.ifscCode ?? null, isDefault: row.isDefault })); }
export async function listReceivingAccounts() { await connectDB(); const rows = await PaymentReceivingAccount.find().sort({ isDefault: -1, isActive: -1, displayName: 1 }).lean(); return rows.map((row) => ({ id: row._id.toString(), accountCode: row.accountCode, type: row.type, displayName: row.displayName, upiId: row.upiId ?? null, bankName: row.bankName ?? null, accountHolderName: row.accountHolderName, ifscCode: row.ifscCode ?? null, isDefault: row.isDefault, isActive: row.isActive })); }
export async function listClientPayableInvoices(clientId: string) { await connectDB(); const rows = await Invoice.find({ clientId: new Types.ObjectId(clientId), status: 'ISSUED', amountDueMinor: { $gt: 0 } }).select('invoiceNumber invoiceCode amountDueMinor totalMinor currency dueDate').sort({ dueDate: 1 }).lean(); return rows.map((row) => ({ id: row._id.toString(), invoiceNumber: row.invoiceNumber ?? row.invoiceCode, amountDueMinor: row.amountDueMinor, totalMinor: row.totalMinor, currency: row.currency, dueDate: row.dueDate.toISOString() })); }
export async function paymentSummary(clientId?: string) { await connectDB(); const match: Record<string, unknown> = {}; if (clientId) match.clientId = new Types.ObjectId(clientId); const [verified, pending, rejected] = await Promise.all([Payment.aggregate([{ $match: { ...match, status: PAYMENT_STATUSES.VERIFIED } }, { $group: { _id: '$currency', total: { $sum: '$amountMinor' }, count: { $sum: 1 } } }]), Payment.aggregate([{ $match: { ...match, status: { $in: [PAYMENT_STATUSES.SUBMITTED, PAYMENT_STATUSES.UNDER_REVIEW] } } }, { $group: { _id: '$currency', total: { $sum: '$amountMinor' }, count: { $sum: 1 } } }]), Payment.aggregate([{ $match: { ...match, status: PAYMENT_STATUSES.REJECTED } }, { $group: { _id: '$currency', total: { $sum: '$amountMinor' }, count: { $sum: 1 } } }])]); return { verified, pending, rejected }; }

export interface ReceiptListParams { clientId?: string; search?: string; status?: string; page?: number; limit?: number; }
export async function listReceiptsPage(params: ReceiptListParams = {}) {
  await connectDB(); const page = Math.max(1, Math.trunc(params.page || 1)); const limit = Math.min(100, Math.max(1, Math.trunc(params.limit || 20))); const filter: Record<string, unknown> = {};
  if (params.clientId && Types.ObjectId.isValid(params.clientId)) filter.clientId = new Types.ObjectId(params.clientId); if (params.status) filter.status = params.status;
  const search = params.search?.trim(); if (search) { const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); const [clients, payments] = await Promise.all([Client.find({ $or: [{ name: regex }, { companyName: regex }, { clientCode: regex }] }).select('_id').lean(), Payment.find({ $or: [{ paymentCode: regex }, { transactionReference: regex }] }).select('_id').lean()]); filter.$or = [{ receiptCode: regex }, { clientId: { $in: clients.map((row) => row._id) } }, { paymentId: { $in: payments.map((row) => row._id) } }]; }
  const [rows, total] = await Promise.all([PaymentReceipt.find(filter).sort({ issuedAt: -1 }).skip((page - 1) * limit).limit(limit).populate('clientId', 'clientCode name companyName').populate('paymentId', 'paymentCode transactionReference').lean(), PaymentReceipt.countDocuments(filter)]);
  return { items: rows.map((row) => { const client = row.clientId as unknown as { _id: Types.ObjectId; name?: string; companyName?: string; clientCode?: string }; const payment = row.paymentId as unknown as { _id: Types.ObjectId; paymentCode?: string; transactionReference?: string }; return { id: row._id.toString(), receiptCode: row.receiptCode, paymentId: payment?._id?.toString() ?? '', paymentCode: payment?.paymentCode ?? 'Payment', reference: payment?.transactionReference ?? '', clientName: client?.companyName || client?.name || client?.clientCode || 'Client', amountMinor: row.receiptAmountMinor, currency: row.currency, method: row.paymentMethod, status: row.status, issuedAt: row.issuedAt.toISOString() }; }), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
export async function listReceipts(clientId?: string) { return (await listReceiptsPage({ clientId, limit: 100 })).items; }
export async function getReceiptDetail(id: string, clientId?: string) { if (!Types.ObjectId.isValid(id)) return null; await connectDB(); const filter: Record<string, unknown> = { _id: new Types.ObjectId(id) }; if (clientId && Types.ObjectId.isValid(clientId)) filter.clientId = new Types.ObjectId(clientId); const row = await PaymentReceipt.findOne(filter).lean(); if (!row) return null; return { id: row._id.toString(), receiptCode: row.receiptCode, paymentId: row.paymentId.toString(), amountMinor: row.receiptAmountMinor, currency: row.currency, method: row.paymentMethod, reference: row.transactionReference, transactionDate: row.transactionDate.toISOString(), issuedAt: row.issuedAt.toISOString(), status: row.status, seller: row.sellerSnapshot, customer: row.customerSnapshot, allocations: row.allocationSnapshot.map((allocation) => ({ invoiceId: allocation.invoiceId.toString(), invoiceNumber: allocation.invoiceNumber, amountMinor: allocation.amountMinor })) }; }
export async function invoiceVerifiedPaid(invoiceId: Types.ObjectId) { const rows = await PaymentAllocation.aggregate([{ $match: { invoiceId, status: PAYMENT_ALLOCATION_STATUSES.ACTIVE } }, { $group: { _id: null, total: { $sum: '$amountMinor' } } }]); return Number(rows[0]?.total ?? 0); }
