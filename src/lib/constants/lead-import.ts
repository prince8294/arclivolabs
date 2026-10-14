/**
 * Client-safe vocabulary for CSV lead import and lead distribution.
 *
 * Plain data only (no Mongoose, no database access) so the import wizard,
 * the mapping table, the preview grid and the distribution panel can all
 * import from here. The server-only data access lives in
 * `src/lib/queries/lead-import.ts` and
 * `src/lib/queries/lead-distribution.ts`.
 *
 * Nothing in this file is derived from user input at module scope; the
 * mappings are an explicit allow-list, never a guess based on a
 * user-supplied field name.
 */

/* -------------------------------------------------------------------------- */
/* Importable lead fields                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The Arclivo lead fields a CSV column can be mapped onto.
 *
 * `serviceInterest` maps to *text* in a CSV (e.g. "Website Development") and
 * is resolved against the active Service catalogue during import — the Lead
 * model stores Service references, never free text.
 */
export const LEAD_IMPORT_FIELDS = {
  NAME: 'name',
  COMPANY_NAME: 'companyName',
  EMAIL: 'email',
  PHONE: 'phone',
  ALTERNATE_PHONE: 'alternatePhone',
  WEBSITE: 'website',
  SOURCE: 'source',
  SERVICE_INTEREST: 'serviceInterest',
  ESTIMATED_BUDGET: 'estimatedBudget',
  CURRENCY: 'currency',
  NOTES: 'notes',
} as const;

export type LeadImportField =
  (typeof LEAD_IMPORT_FIELDS)[keyof typeof LEAD_IMPORT_FIELDS];

/** Display order of the mapping table, and the template column order. */
export const LEAD_IMPORT_FIELD_ORDER: readonly LeadImportField[] = [
  LEAD_IMPORT_FIELDS.NAME,
  LEAD_IMPORT_FIELDS.COMPANY_NAME,
  LEAD_IMPORT_FIELDS.EMAIL,
  LEAD_IMPORT_FIELDS.PHONE,
  LEAD_IMPORT_FIELDS.ALTERNATE_PHONE,
  LEAD_IMPORT_FIELDS.WEBSITE,
  LEAD_IMPORT_FIELDS.SOURCE,
  LEAD_IMPORT_FIELDS.SERVICE_INTEREST,
  LEAD_IMPORT_FIELDS.ESTIMATED_BUDGET,
  LEAD_IMPORT_FIELDS.CURRENCY,
  LEAD_IMPORT_FIELDS.NOTES,
];

export const LEAD_IMPORT_FIELD_LABELS: Record<LeadImportField, string> = {
  [LEAD_IMPORT_FIELDS.NAME]: 'Contact name',
  [LEAD_IMPORT_FIELDS.COMPANY_NAME]: 'Company name',
  [LEAD_IMPORT_FIELDS.EMAIL]: 'Email',
  [LEAD_IMPORT_FIELDS.PHONE]: 'Phone',
  [LEAD_IMPORT_FIELDS.ALTERNATE_PHONE]: 'Alternate phone',
  [LEAD_IMPORT_FIELDS.WEBSITE]: 'Website',
  [LEAD_IMPORT_FIELDS.SOURCE]: 'Lead source',
  [LEAD_IMPORT_FIELDS.SERVICE_INTEREST]: 'Service interest',
  [LEAD_IMPORT_FIELDS.ESTIMATED_BUDGET]: 'Estimated budget',
  [LEAD_IMPORT_FIELDS.CURRENCY]: 'Currency',
  [LEAD_IMPORT_FIELDS.NOTES]: 'Notes',
};

/** Required to import a file at all. */
export const LEAD_IMPORT_REQUIRED_FIELDS: readonly LeadImportField[] = [
  LEAD_IMPORT_FIELDS.NAME,
];

/** At least one of these must be mapped, and the value must be present. */
export const LEAD_IMPORT_CONTACT_FIELDS: readonly LeadImportField[] = [
  LEAD_IMPORT_FIELDS.EMAIL,
  LEAD_IMPORT_FIELDS.PHONE,
];

/* -------------------------------------------------------------------------- */
/* Template + header aliases                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The official template header per field. Downloaded verbatim by the
 * template route, and matched exactly (case-insensitively, ignoring
 * spaces/underscores) when auto-mapping an uploaded file.
 */
export const LEAD_IMPORT_TEMPLATE_HEADERS: Record<LeadImportField, string> = {
  [LEAD_IMPORT_FIELDS.NAME]: 'name',
  [LEAD_IMPORT_FIELDS.COMPANY_NAME]: 'companyName',
  [LEAD_IMPORT_FIELDS.EMAIL]: 'email',
  [LEAD_IMPORT_FIELDS.PHONE]: 'phone',
  [LEAD_IMPORT_FIELDS.ALTERNATE_PHONE]: 'alternatePhone',
  [LEAD_IMPORT_FIELDS.WEBSITE]: 'website',
  [LEAD_IMPORT_FIELDS.SOURCE]: 'source',
  [LEAD_IMPORT_FIELDS.SERVICE_INTEREST]: 'serviceInterest',
  [LEAD_IMPORT_FIELDS.ESTIMATED_BUDGET]: 'estimatedBudget',
  [LEAD_IMPORT_FIELDS.CURRENCY]: 'currency',
  [LEAD_IMPORT_FIELDS.NOTES]: 'notes',
};

/**
 * One example row, shown on the import page as documentation only. It is
 * NOT part of the downloadable template (which is headers only) so it can
 * never be imported by accident.
 */
export const LEAD_IMPORT_EXAMPLE_ROW: readonly string[] = [
  'John Doe',
  'ABC Restaurant',
  'john@example.com',
  '+919999999999',
  '',
  'https://example.com',
  'MANUAL',
  'Website Development',
  '25000',
  'INR',
  'Interested in business website',
];

/**
 * Common header spellings mapped to a field, beyond the official template.
 *
 * Matching ignores case, spaces, hyphens and underscores. This is a
 * deliberate, explicit allow-list: a fuzzy or AI-based mapper is not used,
 * and the admin can always override every mapping by hand.
 */
export const LEAD_IMPORT_HEADER_ALIASES: Record<string, LeadImportField> = {
  name: LEAD_IMPORT_FIELDS.NAME,
  fullname: LEAD_IMPORT_FIELDS.NAME,
  contactname: LEAD_IMPORT_FIELDS.NAME,
  leadname: LEAD_IMPORT_FIELDS.NAME,
  contactperson: LEAD_IMPORT_FIELDS.NAME,

  company: LEAD_IMPORT_FIELDS.COMPANY_NAME,
  companyname: LEAD_IMPORT_FIELDS.COMPANY_NAME,
  business: LEAD_IMPORT_FIELDS.COMPANY_NAME,
  businessname: LEAD_IMPORT_FIELDS.COMPANY_NAME,
  organization: LEAD_IMPORT_FIELDS.COMPANY_NAME,
  organisation: LEAD_IMPORT_FIELDS.COMPANY_NAME,

  email: LEAD_IMPORT_FIELDS.EMAIL,
  emailaddress: LEAD_IMPORT_FIELDS.EMAIL,
  mail: LEAD_IMPORT_FIELDS.EMAIL,

  phone: LEAD_IMPORT_FIELDS.PHONE,
  phonenumber: LEAD_IMPORT_FIELDS.PHONE,
  mobile: LEAD_IMPORT_FIELDS.PHONE,
  mobilenumber: LEAD_IMPORT_FIELDS.PHONE,
  contactnumber: LEAD_IMPORT_FIELDS.PHONE,
  primaryphone: LEAD_IMPORT_FIELDS.PHONE,

  alternatephone: LEAD_IMPORT_FIELDS.ALTERNATE_PHONE,
  alternatemobile: LEAD_IMPORT_FIELDS.ALTERNATE_PHONE,
  altphone: LEAD_IMPORT_FIELDS.ALTERNATE_PHONE,
  secondaryphone: LEAD_IMPORT_FIELDS.ALTERNATE_PHONE,

  website: LEAD_IMPORT_FIELDS.WEBSITE,
  web: LEAD_IMPORT_FIELDS.WEBSITE,
  url: LEAD_IMPORT_FIELDS.WEBSITE,
  site: LEAD_IMPORT_FIELDS.WEBSITE,

  source: LEAD_IMPORT_FIELDS.SOURCE,
  leadsource: LEAD_IMPORT_FIELDS.SOURCE,
  channel: LEAD_IMPORT_FIELDS.SOURCE,

  service: LEAD_IMPORT_FIELDS.SERVICE_INTEREST,
  services: LEAD_IMPORT_FIELDS.SERVICE_INTEREST,
  serviceinterest: LEAD_IMPORT_FIELDS.SERVICE_INTEREST,
  interestedin: LEAD_IMPORT_FIELDS.SERVICE_INTEREST,
  requirement: LEAD_IMPORT_FIELDS.SERVICE_INTEREST,

  budget: LEAD_IMPORT_FIELDS.ESTIMATED_BUDGET,
  estimatedbudget: LEAD_IMPORT_FIELDS.ESTIMATED_BUDGET,
  expectedbudget: LEAD_IMPORT_FIELDS.ESTIMATED_BUDGET,
  projectbudget: LEAD_IMPORT_FIELDS.ESTIMATED_BUDGET,

  currency: LEAD_IMPORT_FIELDS.CURRENCY,
  currencycode: LEAD_IMPORT_FIELDS.CURRENCY,

  notes: LEAD_IMPORT_FIELDS.NOTES,
  note: LEAD_IMPORT_FIELDS.NOTES,
  comment: LEAD_IMPORT_FIELDS.NOTES,
  comments: LEAD_IMPORT_FIELDS.NOTES,
  remarks: LEAD_IMPORT_FIELDS.NOTES,
  details: LEAD_IMPORT_FIELDS.NOTES,
};

/* -------------------------------------------------------------------------- */
/* Limits                                                                      */
/* -------------------------------------------------------------------------- */

/** Hard ceiling on the uploaded file, in bytes (5 MB). */
export const LEAD_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Hard ceiling on data rows per import operation (excludes the header). */
export const LEAD_IMPORT_MAX_ROWS = 5000;

/** Rows rendered in the preview grid — the browser never gets thousands. */
export const LEAD_IMPORT_PREVIEW_ROW_LIMIT = 50;

/** Database insert batch size for one import. */
export const LEAD_IMPORT_INSERT_BATCH_SIZE = 200;

/** Accepted file extensions. */
export const LEAD_IMPORT_ACCEPTED_EXTENSIONS = ['.csv'] as const;

/**
 * Bulk operations up to this size also write one timeline entry per lead
 * (Part 6 audit trail). Above it, only the batch/distribution audit record
 * is written — see `BULK_ACTIVITY_THRESHOLD_NOTE` in the actions.
 */
export const LEAD_BULK_ACTIVITY_LIMIT = 25;

/* -------------------------------------------------------------------------- */
/* Row + duplicate status                                                      */
/* -------------------------------------------------------------------------- */

export const LEAD_IMPORT_ROW_STATUSES = {
  VALID: 'VALID',
  WARNING: 'WARNING',
  INVALID: 'INVALID',
  DUPLICATE: 'DUPLICATE',
} as const;

export type LeadImportRowStatus =
  (typeof LEAD_IMPORT_ROW_STATUSES)[keyof typeof LEAD_IMPORT_ROW_STATUSES];

export const LEAD_IMPORT_ROW_STATUS_LABELS: Record<LeadImportRowStatus, string> = {
  [LEAD_IMPORT_ROW_STATUSES.VALID]: 'Valid',
  [LEAD_IMPORT_ROW_STATUSES.WARNING]: 'Warning',
  [LEAD_IMPORT_ROW_STATUSES.INVALID]: 'Invalid',
  [LEAD_IMPORT_ROW_STATUSES.DUPLICATE]: 'Duplicate',
};

/**
 * Duplicate detection is advisory: lead email/phone are intentionally NOT
 * unique, so a match warns instead of blocking. A row can match both an
 * existing lead and another row in the same file.
 */
export const LEAD_DUPLICATE_LEVELS = {
  EXISTING_LEAD: 'EXISTING_LEAD',
  DUPLICATE_IN_FILE: 'DUPLICATE_IN_FILE',
  NO_DUPLICATE: 'NO_DUPLICATE',
} as const;

export type LeadDuplicateLevel =
  (typeof LEAD_DUPLICATE_LEVELS)[keyof typeof LEAD_DUPLICATE_LEVELS];

/** Admin's choice for potential duplicates at commit time. */
export const LEAD_DUPLICATE_POLICIES = {
  /** Default: advisory matches are skipped, never merged. */
  SKIP: 'SKIP',
  IMPORT: 'IMPORT',
} as const;

export type LeadDuplicatePolicy =
  (typeof LEAD_DUPLICATE_POLICIES)[keyof typeof LEAD_DUPLICATE_POLICIES];

/* -------------------------------------------------------------------------- */
/* Import batch lifecycle                                                      */
/* -------------------------------------------------------------------------- */

export const LEAD_IMPORT_STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
} as const;

export type LeadImportStatus =
  (typeof LEAD_IMPORT_STATUSES)[keyof typeof LEAD_IMPORT_STATUSES];

export const LEAD_IMPORT_STATUS_LABELS: Record<LeadImportStatus, string> = {
  [LEAD_IMPORT_STATUSES.PENDING]: 'Pending',
  [LEAD_IMPORT_STATUSES.PROCESSING]: 'Processing',
  [LEAD_IMPORT_STATUSES.COMPLETED]: 'Completed',
  [LEAD_IMPORT_STATUSES.PARTIAL]: 'Partial',
  [LEAD_IMPORT_STATUSES.FAILED]: 'Failed',
};

/* -------------------------------------------------------------------------- */
/* Distribution modes                                                          */
/* -------------------------------------------------------------------------- */

export const LEAD_DISTRIBUTION_MODES = {
  /** Import only: leave every lead in the shared pool. */
  UNASSIGNED: 'UNASSIGNED',
  /** Everyone selected goes to the same marketing user. */
  SINGLE_USER: 'SINGLE_USER',
  /** Deterministic even split across the selected users. */
  ROUND_ROBIN: 'ROUND_ROBIN',
} as const;

export type LeadDistributionMode =
  (typeof LEAD_DISTRIBUTION_MODES)[keyof typeof LEAD_DISTRIBUTION_MODES];

export const LEAD_DISTRIBUTION_MODE_LABELS: Record<LeadDistributionMode, string> = {
  [LEAD_DISTRIBUTION_MODES.UNASSIGNED]: 'Leave unassigned',
  [LEAD_DISTRIBUTION_MODES.SINGLE_USER]: 'Assign all to one user',
  [LEAD_DISTRIBUTION_MODES.ROUND_ROBIN]: 'Distribute round robin',
};

export const LEAD_DISTRIBUTION_MODES_REQUIRING_USERS: readonly LeadDistributionMode[] =
  [LEAD_DISTRIBUTION_MODES.SINGLE_USER, LEAD_DISTRIBUTION_MODES.ROUND_ROBIN];

export const LEAD_DISTRIBUTION_STATUSES = {
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
} as const;

export type LeadDistributionStatus =
  (typeof LEAD_DISTRIBUTION_STATUSES)[keyof typeof LEAD_DISTRIBUTION_STATUSES];

export const LEAD_DISTRIBUTION_STATUS_LABELS: Record<
  LeadDistributionStatus,
  string
> = {
  [LEAD_DISTRIBUTION_STATUSES.COMPLETED]: 'Completed',
  [LEAD_DISTRIBUTION_STATUSES.PARTIAL]: 'Partial',
  [LEAD_DISTRIBUTION_STATUSES.FAILED]: 'Failed',
};

/** Distribution filter value: leads owned by a non-ACTIVE marketing user. */
export const DISTRIBUTION_FILTER_INACTIVE_OWNER = 'inactive_owner';
