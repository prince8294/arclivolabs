import test from 'node:test';
import assert from 'node:assert/strict';

import {
  employeeCreateSchema,
  marketingCreateSchema,
  passwordResetSchema,
} from '../src/lib/validations/admin-users.ts';
import {
  COMMISSION_TYPES,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYMENT_TYPES,
  PAYMENT_TYPES,
} from '../src/lib/constants/enums.ts';

const account = {
  name: 'Test User',
  email: 'test.user@example.com',
  phone: '',
  password: 'temporary-passphrase',
  confirmPassword: 'temporary-passphrase',
};

test('employee create schema composes password and profile validation', () => {
  const validInput = {
    ...account,
    department: EMPLOYEE_DEPARTMENTS.WEB_DEVELOPMENT,
    designation: 'Developer',
    employmentType: EMPLOYMENT_TYPES.FULL_TIME,
    joiningDate: '2026-10-07',
    paymentType: PAYMENT_TYPES.MONTHLY,
    baseAmount: '50000',
    currency: 'INR',
    skills: 'TypeScript, Next.js',
    address: '',
    emergencyContact: '',
    notes: '',
  };
  const valid = employeeCreateSchema.safeParse(validInput);
  assert.equal(valid.success, true);

  const mismatch = employeeCreateSchema.safeParse({
    ...validInput,
    password: 'temporary-passphrase',
    confirmPassword: 'different-passphrase',
  });
  assert.equal(mismatch.success, false);
});

test('marketing schema preserves percentage commission refinement', () => {
  const common = {
    ...account,
    designation: 'Sales Executive',
    joiningDate: '2026-10-07',
    commissionType: COMMISSION_TYPES.PERCENTAGE,
    target: '',
    notes: '',
  };
  assert.equal(
    marketingCreateSchema.safeParse({ ...common, commissionValue: '10' }).success,
    true
  );
  assert.equal(
    marketingCreateSchema.safeParse({ ...common, commissionValue: '101' }).success,
    false
  );
});

test('password reset schema rejects mismatched confirmation', () => {
  assert.equal(
    passwordResetSchema.safeParse({
      id: '000000000000000000000001',
      password: 'temporary-passphrase',
      confirmPassword: 'different-passphrase',
    }).success,
    false
  );
});
