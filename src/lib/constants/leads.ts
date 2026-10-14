import type { FollowUpState } from '@/lib/utils/follow-up';
import type { LeadSource, LeadStatus } from './enums';

/**
 * Client-safe vocabulary for the CRM lead lists.
 *
 * Everything here is plain data (no Mongoose, no database access), so it
 * can be imported by both server components and the filter/table/form
 * client components. The server-only data access lives in
 * `src/lib/queries/leads.ts`, which must never be pulled into the browser
 * bundle.
 */

/** Page sizes a lead list may request. Anything else falls back to 20. */
export const LEAD_PAGE_SIZES = [20, 50, 100] as const;
export type LeadPageSize = (typeof LEAD_PAGE_SIZES)[number];
export const LEAD_PAGE_SIZE_DEFAULT: LeadPageSize = 20;

/**
 * Supported sort orders. This is a fixed allow-list — no generic sort
 * engine, because a user-supplied field name must never reach MongoDB.
 */
export const LEAD_SORTS = {
  NEWEST: 'NEWEST',
  OLDEST: 'OLDEST',
  FOLLOW_UP: 'FOLLOW_UP',
  UPDATED: 'UPDATED',
} as const;

export type LeadSort = (typeof LEAD_SORTS)[keyof typeof LEAD_SORTS];

export const LEAD_SORT_LABELS: Record<LeadSort, string> = {
  [LEAD_SORTS.NEWEST]: 'Newest first',
  [LEAD_SORTS.OLDEST]: 'Oldest first',
  [LEAD_SORTS.FOLLOW_UP]: 'Next follow-up',
  [LEAD_SORTS.UPDATED]: 'Recently updated',
};

/** Assignment-filter values that are not user ids. */
export const ASSIGNMENT_FILTER_UNASSIGNED = 'unassigned';
export const ASSIGNMENT_FILTER_ASSIGNED = 'assigned';

/** Whitelisted, already-parsed query state for a lead list. */
export interface LeadListParams {
  search: string;
  status: LeadStatus | '';
  source: LeadSource | '';
  /** '' | 'unassigned' | 'assigned' | a marketing user ObjectId. */
  assignedTo: string;
  service: string;
  /** `YYYY-MM-DD` inclusive lower bound on createdAt (local time). */
  createdFrom: string;
  /** `YYYY-MM-DD` inclusive upper bound on createdAt (local time). */
  createdTo: string;
  followUp: FollowUpState | '';
  /** Filter to a single CSV import batch (its ObjectId), or ''. */
  importBatch: string;
  sort: LeadSort;
  page: number;
  limit: LeadPageSize;
}

/** Minimal, safe projection of a marketing user shown next to a lead. */
export interface AssignableMarketingUser {
  id: string;
  name: string;
  email: string;
  marketingCode: string | null;
}

/** Catalogue option for the "Service interest" picker. */
export interface ServiceOption {
  id: string;
  name: string;
}

/** One column of the pipeline summary board. */
export interface PipelineStage {
  status: LeadStatus;
  label: string;
  count: number;
}