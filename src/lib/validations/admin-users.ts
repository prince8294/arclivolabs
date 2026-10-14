import { z } from 'zod';

import { PASSWORD_POLICY } from '../auth/config.ts';
import {
  COMMISSION_TYPES,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYMENT_TYPES,
  PAYMENT_TYPES,
  USER_STATUS,
} from '../constants/enums.ts';
import { isPhone } from './common.ts';

/**
 * Validation schemas for the admin management of internal users
 * (EMPLOYEE and MARKETING accounts).
 *
 * These are the authority: every server action re-validates raw
 * FormData through these schemas before touching the database.
 * Forms always submit strings; the transforms here normalize them into
 * the exact shapes the models expect.
 */

/* ------------------------------------------------------------------ */
/* Shared pieces                                                      */
/* ------------------------------------------------------------------ */

/** Name: 2–100 chars after trimming. */
const nameSchema = z
  .string()
  .trim()
  .min(2, 'Enter the full name.')
  .max(100, 'Name is too long (max 100 characters).');

/** Login identifier: trimmed + lowercased before any uniqueness check. */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required.')
  .max(254, 'Email is too long.')
  .email('Enter a valid email address.');

/**
 * Optional phone. Deliberately NOT globally unique (shared office
 * numbers are allowed); email is the unique login identifier.
 */
const optionalPhoneSchema = z
  .string()
  .trim()
  .max(20, 'Phone is too long.')
  .refine((value) => value === '' || isPhone(value), {
    message: 'Enter a valid phone number (international formats allowed).',
  })
  .transform((value) => (value === '' ? null : value));

/**
 * Optional non-negative decimal amount, submitted as a form string.
 * Empty string → undefined (field left blank).
 */
const optionalAmountSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (value === '') {
      return true;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }, {
    message: 'Enter a valid non-negative amount.',
  })
  .transform((value) => (value === '' ? undefined : Number(value)));

/** A calendar date submitted as `YYYY-MM-DD` from an input[type=date]. */
const joiningDateSchema = z
  .coerce.date({ error: 'Enter a valid date.' })
  .refine((value) => !Number.isNaN(value.getTime()), {
    message: 'Enter a valid date.',
  })
  .refine(
    (value) => {
      const year = value.getUTCFullYear();
      return year >= 1970 && year <= 2100;
    },
    { message: 'Enter a valid joining date.' }
  );

/** Narrow a string field to one of the values of a domain enum. */
function enumField<T extends Record<string, string>>(
  values: T,
  message: string
): z.ZodType<T[keyof T]> {
  const allowed = Object.values(values) as string[];
  return z
    .string()
    .refine((value) => allowed.includes(value), { message }) as unknown as z.ZodType<
      T[keyof T]
    >;
}

/** Skills arrive as a comma-separated string; leave max 25 items. */
const skillsSchema = z
  .string()
  .trim()
  .max(500, 'Please list fewer skills.')
  .transform((value) =>
    value
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 25)
  );

const notesSchema = z
  .string()
  .trim()
  .max(2000, 'Notes are limited to 2000 characters.')
  .transform((value) => (value === '' ? null : value));

/* ------------------------------------------------------------------ */
/* Password pairs                                                     */
/* ------------------------------------------------------------------ */

const passwordSchema = z
  .string()
  .min(PASSWORD_POLICY.MIN_LENGTH, 'Password must be at least 8 characters.')
  .max(
    PASSWORD_POLICY.MAX_LENGTH,
    'Password must be at most 72 characters.'
  );

const passwordPairShape = {
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirm the password.'),
};

function validatePasswordPair(minField?: 'password') {
  return (
    data: { password: string; confirmPassword: string },
    ctx: z.RefinementCtx
  ) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: [minField ?? 'confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  };
}

/**
 * A password + confirmation pair. The two are always validated together
 * so no caller can accept a mismatched pair.
 */
export function passwordPairSchema(minField?: 'password') {
  return z
    .object(passwordPairShape)
    .superRefine(validatePasswordPair(minField));
}

/* ------------------------------------------------------------------ */
/* Employee                                                           */
/* ------------------------------------------------------------------ */

export const employeeProfileSchema = z.object({
  department: enumField(EMPLOYEE_DEPARTMENTS, 'Select a department.'),
  designation: z
    .string()
    .trim()
    .min(1, 'Designation is required.')
    .max(100, 'Designation is too long.'),
  employmentType: enumField(EMPLOYMENT_TYPES, 'Select an employment type.'),
  joiningDate: joiningDateSchema,
  paymentType: enumField(PAYMENT_TYPES, 'Select a payment type.'),
  baseAmount: optionalAmountSchema,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, 'Enter a 3-letter currency code (e.g. INR).'),
  skills: skillsSchema,
  address: z
    .string()
    .trim()
    .max(500, 'Address is too long (max 500 characters).')
    .transform((value) => (value === '' ? null : value)),
  emergencyContact: optionalPhoneSchema,
  notes: notesSchema,
});

/** Create = account fields + temporary password + profile. */
export const employeeCreateSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: optionalPhoneSchema,
    ...passwordPairShape,
    ...employeeProfileSchema.shape,
  })
  .superRefine(validatePasswordPair());

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;

/**
 * Update = same account + profile fields, no password. The role is never
 * part of the schema, so it cannot be changed through this path.
 */
export const employeeUpdateSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: optionalPhoneSchema,
    ...employeeProfileSchema.shape,
  })
  ;

export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

/* ------------------------------------------------------------------ */
/* Marketing                                                          */
/* ------------------------------------------------------------------ */

/**
 * Commission value rules:
 * - PERCENTAGE: 0–100
 * - FIXED:      any non-negative amount
 * - NONE:       normalized to 0 by the action (ignored here)
 * No commission calculations happen at this layer.
 */
const marketingProfileBaseSchema = z.object({
    designation: z
      .string()
      .trim()
      .min(1, 'Designation is required.')
      .max(100, 'Designation is too long.'),
    joiningDate: joiningDateSchema,
    commissionType: enumField(COMMISSION_TYPES, 'Select a commission type.'),
    commissionValue: z
      .string()
      .trim()
      .refine((value) => {
        const parsed = Number(value);
        return (
          value !== '' && Number.isFinite(parsed) && parsed >= 0
        );
      }, { message: 'Enter a valid non-negative commission value.' })
      .transform((value) => Number(value)),
    target: optionalAmountSchema,
    notes: notesSchema,
  });

function validateMarketingProfile(
  data: z.infer<typeof marketingProfileBaseSchema>,
  ctx: z.RefinementCtx
) {
    if (
      data.commissionType === COMMISSION_TYPES.PERCENTAGE &&
      (data.commissionValue < 0 || data.commissionValue > 100)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['commissionValue'],
        message: 'Percentage commission must be between 0 and 100.',
      });
    }
}

export const marketingProfileSchema = marketingProfileBaseSchema.superRefine(
  validateMarketingProfile
);

/** Create = account fields + temporary password + profile. */
export const marketingCreateSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: optionalPhoneSchema,
    ...passwordPairShape,
    ...marketingProfileBaseSchema.shape,
  })
  .superRefine(validatePasswordPair())
  .superRefine(validateMarketingProfile);

export type MarketingCreateInput = z.infer<typeof marketingCreateSchema>;

/** Update = account + profile fields, no password. */
export const marketingUpdateSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: optionalPhoneSchema,
    ...marketingProfileBaseSchema.shape,
  })
  .superRefine(validateMarketingProfile);

export type MarketingUpdateInput = z.infer<typeof marketingUpdateSchema>;

/* ------------------------------------------------------------------ */
/* Account-level operations                                           */
/* ------------------------------------------------------------------ */

/** Admin can only move internal (EMPLOYEE / MARKETING) accounts. */
export const userStatusSchema = z.object({
  id: z.string().min(24, 'Invalid record id.'),
  status: enumField(USER_STATUS, 'Select a status.'),
});

export type UserStatusInput = z.infer<typeof userStatusSchema>;

/**
 * Admin-driven password reset. Reuses the shared password pair so the
 * policy (min 8 / max 72) and the match check stay in one place.
 */
export const passwordResetSchema = z
  .object({
    id: z.string().min(24, 'Invalid record id.'),
    ...passwordPairShape,
  })
  .superRefine(validatePasswordPair('password'));

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

/* ------------------------------------------------------------------ */
/* Action state shared by admin user forms                            */
/* ------------------------------------------------------------------ */

export interface AdminUserActionState {
  /** True when the mutation succeeded (client can refresh + close). */
  ok?: boolean;
  /** Short success message shown where useful. */
  message?: string;
  /** Generic, safe error banner text (never database internals). */
  error?: string;
  /** First error per form field, for inline validation. */
  fieldErrors?: Record<string, string>;
}

export const INITIAL_ADMIN_USER_STATE: AdminUserActionState = {};
