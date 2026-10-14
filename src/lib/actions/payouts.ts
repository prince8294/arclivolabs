'use server';
import { revalidatePath } from 'next/cache'; import { Types } from 'mongoose';
import { requireRole } from '@/lib/auth/authorization'; import { USER_ROLES } from '@/types/auth'; import { COMMISSION_STATUSES, EMPLOYEE_PAYOUT_TYPES, OUTGOING_PAYMENT_STATUSES } from '@/lib/constants/enums'; import { generateSequentialCode } from '@/lib/db/generate-code'; import { toMinorUnits } from '@/lib/utils/money'; import { MarketingCommission } from '@/models/MarketingCommission'; import { CommissionPayout } from '@/models/CommissionPayout'; import { EmployeePayment } from '@/models/EmployeePayment'; import { Employee } from '@/models/Employee'; import { writeAudit } from '@/lib/audit/log'; import { createNotification } from '@/lib/notifications/create';
import connectDB from '@/lib/db/mongoose'; import { withOptionalTransaction } from '@/lib/db/transaction';
export interface PayoutActionState { ok: boolean; error?: string; message?: string; id?: string; } const fail = (error: string): PayoutActionState => ({ ok: false, error }); const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function updateCommissionStatus(_previous: PayoutActionState, form: FormData): Promise<PayoutActionState> { const user = await requireRole(USER_ROLES.ADMIN); const id = text(form, 'commissionId'); const action = text(form, 'action'); if (!Types.ObjectId.isValid(id) || !['APPROVE', 'HOLD', 'CANCEL'].includes(action)) return fail('Invalid commission action.'); const status = action === 'APPROVE' ? COMMISSION_STATUSES.APPROVED : action === 'HOLD' ? COMMISSION_STATUSES.ON_HOLD : COMMISSION_STATUSES.CANCELLED; const allowed = action === 'APPROVE' ? [COMMISSION_STATUSES.ELIGIBLE, COMMISSION_STATUSES.ON_HOLD] : [COMMISSION_STATUSES.ELIGIBLE, COMMISSION_STATUSES.APPROVED, COMMISSION_STATUSES.ON_HOLD]; const commission = await MarketingCommission.findOneAndUpdate({ _id: id, status: { $in: allowed } }, { $set: { status, ...(status === COMMISSION_STATUSES.APPROVED ? { approvedBy: new Types.ObjectId(user.id), approvedAt: new Date() } : {}) } }, { new: true }); if (!commission) return fail('Commission cannot make that transition.'); await writeAudit({ actorUserId: user.id, action: `COMMISSION_${status}`, resourceType: 'MarketingCommission', resourceId: commission._id, afterSummary: { status } }); if (status === COMMISSION_STATUSES.APPROVED) await createNotification({ recipientUserId: commission.marketingUserId, type: 'COMMISSION_APPROVED', title: 'Commission approved', message: `${commission.commissionCode} was approved.`, resourceType: 'MarketingCommission', resourceId: commission._id, resourceUrl: `/marketing/commissions/${commission._id}`, idempotencyKey: `commission-approved:${commission._id}` }); revalidatePath('/admin/commissions'); revalidatePath('/marketing/commissions'); return { ok: true, message: `Commission ${status.toLowerCase()}.` }; }

export async function recordCommissionPayout(
  _previous: PayoutActionState,
  form: FormData
): Promise<PayoutActionState> {
  const user = await requireRole(USER_ROLES.ADMIN);
  const id = text(form, 'commissionId');
  const amountMajor = Number(text(form, 'amount'));
  const reference = text(form, 'transactionReference');
  const paidAt = new Date(text(form, 'paidAt'));

  if (
    !Types.ObjectId.isValid(id) ||
    !Number.isFinite(amountMajor) ||
    amountMajor <= 0 ||
    reference.length < 3 ||
    Number.isNaN(paidAt.getTime())
  ) {
    return fail('Complete valid payout details.');
  }

  try {
    const result = await withOptionalTransaction(async (session) => {
      const commission = await MarketingCommission.findOne({
        _id: id,
        status: {
          $in: [COMMISSION_STATUSES.APPROVED, COMMISSION_STATUSES.PARTIALLY_PAID],
        },
      }).session(session ?? null);
      if (!commission) throw new Error('Commission is not approved for payout.');

      const amountMinor = toMinorUnits(amountMajor, commission.currency);
      const nextPaidAmount = commission.paidAmountMinor + amountMinor;
      if (nextPaidAmount > commission.commissionAmountMinor) {
        throw new Error('Payout exceeds the remaining commission.');
      }

      const year = new Date().getUTCFullYear();
      const payoutCode = await generateSequentialCode(
        `commission-payout-${year}`,
        `CPO-${year}`,
        session
      );
      const [payout] = await CommissionPayout.create(
        [
          {
            payoutCode,
            commissionId: commission._id,
            marketingUserId: commission.marketingUserId,
            amountMinor,
            currency: commission.currency,
            paymentMethod: text(form, 'paymentMethod'),
            transactionReference: reference,
            paidAt,
            recordedBy: new Types.ObjectId(user.id),
            notes: text(form, 'notes') || null,
          },
        ],
        session ? { session } : undefined
      );

      try {
        const nextStatus =
          nextPaidAmount === commission.commissionAmountMinor
            ? COMMISSION_STATUSES.PAID
            : COMMISSION_STATUSES.PARTIALLY_PAID;
        const updated = await MarketingCommission.findOneAndUpdate(
          {
            _id: commission._id,
            paidAmountMinor: commission.paidAmountMinor,
            status: commission.status,
          },
          { $set: { paidAmountMinor: nextPaidAmount, status: nextStatus } },
          { new: true, ...(session ? { session } : {}) }
        );
        if (!updated) {
          throw new Error('Commission changed while the payout was being recorded. Try again.');
        }

        return {
          payoutId: payout._id,
          payoutCode,
          commissionId: commission._id,
          marketingUserId: commission.marketingUserId,
          amountMinor,
          status: nextStatus,
        };
      } catch (error) {
        // Standalone MongoDB cannot transact, so undo the primary insert if
        // the guarded commission update loses a race or fails.
        if (!session) await CommissionPayout.deleteOne({ _id: payout._id });
        throw error;
      }
    });

    await writeAudit({
      actorUserId: user.id,
      action: 'COMMISSION_PAID',
      resourceType: 'MarketingCommission',
      resourceId: result.commissionId,
      afterSummary: {
        payoutCode: result.payoutCode,
        amountMinor: result.amountMinor,
        status: result.status,
      },
    });
    await createNotification({
      recipientUserId: result.marketingUserId,
      type: 'COMMISSION_PAID',
      title: 'Commission payout recorded',
      message: `${result.payoutCode} has been recorded.`,
      resourceType: 'CommissionPayout',
      resourceId: result.payoutId,
      resourceUrl: '/marketing/commissions',
      idempotencyKey: `commission-payout:${result.payoutId}`,
    });
    revalidatePath('/admin/commissions');
    revalidatePath('/marketing/commissions');
    return {
      ok: true,
      id: result.payoutId.toString(),
      message: 'Commission payout recorded.',
    };
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: number }).code === 11000) {
      return fail('This outgoing transaction was already recorded.');
    }
    return fail(error instanceof Error ? error.message : 'Unable to record payout.');
  }
}

export async function createEmployeePayment(_previous: PayoutActionState, form: FormData): Promise<PayoutActionState> { const user = await requireRole(USER_ROLES.ADMIN); const employeeUserId = text(form, 'employeeUserId'); const paymentType = text(form, 'paymentType'); const gross = Number(text(form, 'grossAmount')); const adjustments = Number(text(form, 'adjustments') || '0'); const currency = text(form, 'currency').toUpperCase(); const paymentPeriod = text(form, 'paymentPeriod'); if (!Types.ObjectId.isValid(employeeUserId) || !Object.values(EMPLOYEE_PAYOUT_TYPES).includes(paymentType as never) || !Number.isFinite(gross) || gross < 0 || !Number.isFinite(adjustments) || !/^\w{3}$/.test(currency) || !paymentPeriod) return fail('Complete valid employee payment fields.'); const employee = await Employee.exists({ userId: employeeUserId }); if (!employee) return fail('Employee profile not found.'); const grossMinor = toMinorUnits(gross, currency); const adjustmentsMinor = toMinorUnits(adjustments, currency); const netAmountMinor = grossMinor + adjustmentsMinor; if (netAmountMinor < 0) return fail('Net payment cannot be negative.'); try { const year = new Date().getUTCFullYear(); const paymentCode = await generateSequentialCode(`employee-payment-${year}`, `EPM-${year}`); const payment = await EmployeePayment.create({ paymentCode, employeeUserId: new Types.ObjectId(employeeUserId), paymentPeriod, paymentType, grossAmountMinor: grossMinor, adjustmentsMinor, netAmountMinor, currency, status: OUTGOING_PAYMENT_STATUSES.DRAFT, recordedBy: new Types.ObjectId(user.id), notes: text(form, 'notes') || null }); revalidatePath('/admin/employee-payments'); return { ok: true, id: payment._id.toString(), message: 'Employee payment draft created.' }; } catch (error) { return fail(error instanceof Error && 'code' in error && (error as { code?: number }).code === 11000 ? 'A payment for this employee, period and type already exists.' : 'Unable to create payment.'); } }

export async function approveEmployeePayment(_previous: PayoutActionState, form: FormData): Promise<PayoutActionState> { const user = await requireRole(USER_ROLES.ADMIN); const id = text(form, 'paymentId'); if (!Types.ObjectId.isValid(id)) return fail('Invalid employee payment.'); const payment = await EmployeePayment.findOneAndUpdate({ _id: id, status: OUTGOING_PAYMENT_STATUSES.DRAFT }, { $set: { status: OUTGOING_PAYMENT_STATUSES.APPROVED, approvedBy: new Types.ObjectId(user.id), approvedAt: new Date() } }, { new: true }); if (!payment) return fail('Payment is no longer a draft.'); await writeAudit({ actorUserId: user.id, action: 'EMPLOYEE_PAYMENT_APPROVED', resourceType: 'EmployeePayment', resourceId: payment._id }); revalidatePath('/admin/employee-payments'); return { ok: true, message: 'Employee payment approved.' }; }

export async function recordEmployeePayment(_previous: PayoutActionState, form: FormData): Promise<PayoutActionState> { const user = await requireRole(USER_ROLES.ADMIN); const id = text(form, 'paymentId'); const reference = text(form, 'transactionReference'); const paidAt = new Date(text(form, 'paidAt')); if (!Types.ObjectId.isValid(id) || reference.length < 3 || Number.isNaN(paidAt.getTime())) return fail('Complete valid payment details.'); try { const payment = await EmployeePayment.findOneAndUpdate({ _id: id, status: OUTGOING_PAYMENT_STATUSES.APPROVED }, { $set: { status: OUTGOING_PAYMENT_STATUSES.PAID, paymentMethod: text(form, 'paymentMethod'), transactionReference: reference, paidAt, recordedBy: new Types.ObjectId(user.id) } }, { new: true }); if (!payment) return fail('Payment is not approved or was already recorded.'); await writeAudit({ actorUserId: user.id, action: 'EMPLOYEE_PAYMENT_RECORDED', resourceType: 'EmployeePayment', resourceId: payment._id, afterSummary: { transactionReference: reference, paidAt: paidAt.toISOString() } }); await createNotification({ recipientUserId: payment.employeeUserId, type: 'EMPLOYEE_PAYMENT_RECORDED', title: 'Payment recorded', message: `${payment.paymentCode} has been marked paid.`, resourceType: 'EmployeePayment', resourceId: payment._id, resourceUrl: `/employee/payments/${payment._id}`, idempotencyKey: `employee-payment-paid:${payment._id}` }); revalidatePath('/admin/employee-payments'); revalidatePath('/employee/payments'); return { ok: true, message: 'Employee payment recorded.' }; } catch (error) { return fail(error instanceof Error && 'code' in error && (error as { code?: number }).code === 11000 ? 'This transaction reference was already used.' : 'Unable to record payment.'); } }

export async function reverseCommissionPayout(_previous: PayoutActionState, form: FormData): Promise<PayoutActionState> { const user = await requireRole(USER_ROLES.ADMIN); const id = text(form, 'payoutId'); const reason = text(form, 'reason'); if (!Types.ObjectId.isValid(id) || reason.length < 5) return fail('Provide a valid payout and reversal reason.'); try { await connectDB(); let commissionId: Types.ObjectId | null = null; let marketingUserId: Types.ObjectId | null = null; await withOptionalTransaction(async (session) => { const payout = await CommissionPayout.findOneAndUpdate({ _id: id, reversedAt: null }, { $set: { reversedAt: new Date(), reversedBy: new Types.ObjectId(user.id), reversalReason: reason } }, { new: true, session }); if (!payout) throw new Error('Payout is already reversed or was not found.'); commissionId = payout.commissionId; marketingUserId = payout.marketingUserId; const commission = await MarketingCommission.findOneAndUpdate({ _id: payout.commissionId, paidAmountMinor: { $gte: payout.amountMinor } }, { $inc: { paidAmountMinor: -payout.amountMinor } }, { new: true, session }); if (!commission) throw new Error('Commission payout total could not be reconciled.'); if (commission.status !== COMMISSION_STATUSES.ADJUSTED) { commission.status = commission.paidAmountMinor === 0 ? COMMISSION_STATUSES.APPROVED : COMMISSION_STATUSES.PARTIALLY_PAID; await commission.save({ session }); } }); await writeAudit({ actorUserId: user.id, action: 'COMMISSION_PAYOUT_REVERSED', resourceType: 'CommissionPayout', resourceId: id, afterSummary: { reason, commissionId } }); if (marketingUserId) await createNotification({ recipientUserId: marketingUserId, type: 'COMMISSION_PAYOUT_REVERSED', title: 'Commission payout reversed', message: `A commission payout was reversed: ${reason}`, resourceType: 'CommissionPayout', resourceId: id, resourceUrl: '/marketing/commissions', idempotencyKey: `commission-payout-reversed:${id}` }); revalidatePath('/admin/commissions'); revalidatePath('/admin/commissions/payouts'); revalidatePath('/marketing/commissions'); return { ok: true, message: 'Commission payout reversed and totals reconciled.' }; } catch (error) { return fail(error instanceof Error ? error.message : 'Unable to reverse payout.'); } }

export async function correctEmployeePayment(_previous: PayoutActionState, form: FormData): Promise<PayoutActionState> { const user = await requireRole(USER_ROLES.ADMIN); const id = text(form, 'paymentId'); const gross = Number(text(form, 'grossAmount')); const adjustments = Number(text(form, 'adjustments') || '0'); const reason = text(form, 'reason'); if (!Types.ObjectId.isValid(id) || !Number.isFinite(gross) || gross < 0 || !Number.isFinite(adjustments) || reason.length < 5) return fail('Provide valid corrected amounts and a reason.'); const existing = await EmployeePayment.findOne({ _id: id, status: OUTGOING_PAYMENT_STATUSES.DRAFT }); if (!existing) return fail('Only a draft payment can be corrected.'); const grossAmountMinor = toMinorUnits(gross, existing.currency); const adjustmentsMinor = toMinorUnits(adjustments, existing.currency); const netAmountMinor = grossAmountMinor + adjustmentsMinor; if (netAmountMinor < 0) return fail('Net payment cannot be negative.'); const payment = await EmployeePayment.findOneAndUpdate({ _id: id, status: OUTGOING_PAYMENT_STATUSES.DRAFT }, { $set: { grossAmountMinor, adjustmentsMinor, netAmountMinor, correctionReason: reason, correctedAt: new Date(), correctedBy: new Types.ObjectId(user.id) } }, { new: true }); if (!payment) return fail('Payment changed before correction was saved.'); await writeAudit({ actorUserId: user.id, action: 'EMPLOYEE_PAYMENT_CORRECTED', resourceType: 'EmployeePayment', resourceId: payment._id, afterSummary: { grossAmountMinor, adjustmentsMinor, netAmountMinor, reason } }); revalidatePath(`/admin/employee-payments/${id}`); return { ok: true, message: 'Draft payment corrected.' }; }

export async function reverseEmployeePayment(_previous: PayoutActionState, form: FormData): Promise<PayoutActionState> { const user = await requireRole(USER_ROLES.ADMIN); const id = text(form, 'paymentId'); const reason = text(form, 'reason'); if (!Types.ObjectId.isValid(id) || reason.length < 5) return fail('Provide a valid paid record and reversal reason.'); const payment = await EmployeePayment.findOneAndUpdate({ _id: id, status: OUTGOING_PAYMENT_STATUSES.PAID }, { $set: { status: OUTGOING_PAYMENT_STATUSES.REVERSED, reversedAt: new Date(), reversedBy: new Types.ObjectId(user.id), reversalReason: reason } }, { new: true }); if (!payment) return fail('Only a paid record can be reversed once.'); await writeAudit({ actorUserId: user.id, action: 'EMPLOYEE_PAYMENT_REVERSED', resourceType: 'EmployeePayment', resourceId: payment._id, afterSummary: { reason } }); await createNotification({ recipientUserId: payment.employeeUserId, type: 'EMPLOYEE_PAYMENT_REVERSED', title: 'Payment record reversed', message: `${payment.paymentCode} was reversed: ${reason}`, resourceType: 'EmployeePayment', resourceId: payment._id, resourceUrl: `/employee/payments/${payment._id}`, idempotencyKey: `employee-payment-reversed:${payment._id}` }); revalidatePath('/admin/employee-payments'); revalidatePath('/employee/payments'); return { ok: true, message: 'Employee payment reversed.' }; }
