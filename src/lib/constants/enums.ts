/**
 * Reusable domain constants for the Arclivo Labs management system.
 *
 * User roles intentionally live in `@/types/auth` (`USER_ROLES`) and are
 * imported from there wherever needed — they are not duplicated here.
 */

/** Returns the values of an enum-like const object, for Mongoose `enum` options. */
export function enumValues<const T extends Record<string, string>>(
  values: T
): T[keyof T][] {
  return Object.values(values) as T[keyof T][];
}

/* -------------------------------------------------------------------------- */
/* User (account) status                                                      */
/* -------------------------------------------------------------------------- */

export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  [USER_STATUS.ACTIVE]: 'Active',
  [USER_STATUS.SUSPENDED]: 'Suspended',
  [USER_STATUS.INACTIVE]: 'Inactive',
};

/* -------------------------------------------------------------------------- */
/* Employee                                                                   */
/* -------------------------------------------------------------------------- */

export const EMPLOYEE_DEPARTMENTS = {
  WEB_DEVELOPMENT: 'WEB_DEVELOPMENT',
  APP_DEVELOPMENT: 'APP_DEVELOPMENT',
  UI_UX_DESIGN: 'UI_UX_DESIGN',
  GRAPHIC_DESIGN: 'GRAPHIC_DESIGN',
  VIDEO_EDITING: 'VIDEO_EDITING',
  SEO: 'SEO',
  DIGITAL_MARKETING: 'DIGITAL_MARKETING',
  CONTENT: 'CONTENT',
  OTHER: 'OTHER',
} as const;

export type EmployeeDepartment =
  (typeof EMPLOYEE_DEPARTMENTS)[keyof typeof EMPLOYEE_DEPARTMENTS];

export const EMPLOYEE_DEPARTMENT_LABELS: Record<
  EmployeeDepartment,
  string
> = {
  [EMPLOYEE_DEPARTMENTS.WEB_DEVELOPMENT]: 'Web Development',
  [EMPLOYEE_DEPARTMENTS.APP_DEVELOPMENT]: 'App Development',
  [EMPLOYEE_DEPARTMENTS.UI_UX_DESIGN]: 'UI/UX Design',
  [EMPLOYEE_DEPARTMENTS.GRAPHIC_DESIGN]: 'Graphic Design',
  [EMPLOYEE_DEPARTMENTS.VIDEO_EDITING]: 'Video Editing',
  [EMPLOYEE_DEPARTMENTS.SEO]: 'SEO',
  [EMPLOYEE_DEPARTMENTS.DIGITAL_MARKETING]: 'Digital Marketing',
  [EMPLOYEE_DEPARTMENTS.CONTENT]: 'Content',
  [EMPLOYEE_DEPARTMENTS.OTHER]: 'Other',
};

export const EMPLOYMENT_TYPES = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  FREELANCER: 'FREELANCER',
  INTERN: 'INTERN',
  CONTRACT: 'CONTRACT',
} as const;

export type EmploymentType =
  (typeof EMPLOYMENT_TYPES)[keyof typeof EMPLOYMENT_TYPES];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  [EMPLOYMENT_TYPES.FULL_TIME]: 'Full Time',
  [EMPLOYMENT_TYPES.PART_TIME]: 'Part Time',
  [EMPLOYMENT_TYPES.FREELANCER]: 'Freelancer',
  [EMPLOYMENT_TYPES.INTERN]: 'Intern',
  [EMPLOYMENT_TYPES.CONTRACT]: 'Contract',
};

export const PAYMENT_TYPES = {
  MONTHLY: 'MONTHLY',
  PER_PROJECT: 'PER_PROJECT',
  HOURLY: 'HOURLY',
  FIXED: 'FIXED',
} as const;

export type PaymentType =
  (typeof PAYMENT_TYPES)[keyof typeof PAYMENT_TYPES];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  [PAYMENT_TYPES.MONTHLY]: 'Monthly',
  [PAYMENT_TYPES.PER_PROJECT]: 'Per Project',
  [PAYMENT_TYPES.HOURLY]: 'Hourly',
  [PAYMENT_TYPES.FIXED]: 'Fixed',
};

export const EMPLOYEE_STATUS = {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  TERMINATED: 'TERMINATED',
} as const;

export type EmployeeStatus =
  (typeof EMPLOYEE_STATUS)[keyof typeof EMPLOYEE_STATUS];

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  [EMPLOYEE_STATUS.ACTIVE]: 'Active',
  [EMPLOYEE_STATUS.ON_LEAVE]: 'On Leave',
  [EMPLOYEE_STATUS.TERMINATED]: 'Terminated',
};

/* -------------------------------------------------------------------------- */
/* Marketing                                                                  */
/* -------------------------------------------------------------------------- */

export const COMMISSION_TYPES = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
  NONE: 'NONE',
} as const;

export type CommissionType =
  (typeof COMMISSION_TYPES)[keyof typeof COMMISSION_TYPES];

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  [COMMISSION_TYPES.PERCENTAGE]: 'Percentage',
  [COMMISSION_TYPES.FIXED]: 'Fixed Amount',
  [COMMISSION_TYPES.NONE]: 'None',
};

export const MARKETING_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type MarketingStatus =
  (typeof MARKETING_STATUS)[keyof typeof MARKETING_STATUS];

export const MARKETING_STATUS_LABELS: Record<MarketingStatus, string> = {
  [MARKETING_STATUS.ACTIVE]: 'Active',
  [MARKETING_STATUS.INACTIVE]: 'Inactive',
};

/* -------------------------------------------------------------------------- */
/* Client                                                                     */
/* -------------------------------------------------------------------------- */

export const CLIENT_TYPES = {
  PERSON: 'PERSON',
  COMPANY: 'COMPANY',
} as const;

export type ClientType = (typeof CLIENT_TYPES)[keyof typeof CLIENT_TYPES];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  [CLIENT_TYPES.PERSON]: 'Person',
  [CLIENT_TYPES.COMPANY]: 'Company',
};

export const CLIENT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
} as const;

/** Backwards-compatible plural alias used by older query modules. */
export const CLIENT_STATUSES = CLIENT_STATUS;

export type ClientStatus =
  (typeof CLIENT_STATUS)[keyof typeof CLIENT_STATUS];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  [CLIENT_STATUS.ACTIVE]: 'Active',
  [CLIENT_STATUS.INACTIVE]: 'Inactive',
  [CLIENT_STATUS.BLOCKED]: 'Blocked',
};

export const CLIENT_SOURCES = {
  WEBSITE: 'WEBSITE',
  REFERRAL: 'REFERRAL',
  SOCIAL_MEDIA: 'SOCIAL_MEDIA',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  WALK_IN: 'WALK_IN',
  ADVERTISEMENT: 'ADVERTISEMENT',
  OTHER: 'OTHER',
} as const;

export type ClientSource = (typeof CLIENT_SOURCES)[keyof typeof CLIENT_SOURCES];

export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  [CLIENT_SOURCES.WEBSITE]: 'Website',
  [CLIENT_SOURCES.REFERRAL]: 'Referral',
  [CLIENT_SOURCES.SOCIAL_MEDIA]: 'Social Media',
  [CLIENT_SOURCES.EMAIL]: 'Email',
  [CLIENT_SOURCES.PHONE]: 'Phone',
  [CLIENT_SOURCES.WALK_IN]: 'Walk-in',
  [CLIENT_SOURCES.ADVERTISEMENT]: 'Advertisement',
  [CLIENT_SOURCES.OTHER]: 'Other',
};

/* -------------------------------------------------------------------------- */
/* Lead (CRM)                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Sales pipeline. The happy path runs NEW → CONTACTED → INTERESTED →
 * MEETING → PROPOSAL_SENT → NEGOTIATION → WON, with LOST reachable from
 * any active stage. Transitions are intentionally NOT enforced as a
 * one-way workflow — real deals move backwards — but every stored value
 * must come from this set.
 */
export const LEAD_STATUSES = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  INTERESTED: 'INTERESTED',
  MEETING: 'MEETING',
  PROPOSAL_SENT: 'PROPOSAL_SENT',
  NEGOTIATION: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
} as const;

export type LeadStatus = (typeof LEAD_STATUSES)[keyof typeof LEAD_STATUSES];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  [LEAD_STATUSES.NEW]: 'New',
  [LEAD_STATUSES.CONTACTED]: 'Contacted',
  [LEAD_STATUSES.INTERESTED]: 'Interested',
  [LEAD_STATUSES.MEETING]: 'Meeting',
  [LEAD_STATUSES.PROPOSAL_SENT]: 'Proposal Sent',
  [LEAD_STATUSES.NEGOTIATION]: 'Negotiation',
  [LEAD_STATUSES.WON]: 'Won',
  [LEAD_STATUSES.LOST]: 'Lost',
};

/**
 * Visual pipeline order for the CRM overview board. LOST is terminal and
 * deliberately excluded — it is reported separately so the funnel reads
 * left to right.
 */
export const LEAD_PIPELINE_STAGES: readonly LeadStatus[] = [
  LEAD_STATUSES.NEW,
  LEAD_STATUSES.CONTACTED,
  LEAD_STATUSES.INTERESTED,
  LEAD_STATUSES.MEETING,
  LEAD_STATUSES.PROPOSAL_SENT,
  LEAD_STATUSES.NEGOTIATION,
  LEAD_STATUSES.WON,
] as const;

/** Acquisition channels. CSV_IMPORT is set on imported leads. */
export const LEAD_SOURCES = {
  MANUAL: 'MANUAL',
  CSV_IMPORT: 'CSV_IMPORT',
  WEBSITE: 'WEBSITE',
  REFERRAL: 'REFERRAL',
  LINKEDIN: 'LINKEDIN',
  INSTAGRAM: 'INSTAGRAM',
  FACEBOOK: 'FACEBOOK',
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  CALL: 'CALL',
  OTHER: 'OTHER',
} as const;

export type LeadSource = (typeof LEAD_SOURCES)[keyof typeof LEAD_SOURCES];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  [LEAD_SOURCES.MANUAL]: 'Manual',
  [LEAD_SOURCES.CSV_IMPORT]: 'CSV Import',
  [LEAD_SOURCES.WEBSITE]: 'Website',
  [LEAD_SOURCES.REFERRAL]: 'Referral',
  [LEAD_SOURCES.LINKEDIN]: 'LinkedIn',
  [LEAD_SOURCES.INSTAGRAM]: 'Instagram',
  [LEAD_SOURCES.FACEBOOK]: 'Facebook',
  [LEAD_SOURCES.EMAIL]: 'Email',
  [LEAD_SOURCES.WHATSAPP]: 'WhatsApp',
  [LEAD_SOURCES.CALL]: 'Call',
  [LEAD_SOURCES.OTHER]: 'Other',
};

/**
 * Optional structured reason captured when a lead is marked LOST. Stored
 * as a plain enum (never a separate module) plus an optional free-text
 * `lostReasonNote` on the Lead.
 */
export const LOST_REASONS = {
  BUDGET: 'BUDGET',
  NO_RESPONSE: 'NO_RESPONSE',
  CHOSE_COMPETITOR: 'CHOSE_COMPETITOR',
  PROJECT_CANCELLED: 'PROJECT_CANCELLED',
  NOT_QUALIFIED: 'NOT_QUALIFIED',
  OTHER: 'OTHER',
} as const;

export type LostReason = (typeof LOST_REASONS)[keyof typeof LOST_REASONS];

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  [LOST_REASONS.BUDGET]: 'Budget',
  [LOST_REASONS.NO_RESPONSE]: 'No response',
  [LOST_REASONS.CHOSE_COMPETITOR]: 'Chose competitor',
  [LOST_REASONS.PROJECT_CANCELLED]: 'Project cancelled',
  [LOST_REASONS.NOT_QUALIFIED]: 'Not qualified',
  [LOST_REASONS.OTHER]: 'Other',
};

/* -------------------------------------------------------------------------- */
/* Communication timeline (CRM activity)                                       */
/* -------------------------------------------------------------------------- */

/**
 * One entry on a lead's communication timeline.
 *
 * Manual entries (CALL / WHATSAPP / EMAIL / INTERNAL_NOTE) are written by
 * staff; FOLLOW_UP, MEETING and SYSTEM entries are derived from the
 * follow-up and meeting workflows plus the automatic activity log. They
 * share one collection so the timeline stays chronological.
 */
export const COMMUNICATION_TYPES = {
  CALL: 'CALL',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  MEETING: 'MEETING',
  INTERNAL_NOTE: 'INTERNAL_NOTE',
  FOLLOW_UP: 'FOLLOW_UP',
  SYSTEM: 'SYSTEM',
} as const;

export type CommunicationType =
  (typeof COMMUNICATION_TYPES)[keyof typeof COMMUNICATION_TYPES];

export const COMMUNICATION_TYPE_LABELS: Record<CommunicationType, string> = {
  [COMMUNICATION_TYPES.CALL]: 'Call',
  [COMMUNICATION_TYPES.WHATSAPP]: 'WhatsApp',
  [COMMUNICATION_TYPES.EMAIL]: 'Email',
  [COMMUNICATION_TYPES.MEETING]: 'Meeting',
  [COMMUNICATION_TYPES.INTERNAL_NOTE]: 'Internal Note',
  [COMMUNICATION_TYPES.FOLLOW_UP]: 'Follow-up',
  [COMMUNICATION_TYPES.SYSTEM]: 'System Activity',
};

/**
 * Types a staff member may log by hand. MEETING (lives in the Meeting
 * collection), FOLLOW_UP (mirrors `Lead.nextFollowUpAt`) and SYSTEM
 * (generated by the activity helper) are never accepted from a form.
 */
export const LOGGABLE_COMMUNICATION_TYPES = [
  COMMUNICATION_TYPES.CALL,
  COMMUNICATION_TYPES.WHATSAPP,
  COMMUNICATION_TYPES.EMAIL,
  COMMUNICATION_TYPES.INTERNAL_NOTE,
] as const;

export type LoggableCommunicationType =
  (typeof LOGGABLE_COMMUNICATION_TYPES)[number];

export const COMMUNICATION_DIRECTIONS = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
  INTERNAL: 'INTERNAL',
} as const;

export type CommunicationDirection =
  (typeof COMMUNICATION_DIRECTIONS)[keyof typeof COMMUNICATION_DIRECTIONS];

export const COMMUNICATION_DIRECTION_LABELS: Record<
  CommunicationDirection,
  string
> = {
  [COMMUNICATION_DIRECTIONS.INBOUND]: 'Inbound',
  [COMMUNICATION_DIRECTIONS.OUTBOUND]: 'Outbound',
  [COMMUNICATION_DIRECTIONS.INTERNAL]: 'Internal',
};

/**
 * Which directions make sense per type, so the form can hide irrelevant
 * inputs (an internal note is always INTERNAL; a system entry has no
 * direction at all).
 */
export const COMMUNICATION_TYPE_DIRECTIONS: Record<
  CommunicationType,
  readonly CommunicationDirection[]
> = {
  [COMMUNICATION_TYPES.CALL]: [
    COMMUNICATION_DIRECTIONS.INBOUND,
    COMMUNICATION_DIRECTIONS.OUTBOUND,
  ],
  [COMMUNICATION_TYPES.WHATSAPP]: [
    COMMUNICATION_DIRECTIONS.INBOUND,
    COMMUNICATION_DIRECTIONS.OUTBOUND,
  ],
  [COMMUNICATION_TYPES.EMAIL]: [
    COMMUNICATION_DIRECTIONS.INBOUND,
    COMMUNICATION_DIRECTIONS.OUTBOUND,
  ],
  [COMMUNICATION_TYPES.MEETING]: [COMMUNICATION_DIRECTIONS.INTERNAL],
  [COMMUNICATION_TYPES.INTERNAL_NOTE]: [COMMUNICATION_DIRECTIONS.INTERNAL],
  [COMMUNICATION_TYPES.FOLLOW_UP]: [
    COMMUNICATION_DIRECTIONS.OUTBOUND,
    COMMUNICATION_DIRECTIONS.INTERNAL,
  ],
  [COMMUNICATION_TYPES.SYSTEM]: [],
};

/** Call outcomes captured by the manual call log (no telephony API). */
export const CALL_RESULTS = {
  CONNECTED: 'CONNECTED',
  NO_ANSWER: 'NO_ANSWER',
  BUSY: 'BUSY',
  CALL_BACK: 'CALL_BACK',
  NOT_INTERESTED: 'NOT_INTERESTED',
  WRONG_NUMBER: 'WRONG_NUMBER',
  OTHER: 'OTHER',
} as const;

export type CallResult = (typeof CALL_RESULTS)[keyof typeof CALL_RESULTS];

export const CALL_RESULT_LABELS: Record<CallResult, string> = {
  [CALL_RESULTS.CONNECTED]: 'Connected',
  [CALL_RESULTS.NO_ANSWER]: 'No Answer',
  [CALL_RESULTS.BUSY]: 'Busy',
  [CALL_RESULTS.CALL_BACK]: 'Call Back Requested',
  [CALL_RESULTS.NOT_INTERESTED]: 'Not Interested',
  [CALL_RESULTS.WRONG_NUMBER]: 'Wrong Number',
  [CALL_RESULTS.OTHER]: 'Other',
};

/** Call results that mean the lead asked to be contacted again. */
export const CALL_RESULTS_REQUIRING_FOLLOW_UP: readonly CallResult[] = [
  CALL_RESULTS.CONNECTED,
  CALL_RESULTS.CALL_BACK,
];

/**
 * Visibility of a timeline entry.
 *
 * Everything written in this phase is INTERNAL CRM history. CLIENT_VISIBLE
 * exists so a later client-facing surface can be introduced without
 * re-modelling historical records — the client portal must never surface
 * INTERNAL entries.
 */
export const COMMUNICATION_VISIBILITIES = {
  INTERNAL: 'INTERNAL',
  CLIENT_VISIBLE: 'CLIENT_VISIBLE',
} as const;

export type CommunicationVisibility =
  (typeof COMMUNICATION_VISIBILITIES)[keyof typeof COMMUNICATION_VISIBILITIES];

export const COMMUNICATION_VISIBILITY_LABELS: Record<
  CommunicationVisibility,
  string
> = {
  [COMMUNICATION_VISIBILITIES.INTERNAL]: 'Internal only',
  [COMMUNICATION_VISIBILITIES.CLIENT_VISIBLE]: 'Client visible',
};

/** Filter chips offered above a lead timeline. */
export const COMMUNICATION_TYPE_FILTERS = [
  COMMUNICATION_TYPES.CALL,
  COMMUNICATION_TYPES.WHATSAPP,
  COMMUNICATION_TYPES.EMAIL,
  COMMUNICATION_TYPES.MEETING,
  COMMUNICATION_TYPES.INTERNAL_NOTE,
  COMMUNICATION_TYPES.FOLLOW_UP,
  COMMUNICATION_TYPES.SYSTEM,
] as const;

export const COMMUNICATION_SORTS = {
  NEWEST: 'NEWEST',
  OLDEST: 'OLDEST',
} as const;

export type CommunicationSort =
  (typeof COMMUNICATION_SORTS)[keyof typeof COMMUNICATION_SORTS];

export const COMMUNICATION_SORT_LABELS: Record<CommunicationSort, string> = {
  [COMMUNICATION_SORTS.NEWEST]: 'Newest first',
  [COMMUNICATION_SORTS.OLDEST]: 'Oldest first',
};

/**
 * Kinds of automatically generated timeline entry. The human-readable
 * sentence is composed server-side by `createLeadSystemActivity`, so the
 * stored event code stays stable and queryable.
 */
export const LEAD_ACTIVITY_EVENTS = {
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_ASSIGNED: 'LEAD_ASSIGNED',
  LEAD_REASSIGNED: 'LEAD_REASSIGNED',
  LEAD_UNASSIGNED: 'LEAD_UNASSIGNED',
  LEAD_STATUS_CHANGED: 'LEAD_STATUS_CHANGED',
  FOLLOW_UP_SCHEDULED: 'FOLLOW_UP_SCHEDULED',
  FOLLOW_UP_RESCHEDULED: 'FOLLOW_UP_RESCHEDULED',
  FOLLOW_UP_CLEARED: 'FOLLOW_UP_CLEARED',
  MEETING_SCHEDULED: 'MEETING_SCHEDULED',
  MEETING_COMPLETED: 'MEETING_COMPLETED',
  MEETING_CANCELLED: 'MEETING_CANCELLED',
  MEETING_NO_SHOW: 'MEETING_NO_SHOW',
  LEAD_CONVERTED: 'LEAD_CONVERTED',
  /** Part 9: commercial milestones recorded on the lead timeline. */
  PROPOSAL_ISSUED: 'PROPOSAL_ISSUED',
  PROPOSAL_SENT: 'PROPOSAL_SENT',
  PROPOSAL_ACCEPTED: 'PROPOSAL_ACCEPTED',
  PROPOSAL_REJECTED: 'PROPOSAL_REJECTED',
  DEAL_FINALIZED: 'DEAL_FINALIZED',
} as const;

export type LeadActivityEvent =
  (typeof LEAD_ACTIVITY_EVENTS)[keyof typeof LEAD_ACTIVITY_EVENTS];

/* -------------------------------------------------------------------------- */
/* Meetings (CRM)                                                              */
/* -------------------------------------------------------------------------- */

/** How a meeting happens. Video links are typed in manually. */
export const MEETING_TYPES = {
  PHONE: 'PHONE',
  VIDEO: 'VIDEO',
  IN_PERSON: 'IN_PERSON',
} as const;

export type MeetingType = (typeof MEETING_TYPES)[keyof typeof MEETING_TYPES];

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  [MEETING_TYPES.PHONE]: 'Phone',
  [MEETING_TYPES.VIDEO]: 'Video',
  [MEETING_TYPES.IN_PERSON]: 'In Person',
};

export const MEETING_STATUSES = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;

export type MeetingStatus =
  (typeof MEETING_STATUSES)[keyof typeof MEETING_STATUSES];

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  [MEETING_STATUSES.SCHEDULED]: 'Scheduled',
  [MEETING_STATUSES.COMPLETED]: 'Completed',
  [MEETING_STATUSES.CANCELLED]: 'Cancelled',
  [MEETING_STATUSES.NO_SHOW]: 'No Show',
};

/** Statuses that can still be updated by a member of staff. */
export const OPEN_MEETING_STATUSES: readonly MeetingStatus[] = [
  MEETING_STATUSES.SCHEDULED,
];

/** Offered durations for the schedule-meeting form, in minutes. */
export const MEETING_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

export const MEETING_DURATION_DEFAULT = 30;

/* -------------------------------------------------------------------------- */
/* Currency                                                                   */
/* -------------------------------------------------------------------------- */

/** Default ISO-4217 currency code. Money fields store this unless overridden. */
export const DEFAULT_CURRENCY = 'INR';

/**
 * Currencies offered in money inputs. Stored as plain ISO-4217 codes so
 * international leads stay first-class; the code list is intentionally
 * short and extensible.
 */
export const CURRENCIES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SGD',
  'AUD',
  'CAD',
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

/* -------------------------------------------------------------------------- */
/* Projects (Part 10 & 11)                                                    */
/* -------------------------------------------------------------------------- */

export const PROJECT_STATUSES = {
  PLANNING: 'PLANNING',
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  IN_REVIEW: 'IN_REVIEW',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type ProjectStatus =
  (typeof PROJECT_STATUSES)[keyof typeof PROJECT_STATUSES];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [PROJECT_STATUSES.PLANNING]: 'Planning',
  [PROJECT_STATUSES.NOT_STARTED]: 'Not Started',
  [PROJECT_STATUSES.IN_PROGRESS]: 'In Progress',
  [PROJECT_STATUSES.ON_HOLD]: 'On Hold',
  [PROJECT_STATUSES.IN_REVIEW]: 'In Review',
  [PROJECT_STATUSES.COMPLETED]: 'Completed',
  [PROJECT_STATUSES.CANCELLED]: 'Cancelled',
};

/**
 * Allowed project status moves. Admin-only gate applied server-side by the
 * project actions, so a hand-crafted request cannot skip the workflow.
 * COMPLETED and CANCELLED are terminal - nothing moves out of them.
 */
export const PROJECT_STATUS_TRANSITIONS: Record<
  ProjectStatus,
  readonly ProjectStatus[]
> = {
  [PROJECT_STATUSES.PLANNING]: [
    PROJECT_STATUSES.NOT_STARTED,
    PROJECT_STATUSES.IN_PROGRESS,
    PROJECT_STATUSES.ON_HOLD,
    PROJECT_STATUSES.CANCELLED,
  ],
  [PROJECT_STATUSES.NOT_STARTED]: [
    PROJECT_STATUSES.IN_PROGRESS,
    PROJECT_STATUSES.ON_HOLD,
    PROJECT_STATUSES.CANCELLED,
  ],
  [PROJECT_STATUSES.IN_PROGRESS]: [
    PROJECT_STATUSES.ON_HOLD,
    PROJECT_STATUSES.IN_REVIEW,
    PROJECT_STATUSES.COMPLETED,
    PROJECT_STATUSES.CANCELLED,
  ],
  [PROJECT_STATUSES.ON_HOLD]: [
    PROJECT_STATUSES.IN_PROGRESS,
    PROJECT_STATUSES.CANCELLED,
  ],
  [PROJECT_STATUSES.IN_REVIEW]: [
    PROJECT_STATUSES.IN_PROGRESS,
    PROJECT_STATUSES.COMPLETED,
    PROJECT_STATUSES.CANCELLED,
  ],
  [PROJECT_STATUSES.COMPLETED]: [],
  [PROJECT_STATUSES.CANCELLED]: [],
};

/** Statuses that still count as live delivery work. */
export const ACTIVE_PROJECT_STATUSES: readonly ProjectStatus[] = [
  PROJECT_STATUSES.PLANNING,
  PROJECT_STATUSES.NOT_STARTED,
  PROJECT_STATUSES.IN_PROGRESS,
  PROJECT_STATUSES.ON_HOLD,
  PROJECT_STATUSES.IN_REVIEW,
] as const;

/**
 * Project health is deliberately independent of status: an IN_PROGRESS
 * project can be DELAYED, and a COMPLETED one is always ON_TRACK.
 */
export const PROJECT_HEALTHS = {
  ON_TRACK: 'ON_TRACK',
  AT_RISK: 'AT_RISK',
  DELAYED: 'DELAYED',
  BLOCKED: 'BLOCKED',
} as const;

export type ProjectHealth =
  (typeof PROJECT_HEALTHS)[keyof typeof PROJECT_HEALTHS];

export const PROJECT_HEALTH_LABELS: Record<ProjectHealth, string> = {
  [PROJECT_HEALTHS.ON_TRACK]: 'On Track',
  [PROJECT_HEALTHS.AT_RISK]: 'At Risk',
  [PROJECT_HEALTHS.DELAYED]: 'Delayed',
  [PROJECT_HEALTHS.BLOCKED]: 'Blocked',
};

/** Where a project came from. MANUAL means no linked finalized Deal. */
export const PROJECT_ORIGINS = {
  DEAL: 'DEAL',
  MANUAL: 'MANUAL',
} as const;

export type ProjectOrigin = (typeof PROJECT_ORIGINS)[keyof typeof PROJECT_ORIGINS];

export const PROJECT_ORIGIN_LABELS: Record<ProjectOrigin, string> = {
  [PROJECT_ORIGINS.DEAL]: 'From Deal',
  [PROJECT_ORIGINS.MANUAL]: 'Manual',
};

/** Broad delivery shape. Informational - it does not drive milestone templates. */
export const PROJECT_TYPES = {
  WEBSITE_DEVELOPMENT: 'WEBSITE_DEVELOPMENT',
  WEB_APPLICATION: 'WEB_APPLICATION',
  MOBILE_APPLICATION: 'MOBILE_APPLICATION',
  UI_UX_DESIGN: 'UI_UX_DESIGN',
  GRAPHIC_DESIGN: 'GRAPHIC_DESIGN',
  SEO: 'SEO',
  VIDEO_EDITING: 'VIDEO_EDITING',
  DIGITAL_MARKETING: 'DIGITAL_MARKETING',
  MAINTENANCE: 'MAINTENANCE',
  INTERNAL: 'INTERNAL',
  OTHER: 'OTHER',
} as const;

export type ProjectType = (typeof PROJECT_TYPES)[keyof typeof PROJECT_TYPES];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  [PROJECT_TYPES.WEBSITE_DEVELOPMENT]: 'Website Development',
  [PROJECT_TYPES.WEB_APPLICATION]: 'Web Application',
  [PROJECT_TYPES.MOBILE_APPLICATION]: 'Mobile Application',
  [PROJECT_TYPES.UI_UX_DESIGN]: 'UI/UX Design',
  [PROJECT_TYPES.GRAPHIC_DESIGN]: 'Graphic Design',
  [PROJECT_TYPES.SEO]: 'SEO',
  [PROJECT_TYPES.VIDEO_EDITING]: 'Video Editing',
  [PROJECT_TYPES.DIGITAL_MARKETING]: 'Digital Marketing',
  [PROJECT_TYPES.MAINTENANCE]: 'Maintenance',
  [PROJECT_TYPES.INTERNAL]: 'Internal',
  [PROJECT_TYPES.OTHER]: 'Other',
};

/**
 * Project-level responsibilities. These are NOT authentication roles - they
 * never widen access, they only describe what a person does on one project.
 */
export const PROJECT_MEMBER_ROLES = {
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  DEVELOPER: 'DEVELOPER',
  DESIGNER: 'DESIGNER',
  QA_TESTER: 'QA_TESTER',
  SEO_SPECIALIST: 'SEO_SPECIALIST',
  CONTENT_CREATOR: 'CONTENT_CREATOR',
  CONTRIBUTOR: 'CONTRIBUTOR',
  OTHER: 'OTHER',
} as const;

export type ProjectMemberRole =
  (typeof PROJECT_MEMBER_ROLES)[keyof typeof PROJECT_MEMBER_ROLES];

export const PROJECT_MEMBER_ROLE_LABELS: Record<ProjectMemberRole, string> = {
  [PROJECT_MEMBER_ROLES.PROJECT_MANAGER]: 'Project Manager',
  [PROJECT_MEMBER_ROLES.DEVELOPER]: 'Developer',
  [PROJECT_MEMBER_ROLES.DESIGNER]: 'Designer',
  [PROJECT_MEMBER_ROLES.QA_TESTER]: 'QA Tester',
  [PROJECT_MEMBER_ROLES.SEO_SPECIALIST]: 'SEO Specialist',
  [PROJECT_MEMBER_ROLES.CONTENT_CREATOR]: 'Content Creator',
  [PROJECT_MEMBER_ROLES.CONTRIBUTOR]: 'Contributor',
  [PROJECT_MEMBER_ROLES.OTHER]: 'Other Member',
};

export const PROJECT_MEMBER_STATUSES = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
} as const;

export type ProjectMemberStatus =
  (typeof PROJECT_MEMBER_STATUSES)[keyof typeof PROJECT_MEMBER_STATUSES];

export const PROJECT_MEMBER_STATUS_LABELS: Record<ProjectMemberStatus, string> = {
  [PROJECT_MEMBER_STATUSES.ACTIVE]: 'Active',
  [PROJECT_MEMBER_STATUSES.REMOVED]: 'Removed',
};

export const PROJECT_MILESTONE_STATUSES = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type ProjectMilestoneStatus =
  (typeof PROJECT_MILESTONE_STATUSES)[keyof typeof PROJECT_MILESTONE_STATUSES];

export const PROJECT_MILESTONE_STATUS_LABELS: Record<
  ProjectMilestoneStatus,
  string
> = {
  [PROJECT_MILESTONE_STATUSES.NOT_STARTED]: 'Not Started',
  [PROJECT_MILESTONE_STATUSES.IN_PROGRESS]: 'In Progress',
  [PROJECT_MILESTONE_STATUSES.BLOCKED]: 'Blocked',
  [PROJECT_MILESTONE_STATUSES.PENDING_REVIEW]: 'Pending Review',
  [PROJECT_MILESTONE_STATUSES.COMPLETED]: 'Completed',
  [PROJECT_MILESTONE_STATUSES.CANCELLED]: 'Cancelled',
};

/**
 * Milestone workflow gate. COMPLETED requires an admin review pass
 * (MILESTONE_REVIEWED below), so an employee can never move a milestone
 * straight to COMPLETED.
 */
export const PROJECT_MILESTONE_TRANSITIONS: Record<
  ProjectMilestoneStatus,
  readonly ProjectMilestoneStatus[]
> = {
  [PROJECT_MILESTONE_STATUSES.NOT_STARTED]: [
    PROJECT_MILESTONE_STATUSES.IN_PROGRESS,
    PROJECT_MILESTONE_STATUSES.BLOCKED,
    PROJECT_MILESTONE_STATUSES.CANCELLED,
  ],
  [PROJECT_MILESTONE_STATUSES.IN_PROGRESS]: [
    PROJECT_MILESTONE_STATUSES.BLOCKED,
    PROJECT_MILESTONE_STATUSES.PENDING_REVIEW,
    PROJECT_MILESTONE_STATUSES.CANCELLED,
  ],
  [PROJECT_MILESTONE_STATUSES.BLOCKED]: [
    PROJECT_MILESTONE_STATUSES.IN_PROGRESS,
    PROJECT_MILESTONE_STATUSES.CANCELLED,
  ],
  [PROJECT_MILESTONE_STATUSES.PENDING_REVIEW]: [
    PROJECT_MILESTONE_STATUSES.IN_PROGRESS,
    PROJECT_MILESTONE_STATUSES.COMPLETED,
    PROJECT_MILESTONE_STATUSES.CANCELLED,
  ],
  [PROJECT_MILESTONE_STATUSES.COMPLETED]: [],
  [PROJECT_MILESTONE_STATUSES.CANCELLED]: [],
};

/** Milestones counted when deriving project progress (see §29). */
export const PROGRESS_COUNTED_MILESTONE_STATUSES: readonly ProjectMilestoneStatus[] =
  [
    PROJECT_MILESTONE_STATUSES.NOT_STARTED,
    PROJECT_MILESTONE_STATUSES.IN_PROGRESS,
    PROJECT_MILESTONE_STATUSES.BLOCKED,
    PROJECT_MILESTONE_STATUSES.PENDING_REVIEW,
    PROJECT_MILESTONE_STATUSES.COMPLETED,
  ] as const;

/**
 * Derived milestone deadline state (§47). Never stored - always computed from
 * status + dueDate + today so the badge can never contradict the record.
 */
export const MILESTONE_DEADLINE_STATES = {
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
  OVERDUE: 'OVERDUE',
  DUE_SOON: 'DUE_SOON',
  ON_TIME: 'ON_TIME',
  NO_DATE: 'NO_DATE',
} as const;

export type MilestoneDeadlineState =
  (typeof MILESTONE_DEADLINE_STATES)[keyof typeof MILESTONE_DEADLINE_STATES];

export const MILESTONE_DEADLINE_STATE_LABELS: Record<
  MilestoneDeadlineState,
  string
> = {
  [MILESTONE_DEADLINE_STATES.COMPLETED]: 'Completed',
  [MILESTONE_DEADLINE_STATES.BLOCKED]: 'Blocked',
  [MILESTONE_DEADLINE_STATES.OVERDUE]: 'Overdue',
  [MILESTONE_DEADLINE_STATES.DUE_SOON]: 'Due Soon',
  [MILESTONE_DEADLINE_STATES.ON_TIME]: 'On Time',
  [MILESTONE_DEADLINE_STATES.NO_DATE]: 'No Deadline',
};

/** A milestone is "due soon" inside this many days of its due date. */
export const MILESTONE_DUE_SOON_DAYS = 3;

/* -------------------------------------------------------------------------- */
/* Project activity timeline (Part 10)                                         */
/* -------------------------------------------------------------------------- */

export const PROJECT_ACTIVITY_TYPES = {
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_STARTED: 'PROJECT_STARTED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  HEALTH_CHANGED: 'HEALTH_CHANGED',
  DEADLINE_CHANGED: 'DEADLINE_CHANGED',
  MANAGER_CHANGED: 'MANAGER_CHANGED',
  MEMBER_ASSIGNED: 'MEMBER_ASSIGNED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  MILESTONE_CREATED: 'MILESTONE_CREATED',
  MILESTONE_UPDATED: 'MILESTONE_UPDATED',
  MILESTONE_SUBMITTED: 'MILESTONE_SUBMITTED',
  MILESTONE_APPROVED: 'MILESTONE_APPROVED',
  MILESTONE_REJECTED: 'MILESTONE_REJECTED',
  NOTE_ADDED: 'NOTE_ADDED',
  PROJECT_PAUSED: 'PROJECT_PAUSED',
  PROJECT_RESUMED: 'PROJECT_RESUMED',
  PROJECT_COMPLETED: 'PROJECT_COMPLETED',
  PROJECT_CANCELLED: 'PROJECT_CANCELLED',
} as const;

export type ProjectActivityType =
  (typeof PROJECT_ACTIVITY_TYPES)[keyof typeof PROJECT_ACTIVITY_TYPES];

/** Icons/tones for the timeline, kept beside the types they describe. */
export const PROJECT_ACTIVITY_TONES: Record<
  ProjectActivityType,
  'neutral' | 'info' | 'success' | 'warning' | 'error'
> = {
  [PROJECT_ACTIVITY_TYPES.PROJECT_CREATED]: 'info',
  [PROJECT_ACTIVITY_TYPES.PROJECT_STARTED]: 'info',
  [PROJECT_ACTIVITY_TYPES.PROJECT_UPDATED]: 'neutral',
  [PROJECT_ACTIVITY_TYPES.STATUS_CHANGED]: 'info',
  [PROJECT_ACTIVITY_TYPES.HEALTH_CHANGED]: 'warning',
  [PROJECT_ACTIVITY_TYPES.DEADLINE_CHANGED]: 'warning',
  [PROJECT_ACTIVITY_TYPES.MANAGER_CHANGED]: 'neutral',
  [PROJECT_ACTIVITY_TYPES.MEMBER_ASSIGNED]: 'neutral',
  [PROJECT_ACTIVITY_TYPES.MEMBER_REMOVED]: 'warning',
  [PROJECT_ACTIVITY_TYPES.MILESTONE_CREATED]: 'neutral',
  [PROJECT_ACTIVITY_TYPES.MILESTONE_UPDATED]: 'neutral',
  [PROJECT_ACTIVITY_TYPES.MILESTONE_SUBMITTED]: 'info',
  [PROJECT_ACTIVITY_TYPES.MILESTONE_APPROVED]: 'success',
  [PROJECT_ACTIVITY_TYPES.MILESTONE_REJECTED]: 'warning',
  [PROJECT_ACTIVITY_TYPES.NOTE_ADDED]: 'neutral',
  [PROJECT_ACTIVITY_TYPES.PROJECT_PAUSED]: 'warning',
  [PROJECT_ACTIVITY_TYPES.PROJECT_RESUMED]: 'info',
  [PROJECT_ACTIVITY_TYPES.PROJECT_COMPLETED]: 'success',
  [PROJECT_ACTIVITY_TYPES.PROJECT_CANCELLED]: 'error',
};

export const PROJECT_ACTIVITY_TYPE_LABELS: Record<ProjectActivityType, string> = {
  [PROJECT_ACTIVITY_TYPES.PROJECT_CREATED]: 'Project created',
  [PROJECT_ACTIVITY_TYPES.PROJECT_STARTED]: 'Project started',
  [PROJECT_ACTIVITY_TYPES.PROJECT_UPDATED]: 'Project updated',
  [PROJECT_ACTIVITY_TYPES.STATUS_CHANGED]: 'Status changed',
  [PROJECT_ACTIVITY_TYPES.HEALTH_CHANGED]: 'Health changed',
  [PROJECT_ACTIVITY_TYPES.DEADLINE_CHANGED]: 'Deadline changed',
  [PROJECT_ACTIVITY_TYPES.MANAGER_CHANGED]: 'Project manager changed',
  [PROJECT_ACTIVITY_TYPES.MEMBER_ASSIGNED]: 'Member assigned',
  [PROJECT_ACTIVITY_TYPES.MEMBER_REMOVED]: 'Member removed',
  [PROJECT_ACTIVITY_TYPES.MILESTONE_CREATED]: 'Milestone created',
  [PROJECT_ACTIVITY_TYPES.MILESTONE_UPDATED]: 'Milestone updated',
  [PROJECT_ACTIVITY_TYPES.MILESTONE_SUBMITTED]: 'Milestone submitted',
  [PROJECT_ACTIVITY_TYPES.MILESTONE_APPROVED]: 'Milestone approved',
  [PROJECT_ACTIVITY_TYPES.MILESTONE_REJECTED]: 'Changes requested',
  [PROJECT_ACTIVITY_TYPES.NOTE_ADDED]: 'Internal note added',
  [PROJECT_ACTIVITY_TYPES.PROJECT_PAUSED]: 'Project put on hold',
  [PROJECT_ACTIVITY_TYPES.PROJECT_RESUMED]: 'Project resumed',
  [PROJECT_ACTIVITY_TYPES.PROJECT_COMPLETED]: 'Project completed',
  [PROJECT_ACTIVITY_TYPES.PROJECT_CANCELLED]: 'Project cancelled',
};

/** Named list presets for the project filter bar (§35). */
export const PROJECT_FILTER_PRESETS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
  DUE_THIS_WEEK: 'due_this_week',
  ON_HOLD: 'on_hold',
} as const;

export type ProjectFilterPreset =
  (typeof PROJECT_FILTER_PRESETS)[keyof typeof PROJECT_FILTER_PRESETS];

export const PROJECT_FILTER_PRESET_LABELS: Record<ProjectFilterPreset, string> = {
  [PROJECT_FILTER_PRESETS.ACTIVE]: 'Active',
  [PROJECT_FILTER_PRESETS.COMPLETED]: 'Completed',
  [PROJECT_FILTER_PRESETS.OVERDUE]: 'Overdue',
  [PROJECT_FILTER_PRESETS.DUE_THIS_WEEK]: 'Due This Week',
  [PROJECT_FILTER_PRESETS.ON_HOLD]: 'On Hold',
};


/* -------------------------------------------------------------------------- */
/* Tasks (Part 11)                                                            */
/* -------------------------------------------------------------------------- */

export const TASK_STATUSES = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  IN_REVIEW: 'IN_REVIEW',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TASK_STATUSES.TODO]: 'To Do',
  [TASK_STATUSES.IN_PROGRESS]: 'In Progress',
  [TASK_STATUSES.BLOCKED]: 'Blocked',
  [TASK_STATUSES.IN_REVIEW]: 'In Review',
  [TASK_STATUSES.CHANGES_REQUESTED]: 'Changes Requested',
  [TASK_STATUSES.COMPLETED]: 'Completed',
  [TASK_STATUSES.CANCELLED]: 'Cancelled',
};

export const TASK_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type TaskPriority =
  (typeof TASK_PRIORITIES)[keyof typeof TASK_PRIORITIES];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TASK_PRIORITIES.LOW]: 'Low',
  [TASK_PRIORITIES.MEDIUM]: 'Medium',
  [TASK_PRIORITIES.HIGH]: 'High',
  [TASK_PRIORITIES.URGENT]: 'Urgent',
};

export const TASK_COMMENT_VISIBILITIES = {
  INTERNAL: 'INTERNAL',
} as const;

export type TaskCommentVisibility =
  (typeof TASK_COMMENT_VISIBILITIES)[keyof typeof TASK_COMMENT_VISIBILITIES];

export const TASK_ACTIVITY_TYPES = {
  TASK_CREATED: 'TASK_CREATED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_REASSIGNED: 'TASK_REASSIGNED',
  TASK_STARTED: 'TASK_STARTED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  DUE_DATE_CHANGED: 'DUE_DATE_CHANGED',
  PROGRESS_UPDATED: 'PROGRESS_UPDATED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  BLOCKER_REPORTED: 'BLOCKER_REPORTED',
  BLOCKER_RESOLVED: 'BLOCKER_RESOLVED',
  SUBMITTED_FOR_REVIEW: 'SUBMITTED_FOR_REVIEW',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  TASK_APPROVED: 'TASK_APPROVED',
  TASK_CANCELLED: 'TASK_CANCELLED',
} as const;

export type TaskActivityType =
  (typeof TASK_ACTIVITY_TYPES)[keyof typeof TASK_ACTIVITY_TYPES];

export const TASK_ACTIVITY_TYPE_LABELS: Record<TaskActivityType, string> = {
  [TASK_ACTIVITY_TYPES.TASK_CREATED]: 'Task Created',
  [TASK_ACTIVITY_TYPES.TASK_ASSIGNED]: 'Task Assigned',
  [TASK_ACTIVITY_TYPES.TASK_REASSIGNED]: 'Task Reassigned',
  [TASK_ACTIVITY_TYPES.TASK_STARTED]: 'Work Started',
  [TASK_ACTIVITY_TYPES.STATUS_CHANGED]: 'Status Changed',
  [TASK_ACTIVITY_TYPES.PRIORITY_CHANGED]: 'Priority Changed',
  [TASK_ACTIVITY_TYPES.DUE_DATE_CHANGED]: 'Due Date Changed',
  [TASK_ACTIVITY_TYPES.PROGRESS_UPDATED]: 'Progress Updated',
  [TASK_ACTIVITY_TYPES.COMMENT_ADDED]: 'Comment Added',
  [TASK_ACTIVITY_TYPES.BLOCKER_REPORTED]: 'Blocker Reported',
  [TASK_ACTIVITY_TYPES.BLOCKER_RESOLVED]: 'Blocker Resolved',
  [TASK_ACTIVITY_TYPES.SUBMITTED_FOR_REVIEW]: 'Submitted for Review',
  [TASK_ACTIVITY_TYPES.CHANGES_REQUESTED]: 'Changes Requested',
  [TASK_ACTIVITY_TYPES.TASK_APPROVED]: 'Task Approved',
  [TASK_ACTIVITY_TYPES.TASK_CANCELLED]: 'Task Cancelled',
};

/* -------------------------------------------------------------------------- */
/* File Assets & Documents (Part 13)                                          */
/* -------------------------------------------------------------------------- */

export const FILE_CATEGORIES = {
  CLIENT_REQUIREMENT: 'CLIENT_REQUIREMENT',
  REFERENCE: 'REFERENCE',
  DESIGN: 'DESIGN',
  SOURCE_CODE: 'SOURCE_CODE',
  DOCUMENT: 'DOCUMENT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  TASK_ATTACHMENT: 'TASK_ATTACHMENT',
  MILESTONE_ATTACHMENT: 'MILESTONE_ATTACHMENT',
  DELIVERABLE: 'DELIVERABLE',
  CONTRACT: 'CONTRACT',
  PAYMENT_PROOF: 'PAYMENT_PROOF',
  OTHER: 'OTHER',
} as const;

export type FileCategory = (typeof FILE_CATEGORIES)[keyof typeof FILE_CATEGORIES];

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  [FILE_CATEGORIES.CLIENT_REQUIREMENT]: 'Client Requirement',
  [FILE_CATEGORIES.REFERENCE]: 'Reference Asset',
  [FILE_CATEGORIES.DESIGN]: 'Design & Graphics',
  [FILE_CATEGORIES.SOURCE_CODE]: 'Source Code',
  [FILE_CATEGORIES.DOCUMENT]: 'Document',
  [FILE_CATEGORIES.IMAGE]: 'Image',
  [FILE_CATEGORIES.VIDEO]: 'Video',
  [FILE_CATEGORIES.TASK_ATTACHMENT]: 'Task Attachment',
  [FILE_CATEGORIES.MILESTONE_ATTACHMENT]: 'Milestone Attachment',
  [FILE_CATEGORIES.DELIVERABLE]: 'Final Deliverable',
  [FILE_CATEGORIES.CONTRACT]: 'Contract & Legal',
  [FILE_CATEGORIES.PAYMENT_PROOF]: 'Payment Proof',
  [FILE_CATEGORIES.OTHER]: 'Other',
};

export const FILE_VISIBILITIES = {
  ADMIN_ONLY: 'ADMIN_ONLY',
  INTERNAL_TEAM: 'INTERNAL_TEAM',
  CLIENT_UPLOADED: 'CLIENT_UPLOADED',
  CLIENT_VISIBLE: 'CLIENT_VISIBLE',
} as const;

export type FileVisibility = (typeof FILE_VISIBILITIES)[keyof typeof FILE_VISIBILITIES];

export const FILE_VISIBILITY_LABELS: Record<FileVisibility, string> = {
  [FILE_VISIBILITIES.ADMIN_ONLY]: 'Admin Only',
  [FILE_VISIBILITIES.INTERNAL_TEAM]: 'Internal Team',
  [FILE_VISIBILITIES.CLIENT_UPLOADED]: 'Client Uploaded',
  [FILE_VISIBILITIES.CLIENT_VISIBLE]: 'Client Visible',
};

export const FILE_STATUSES = {
  UPLOADING: 'UPLOADING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
  FAILED: 'FAILED',
} as const;

export type FileStatus = (typeof FILE_STATUSES)[keyof typeof FILE_STATUSES];

export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  [FILE_STATUSES.UPLOADING]: 'Uploading',
  [FILE_STATUSES.PROCESSING]: 'Processing',
  [FILE_STATUSES.READY]: 'Ready',
  [FILE_STATUSES.PENDING_REVIEW]: 'Pending Review',
  [FILE_STATUSES.APPROVED]: 'Approved',
  [FILE_STATUSES.REJECTED]: 'Rejected',
  [FILE_STATUSES.ARCHIVED]: 'Archived',
  [FILE_STATUSES.FAILED]: 'Failed',
};

/* -------------------------------------------------------------------------- */
/* Final Deliverables (Part 13)                                               */
/* -------------------------------------------------------------------------- */

export const DELIVERABLE_STATUSES = {
  DRAFT: 'DRAFT',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  APPROVED: 'APPROVED',
  PUBLISHED: 'PUBLISHED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type DeliverableStatus =
  (typeof DELIVERABLE_STATUSES)[keyof typeof DELIVERABLE_STATUSES];

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  [DELIVERABLE_STATUSES.DRAFT]: 'Draft',
  [DELIVERABLE_STATUSES.READY_FOR_REVIEW]: 'Ready for Review',
  [DELIVERABLE_STATUSES.APPROVED]: 'Approved',
  [DELIVERABLE_STATUSES.PUBLISHED]: 'Published',
  [DELIVERABLE_STATUSES.ACKNOWLEDGED]: 'Acknowledged',
  [DELIVERABLE_STATUSES.ARCHIVED]: 'Archived',
};

/* -------------------------------------------------------------------------- */
/* Client Requirements (Part 12/13)                                           */
/* -------------------------------------------------------------------------- */

export const CLIENT_REQUIREMENT_STATUSES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ACCEPTED: 'ACCEPTED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
} as const;

export type ClientRequirementStatus =
  (typeof CLIENT_REQUIREMENT_STATUSES)[keyof typeof CLIENT_REQUIREMENT_STATUSES];

export const CLIENT_REQUIREMENT_STATUS_LABELS: Record<ClientRequirementStatus, string> = {
  [CLIENT_REQUIREMENT_STATUSES.DRAFT]: 'Draft',
  [CLIENT_REQUIREMENT_STATUSES.SUBMITTED]: 'Submitted',
  [CLIENT_REQUIREMENT_STATUSES.UNDER_REVIEW]: 'Under Review',
  [CLIENT_REQUIREMENT_STATUSES.ACCEPTED]: 'Accepted',
  [CLIENT_REQUIREMENT_STATUSES.CHANGES_REQUESTED]: 'Changes Requested',
};

/* -------------------------------------------------------------------------- */
/* Client Approvals (Part 12/13)                                              */
/* -------------------------------------------------------------------------- */

export const CLIENT_APPROVAL_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
} as const;

export type ClientApprovalStatus =
  (typeof CLIENT_APPROVAL_STATUSES)[keyof typeof CLIENT_APPROVAL_STATUSES];

export const CLIENT_APPROVAL_STATUS_LABELS: Record<ClientApprovalStatus, string> = {
  [CLIENT_APPROVAL_STATUSES.PENDING]: 'Pending',
  [CLIENT_APPROVAL_STATUSES.APPROVED]: 'Approved',
  [CLIENT_APPROVAL_STATUSES.REJECTED]: 'Rejected',
  [CLIENT_APPROVAL_STATUSES.REVISION_REQUESTED]: 'Revision Requested',
};

/* -------------------------------------------------------------------------- */
/* File Activity Audit Events (Part 13)                                       */
/* -------------------------------------------------------------------------- */

export const FILE_ACTIVITY_TYPES = {
  FILE_UPLOADED: 'FILE_UPLOADED',
  FILE_VERSION_CREATED: 'FILE_VERSION_CREATED',
  FILE_SUBMITTED: 'FILE_SUBMITTED',
  FILE_APPROVED: 'FILE_APPROVED',
  FILE_REJECTED: 'FILE_REJECTED',
  FILE_PUBLISHED: 'FILE_PUBLISHED',
  FILE_ARCHIVED: 'FILE_ARCHIVED',
  DELIVERABLE_CREATED: 'DELIVERABLE_CREATED',
  DELIVERABLE_PUBLISHED: 'DELIVERABLE_PUBLISHED',
  DELIVERABLE_ACKNOWLEDGED: 'DELIVERABLE_ACKNOWLEDGED',
} as const;

export type FileActivityType =
  (typeof FILE_ACTIVITY_TYPES)[keyof typeof FILE_ACTIVITY_TYPES];

/* -------------------------------------------------------------------------- */
/* Professional Billing & Invoices (Part 14)                                  */
/* -------------------------------------------------------------------------- */

export const INVOICE_TYPES = {
  STANDARD: 'STANDARD',
  MILESTONE: 'MILESTONE',
  FINAL: 'FINAL',
} as const;

export type InvoiceType = (typeof INVOICE_TYPES)[keyof typeof INVOICE_TYPES];

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  [INVOICE_TYPES.STANDARD]: 'Standard Invoice',
  [INVOICE_TYPES.MILESTONE]: 'Milestone Installment',
  [INVOICE_TYPES.FINAL]: 'Final Installment',
};

export const INVOICE_STATUSES = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  VOID: 'VOID',
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  [INVOICE_STATUSES.DRAFT]: 'Draft',
  [INVOICE_STATUSES.ISSUED]: 'Issued',
  [INVOICE_STATUSES.VOID]: 'Void',
};

export const INVOICE_PAYMENT_STATUSES = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
} as const;

export type InvoicePaymentStatus =
  (typeof INVOICE_PAYMENT_STATUSES)[keyof typeof INVOICE_PAYMENT_STATUSES];

export const INVOICE_PAYMENT_STATUS_LABELS: Record<InvoicePaymentStatus, string> = {
  [INVOICE_PAYMENT_STATUSES.UNPAID]: 'Unpaid',
  [INVOICE_PAYMENT_STATUSES.PARTIALLY_PAID]: 'Partially Paid',
  [INVOICE_PAYMENT_STATUSES.PAID]: 'Paid',
};

export const BILLING_MILESTONE_STATUSES = {
  NOT_BILLED: 'NOT_BILLED',
  BILLED: 'BILLED',
  CANCELLED: 'CANCELLED',
} as const;

export type BillingMilestoneStatus =
  (typeof BILLING_MILESTONE_STATUSES)[keyof typeof BILLING_MILESTONE_STATUSES];

export const BILLING_MILESTONE_STATUS_LABELS: Record<BillingMilestoneStatus, string> = {
  [BILLING_MILESTONE_STATUSES.NOT_BILLED]: 'Not Billed',
  [BILLING_MILESTONE_STATUSES.BILLED]: 'Billed',
  [BILLING_MILESTONE_STATUSES.CANCELLED]: 'Cancelled',
};

export const TAX_TREATMENTS = {
  NONE: 'NONE',
  IGST: 'IGST',
  CGST_SGST: 'CGST_SGST',
  EXPORT_NON_TAXABLE: 'EXPORT_NON_TAXABLE',
} as const;

export type TaxTreatment = (typeof TAX_TREATMENTS)[keyof typeof TAX_TREATMENTS];

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  [TAX_TREATMENTS.NONE]: 'No Tax / Tax Exempt',
  [TAX_TREATMENTS.IGST]: 'IGST (Inter-State / Integrated GST)',
  [TAX_TREATMENTS.CGST_SGST]: 'CGST + SGST (Intra-State GST)',
  [TAX_TREATMENTS.EXPORT_NON_TAXABLE]: 'Export / Zero Rated',
};

export const INVOICE_ACTIVITY_TYPES = {
  INVOICE_DRAFT_CREATED: 'INVOICE_DRAFT_CREATED',
  INVOICE_UPDATED: 'INVOICE_UPDATED',
  INVOICE_ISSUED: 'INVOICE_ISSUED',
  INVOICE_PDF_GENERATED: 'INVOICE_PDF_GENERATED',
  INVOICE_VOIDED: 'INVOICE_VOIDED',
  BILLING_MILESTONE_INVOICED: 'BILLING_MILESTONE_INVOICED',
} as const;

/* -------------------------------------------------------------------------- */
/* Manual Payments & Receipts (Part 15)                                       */
/* -------------------------------------------------------------------------- */

export const PAYMENT_METHODS = {
  UPI: 'UPI',
  BANK_TRANSFER: 'BANK_TRANSFER',
} as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PAYMENT_METHODS.UPI]: 'UPI',
  [PAYMENT_METHODS.BANK_TRANSFER]: 'Bank Transfer',
};

export const BANK_TRANSFER_CHANNELS = {
  NEFT: 'NEFT',
  IMPS: 'IMPS',
  RTGS: 'RTGS',
  OTHER: 'OTHER',
} as const;
export type BankTransferChannel =
  (typeof BANK_TRANSFER_CHANNELS)[keyof typeof BANK_TRANSFER_CHANNELS];

export const PAYMENT_SOURCES = {
  CLIENT_SUBMITTED: 'CLIENT_SUBMITTED',
  ADMIN_RECORDED: 'ADMIN_RECORDED',
} as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[keyof typeof PAYMENT_SOURCES];

export const PAYMENT_STATUSES = {
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  REVERSED: 'REVERSED',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUSES.SUBMITTED]: 'Submitted',
  [PAYMENT_STATUSES.UNDER_REVIEW]: 'Under Review',
  [PAYMENT_STATUSES.VERIFIED]: 'Verified',
  [PAYMENT_STATUSES.REJECTED]: 'Rejected',
  [PAYMENT_STATUSES.CANCELLED]: 'Cancelled',
  [PAYMENT_STATUSES.REVERSED]: 'Reversed',
};

export const PAYMENT_ACCOUNT_TYPES = {
  UPI: 'UPI',
  BANK: 'BANK',
} as const;
export type PaymentAccountType =
  (typeof PAYMENT_ACCOUNT_TYPES)[keyof typeof PAYMENT_ACCOUNT_TYPES];

export const PAYMENT_ALLOCATION_STATUSES = {
  ACTIVE: 'ACTIVE',
  REVERSED: 'REVERSED',
} as const;
export type PaymentAllocationStatus =
  (typeof PAYMENT_ALLOCATION_STATUSES)[keyof typeof PAYMENT_ALLOCATION_STATUSES];

export const PAYMENT_RECEIPT_STATUSES = {
  PENDING_PDF: 'PENDING_PDF',
  AVAILABLE: 'AVAILABLE',
  PDF_FAILED: 'PDF_FAILED',
  INVALIDATED: 'INVALIDATED',
} as const;
export type PaymentReceiptStatus =
  (typeof PAYMENT_RECEIPT_STATUSES)[keyof typeof PAYMENT_RECEIPT_STATUSES];

export const PAYMENT_ACTIVITY_TYPES = {
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAYMENT_UNDER_REVIEW: 'PAYMENT_UNDER_REVIEW',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  PAYMENT_REVERSED: 'PAYMENT_REVERSED',
  PAYMENT_ALLOCATED: 'PAYMENT_ALLOCATED',
  RECEIPT_CREATED: 'RECEIPT_CREATED',
  RECEIPT_PDF_GENERATED: 'RECEIPT_PDF_GENERATED',
} as const;
export type PaymentActivityType =
  (typeof PAYMENT_ACTIVITY_TYPES)[keyof typeof PAYMENT_ACTIVITY_TYPES];

export type InvoiceActivityType =
  (typeof INVOICE_ACTIVITY_TYPES)[keyof typeof INVOICE_ACTIVITY_TYPES];

export const INVOICE_ACTIVITY_TYPE_LABELS: Record<InvoiceActivityType, string> = {
  [INVOICE_ACTIVITY_TYPES.INVOICE_DRAFT_CREATED]: 'Invoice Draft Created',
  [INVOICE_ACTIVITY_TYPES.INVOICE_UPDATED]: 'Invoice Draft Updated',
  [INVOICE_ACTIVITY_TYPES.INVOICE_ISSUED]: 'Invoice Issued',
  [INVOICE_ACTIVITY_TYPES.INVOICE_PDF_GENERATED]: 'Invoice PDF Generated',
  [INVOICE_ACTIVITY_TYPES.INVOICE_VOIDED]: 'Invoice Voided',
  [INVOICE_ACTIVITY_TYPES.BILLING_MILESTONE_INVOICED]: 'Milestone Invoiced',
};

/* -------------------------------------------------------------------------- */
/* Workforce, payouts, notifications and support (Parts 16-19)               */
/* -------------------------------------------------------------------------- */

export const ATTENDANCE_STATUSES = {
  NOT_RECORDED: 'NOT_RECORDED', PRESENT: 'PRESENT', PARTIAL: 'PARTIAL',
  ON_LEAVE: 'ON_LEAVE', ABSENT: 'ABSENT', HOLIDAY: 'HOLIDAY', WEEKLY_OFF: 'WEEKLY_OFF',
} as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[keyof typeof ATTENDANCE_STATUSES];

export const LEAVE_TYPES = { CASUAL: 'CASUAL', SICK: 'SICK', EARNED: 'EARNED', UNPAID: 'UNPAID', OTHER: 'OTHER' } as const;
export type LeaveType = (typeof LEAVE_TYPES)[keyof typeof LEAVE_TYPES];
export const LEAVE_STATUSES = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED', CANCELLED: 'CANCELLED' } as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[keyof typeof LEAVE_STATUSES];
export const LEAVE_DAY_PORTIONS = { FULL_DAY: 'FULL_DAY', FIRST_HALF: 'FIRST_HALF', SECOND_HALF: 'SECOND_HALF' } as const;
export type LeaveDayPortion = (typeof LEAVE_DAY_PORTIONS)[keyof typeof LEAVE_DAY_PORTIONS];

export const WORK_REPORT_STATUSES = { DRAFT: 'DRAFT', SUBMITTED: 'SUBMITTED', UNDER_REVIEW: 'UNDER_REVIEW', APPROVED: 'APPROVED', CHANGES_REQUESTED: 'CHANGES_REQUESTED' } as const;
export type WorkReportStatus = (typeof WORK_REPORT_STATUSES)[keyof typeof WORK_REPORT_STATUSES];

export const COMMISSION_STATUSES = { PENDING: 'PENDING', ELIGIBLE: 'ELIGIBLE', APPROVED: 'APPROVED', PARTIALLY_PAID: 'PARTIALLY_PAID', PAID: 'PAID', ON_HOLD: 'ON_HOLD', CANCELLED: 'CANCELLED', ADJUSTED: 'ADJUSTED' } as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[keyof typeof COMMISSION_STATUSES];
export const EMPLOYEE_PAYOUT_TYPES = { SALARY: 'SALARY', BONUS: 'BONUS', REIMBURSEMENT: 'REIMBURSEMENT', OTHER: 'OTHER' } as const;
export type EmployeePayoutType = (typeof EMPLOYEE_PAYOUT_TYPES)[keyof typeof EMPLOYEE_PAYOUT_TYPES];
export const OUTGOING_PAYMENT_STATUSES = { DRAFT: 'DRAFT', APPROVED: 'APPROVED', PAID: 'PAID', REVERSED: 'REVERSED' } as const;
export type OutgoingPaymentStatus = (typeof OUTGOING_PAYMENT_STATUSES)[keyof typeof OUTGOING_PAYMENT_STATUSES];

export const SUPPORT_CATEGORIES = { GENERAL: 'GENERAL', TECHNICAL: 'TECHNICAL', PROJECT: 'PROJECT', BILLING: 'BILLING', ACCOUNT: 'ACCOUNT', OTHER: 'OTHER' } as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[keyof typeof SUPPORT_CATEGORIES];
export const SUPPORT_STATUSES = { OPEN: 'OPEN', IN_PROGRESS: 'IN_PROGRESS', WAITING_FOR_USER: 'WAITING_FOR_USER', RESOLVED: 'RESOLVED', CLOSED: 'CLOSED' } as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[keyof typeof SUPPORT_STATUSES];
export const SUPPORT_PRIORITIES = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', URGENT: 'URGENT' } as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[keyof typeof SUPPORT_PRIORITIES];

