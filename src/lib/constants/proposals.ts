/**
 * Proposal, Quotation and Deal domain constants (Part 9).
 *
 * Everything a commercial document can say lives here so the Mongoose
 * schemas, the Zod validators, the pricing engine, the server actions and
 * the UI all read the same source. Status transitions are declared ONCE in
 * `PROPOSAL_STATUS_TRANSITIONS` - no action file is allowed to invent its
 * own rules.
 *
 * Pure data module (no Mongoose, no `server-only`) so client components
 * may import labels without pulling the database layer into the bundle.
 */

/* -------------------------------------------------------------------------- */
/* Proposal status                                                             */
/* -------------------------------------------------------------------------- */

export const PROPOSAL_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[keyof typeof PROPOSAL_STATUSES];

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  [PROPOSAL_STATUSES.DRAFT]: 'Draft',
  [PROPOSAL_STATUSES.PENDING_APPROVAL]: 'Pending Approval',
  [PROPOSAL_STATUSES.APPROVED]: 'Approved',
  [PROPOSAL_STATUSES.SENT]: 'Sent',
  [PROPOSAL_STATUSES.ACCEPTED]: 'Accepted',
  [PROPOSAL_STATUSES.REJECTED]: 'Rejected',
  [PROPOSAL_STATUSES.EXPIRED]: 'Expired',
  [PROPOSAL_STATUSES.CANCELLED]: 'Cancelled',
  [PROPOSAL_STATUSES.SUPERSEDED]: 'Superseded',
};

/** Short badge tones, mapped to the shared Badge variants. */
export const PROPOSAL_STATUS_VARIANTS: Record<
  ProposalStatus,
  'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
> = {
  [PROPOSAL_STATUSES.DRAFT]: 'secondary',
  [PROPOSAL_STATUSES.PENDING_APPROVAL]: 'warning',
  [PROPOSAL_STATUSES.APPROVED]: 'info',
  [PROPOSAL_STATUSES.SENT]: 'info',
  [PROPOSAL_STATUSES.ACCEPTED]: 'success',
  [PROPOSAL_STATUSES.REJECTED]: 'error',
  [PROPOSAL_STATUSES.EXPIRED]: 'warning',
  [PROPOSAL_STATUSES.CANCELLED]: 'secondary',
  [PROPOSAL_STATUSES.SUPERSEDED]: 'secondary',
};

/**
 * Allowed status transitions.
 *
 * Internal approval (`PENDING_APPROVAL` -> `APPROVED`) is deliberately
 * separate from customer acceptance (`SENT` -> `ACCEPTED`), and the two
 * terminal customer outcomes (ACCEPTED / REJECTED) each have exactly one
 * way in. A new revision never rewrites history: the previous issued
 * version moves to SUPERSEDED while the new one starts at DRAFT.
 */
export const PROPOSAL_STATUS_TRANSITIONS: Record<ProposalStatus, readonly ProposalStatus[]> = {
  [PROPOSAL_STATUSES.DRAFT]: [PROPOSAL_STATUSES.PENDING_APPROVAL, PROPOSAL_STATUSES.CANCELLED],
  [PROPOSAL_STATUSES.PENDING_APPROVAL]: [
    PROPOSAL_STATUSES.APPROVED,
    PROPOSAL_STATUSES.DRAFT,
    PROPOSAL_STATUSES.CANCELLED,
  ],
  [PROPOSAL_STATUSES.APPROVED]: [PROPOSAL_STATUSES.SENT, PROPOSAL_STATUSES.CANCELLED],
  [PROPOSAL_STATUSES.SENT]: [
    PROPOSAL_STATUSES.ACCEPTED,
    PROPOSAL_STATUSES.REJECTED,
    PROPOSAL_STATUSES.SUPERSEDED,
    PROPOSAL_STATUSES.CANCELLED,
  ],
  [PROPOSAL_STATUSES.ACCEPTED]: [],
  [PROPOSAL_STATUSES.REJECTED]: [],
  [PROPOSAL_STATUSES.EXPIRED]: [],
  [PROPOSAL_STATUSES.CANCELLED]: [],
  [PROPOSAL_STATUSES.SUPERSEDED]: [],
};

/** Terminal statuses: no further transition is possible. */
export const TERMINAL_PROPOSAL_STATUSES: readonly ProposalStatus[] = [
  PROPOSAL_STATUSES.ACCEPTED,
  PROPOSAL_STATUSES.REJECTED,
  PROPOSAL_STATUSES.EXPIRED,
  PROPOSAL_STATUSES.CANCELLED,
  PROPOSAL_STATUSES.SUPERSEDED,
] as const;

/**
 * Statuses that still represent live commercial pipeline value.
 *
 * A DRAFT is included because it is an open opportunity, but it is never
 * counted as confirmed revenue - the dashboard labels it separately.
 */
export const OPEN_PROPOSAL_STATUSES: readonly ProposalStatus[] = [
  PROPOSAL_STATUSES.DRAFT,
  PROPOSAL_STATUSES.PENDING_APPROVAL,
  PROPOSAL_STATUSES.APPROVED,
  PROPOSAL_STATUSES.SENT,
] as const;

/** Statuses a marketing user may see the commercial amount of. */
export const MARKETING_VISIBLE_STATUSES: readonly ProposalStatus[] = [
  PROPOSAL_STATUSES.APPROVED,
  PROPOSAL_STATUSES.SENT,
  PROPOSAL_STATUSES.ACCEPTED,
  PROPOSAL_STATUSES.REJECTED,
  PROPOSAL_STATUSES.EXPIRED,
] as const;

export function canTransitionProposal(
  from: ProposalStatus,
  to: ProposalStatus
): boolean {
  return PROPOSAL_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Statuses whose commercial contents may be issued to a customer.
 *
 * A DRAFT / PENDING_APPROVAL / CANCELLED / SUPERSEDED / EXPIRED version is
 * never a valid candidate for acceptance, and this list is what the
 * acceptance and deal-finalization mutations check.
 */
export const ACCEPTABLE_PROPOSAL_STATUSES: readonly ProposalStatus[] = [
  PROPOSAL_STATUSES.SENT,
] as const;

export function isAcceptableProposalStatus(status: ProposalStatus): boolean {
  return ACCEPTABLE_PROPOSAL_STATUSES.includes(status);
}

/* -------------------------------------------------------------------------- */
/* Pricing vocabulary                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Line discount and proposal discount share one vocabulary.
 * `NONE` is always allowed and means "no discount at all".
 */
export const DISCOUNT_TYPES = {
  NONE: 'NONE',
  FIXED: 'FIXED',
  PERCENTAGE: 'PERCENTAGE',
} as const;

export type DiscountType = (typeof DISCOUNT_TYPES)[keyof typeof DISCOUNT_TYPES];

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  [DISCOUNT_TYPES.NONE]: 'No Discount',
  [DISCOUNT_TYPES.FIXED]: 'Fixed Amount',
  [DISCOUNT_TYPES.PERCENTAGE]: 'Percentage',
};

/** Units offered for a priced line item. Free text after all. */
export const PROPOSAL_UNITS = [
  'Project',
  'Page',
  'Screen',
  'Hour',
  'Day',
  'Week',
  'Month',
  'Video',
  'Design',
  'Campaign',
  'Post',
  'Item',
] as const;

export type ProposalUnit = (typeof PROPOSAL_UNITS)[number];

/** Sales stages recorded when a quotation is delivered to a customer. */
export const DELIVERY_METHODS = {
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  IN_PERSON: 'IN_PERSON',
  PHONE: 'PHONE',
  OTHER: 'OTHER',
} as const;

export type DeliveryMethod = (typeof DELIVERY_METHODS)[keyof typeof DELIVERY_METHODS];

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  [DELIVERY_METHODS.WHATSAPP]: 'WhatsApp',
  [DELIVERY_METHODS.EMAIL]: 'Email',
  [DELIVERY_METHODS.IN_PERSON]: 'In person',
  [DELIVERY_METHODS.PHONE]: 'Phone',
  [DELIVERY_METHODS.OTHER]: 'Other',
};

/**
 * Acceptance channel recorded by Admin.
 *
 * There is NO e-signature and NO gateway confirmation in this phase: the
 * admin attests that an actual human confirmation was received, and the
 * method + evidence fields record exactly what happened.
 */
export const ACCEPTANCE_METHODS = {
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  PHONE_CALL: 'PHONE_CALL',
  SIGNED_DOCUMENT: 'SIGNED_DOCUMENT',
  IN_PERSON: 'IN_PERSON',
  VERBAL: 'VERBAL',
  OTHER: 'OTHER',
} as const;

export type AcceptanceMethod =
  (typeof ACCEPTANCE_METHODS)[keyof typeof ACCEPTANCE_METHODS];

export const ACCEPTANCE_METHOD_LABELS: Record<AcceptanceMethod, string> = {
  [ACCEPTANCE_METHODS.WHATSAPP]: 'WhatsApp confirmation',
  [ACCEPTANCE_METHODS.EMAIL]: 'Email confirmation',
  [ACCEPTANCE_METHODS.PHONE_CALL]: 'Phone discussion',
  [ACCEPTANCE_METHODS.SIGNED_DOCUMENT]: 'Signed document',
  [ACCEPTANCE_METHODS.IN_PERSON]: 'In-person agreement',
  [ACCEPTANCE_METHODS.VERBAL]: 'Verbal confirmation (admin-attested)',
  [ACCEPTANCE_METHODS.OTHER]: 'Other',
};

/**
 * Methods where the confirmation is a conversation rather than a durable
 * artifact. The UI labels these explicitly so nobody later mistakes a
 * logged phone call for independently verified electronic consent.
 */
export const ATTESTED_ACCEPTANCE_METHODS: readonly AcceptanceMethod[] = [
  ACCEPTANCE_METHODS.PHONE_CALL,
  ACCEPTANCE_METHODS.VERBAL,
] as const;

/** Why a customer declined. Recorded for reporting, never deletes history. */
export const REJECTION_REASONS = {
  BUDGET: 'BUDGET',
  POSTPONED: 'POSTPONED',
  COMPETITOR: 'COMPETITOR',
  SCOPE_MISMATCH: 'SCOPE_MISMATCH',
  TIMELINE: 'TIMELINE',
  NO_RESPONSE: 'NO_RESPONSE',
  OTHER: 'OTHER',
} as const;

export type RejectionReason = (typeof REJECTION_REASONS)[keyof typeof REJECTION_REASONS];

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  [REJECTION_REASONS.BUDGET]: 'Budget too high',
  [REJECTION_REASONS.POSTPONED]: 'Project postponed',
  [REJECTION_REASONS.COMPETITOR]: 'Chose a competitor',
  [REJECTION_REASONS.SCOPE_MISMATCH]: 'Scope mismatch',
  [REJECTION_REASONS.TIMELINE]: 'Timeline not acceptable',
  [REJECTION_REASONS.NO_RESPONSE]: 'No response',
  [REJECTION_REASONS.OTHER]: 'Other',
};

/* -------------------------------------------------------------------------- */
/* Deal status                                                                 */
/* -------------------------------------------------------------------------- */

export const DEAL_STATUSES = {
  FINALIZED: 'FINALIZED',
  PENDING_CLIENT_CONVERSION: 'PENDING_CLIENT_CONVERSION',
  READY_FOR_PROJECT: 'READY_FOR_PROJECT',
  CANCELLED: 'CANCELLED',
} as const;

export type DealStatus = (typeof DEAL_STATUSES)[keyof typeof DEAL_STATUSES];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  [DEAL_STATUSES.FINALIZED]: 'Finalized',
  [DEAL_STATUSES.PENDING_CLIENT_CONVERSION]: 'Pending Client Conversion',
  [DEAL_STATUSES.READY_FOR_PROJECT]: 'Ready for Project',
  [DEAL_STATUSES.CANCELLED]: 'Cancelled',
};

export const DEAL_STATUS_VARIANTS: Record<
  DealStatus,
  'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
> = {
  [DEAL_STATUSES.FINALIZED]: 'info',
  [DEAL_STATUSES.PENDING_CLIENT_CONVERSION]: 'warning',
  [DEAL_STATUSES.READY_FOR_PROJECT]: 'success',
  [DEAL_STATUSES.CANCELLED]: 'secondary',
};

/**
 * A finalized deal is a commercial agreement, NOT received money.
 * Invoice / payment / receipt modules come in later phases and must not be
 * inferred from any field defined here.
 */

/* -------------------------------------------------------------------------- */
/* Marketing quotation requests                                                 */
/* -------------------------------------------------------------------------- */

export const PROPOSAL_REQUEST_STATUSES = {
  SUBMITTED: 'SUBMITTED',
  IN_REVIEW: 'IN_REVIEW',
  CONVERTED: 'CONVERTED',
  DECLINED: 'DECLINED',
} as const;

export type ProposalRequestStatus =
  (typeof PROPOSAL_REQUEST_STATUSES)[keyof typeof PROPOSAL_REQUEST_STATUSES];

export const PROPOSAL_REQUEST_STATUS_LABELS: Record<ProposalRequestStatus, string> = {
  [PROPOSAL_REQUEST_STATUSES.SUBMITTED]: 'Submitted',
  [PROPOSAL_REQUEST_STATUSES.IN_REVIEW]: 'In Review',
  [PROPOSAL_REQUEST_STATUSES.CONVERTED]: 'Converted to Proposal',
  [PROPOSAL_REQUEST_STATUSES.DECLINED]: 'Declined',
};

export const PROPOSAL_REQUEST_STATUS_VARIANTS: Record<
  ProposalRequestStatus,
  'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
> = {
  [PROPOSAL_REQUEST_STATUSES.SUBMITTED]: 'warning',
  [PROPOSAL_REQUEST_STATUSES.IN_REVIEW]: 'info',
  [PROPOSAL_REQUEST_STATUSES.CONVERTED]: 'success',
  [PROPOSAL_REQUEST_STATUSES.DECLINED]: 'secondary',
};

export const REQUEST_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type RequestPriority = (typeof REQUEST_PRIORITIES)[keyof typeof REQUEST_PRIORITIES];

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  [REQUEST_PRIORITIES.LOW]: 'Low',
  [REQUEST_PRIORITIES.MEDIUM]: 'Medium',
  [REQUEST_PRIORITIES.HIGH]: 'High',
  [REQUEST_PRIORITIES.URGENT]: 'Urgent',
};

export const REVISION_REQUEST_STATUSES = {
  OPEN: 'OPEN',
  ADDRESSED: 'ADDRESSED',
  DECLINED: 'DECLINED',
} as const;

export type RevisionRequestStatus =
  (typeof REVISION_REQUEST_STATUSES)[keyof typeof REVISION_REQUEST_STATUSES];

export const REVISION_REQUEST_STATUS_LABELS: Record<RevisionRequestStatus, string> = {
  [REVISION_REQUEST_STATUSES.OPEN]: 'Open',
  [REVISION_REQUEST_STATUSES.ADDRESSED]: 'Addressed by a new version',
  [REVISION_REQUEST_STATUSES.DECLINED]: 'Declined',
};

export const REVISION_REQUEST_STATUS_VARIANTS: Record<
  RevisionRequestStatus,
  'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
> = {
  [REVISION_REQUEST_STATUSES.OPEN]: 'warning',
  [REVISION_REQUEST_STATUSES.ADDRESSED]: 'success',
  [REVISION_REQUEST_STATUSES.DECLINED]: 'secondary',
};

/* -------------------------------------------------------------------------- */
/* Terms and conditions                                                        */
/* -------------------------------------------------------------------------- */

/** Which clause a default term belongs to, used by the terms editor. */
export const TERMS_FIELDS = [
  'offerValidity',
  'scopeLimitations',
  'revisionPolicy',
  'paymentTerms',
  'deliveryConditions',
  'clientResponsibilities',
  'cancellationTerms',
  'supportTerms',
  'intellectualProperty',
] as const;

export type TermsField = (typeof TERMS_FIELDS)[number];

export const TERMS_FIELD_LABELS: Record<TermsField, string> = {
  offerValidity: 'Offer Validity',
  scopeLimitations: 'Scope Limitations',
  revisionPolicy: 'Revision Policy',
  paymentTerms: 'Payment Terms',
  deliveryConditions: 'Delivery Conditions',
  clientResponsibilities: 'Client Responsibilities',
  cancellationTerms: 'Cancellation Terms',
  supportTerms: 'Support / Maintenance',
  intellectualProperty: 'Intellectual Property',
};

/**
 * Neutral, editable starter wording.
 *
 * These are drafting aids for a small agency, NOT legal advice and NOT a
 * claim about Arclivo Labs' actual obligations. Every field is fully
 * editable and may be cleared, and the PDF prints whatever the admin
 * stored - it never invents a clause.
 */
export const DEFAULT_TERMS: Record<TermsField, string> = {
  offerValidity:
    'This quotation is valid until the date stated above. Prices and scope may be revised after that date.',
  scopeLimitations:
    'Work is limited to the deliverables and scope listed in this quotation. Requests outside that scope are quoted separately.',
  revisionPolicy:
    'The revision allowance stated in the delivery section applies within the agreed scope. Additional revisions are billed separately.',
  paymentTerms:
    'Payments follow the milestone plan in this quotation. Work is paused when a milestone payment is outstanding beyond the agreed date.',
  deliveryConditions:
    'Delivery dates are estimates and assume timely content, approvals and feedback from the client. Delays on the client side shift the schedule accordingly.',
  clientResponsibilities:
    'The client provides content, brand assets, approvals and third-party access required for delivery within the agreed timeline.',
  cancellationTerms:
    'Either party may cancel with written notice. Work completed up to that point is chargeable, and advance payments are non-refundable against work performed.',
  supportTerms:
    'Post-delivery support covers the period stated in the delivery section for defects in the delivered scope. New work is quoted separately.',
  intellectualProperty:
    'On full payment, ownership of the delivered work transfers to the client. Arclivo Labs retains ownership of pre-existing tools, libraries and generic components reused in delivery.',
};

/* -------------------------------------------------------------------------- */
/* List configuration                                                          */
/* -------------------------------------------------------------------------- */

export const PROPOSAL_PAGE_SIZES = [20, 50, 100] as const;
export type ProposalPageSize = (typeof PROPOSAL_PAGE_SIZES)[number];
export const PROPOSAL_PAGE_SIZE_DEFAULT: ProposalPageSize = 20;

/** Whitelisted sort keys. No user-supplied field ever reaches MongoDB. */
export const PROPOSAL_SORTS = {
  NEWEST: 'NEWEST',
  OLDEST: 'OLDEST',
  UPDATED: 'UPDATED',
  AMOUNT_DESC: 'AMOUNT_DESC',
  VALID_SOONEST: 'VALID_SOONEST',
  CODE: 'CODE',
} as const;

export type ProposalSort = (typeof PROPOSAL_SORTS)[keyof typeof PROPOSAL_SORTS];

export const PROPOSAL_SORT_LABELS: Record<ProposalSort, string> = {
  [PROPOSAL_SORTS.NEWEST]: 'Newest first',
  [PROPOSAL_SORTS.OLDEST]: 'Oldest first',
  [PROPOSAL_SORTS.UPDATED]: 'Recently updated',
  [PROPOSAL_SORTS.AMOUNT_DESC]: 'Highest value',
  [PROPOSAL_SORTS.VALID_SOONEST]: 'Expiring soonest',
  [PROPOSAL_SORTS.CODE]: 'Proposal number',
};

/** Validity filter values that are not dates. */
export const VALIDITY_FILTER_EXPIRING = 'expiring';
export const VALIDITY_FILTER_EXPIRED = 'expired';
export const VALIDITY_FILTER_ACTIVE = 'active';

export const DEAL_PAGE_SIZES = [20, 50, 100] as const;
export type DealPageSize = (typeof DEAL_PAGE_SIZES)[number];
export const DEAL_PAGE_SIZE_DEFAULT: DealPageSize = 20;

export const DEAL_SORTS = {
  NEWEST: 'NEWEST',
  OLDEST: 'OLDEST',
  AMOUNT_DESC: 'AMOUNT_DESC',
  CODE: 'CODE',
} as const;

export type DealSort = (typeof DEAL_SORTS)[keyof typeof DEAL_SORTS];

export const DEAL_SORT_LABELS: Record<DealSort, string> = {
  [DEAL_SORTS.NEWEST]: 'Newest first',
  [DEAL_SORTS.OLDEST]: 'Oldest first',
  [DEAL_SORTS.AMOUNT_DESC]: 'Highest value',
  [DEAL_SORTS.CODE]: 'Deal number',
};

/* -------------------------------------------------------------------------- */
/* Limits                                                                      */
/* -------------------------------------------------------------------------- */

/** Guards against an accidental absurd payload reaching the database. */
export const PROPOSAL_LIMITS = {
  MAX_LINE_ITEMS: 50,
  MAX_DELIVERABLES: 100,
  MAX_SCOPE_FEATURES: 100,
  MAX_MILESTONES: 25,
  MAX_PAYMENT_MILESTONES: 15,
  MAX_VERSIONS: 50,
  MAX_TITLE: 200,
  MAX_SHORT_TEXT: 500,
  MAX_LONG_TEXT: 5000,
  MAX_NOTES: 4000,
  /** Guard rail for a single money value in major units. */
  MAX_AMOUNT: 100_000_000,
  MAX_VALIDITY_DAYS: 730,
  MIN_VALIDITY_DAYS: 0,
} as const;

/** Readable proposal number, e.g. `PRP-0001`. */
export const PROPOSAL_CODE_PREFIX = 'PRP';
/** Readable deal number, e.g. `DEAL-0001`. */
export const DEAL_CODE_PREFIX = 'DEAL';
/** Readable marketing request number, e.g. `REQ-0001`. */
export const PROPOSAL_REQUEST_CODE_PREFIX = 'REQ';

export const PROPOSAL_CODE_PATTERN = /^PRP-\d{4,}$/;
export const DEAL_CODE_PATTERN = /^DEAL-\d{4,}$/;
export const PROPOSAL_REQUEST_CODE_PATTERN = /^REQ-\d{4,}$/;

/** Human label for a version, e.g. `PRP-0001 / Version 2`. */
export function formatProposalVersionLabel(
  proposalCode: string,
  version: number
): string {
  return `${proposalCode} / Version ${version}`;
}