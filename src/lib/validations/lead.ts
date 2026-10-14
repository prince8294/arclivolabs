import { z } from 'zod';

import {
  CURRENCIES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LOST_REASONS,
  type LeadSource,
  type LeadStatus,
} from '@/lib/constants/enums';
import { isEmail, isPhone, normalizeWebsite, zodFieldErrors } from './common';

/**
 * Validation schemas for CRM leads.
 *
 * These are the authority: every lead server action re-validates raw
 * FormData through them before touching MongoDB. Forms always submit
 * strings (or repeated field names for multi-value inputs); the
 * transforms below normalize them into the exact shapes the Lead model
 * expects, so the model never has to guess.
 *
 * Two flavours exist on purpose:
 * - Admin schemas include `source`, `status` and `assignedTo`.
 * - Marketing schemas deliberately omit `source` (acquisition
 *   attribution stays admin-owned after creation) and `assignedTo`
 *   (a marketing user can only work their own leads). A field that is
 *   absent from the schema simply cannot be forged through the form.
 */

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

/** Individual field schemas — exported so CSV import can reuse them. */
export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Enter the contact name.')
  .max(100, 'Contact name is too long (max 100 characters).');

export const companyNameSchema = z
  .string()
  .trim()
  .max(200, 'Company name is too long (max 200 characters).')
  .transform((value) => (value === '' ? null : value));

/**
 * Optional email: trimmed + lowercased, never unique — a lead is only a
 * candidate record, so the same address may legitimately appear twice.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long.')
  .refine((value) => value === '' || isEmail(value), {
    message: 'Enter a valid email address.',
  })
  .transform((value) => (value === '' ? null : value));

export const phoneSchema = z
  .string()
  .trim()
  .max(20, 'Phone number is too long.')
  .refine((value) => value === '' || isPhone(value), {
    message: 'Enter a valid phone number (international formats allowed).',
  })
  .transform((value) => (value === '' ? null : value));

/**
 * Bare domains are accepted and normalized to an absolute https URL by
 * `normalizeWebsite`, so `example.com` is stored (and rendered) as a
 * working link instead of failing validation or crashing the UI.
 */
export const websiteSchema = z
  .string()
  .trim()
  .max(200, 'Website is too long (max 200 characters).')
  .refine((value) => value === '' || normalizeWebsite(value) !== '', {
    message: 'Enter a valid website, for example example.com.',
  })
  .transform((value) => {
    const normalized = normalizeWebsite(value);
    return normalized === '' ? null : normalized;
  });

/** Zero, one or many Service references, from repeated form fields. */
export const serviceInterestSchema = z
  .array(z.string().trim())
  .max(10, 'Select up to 10 services.')
  .refine(
    (ids) => ids.every((id) => id === '' || OBJECT_ID_PATTERN.test(id)),
    { message: 'Invalid service reference.' }
  )
  .transform((ids) => [
    ...new Set(ids.map((id) => id.trim()).filter((id) => id !== '')),
  ]);

export const estimatedBudgetSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (value === '') {
      return true;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }, {
    message: 'Enter a valid non-negative budget.',
  })
  .transform((value) => (value === '' ? null : Number(value)));

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => (CURRENCIES as readonly string[]).includes(value), {
    message: 'Select a supported currency.',
  });

export const notesSchema = z
  .string()
  .trim()
  .max(4000, 'Notes are limited to 4000 characters.')
  .transform((value) => (value === '' ? null : value));

export const LEAD_FIELDS = [
  'name',
  'companyName',
  'email',
  'phone',
  'alternatePhone',
  'website',
  'serviceInterest',
  'estimatedBudget',
  'currency',
  'notes',
] as const;

export const ADMIN_LEAD_FIELDS = [
  ...LEAD_FIELDS,
  'source',
  'status',
  'assignedTo',
  'nextFollowUpAt',
] as const;

/** Fields a marketing user submits when creating a lead. */
export const MARKETING_LEAD_FIELDS = [
  ...LEAD_FIELDS,
  'source',
  'nextFollowUpAt',
] as const;

/** Narrow a submitted string to one of the values of a domain enum. */
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

const objectIdField = (message: string) =>
  z.string().trim().refine((value) => OBJECT_ID_PATTERN.test(value), { message });

/**
 * A follow-up is submitted as `datetime-local` (`YYYY-MM-DDTHH:mm`), which
 * JavaScript parses in local time. The result is a real Date, persisted as
 * UTC by MongoDB. Free text like "tomorrow 2 PM" is never accepted.
 */
const nextFollowUpSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),
    { message: 'Enter a valid follow-up date and time.' }
  )
  .transform((value) => (value === '' ? null : new Date(value)))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), {
    message: 'Enter a valid follow-up date and time.',
  })
  .refine(
    (value) =>
      value === null ||
      (value.getUTCFullYear() >= 1970 && value.getUTCFullYear() <= 2100),
    { message: 'Enter a valid follow-up date and time.' }
  );

/** Assignment is `null` (unassigned pool) or a 24-char ObjectId. */
const assignedToSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .refine((value) => value === null || OBJECT_ID_PATTERN.test(value), {
    message: 'Select a valid marketing user.',
  });

const lostReasonSchema = enumField(
  LOST_REASONS,
  'Select a loss reason.'
).or(z.literal(''));

const lostReasonNoteSchema = z
  .string()
  .trim()
  .max(500, 'Reason detail is limited to 500 characters.')
  .transform((value) => (value === '' ? null : value));

/** Fields shared by every create and update payload. */
const coreShape = {
  name: nameSchema,
  companyName: companyNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  alternatePhone: phoneSchema,
  website: websiteSchema,
  serviceInterest: serviceInterestSchema,
  estimatedBudget: estimatedBudgetSchema,
  currency: currencySchema,
  notes: notesSchema,
};

/**
 * Enforces the business rule that a lead must be reachable: at least one
 * of email or phone. Both may be supplied; neither is individually
 * mandatory.
 */
function requireContactMethod(
  data: { email?: string | null; phone?: string | null },
  ctx: z.RefinementCtx
): void {
  if (!data.email && !data.phone) {
    ctx.addIssue({
      code: 'custom',
      path: ['email'],
      message: 'Provide at least an email address or phone number.',
    });
  }
}

/* ------------------------------------------------------------------ */
/* Create                                                            */
/* ------------------------------------------------------------------ */

/** Shape shared by both roles' create payloads. */
const leadCreateBaseShape = {
  ...coreShape,
  source: enumField(LEAD_SOURCES, 'Select a lead source.'),
  nextFollowUpAt: nextFollowUpSchema,
};

/**
 * Admin create payload. Admin may choose the pipeline status and the
 * owning marketing user (or leave it in the unassigned pool).
 */
export const leadCreateSchema = z
  .object({
    ...leadCreateBaseShape,
    status: enumField(LEAD_STATUSES, 'Select a valid lead status.'),
    assignedTo: assignedToSchema,
  })
  .superRefine(requireContactMethod);

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

/**
 * Marketing create payload. `assignedTo`, `createdBy` and the starting
 * status are forced to the current user / NEW by the server action, so
 * they never appear here and cannot be forged through the form.
 */
export const marketingLeadCreateSchema = z
  .object(leadCreateBaseShape)
  .superRefine(requireContactMethod);

export type MarketingLeadCreateInput = z.infer<
  typeof marketingLeadCreateSchema
>;

/** Normalized new-lead payload both create variants collapse into. */
export type NewLeadPayload = z.infer<typeof marketingLeadCreateSchema>;

/* ------------------------------------------------------------------ */
/* Update                                                            */
/* ------------------------------------------------------------------ */

/** Admin edit: everything except `leadCode` / `createdBy` (immutable). */
export const leadUpdateSchema = z
  .object({
    id: objectIdField('Invalid lead reference.'),
    ...coreShape,
    source: enumField(LEAD_SOURCES, 'Select a lead source.'),
    status: enumField(LEAD_STATUSES, 'Select a valid lead status.'),
    assignedTo: assignedToSchema,
    nextFollowUpAt: nextFollowUpSchema,
    lostReason: lostReasonSchema,
    lostReasonNote: lostReasonNoteSchema,
  })
  .superRefine(requireContactMethod);

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

/**
 * Marketing edit of an assigned lead. No `source` (acquisition
 * attribution stays with admin) and no `assignedTo` (a marketing user
 * cannot hand work to another marketing user).
 */
export const marketingLeadUpdateSchema = z
  .object({
    id: objectIdField('Invalid lead reference.'),
    ...coreShape,
    status: enumField(LEAD_STATUSES, 'Select a valid lead status.'),
    nextFollowUpAt: nextFollowUpSchema,
    lostReason: lostReasonSchema,
    lostReasonNote: lostReasonNoteSchema,
  })
  .superRefine(requireContactMethod);

export type MarketingLeadUpdateInput = z.infer<
  typeof marketingLeadUpdateSchema
>;

/* ------------------------------------------------------------------ */
/* Focused mutations                                                 */
/* ------------------------------------------------------------------ */

/** Quick status change from the list or detail page. */
export const leadStatusSchema = z.object({
  id: objectIdField('Invalid lead reference.'),
  status: enumField(LEAD_STATUSES, 'Select a valid lead status.'),
  lostReason: lostReasonSchema,
  lostReasonNote: lostReasonNoteSchema,
});

export type LeadStatusInput = z.infer<typeof leadStatusSchema>;

/** Admin assign / reassign / unassign. `assignedTo: ''` means unassign. */
export const leadAssignmentSchema = z.object({
  id: objectIdField('Invalid lead reference.'),
  assignedTo: assignedToSchema,
});

export type LeadAssignmentInput = z.infer<typeof leadAssignmentSchema>;

/* ------------------------------------------------------------------ */
/* Action state                                                      */
/* ------------------------------------------------------------------ */

export interface DuplicateLeadHint {
  leadCode: string;
  name: string;
  companyName: string | null;
  status: LeadStatus;
  createdAt: string;
}

export interface LeadActionState {
  /** True when the mutation succeeded (the client can refresh). */
  ok?: boolean;
  message?: string;
  /** Generic, safe error banner text (never database internals). */
  error?: string;
  /** First error per form field, for inline validation. */
  fieldErrors?: Record<string, string>;
  /**
   * Advisory duplicate warning. Never blocks creation on its own — the
   * form offers an explicit "create anyway" submission instead.
   */
  warning?: string;
  duplicates?: DuplicateLeadHint[];
}

export const INITIAL_LEAD_STATE: LeadActionState = {};

export function leadFieldErrors(
  error: z.ZodError,
  fields: readonly string[]
): Record<string, string> {
  return zodFieldErrors(error, fields);
}

export type { LeadSource, LeadStatus };