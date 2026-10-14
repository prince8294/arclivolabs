'use server';

import { revalidatePath } from 'next/cache';
import { Types, type ClientSession } from 'mongoose';
import { requireRole } from '@/lib/auth/authorization';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { generateSequentialCode } from '@/lib/db/generate-code';
import connectDB from '@/lib/db/mongoose';
import { withOptionalTransaction } from '@/lib/db/transaction';
import { companyProfile } from '@/config/company';
import { BANK_TRANSFER_CHANNELS, COMMISSION_TYPES, FILE_CATEGORIES, FILE_STATUSES, INVOICE_STATUSES, PAYMENT_ACCOUNT_TYPES, PAYMENT_ACTIVITY_TYPES, PAYMENT_ALLOCATION_STATUSES, PAYMENT_METHODS, PAYMENT_RECEIPT_STATUSES, PAYMENT_SOURCES, PAYMENT_STATUSES, type BankTransferChannel, type PaymentAccountType, type PaymentActivityType, type PaymentMethod, type PaymentSource, type PaymentStatus } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';
import { toMinorUnits } from '@/lib/utils/money';
import { invoiceSettlement, normalizeTransactionReference, percentageCommission, PROCESSED_PAYMENT_STATUSES } from '@/lib/payments/core';
import { BillingSetting } from '@/models/BillingSetting';
import { Client } from '@/models/Client';
import { FileAsset } from '@/models/FileAsset';
import { Invoice } from '@/models/Invoice';
import { MarketingProfile } from '@/models/MarketingProfile';
import { MarketingCommission } from '@/models/MarketingCommission';
import { Payment } from '@/models/Payment';
import { PaymentActivity } from '@/models/PaymentActivity';
import { PaymentAllocation } from '@/models/PaymentAllocation';
import { PaymentReceipt } from '@/models/PaymentReceipt';
import { PaymentReceivingAccount } from '@/models/PaymentReceivingAccount';
import { User } from '@/models/User';
import { writeAudit } from '@/lib/audit/log';
import { createNotification } from '@/lib/notifications/create';

export interface PaymentActionState { ok: boolean; error?: string; id?: string; message?: string; }
const fail = (error: string): PaymentActionState => ({ ok: false, error });
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const oid = (value: string) => Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
const sessionOptions = (session?: ClientSession) => session ? { session } : {};

async function activity(paymentId: Types.ObjectId, type: PaymentActivityType, user: { id: string; name: string; role: string }, description: string, metadata?: Record<string, unknown>, session?: ClientSession) {
  await PaymentActivity.create([{ paymentId, activityType: type, actorUserId: new Types.ObjectId(user.id), actorName: user.name, actorRole: user.role, description, metadata: metadata ?? null }], sessionOptions(session));
}

export async function createReceivingAccount(_previous: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  const user = await requireRole(USER_ROLES.ADMIN); await connectDB();
  const type = text(form, 'type'); const displayName = text(form, 'displayName'); const accountHolderName = text(form, 'accountHolderName');
  const upiId = text(form, 'upiId').toLowerCase(); const bankName = text(form, 'bankName'); const accountNumber = text(form, 'accountNumber'); const ifscCode = text(form, 'ifscCode').toUpperCase();
  if (!Object.values(PAYMENT_ACCOUNT_TYPES).includes(type as never) || !displayName || !accountHolderName) return fail('Enter valid account details.');
  if (type === PAYMENT_ACCOUNT_TYPES.UPI && !/^[\w.+-]{2,}@[\w.-]{2,}$/.test(upiId)) return fail('Enter a valid UPI ID.');
  if (type === PAYMENT_ACCOUNT_TYPES.BANK && (!bankName || accountNumber.length < 4 || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode))) return fail('Enter valid bank account details and IFSC.');
  const accountCode = await generateSequentialCode('payment-account', 'PAC');
  const isDefault = text(form, 'isDefault') === 'on'; if (isDefault) await PaymentReceivingAccount.updateMany({ isDefault: true }, { $set: { isDefault: false, updatedBy: new Types.ObjectId(user.id) } });
  const account = await PaymentReceivingAccount.create({ accountCode, type: type as PaymentAccountType, displayName, upiId: upiId || null, bankName: bankName || null, accountHolderName, accountNumber: accountNumber || null, ifscCode: ifscCode || null, isActive: true, isDefault, createdBy: new Types.ObjectId(user.id), updatedBy: new Types.ObjectId(user.id) });
  await writeAudit({ actorUserId: user.id, action: 'PAYMENT_ACCOUNT_CREATED', resourceType: 'PaymentReceivingAccount', resourceId: account._id, afterSummary: { accountCode, type, displayName } });
  revalidatePath('/admin/payments/settings'); return { ok: true, id: account._id.toString(), message: 'Receiving account saved.' };
}

export async function updateReceivingAccountStatus(_previous: PaymentActionState, form: FormData): Promise<PaymentActionState> { const user = await requireRole(USER_ROLES.ADMIN); const id = oid(text(form, 'accountId')); const active = text(form, 'active') === 'true'; if (!id) return fail('Invalid receiving account.'); const account = await PaymentReceivingAccount.findByIdAndUpdate(id, { $set: { isActive: active, updatedBy: new Types.ObjectId(user.id), ...(active ? {} : { isDefault: false }) } }, { new: true }); if (!account) return fail('Receiving account not found.'); await writeAudit({ actorUserId: user.id, action: active ? 'PAYMENT_ACCOUNT_ACTIVATED' : 'PAYMENT_ACCOUNT_DEACTIVATED', resourceType: 'PaymentReceivingAccount', resourceId: account._id, afterSummary: { isActive: active } }); revalidatePath('/admin/payments/settings'); return { ok: true, message: `Receiving account ${active ? 'activated' : 'deactivated'}.` }; }

export async function setDefaultReceivingAccount(_previous: PaymentActionState, form: FormData): Promise<PaymentActionState> { const user = await requireRole(USER_ROLES.ADMIN); const id = oid(text(form, 'accountId')); if (!id) return fail('Invalid receiving account.'); const account = await PaymentReceivingAccount.findOne({ _id: id, isActive: true }); if (!account) return fail('Only an active receiving account can be the default.'); await PaymentReceivingAccount.updateMany({ isDefault: true }, { $set: { isDefault: false, updatedBy: new Types.ObjectId(user.id) } }); account.isDefault = true; account.updatedBy = new Types.ObjectId(user.id); await account.save(); await writeAudit({ actorUserId: user.id, action: 'PAYMENT_ACCOUNT_DEFAULT_SET', resourceType: 'PaymentReceivingAccount', resourceId: account._id }); revalidatePath('/admin/payments/settings'); return { ok: true, message: 'Default receiving account updated.' }; }

async function createPaymentForOwner(input: { user: { id: string; name: string; role: string }; clientId: Types.ObjectId; invoiceId: Types.ObjectId; amountMinor: number; method: PaymentMethod; channel?: BankTransferChannel | null; transactionReference: string; transactionDate: Date; accountId: Types.ObjectId; proofFileId?: Types.ObjectId | null; notes?: string | null; source: PaymentSource; status: PaymentStatus; }) {
  await connectDB();
  const [invoice, account] = await Promise.all([Invoice.findOne({ _id: input.invoiceId, clientId: input.clientId, status: INVOICE_STATUSES.ISSUED }).lean(), PaymentReceivingAccount.findOne({ _id: input.accountId, isActive: true }).select('+accountNumber').lean()]);
  if (!invoice) throw new Error('Eligible issued invoice not found.'); if (!account) throw new Error('Receiving account is not active.');
  if (input.amountMinor < 1 || input.amountMinor > invoice.amountDueMinor) throw new Error('Payment amount must not exceed the invoice outstanding balance.');
  if (invoice.currency.length !== 3) throw new Error('Invoice currency is invalid.');
  if (input.method === PAYMENT_METHODS.UPI && account.type !== PAYMENT_ACCOUNT_TYPES.UPI) throw new Error('Select an active UPI receiving account.');
  if (input.method === PAYMENT_METHODS.BANK_TRANSFER && account.type !== PAYMENT_ACCOUNT_TYPES.BANK) throw new Error('Select an active bank receiving account.');
  if (input.proofFileId) {
    const proof = await FileAsset.findOne({ _id: input.proofFileId, clientId: input.clientId, category: FILE_CATEGORIES.PAYMENT_PROOF, status: FILE_STATUSES.READY }).lean();
    if (!proof) throw new Error('Payment proof is invalid or not owned by this client.');
  }
  const normalized = normalizeTransactionReference(input.transactionReference); if (normalized.length < 4) throw new Error('Enter a valid transaction reference.');
  const duplicate = await Payment.exists({ receivingAccountId: account._id, normalizedTransactionReference: normalized, currency: invoice.currency, status: { $in: [PAYMENT_STATUSES.SUBMITTED, PAYMENT_STATUSES.UNDER_REVIEW, PAYMENT_STATUSES.VERIFIED] } });
  if (duplicate) throw new Error('This transaction reference is already in use for the selected receiving account.');
  const year = new Date().getUTCFullYear(); const paymentCode = await generateSequentialCode(`payment-${year}`, `PAY-${year}`);
  const mask = account.accountNumber ? `••••${account.accountNumber.slice(-4)}` : null;
  const payment = await Payment.create({ paymentCode, clientId: input.clientId, primaryInvoiceId: invoice._id, dealId: invoice.dealId ?? null, projectId: invoice.projectId ?? null, submittedBy: new Types.ObjectId(input.user.id), paymentMethod: input.method, bankTransferChannel: input.channel || null, paymentSource: input.source, amountMinor: input.amountMinor, currency: invoice.currency, transactionReference: input.transactionReference, normalizedTransactionReference: normalized, transactionDate: input.transactionDate, receivingAccountId: account._id, receivingAccountSnapshot: { accountCode: account.accountCode, type: account.type, displayName: account.displayName, upiId: account.upiId ?? null, bankName: account.bankName ?? null, accountHolderName: account.accountHolderName, maskedAccountNumber: mask, ifscCode: account.ifscCode ?? null }, proofFileAssetId: input.proofFileId ?? null, notes: input.notes ?? null, status: input.status, submittedAt: new Date() });
  await activity(payment._id, PAYMENT_ACTIVITY_TYPES.PAYMENT_SUBMITTED, input.user, input.source === PAYMENT_SOURCES.ADMIN_RECORDED ? 'Offline payment recorded by Admin.' : 'Payment details submitted for verification.');
  return payment;
}

export async function submitClientPayment(_previous: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  const user = await requireRole(USER_ROLES.CLIENT); const client = await requireClientProfile();
  const invoiceId = oid(text(form, 'invoiceId')); const accountId = oid(text(form, 'receivingAccountId')); const proofFileId = text(form, 'proofFileAssetId') ? oid(text(form, 'proofFileAssetId')) : null;
  const method = text(form, 'paymentMethod'); const channel = text(form, 'bankTransferChannel'); const amount = Number(text(form, 'amount')); const transactionReference = text(form, 'transactionReference'); const transactionDate = new Date(`${text(form, 'transactionDate')}T00:00:00.000Z`);
  if (!invoiceId || !accountId || (!Object.values(PAYMENT_METHODS).includes(method as never)) || !Number.isFinite(amount) || amount <= 0 || !transactionReference || Number.isNaN(transactionDate.getTime())) return fail('Complete all required payment fields.');
  if (transactionDate.getTime() > Date.now() + 86400000) return fail('Transaction date cannot be in the future.');
  if (method === PAYMENT_METHODS.BANK_TRANSFER && !Object.values(BANK_TRANSFER_CHANNELS).includes(channel as never)) return fail('Select a valid bank transfer channel.');
  try { const invoice = await Invoice.findById(invoiceId).select('currency').lean(); if (!invoice) return fail('Invoice not found.'); const payment = await createPaymentForOwner({ user, clientId: new Types.ObjectId(client.id), invoiceId, amountMinor: toMinorUnits(amount, invoice.currency), method: method as PaymentMethod, channel: (channel || null) as BankTransferChannel | null, transactionReference, transactionDate, accountId, proofFileId, notes: text(form, 'notes') || null, source: PAYMENT_SOURCES.CLIENT_SUBMITTED, status: PAYMENT_STATUSES.SUBMITTED });
    await writeAudit({ actorUserId: user.id, action: 'PAYMENT_SUBMITTED', resourceType: 'Payment', resourceId: payment._id, afterSummary: { paymentCode: payment.paymentCode, amountMinor: payment.amountMinor, currency: payment.currency } }); const admins = await User.find({ role: USER_ROLES.ADMIN, status: 'ACTIVE' }).select('_id').lean(); await Promise.all(admins.map((admin) => createNotification({ recipientUserId: admin._id, type: 'PAYMENT_SUBMITTED', title: 'Payment submitted', message: `${payment.paymentCode} is awaiting verification.`, resourceType: 'Payment', resourceId: payment._id, resourceUrl: `/admin/payments/${payment._id}`, idempotencyKey: `payment-submitted:${payment._id}:${admin._id}` })));
    revalidatePath('/client/payments'); revalidatePath('/admin/payments'); return { ok: true, id: payment._id.toString(), message: 'Payment submitted for verification.' };
  } catch (error) { return fail(error instanceof Error ? error.message : 'Payment submission failed.'); }
}

export async function recordOfflinePayment(_previous: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  const user = await requireRole(USER_ROLES.ADMIN); const invoiceId = oid(text(form, 'invoiceId')); const accountId = oid(text(form, 'receivingAccountId')); if (!invoiceId || !accountId) return fail('Select an invoice and receiving account.');
  const invoice = await Invoice.findById(invoiceId).lean(); if (!invoice) return fail('Invoice not found.'); const client = await Client.findById(invoice.clientId).lean(); if (!client) return fail('Client not found.');
  const amount = Number(text(form, 'amount')); const method = text(form, 'paymentMethod'); const transactionDate = new Date(`${text(form, 'transactionDate')}T00:00:00.000Z`);
  try { const payment = await createPaymentForOwner({ user, clientId: client._id, invoiceId, amountMinor: toMinorUnits(amount, invoice.currency), method: method as PaymentMethod, channel: (text(form, 'bankTransferChannel') || null) as BankTransferChannel | null, transactionReference: text(form, 'transactionReference'), transactionDate, accountId, notes: text(form, 'notes') || null, source: PAYMENT_SOURCES.ADMIN_RECORDED, status: PAYMENT_STATUSES.SUBMITTED }); revalidatePath('/admin/payments'); return { ok: true, id: payment._id.toString(), message: 'Offline payment recorded; verify it to settle the invoice.' }; } catch (error) { return fail(error instanceof Error ? error.message : 'Unable to record payment.'); }
}

export async function markPaymentUnderReview(_previous: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  const user = await requireRole(USER_ROLES.ADMIN); const paymentId = oid(text(form, 'paymentId')); if (!paymentId) return fail('Invalid payment.'); await connectDB(); const payment = await Payment.findOneAndUpdate({ _id: paymentId, status: PAYMENT_STATUSES.SUBMITTED }, { $set: { status: PAYMENT_STATUSES.UNDER_REVIEW } }, { new: true }); if (!payment) return fail('Only a newly submitted payment can be moved under review.'); await activity(payment._id, PAYMENT_ACTIVITY_TYPES.PAYMENT_UNDER_REVIEW, user, 'Payment review started.'); await writeAudit({ actorUserId: user.id, action: 'PAYMENT_UNDER_REVIEW', resourceType: 'Payment', resourceId: payment._id }); revalidatePath('/admin/payments'); revalidatePath(`/admin/payments/${payment._id}`); return { ok: true, message: 'Payment marked under review.' };
}

async function reconcileInvoice(invoiceId: Types.ObjectId, session?: ClientSession) {
  const invoice = await Invoice.findById(invoiceId, null, sessionOptions(session)); if (!invoice) throw new Error('Invoice not found during reconciliation.');
  const rows = await PaymentAllocation.aggregate([{ $match: { invoiceId, status: PAYMENT_ALLOCATION_STATUSES.ACTIVE } }, { $group: { _id: null, paid: { $sum: '$amountMinor' } } }]).session(session ?? null);
  const paid = Number(rows[0]?.paid ?? 0); if (paid > invoice.totalMinor) throw new Error('Allocations exceed the invoice total.'); const settlement = invoiceSettlement(invoice.totalMinor, paid);
  await Invoice.updateOne({ _id: invoiceId }, { $set: settlement }, sessionOptions(session));
}

async function createCommissionForAllocation(payment: { _id: Types.ObjectId; clientId: Types.ObjectId; dealId?: Types.ObjectId | null; currency: string }, allocation: { _id: Types.ObjectId; amountMinor: number }, session?: ClientSession) {
  const client = await Client.findById(payment.clientId).session(session ?? null).lean(); if (!client) return; const attributionUserId = client.marketingAttributionUserId ?? client.assignedMarketingUserId; if (!attributionUserId) return;
  const profile = await MarketingProfile.findOne({ userId: attributionUserId, status: 'ACTIVE' }).session(session ?? null).lean(); if (!profile || profile.commissionType === COMMISSION_TYPES.NONE || profile.commissionValue <= 0) return;
  const amount = profile.commissionType === COMMISSION_TYPES.PERCENTAGE ? percentageCommission(allocation.amountMinor, profile.commissionValue) : toMinorUnits(profile.commissionValue, payment.currency); if (amount <= 0) return;
  const year = new Date().getUTCFullYear(); const commissionCode = await generateSequentialCode(`commission-${year}`, `COM-${year}`, session);
  await MarketingCommission.updateOne({ paymentAllocationId: allocation._id, marketingUserId: attributionUserId }, { $setOnInsert: { commissionCode, marketingUserId: attributionUserId, clientId: client._id, leadId: client.originLeadId ?? null, dealId: payment.dealId ?? null, paymentId: payment._id, paymentAllocationId: allocation._id, commissionType: profile.commissionType, rateSnapshot: profile.commissionValue, baseAmountMinor: allocation.amountMinor, commissionAmountMinor: amount, currency: payment.currency, status: 'ELIGIBLE', paidAmountMinor: 0 } }, { upsert: true, ...sessionOptions(session) });
}

export async function verifyPayment(_previous: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  const user = await requireRole(USER_ROLES.ADMIN); const paymentId = oid(text(form, 'paymentId')); if (!paymentId) return fail('Invalid payment.'); await connectDB();
  try {
    await withOptionalTransaction(async (session) => {
      try {
      const payment = await Payment.findOne({ _id: paymentId, status: { $in: [PAYMENT_STATUSES.SUBMITTED, PAYMENT_STATUSES.UNDER_REVIEW] } }).session(session ?? null); if (!payment) throw new Error('Payment is no longer awaiting verification.');
      const duplicate = await Payment.exists({ _id: { $ne: payment._id }, receivingAccountId: payment.receivingAccountId, normalizedTransactionReference: payment.normalizedTransactionReference, currency: payment.currency, status: { $in: PROCESSED_PAYMENT_STATUSES } }).session(session ?? null); if (duplicate) throw new Error('A processed payment already uses this transaction reference.');
      let requested: Array<{ invoiceId: string; amountMinor: number }> = []; const raw = text(form, 'allocations'); if (raw) { try { requested = JSON.parse(raw); } catch { throw new Error('Allocation data is invalid.'); } } else requested = [{ invoiceId: payment.primaryInvoiceId.toString(), amountMinor: payment.amountMinor }];
      if (!Array.isArray(requested) || requested.length === 0 || requested.some((row) => !Types.ObjectId.isValid(row.invoiceId) || !Number.isSafeInteger(row.amountMinor) || row.amountMinor < 1) || requested.reduce((sum, row) => sum + row.amountMinor, 0) !== payment.amountMinor) throw new Error('Allocations must exactly equal the verified payment amount.');
      const uniqueIds = new Set(requested.map((row) => row.invoiceId)); if (uniqueIds.size !== requested.length) throw new Error('Each invoice may appear only once.');
      const receiptRows: Array<{ invoiceId: Types.ObjectId; invoiceNumber: string; amountMinor: number }> = []; const createdAllocations: Array<{ _id: Types.ObjectId; amountMinor: number }> = [];
      for (const row of requested) { const invoiceId = new Types.ObjectId(row.invoiceId); const invoice = await Invoice.findOne({ _id: invoiceId, clientId: payment.clientId, status: INVOICE_STATUSES.ISSUED, currency: payment.currency }).session(session ?? null); if (!invoice) throw new Error('An allocated invoice is not eligible.'); const existing = await PaymentAllocation.aggregate([{ $match: { invoiceId, status: PAYMENT_ALLOCATION_STATUSES.ACTIVE } }, { $group: { _id: null, total: { $sum: '$amountMinor' } } }]).session(session ?? null); if (Number(existing[0]?.total ?? 0) + row.amountMinor > invoice.totalMinor) throw new Error(`Allocation exceeds outstanding balance for ${invoice.invoiceNumber ?? invoice.invoiceCode}.`);
        const [allocation] = await PaymentAllocation.create([{ paymentId: payment._id, invoiceId, amountMinor: row.amountMinor, currency: payment.currency, status: PAYMENT_ALLOCATION_STATUSES.ACTIVE, allocatedBy: new Types.ObjectId(user.id), allocatedAt: new Date() }], sessionOptions(session)); createdAllocations.push({ _id: allocation._id, amountMinor: allocation.amountMinor }); receiptRows.push({ invoiceId, invoiceNumber: invoice.invoiceNumber ?? invoice.invoiceCode, amountMinor: row.amountMinor }); }
      const now = new Date(); const updated = await Payment.updateOne({ _id: payment._id, status: { $in: [PAYMENT_STATUSES.SUBMITTED, PAYMENT_STATUSES.UNDER_REVIEW] } }, { $set: { status: PAYMENT_STATUSES.VERIFIED, verifiedBy: new Types.ObjectId(user.id), verifiedAt: now, verificationNotes: text(form, 'verificationNotes') || null, bankStatementReference: text(form, 'bankStatementReference') || null } }, sessionOptions(session)); if (updated.modifiedCount !== 1) throw new Error('Payment was verified by another request.');
      for (const row of requested) await reconcileInvoice(new Types.ObjectId(row.invoiceId), session);
      const client = await Client.findById(payment.clientId).session(session ?? null).lean(); if (!client) throw new Error('Client not found.'); const settings = await BillingSetting.findOne({ key: 'primary' }).session(session ?? null).lean(); const year = now.getUTCFullYear(); const receiptCode = await generateSequentialCode(`receipt-${year}`, `RCT-${year}`, session);
      await PaymentReceipt.create([{ receiptCode, paymentId: payment._id, clientId: payment.clientId, allocationSnapshot: receiptRows, receiptAmountMinor: payment.amountMinor, currency: payment.currency, sellerSnapshot: { companyName: settings?.companyName ?? companyProfile.displayName, legalName: settings?.legalName ?? companyProfile.legalName, address: (settings?.address ?? companyProfile.registeredAddress) || null, email: (settings?.email ?? companyProfile.email) || null, phone: (settings?.phone ?? companyProfile.phone) || null, website: (settings?.website ?? companyProfile.website) || null, taxId: (settings?.taxRegistrationNumber ?? companyProfile.taxId) || null }, customerSnapshot: { clientCode: client.clientCode, clientName: client.name, companyName: client.companyName ?? null, email: client.email, phone: client.phone ?? null, billingAddress: client.billingAddress ?? null }, paymentMethod: payment.paymentMethod, transactionReference: payment.transactionReference, transactionDate: payment.transactionDate, verifiedBy: new Types.ObjectId(user.id), verifiedAt: now, issuedAt: now, issuedBy: new Types.ObjectId(user.id), pdfGeneratedAt: now, status: PAYMENT_RECEIPT_STATUSES.AVAILABLE }], sessionOptions(session));
      for (const allocation of createdAllocations) await createCommissionForAllocation(payment, allocation, session);
      await activity(payment._id, PAYMENT_ACTIVITY_TYPES.PAYMENT_ALLOCATED, user, 'Payment allocations recorded.', { allocationCount: createdAllocations.length }, session);
      await activity(payment._id, PAYMENT_ACTIVITY_TYPES.RECEIPT_CREATED, user, 'Receipt created.', { receiptCode }, session);
      await activity(payment._id, PAYMENT_ACTIVITY_TYPES.PAYMENT_VERIFIED, user, 'Payment verified and allocated.', { receiptCode }, session);
      } catch (error) {
        if (!session) {
          const allocations = await PaymentAllocation.find({ paymentId }).select('invoiceId').lean();
          await Promise.all([
            PaymentAllocation.deleteMany({ paymentId }),
            PaymentReceipt.deleteMany({ paymentId }),
            MarketingCommission.deleteMany({ paymentId }),
            PaymentActivity.deleteMany({ paymentId, activityType: { $in: [PAYMENT_ACTIVITY_TYPES.PAYMENT_VERIFIED, PAYMENT_ACTIVITY_TYPES.PAYMENT_ALLOCATED, PAYMENT_ACTIVITY_TYPES.RECEIPT_CREATED] } }),
            Payment.updateOne(
              { _id: paymentId, status: PAYMENT_STATUSES.VERIFIED },
              {
                $set: { status: PAYMENT_STATUSES.SUBMITTED },
                $unset: { verifiedBy: 1, verifiedAt: 1, verificationNotes: 1, bankStatementReference: 1 },
              }
            ),
          ]);
          for (const allocation of allocations) await reconcileInvoice(allocation.invoiceId);
        }
        throw error;
      }
    });
    const payment = await Payment.findById(paymentId).lean(); if (payment) { await writeAudit({ actorUserId: user.id, action: 'PAYMENT_VERIFIED', resourceType: 'Payment', resourceId: paymentId, afterSummary: { paymentCode: payment.paymentCode, amountMinor: payment.amountMinor, currency: payment.currency } }); const client = await Client.findById(payment.clientId).lean(); if (client?.userId) await createNotification({ recipientUserId: client.userId, type: 'PAYMENT_VERIFIED', title: 'Payment verified', message: `${payment.paymentCode} has been verified.`, resourceType: 'Payment', resourceId: payment._id, resourceUrl: `/client/payments/${payment._id}`, idempotencyKey: `payment-verified:${payment._id}` }); }
    revalidatePath('/admin/payments'); revalidatePath('/admin/billing'); revalidatePath('/client/invoices'); return { ok: true, id: paymentId.toString(), message: 'Payment verified and receipt created.' };
  } catch (error) { return fail(error instanceof Error ? error.message : 'Verification failed.'); }
}

export async function rejectPayment(_previous: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  const user = await requireRole(USER_ROLES.ADMIN); const paymentId = oid(text(form, 'paymentId')); const reason = text(form, 'reason'); if (!paymentId || reason.length < 3) return fail('A rejection reason is required.');
  const payment = await Payment.findOneAndUpdate({ _id: paymentId, status: { $in: [PAYMENT_STATUSES.SUBMITTED, PAYMENT_STATUSES.UNDER_REVIEW] } }, { $set: { status: PAYMENT_STATUSES.REJECTED, rejectedBy: new Types.ObjectId(user.id), rejectedAt: new Date(), rejectionReason: reason } }, { new: true }); if (!payment) return fail('Payment is no longer awaiting review.');
  await activity(payment._id, PAYMENT_ACTIVITY_TYPES.PAYMENT_REJECTED, user, 'Payment rejected.', { reason }); await writeAudit({ actorUserId: user.id, action: 'PAYMENT_REJECTED', resourceType: 'Payment', resourceId: payment._id, afterSummary: { reason } }); const client = await Client.findById(payment.clientId).select('userId').lean(); if (client?.userId) await createNotification({ recipientUserId: client.userId, type: 'PAYMENT_REJECTED', title: 'Payment rejected', message: `${payment.paymentCode} was rejected. Review the reason and submit corrected details.`, resourceType: 'Payment', resourceId: payment._id, resourceUrl: `/client/payments/${payment._id}`, idempotencyKey: `payment-rejected:${payment._id}` }); revalidatePath('/admin/payments'); revalidatePath('/client/payments'); return { ok: true, message: 'Payment rejected.' };
}

export async function reversePayment(_previous: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  const user = await requireRole(USER_ROLES.ADMIN); const paymentId = oid(text(form, 'paymentId')); const reason = text(form, 'reason'); if (!paymentId || reason.length < 5) return fail('A reversal reason is required.');
  try { await withOptionalTransaction(async (session) => { const payment = await Payment.findOne({ _id: paymentId, status: PAYMENT_STATUSES.VERIFIED }).session(session ?? null); if (!payment) throw new Error('Only a verified payment can be reversed.'); const allocations = await PaymentAllocation.find({ paymentId, status: PAYMENT_ALLOCATION_STATUSES.ACTIVE }).session(session ?? null); const now = new Date(); const updated = await Payment.updateOne({ _id: paymentId, status: PAYMENT_STATUSES.VERIFIED }, { $set: { status: PAYMENT_STATUSES.REVERSED, reversedBy: new Types.ObjectId(user.id), reversedAt: now, reversalReason: reason } }, sessionOptions(session)); if (updated.modifiedCount !== 1) throw new Error('Payment was already reversed.'); await PaymentAllocation.updateMany({ paymentId, status: PAYMENT_ALLOCATION_STATUSES.ACTIVE }, { $set: { status: PAYMENT_ALLOCATION_STATUSES.REVERSED, reversedAt: now, reversalReason: reason } }, sessionOptions(session)); await PaymentReceipt.updateOne({ paymentId }, { $set: { status: PAYMENT_RECEIPT_STATUSES.INVALIDATED, invalidatedAt: now, invalidationReason: reason } }, sessionOptions(session)); await MarketingCommission.updateMany({ paymentId }, { $set: { status: 'ADJUSTED' } }, sessionOptions(session)); for (const allocation of allocations) await reconcileInvoice(allocation.invoiceId, session); await activity(payment._id, PAYMENT_ACTIVITY_TYPES.PAYMENT_REVERSED, user, 'Payment reversed.', { reason }, session); }); await writeAudit({ actorUserId: user.id, action: 'PAYMENT_REVERSED', resourceType: 'Payment', resourceId: paymentId, afterSummary: { reason } }); const reversed = await Payment.findById(paymentId).select('clientId paymentCode').lean(); if (reversed) { const client = await Client.findById(reversed.clientId).select('userId').lean(); if (client?.userId) await createNotification({ recipientUserId: client.userId, type: 'PAYMENT_REVERSED', title: 'Payment reversed', message: `${reversed.paymentCode} was reversed.`, resourceType: 'Payment', resourceId: paymentId, resourceUrl: `/client/payments/${paymentId}`, idempotencyKey: `payment-reversed:${paymentId}` }); } revalidatePath('/admin/payments'); revalidatePath('/admin/billing'); return { ok: true, message: 'Payment reversal recorded and invoice balances reconciled.' }; } catch (error) { return fail(error instanceof Error ? error.message : 'Reversal failed.'); }
}
