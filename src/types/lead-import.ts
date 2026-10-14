import type { LeadImportRowStatus, LeadDuplicateLevel, LeadDuplicatePolicy, LeadImportStatus, LeadDistributionMode, LeadDistributionStatus } from '@/lib/constants/lead-import';

/**
 * Shared TypeScript types for the CSV lead import + distribution flows.
 *
 * These are deliberately narrow and serializable — they cross the
 * client/server boundary in the import wizard and the distribution panel.
 * No Mongoose types, no `any`.
 */

/* -------------------------------------------------------------------------- */
/* CSV parsing & mapping                                                       */
/* -------------------------------------------------------------------------- */

export interface CsvParseResult {
  headers: string[];
  rows: string[][];               // trimmed cells, no header row
  parseErrors: string[];          // papaparse error messages (row indices)
  rowCount: number;               // data rows only
}

/** One CSV column → one Arclivo field, or null = ignore this column. */
export interface ColumnMapping {
  [field: string]: string | null;
}

/* -------------------------------------------------------------------------- */
/* Normalised row (what the server & preview expect)                           */
/* -------------------------------------------------------------------------- */

export interface NormalizedLeadImportRow {
  rowNumber: number;              // 1-based from the CSV data rows
  name: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  website: string | null;
  source: string | null;          // raw text from CSV; validated against enums
  serviceInterestText: string | null; // free text, resolved against Service names
  estimatedBudget: number | null; // NaN filtered out
  currency: string | null;        // validated against CURRENCIES, uppercased
  notes: string | null;
  /** Original raw cells in template order (for invalid-row export). */
  originalCells: string[];
}

export interface LeadImportValidationResult {
  rowNumber: number;
  status: LeadImportRowStatus;
  errors: string[];               // empty → VALID or WARNING
  warnings: string[];             // non-empty on WARNING (and sometimes VALID)
  value: NormalizedLeadImportRow | null;  // null on INVALID
  duplicateLevel: LeadDuplicateLevel;
  duplicateMatches: { leadCode: string; matchType: 'email' | 'phone' }[];
}

/* -------------------------------------------------------------------------- */
/* Preview payload                                                             */
/* -------------------------------------------------------------------------- */

export interface LeadImportPreviewRow {
  rowNumber: number;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  serviceInterestText: string;
  estimatedBudget: number | null;
  currency: string;
  status: LeadImportRowStatus;
  errors: string[];
  warnings: string[];
  duplicateLevel: LeadDuplicateLevel;
  duplicateMatches: { leadCode: string; matchType: 'email' | 'phone' }[];
}

export interface LeadImportSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  invalidRows: number;
  duplicateRows: number;
  rowsWithBothDuplicates: number;
  skippedDuplicateRows: number;      // depends on policy
  willImport: number;                // after policy applied
}

export interface LeadImportPreviewResult {
  ok: boolean;
  error?: string;
  summary?: LeadImportSummary;
  previewRows?: LeadImportPreviewRow[];
  headers?: string[];
  parseErrors?: string[];
  /** Row number → error messages, for invalid-row CSV export. */
  rowIssues?: Record<number, string[]>;
  /** Row number → duplicate info, for export. */
  duplicateRows?: Record<number, { level: LeadDuplicateLevel; matches: { leadCode: string; matchType: 'email' | 'phone' }[] }>;
}

/* -------------------------------------------------------------------------- */
/* Commit payload                                                              */
/* -------------------------------------------------------------------------- */

export interface LeadImportCommitResult {
  ok: boolean;
  error?: string;
  batchId?: string;
  importCode?: string;
  summary?: LeadImportSummary;
  importedCount?: number;
  failedCount?: number;
  isIdempotentReplay?: boolean;
}

export interface LeadImportCommitRequest {
  requestId: string;
  mapping: ColumnMapping;
  assignmentMode: LeadDistributionMode;
  /** Used when mode = SINGLE_USER. */
  assignedToUserId?: string;
  /** Used when mode = ROUND_ROBIN. */
  userIds?: string[];
  /** Default NEW, Admin can override. */
  defaultStatus: string;
  duplicatePolicy: LeadDuplicatePolicy;
}

/* -------------------------------------------------------------------------- */
/* Distribution                                                                */
/* -------------------------------------------------------------------------- */

export interface LeadDistributionPreview {
  totalLeads: number;
  userIds: string[];
  allocation: { userId: string; count: number }[];
}

export interface LeadDistributionResult {
  ok: boolean;
  error?: string;
  distributionCode?: string;
  distributionId?: string;
  leadCount?: number;
  userAllocation?: { userId: string; count: number }[];
  updatedLeads?: number;
  failedLeads?: number;
}

/* -------------------------------------------------------------------------- */
/* Bulk actions                                                                */
/* -------------------------------------------------------------------------- */

export interface BulkAssignInput {
  leadIds: string[];
  assignedToUserId: string;  // non-empty
}

export interface BulkUnassignInput {
  leadIds: string[];
}

export interface BulkStatusInput {
  leadIds: string[];
  status: string;  // validated against LEAD_STATUSES
}

export interface BulkDistributeInput {
  leadIds: string[];
  mode: LeadDistributionMode;
  userIds: string[];  // non-empty when mode requires users
}

export interface BulkActionResult {
  ok: boolean;
  error?: string;
  updatedCount?: number;
  failedCount?: number;
  message?: string;
}

/* -------------------------------------------------------------------------- */
/* History listings                                                            */
/* -------------------------------------------------------------------------- */

export interface LeadImportHistoryItem {
  importCode: string;
  fileName: string;
  status: LeadImportStatus;
  totalRows: number;
  importedRows: number;
  skippedDuplicateRows: number;
  invalidRows: number;
  createdBy: string;
  createdAt: Date;
  completedAt: Date | null;
  assignmentMode: LeadDistributionMode;
  assignedUserIds: string[];
}

export interface LeadDistributionHistoryItem {
  distributionCode: string;
  mode: LeadDistributionMode;
  leadCount: number;
  userAllocation: { userId: string; name: string; marketingCode: string | null; count: number }[];
  filtersSnapshot: { label: string; value: string }[];
  status: LeadDistributionStatus;
  createdBy: string;
  createdAt: Date;
  completedAt: Date | null;
}

/* -------------------------------------------------------------------------- */
/* Lead import batch detail (for /admin/crm/import/[id])                       */
/* -------------------------------------------------------------------------- */

export interface LeadImportDetail extends LeadImportHistoryItem {
  duplicatePolicy: LeadDuplicatePolicy;
  defaultStatus: string;
  columnMapping: ColumnMapping;
  invalidRowCount: number;
  warningRowCount: number;
}

/* -------------------------------------------------------------------------- */
/* Import wizard state (client)                                                */
/* -------------------------------------------------------------------------- */

export type ImportWizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface ImportWizardState {
  step: ImportWizardStep;
  file?: File;
  fileName?: string;
  fileSize?: number;
  parseResult?: CsvParseResult;
  mapping?: ColumnMapping;
  validationResults?: LeadImportValidationResult[];
  previewResult?: LeadImportPreviewResult;
  assignmentMode?: LeadDistributionMode;
  assignedToUserId?: string;
  userIds?: string[];
  duplicatePolicy?: LeadDuplicatePolicy;
  defaultStatus?: string;
  commitResult?: LeadImportCommitResult;
  isSubmitting?: boolean;
}