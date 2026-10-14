import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceSettlement, normalizeTransactionReference, percentageCommission, PROCESSED_PAYMENT_STATUSES } from '../src/lib/payments/core.ts';
import { INVOICE_PAYMENT_STATUSES } from '../src/lib/constants/enums.ts';
import { applyPercentage, fromMinorUnits, toMinorUnits } from '../src/lib/utils/money.ts';

test('money is represented in integer minor units', () => {
  assert.equal(toMinorUnits(10000, 'INR'), 1000000);
  assert.equal(fromMinorUnits(1500000, 'INR'), 15000);
  assert.equal(applyPercentage(2000000, 10), 200000);
});
test('invoice partial settlement never produces a negative balance', () => {
  assert.deepEqual(invoiceSettlement(3000000, 1500000), { amountPaidMinor: 1500000, amountDueMinor: 1500000, paymentStatus: INVOICE_PAYMENT_STATUSES.PARTIALLY_PAID });
  assert.equal(invoiceSettlement(3000000, 4000000).amountDueMinor, 0);
});
test('invoice settlement distinguishes unpaid and paid', () => {
  assert.equal(invoiceSettlement(3000000, 0).paymentStatus, INVOICE_PAYMENT_STATUSES.UNPAID);
  assert.equal(invoiceSettlement(3000000, 3000000).paymentStatus, INVOICE_PAYMENT_STATUSES.PAID);
});
test('transaction references normalize safely', () => assert.equal(normalizeTransactionReference(' 4123-4567 8901 '), '412345678901'));
test('percentage commission rounds in minor units', () => {
  assert.equal(percentageCommission(2000000, 10), 200000);
  assert.equal(percentageCommission(101, 2.5), 3);
});
test('verified and reversed payments reserve a transaction reference', () => {
  assert.deepEqual([...PROCESSED_PAYMENT_STATUSES], ['VERIFIED', 'REVERSED']);
});
