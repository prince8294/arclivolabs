import { z } from 'zod';

import {
  ACCEPTANCE_METHODS,
  DEAL_CODE_PATTERN,
  DEFAULT_TERMS,
  DELIVERY_METHODS,
  DISCOUNT_TYPES,
  PROPOSAL_LIMITS,
  PROPOSAL_PAGE_SIZE_DEFAULT,
  PROPOSAL_PAGE_SIZES,
  PROPOSAL_CODE_PATTERN,
  PROPOSAL_REQUEST_CODE_PATTERN,
  PROPOSAL_REQUEST_STATUSES,
  PROPOSAL_SORTS,
  PROPOSAL_STATUSES,
  REJECTION_REASONS,
  REQUEST_PRIORITIES,
  REVISION_REQUEST_STATUSES,
  TERMS_FIELDS,
  TERMS_FIELD_LABELS,
  type ProposalStatus,
  type TermsField,
} from '@/lib/constants/proposals';
import { CURRENCIES } from '@/lib/constants/enums';
import { enumField, isNonEmptyString } from '@/lib/validations/common';

/**
 * Validation schemas for proposals, versions, requests and deals.
 *
 * These are the authority for every Part 9 mutation. Two rules matter most:
 *
 * 1. NO TOTAL IS EVER ACCEPTED FROM THE BROWSER. Schemas parse line
 *    items, discounts, tax rates and milestones only; the grand total,
 *    subtotal, line totals and milestone amounts are produced by the server
 *    pricing engine.
 * 2. OWNERSHIP AND STATUS ARE CHECKED AGAINST THE DATABASE, not here. These
 *    schemas validate shape; the server actions verify that the record
 *    exists, that the caller may touch it, and that the status transition
 *    is legal.
 */

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const optionalObjectId = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' || value === undefined ? null : value))
  .refine((value) => value === null || OBJECT_ID_PATTERN.test(value as string), {
    message: 'Invalid record id.',
  });

/** Split a textarea into a trimmed, non-empty list (one item per line). */
export function parseLines(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split('\n')
    .map((line) => line.replace(/\s+$/g, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, PROPOSAL_LIMITS.MAX_SCOPE_FEATURES);
}

/**
 * Money as entered by a user: a non-negative decimal, bounded, and NOT
 * trusted for any total. `finite` rejects NaN so "abc" never becomes 0
 * silently in a priced line.
 */
const amountSchema = z
  .number({ message: 'Enter a valid amount.' })
  .finite('Enter a valid amount.')
  .min(0, 'Amount cannot be negative.')
  .max(PROPOSAL_LIMITS.MAX_AMOUNT, 'Amount is too large.');

const quantitySchema = z
  .number({ message: 'Enter a valid quantity.' })
  .finite('Enter a valid quantity.')
  .positive('Quantity must be greater than zero.')
  .max(1_000_000, 'Quantity is unrealistically large.');

const currencySchema = enumField(CURRENCIES, 'Choose a supported currency.');

const percentSchema = z
  .number({ message: 'Enter a valid percentage.' })
  .finite('Enter a valid percentage.')
  .min(0, 'Percentage cannot be negative.')
  .max(100, 'Percentage cannot be above 100.');

const discountTypeSchema = enumField(DISCOUNT_TYPES, 'Choose a discount type.');

const longText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long (max ${max} characters).`)
    .transform((value) => (value === '' ? null : value));

/* -------------------------------------------------------------------------- */
/* Shared action state                                                         */
/* -------------------------------------------------------------------------- */

export interface ProposalActionState {
  ok: boolean;
  /** Set on success: the record id the page should navigate to. */
  id?: string;
  /** Human confirmation message. */
  message?: string;
  /** Generic failure text (safe to show). */
  error?: string;
  fieldErrors?: Record<string, string>;
}

export const INITIAL_PROPOSAL_STATE: ProposalActionState = { ok: false };

/* -------------------------------------------------------------------------- */
/* Line items                                                                  */
/* -------------------------------------------------------------------------- */

export const lineItemInputSchema = z.object({
  serviceId: optionalObjectId,
  serviceName: z
    .string()
    .trim()
    .min(1, 'Service name is required.')
    .max(150, 'Service name is too long.'),
  description: longText(2000, 'Description'),
  quantity: quantitySchema,
  unit: z
    .string()
    .trim()
    .min(1, 'Unit is required.')
    .max(40, 'Unit is too long.'),
  unitPrice: amountSchema,
  discountType: discountTypeSchema,
  discountValue: z.number().finite('Enter a valid discount.').min(0, 'Discount cannot be negative.').max(
    PROPOSAL_LIMITS.MAX_AMOUNT,
    'Discount is too large.'
  ),
  taxRatePercent: z
    .number()
    .finite('Enter a valid tax rate.')
    .min(0, 'Tax rate cannot be negative.')
    .max(100, 'Tax rate cannot be above 100.')
    .optional()
    .nullable(),
});

export type LineItemInput = z.infer<typeof lineItemInputSchema>;

export const lineItemsSchema = z
  .array(lineItemInputSchema)
  .min(1, 'Add at least one line item.')
  .max(PROPOSAL_LIMITS.MAX_LINE_ITEMS, 'Too many line items.');

/* -------------------------------------------------------------------------- */
/* Payment milestones                                                          */
/* -------------------------------------------------------------------------- */

export const paymentMilestoneInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Milestone name is required.')
    .max(150, 'Milestone name is too long.'),
  /** Reuses the discount vocabulary: NONE | FIXED | PERCENTAGE. */
  type: discountTypeSchema,
  /** FIXED -> minor units, PERCENTAGE -> percent. Validated server-side. */
  value: z.number().finite('Enter a valid milestone value.').min(0, 'Milestone value cannot be negative.'),
  condition: longText(1000, 'Condition'),
  /** `YYYY-MM-DD`, optional. */
  dueDate: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: 'Enter a valid date.',
    })
    .transform((value) => (value === '' || value === undefined ? null : value)),
});

export type PaymentMilestoneInput = z.infer<typeof paymentMilestoneInputSchema>;

export const paymentMilestonesSchema = z
  .array(paymentMilestoneInputSchema)
  .max(PROPOSAL_LIMITS.MAX_PAYMENT_MILESTONES, 'Too many payment milestones.');

/* -------------------------------------------------------------------------- */
/* Delivery milestones / scope lists                                           */
/* -------------------------------------------------------------------------- */

export const deliveryMilestoneInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Milestone name is required.')
    .max(200, 'Milestone name is too long.'),
  description: longText(1000, 'Description'),
});

/* -------------------------------------------------------------------------- */
/* Create / update proposal draft                                               */
/* -------------------------------------------------------------------------- */

const commercialBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Enter a proposal title.')
    .max(PROPOSAL_LIMITS.MAX_TITLE, 'Title is too long.'),
  description: longText(PROPOSAL_LIMITS.MAX_LONG_TEXT, 'Description'),
  overview: longText(PROPOSAL_LIMITS.MAX_LONG_TEXT, 'Project overview'),

  /* Scope of work */
  scopeSummary: longText(PROPOSAL_LIMITS.MAX_LONG_TEXT, 'Scope summary'),
  includedFeatures: longText(PROPOSAL_LIMITS.MAX_LONG_TEXT, 'Included features'),
  excludedFeatures: longText(PROPOSAL_LIMITS.MAX_LONG_TEXT, 'Excluded features'),
  dependencies: longText(PROPOSAL_LIMITS.MAX_LONG_TEXT, 'Dependencies'),
  customerResponsibilities: longText(PROPOSAL_LIMITS.MAX_LONG_TEXT, 'Customer responsibilities'),
  deliverables: longText(PROPOSAL_LIMITS.MAX_LONG_TEXT, 'Deliverables'),

  /* Schedule */
  estimatedDuration: z
    .string()
    .trim()
    .max(200, 'Duration is too long.')
    .transform((value) => (value === '' ? null : value)),
  expectedStartDate: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: 'Enter a valid start date.',
    })
    .transform((value) => (value === '' || value === undefined ? null : value)),
  deliveryConditions: longText(3000, 'Delivery conditions'),
  revisionAllowance: z
    .string()
    .trim()
    .max(500, 'Revision allowance is too long.')
    .transform((value) => (value === '' ? null : value)),
  supportPeriod: z
    .string()
    .trim()
    .max(500, 'Support period is too long.')
    .transform((value) => (value === '' ? null : value)),
  deliveryMilestonesJson: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) {
        return [] as Array<{ name: string; description: string | null }>;
      }
      try {
        const parsed: unknown = JSON.parse(value);
        const result = z
          .array(deliveryMilestoneInputSchema)
          .max(PROPOSAL_LIMITS.MAX_MILESTONES, 'Too many delivery milestones.')
          .safeParse(parsed);
        if (!result.success) {
          ctx.addIssue({
            code: 'custom',
            message: 'One of the delivery milestones is invalid.',
          });
          return z.NEVER;
        }
        return result.data;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Could not read the delivery milestones.' });
        return z.NEVER;
      }
    }),

  /* Commercial terms */
  currency: currencySchema,
  discountType: discountTypeSchema,
  discountValue: z.number().finite('Enter a valid discount.').min(0, 'Discount cannot be negative.'),
  taxEnabled: z.boolean(),
  taxRatePercent: percentSchema,
  taxLabel: z
    .string()
    .trim()
    .max(80, 'Tax label is too long.')
    .transform((value) => (value === '' ? null : value)),

  /* Payment plan */
  hasPaymentPlan: z.boolean(),
  paymentMilestonesJson: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) {
        return [] as PaymentMilestoneInput[];
      }
      try {
        const parsed: unknown = JSON.parse(value);
        const result = paymentMilestonesSchema.safeParse(parsed);
        if (!result.success) {
          ctx.addIssue({ code: 'custom', message: 'One of the payment milestones is invalid.' });
          return z.NEVER;
        }
        return result.data;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Could not read the payment milestones.' });
        return z.NEVER;
      }
    }),

  /* Validity */
  /** `YYYY-MM-DD`. Required before a version can be issued. */
  validUntil: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: 'Enter a valid validity date.',
    })
    .transform((value) => (value === '' || value === undefined ? null : value)),

    /**
     * Terms clauses arrive as `term_<field>` inputs. Every one is optional:
     * an empty clause is omitted from the PDF rather than printed as a blank
     * heading. No clause is ever invented server-side.
     */
    terms: z.object(
      Object.fromEntries(
        TERMS_FIELDS.map((field) => [
          field,
          longText(3000, TERMS_FIELD_LABELS[field]),
        ])
      ) as unknown as Record<TermsField, z.ZodType<string | null>>
    ),

  /** Internal-only. Never rendered in a customer PDF. */
  internalNotes: longText(PROPOSAL_LIMITS.MAX_NOTES, 'Internal notes'),
  changeSummary: longText(2000, 'Change summary'),
});

export type CommercialBodyInput = z.infer<typeof commercialBodySchema>;

export const createProposalSchema = commercialBodySchema.extend({
  /** Exactly one target. Both, or neither, is rejected. */
  leadId: optionalObjectId,
  clientId: optionalObjectId,
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;

export const updateProposalDraftSchema = commercialBodySchema.extend({
  proposalId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid proposal id.'),
  versionId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid version id.'),
});

export type UpdateProposalDraftInput = z.infer<typeof updateProposalDraftSchema>;

/* -------------------------------------------------------------------------- */
/* Lifecycle actions                                                           */
/* -------------------------------------------------------------------------- */

const proposalIdSchema = z.string().regex(OBJECT_ID_PATTERN, 'Invalid proposal id.');
const versionIdSchema = z.string().regex(OBJECT_ID_PATTERN, 'Invalid version id.');

export const submitForApprovalSchema = z.object({
  proposalId: proposalIdSchema,
  versionId: versionIdSchema,
});

export const approveProposalSchema = z.object({
  proposalId: proposalIdSchema,
  versionId: versionIdSchema,
  /** Set when the admin approves and issues in one step. */
  issueNow: z.boolean().optional(),
});

export const issueProposalSchema = z.object({
  proposalId: proposalIdSchema,
  versionId: versionIdSchema,
});

export const markProposalSentSchema = z.object({
  proposalId: proposalIdSchema,
  versionId: versionIdSchema,
  deliveryMethod: enumField(DELIVERY_METHODS, 'Choose how it was delivered.'),
  recipient: z
    .string()
    .trim()
    .min(1, 'Record who received the quotation.')
    .max(150, 'Recipient name is too long.'),
  recipientDetail: z
    .string()
    .trim()
    .max(200, 'Recipient detail is too long.')
    .transform((value) => (value === '' ? null : value)),
  deliveredAt: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: 'Enter a valid delivery date.',
    })
    .transform((value) => (value === '' || value === undefined ? null : value)),
  notes: longText(2000, 'Notes'),
});

export const createRevisionSchema = z.object({
  proposalId: proposalIdSchema,
  /** The issued version the revision starts from. */
  fromVersionId: versionIdSchema,
  changeSummary: z
    .string()
    .trim()
    .min(3, 'Describe what changes in this revision.')
    .max(2000, 'Change summary is too long.'),
});

export const cancelProposalSchema = z.object({
  proposalId: proposalIdSchema,
  versionId: versionIdSchema,
  reason: z
    .string()
    .trim()
    .min(3, 'Record why the proposal was cancelled.')
    .max(1000, 'Reason is too long.'),
});

export const recordAcceptanceSchema = z.object({
  proposalId: proposalIdSchema,
  versionId: versionIdSchema,
  acceptedBy: z
    .string()
    .trim()
    .min(2, 'Record who accepted the offer.')
    .max(150, 'Name is too long.'),
  acceptanceMethod: enumField(ACCEPTANCE_METHODS, 'Choose how the customer confirmed.'),
  /** ISO date of the confirmation (may be back-dated). */
  acceptedAt: z
    .string()
    .trim()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: 'Enter the acceptance date.',
    }),
  evidence: z
    .string()
    .trim()
    .max(1000, 'Evidence reference is too long.')
    .transform((value) => (value === '' ? null : value)),
  notes: longText(2000, 'Notes'),
});

export const recordRejectionSchema = z.object({
  proposalId: proposalIdSchema,
  versionId: versionIdSchema,
  reason: enumField(REJECTION_REASONS, 'Choose a rejection reason.'),
  reasonNote: z
    .string()
    .trim()
    .max(1000, 'Reason note is too long.')
    .transform((value) => (value === '' ? null : value)),
  customerFeedback: longText(2000, 'Customer feedback'),
  rejectedAt: z
    .string()
    .trim()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: 'Enter the rejection date.',
    }),
});

export const finalizeDealSchema = z.object({
  proposalId: proposalIdSchema,
  versionId: versionIdSchema,
  agreementReference: z
    .string()
    .trim()
    .max(200, 'Agreement reference is too long.')
    .transform((value) => (value === '' ? null : value)),
  notes: longText(PROPOSAL_LIMITS.MAX_NOTES, 'Notes'),
});

export const cancelDealSchema = z.object({
  dealId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid deal id.'),
  reason: z
    .string()
    .trim()
    .min(3, 'Record why the deal was cancelled.')
    .max(1000, 'Reason is too long.'),
});

/* -------------------------------------------------------------------------- */
/* Marketing requests                                                          */
/* -------------------------------------------------------------------------- */

export const createProposalRequestSchema = z
  .object({
    leadId: optionalObjectId,
    clientId: optionalObjectId,
    requestedServicesJson: z
      .string()
      .optional()
      .transform((value, ctx) => {
        if (!value) {
          return [] as string[];
        }
        try {
          const parsed: unknown = JSON.parse(value);
          const result = z
            .array(z.string().trim().min(1).max(150))
            .max(20, 'Too many services requested.')
            .safeParse(parsed);
          if (!result.success) {
            ctx.addIssue({ code: 'custom', message: 'One of the requested services is invalid.' });
            return z.NEVER;
          }
          return result.data;
        } catch {
          ctx.addIssue({ code: 'custom', message: 'Could not read the requested services.' });
          return z.NEVER;
        }
      }),
    requirements: longText(PROPOSAL_LIMITS.MAX_LONG_TEXT, 'Requirements'),
    expectedBudget: z
      .number({ message: 'Enter a valid expected budget.' })
      .finite('Enter a valid expected budget.')
      .min(0, 'Expected budget cannot be negative.')
      .max(PROPOSAL_LIMITS.MAX_AMOUNT, 'Expected budget is too large.'),
    currency: currencySchema,
    expectedTimeline: z
      .string()
      .trim()
      .max(300, 'Timeline is too long.')
      .transform((value) => (value === '' ? null : value)),
    customerNotes: longText(2000, 'Customer notes'),
    priority: enumField(REQUEST_PRIORITIES, 'Choose a priority.'),
  })
  .refine((value) => Boolean(value.leadId) !== Boolean(value.clientId), {
    message: 'Select exactly one lead or client.',
    path: ['leadId'],
  });

export type CreateProposalRequestInput = z.infer<typeof createProposalRequestSchema>;

export const reviewProposalRequestSchema = z.object({
  requestId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid request id.'),
  status: enumField(
    {
      IN_REVIEW: PROPOSAL_REQUEST_STATUSES.IN_REVIEW,
      DECLINED: PROPOSAL_REQUEST_STATUSES.DECLINED,
    },
    'Choose a status.'
  ),
  adminNotes: longText(2000, 'Admin notes'),
});

export const createRevisionRequestSchema = z
  .object({
    proposalId: proposalIdSchema,
    requestedChanges: z
      .string()
      .trim()
      .min(3, 'Describe the changes you are asking for.')
      .max(3000, 'Requested changes are too long.'),
    reason: z
      .string()
      .trim()
      .max(1000, 'Reason is too long.')
      .transform((value) => (value === '' ? null : value)),
    customerFeedback: longText(2000, 'Customer feedback'),
    requestedBudget: z
      .number()
      .finite('Enter a valid requested budget.')
      .min(0, 'Requested budget cannot be negative.')
      .max(PROPOSAL_LIMITS.MAX_AMOUNT, 'Requested budget is too large.')
      .optional(),
  })
  .refine((value) => value.requestedBudget !== undefined || value.requestedChanges.length > 3, {
    message: 'Describe the changes or enter a requested budget.',
    path: ['requestedChanges'],
  });

export const resolveRevisionRequestSchema = z.object({
  revisionRequestId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid request id.'),
  status: enumField(
    {
      ADDRESSED: REVISION_REQUEST_STATUSES.ADDRESSED,
      DECLINED: REVISION_REQUEST_STATUSES.DECLINED,
    },
    'Choose an outcome.'
  ),
  adminResponse: longText(2000, 'Response'),
  /** Version created to address the request (required when ADDRESSED). */
  resolvedVersion: z
    .number()
    .finite('Enter a valid version number.')
    .int('Version must be a whole number.')
    .min(1)
    .optional(),
});

/* -------------------------------------------------------------------------- */
/* List parameters                                                             */
/* -------------------------------------------------------------------------- */

export const PROPOSAL_PAGE_SIZE_VALUES = PROPOSAL_PAGE_SIZES;
export const PROPOSAL_DEFAULT_PAGE_SIZE = PROPOSAL_PAGE_SIZE_DEFAULT;

export const proposalStatusSchema = enumField(
  PROPOSAL_STATUSES,
  'Invalid status.'
) as z.ZodType<ProposalStatus>;

export const proposalSortSchema = enumField(PROPOSAL_SORTS, 'Invalid sort.');

/* -------------------------------------------------------------------------- */
/* Term defaults                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Starter clause text keyed by the terms field name. Returned as a plain
 * object so the terms editor can pre-fill a new draft; the admin can edit
 * or clear every value.
 */
export function defaultTermsRecord(): Record<string, string> {
  return { ...DEFAULT_TERMS };
}

/** Whitelisted terms field names, re-exported for the editor component. */
export const TERMS_FIELD_NAMES = TERMS_FIELDS;

/** Guard used by the actions when reading textarea lists from FormData. */
export function hasContent(value: string | null | undefined): boolean {
  return isNonEmptyString(value);
}

/** Codes are validated in tests; exported so actions can assert on shape. */
export const PROPOSAL_CODE_VALIDATOR = PROPOSAL_CODE_PATTERN;
export const DEAL_CODE_VALIDATOR = DEAL_CODE_PATTERN;
export const REQUEST_CODE_VALIDATOR = PROPOSAL_REQUEST_CODE_PATTERN;

export type SubmitForApprovalInput = z.infer<typeof submitForApprovalSchema>;
export type ApproveProposalInput = z.infer<typeof approveProposalSchema>;
export type IssueProposalInput = z.infer<typeof issueProposalSchema>;
export type MarkProposalSentInput = z.infer<typeof markProposalSentSchema>;
export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;
export type CancelProposalInput = z.infer<typeof cancelProposalSchema>;
export type RecordAcceptanceInput = z.infer<typeof recordAcceptanceSchema>;
export type RecordRejectionInput = z.infer<typeof recordRejectionSchema>;
export type FinalizeDealInput = z.infer<typeof finalizeDealSchema>;
export type CancelDealInput = z.infer<typeof cancelDealSchema>;
export type ReviewProposalRequestInput = z.infer<typeof reviewProposalRequestSchema>;
export type CreateRevisionRequestInput = z.infer<typeof createRevisionRequestSchema>;
export type ResolveRevisionRequestInput = z.infer<typeof resolveRevisionRequestSchema>;
