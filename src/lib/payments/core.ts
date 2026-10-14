import { INVOICE_PAYMENT_STATUSES, PAYMENT_STATUSES } from '../constants/enums.ts';

export const PROCESSED_PAYMENT_STATUSES = [
  PAYMENT_STATUSES.VERIFIED,
  PAYMENT_STATUSES.REVERSED,
] as const;

export function normalizeTransactionReference(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function invoiceSettlement(totalMinor: number, paidMinor: number) {
  const safePaid = Math.max(0, Math.min(totalMinor, Math.trunc(paidMinor)));
  return { amountPaidMinor: safePaid, amountDueMinor: Math.max(0, totalMinor - safePaid), paymentStatus: safePaid === 0 ? INVOICE_PAYMENT_STATUSES.UNPAID : safePaid >= totalMinor ? INVOICE_PAYMENT_STATUSES.PAID : INVOICE_PAYMENT_STATUSES.PARTIALLY_PAID };
}

export function percentageCommission(baseAmountMinor: number, percentage: number): number {
  if (!Number.isSafeInteger(baseAmountMinor) || baseAmountMinor < 0 || !Number.isFinite(percentage) || percentage < 0) throw new Error('Invalid commission inputs.');
  return Math.round((baseAmountMinor * percentage) / 100);
}
