'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';

import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
} from '@/lib/constants/enums';
import {
  ASSIGNMENT_FILTER_ASSIGNED,
  ASSIGNMENT_FILTER_UNASSIGNED,
  LEAD_PAGE_SIZES,
  LEAD_SORTS,
  LEAD_SORT_LABELS,
  type AssignableMarketingUser,
  type LeadListParams,
  type ServiceOption,
} from '@/lib/constants/leads';
import {
  FOLLOW_UP_STATES,
  FOLLOW_UP_STATE_LABELS,
} from '@/lib/utils/follow-up';
import { cn } from '@/lib/utils/cn';
import type { ImportBatchOption } from '@/lib/queries/leads';

export interface LeadFiltersProps {
  /** Route the GET form submits to, e.g. `/admin/crm/leads`. */
  endpoint: string;
  current: LeadListParams;
  /** Admin-only filters: assignee + created date range. */
  showAdminFilters: boolean;
  marketingUsers?: AssignableMarketingUser[];
  services?: ServiceOption[];
  /** Admin-only: recent CSV import batches. */
  importBatches?: ImportBatchOption[];
}

const selectClasses =
  'h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Search + filter bar for the lead lists.
 *
 * A plain GET form: submitting navigates to the list route with query
 * params (the current page is dropped so results restart at page 1) and
 * the server does the actual filtering. Every option list is rendered
 * from the shared constants, never hardcoded per form.
 */
export default function LeadFilters({
  endpoint,
  current,
  showAdminFilters,
  marketingUsers = [],
  services = [],
  importBatches = [],
}: LeadFiltersProps) {
  return (
    <form
      action={endpoint}
      method="get"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            name="search"
            defaultValue={current.search}
            maxLength={100}
            placeholder="Search by code, contact, company, email, phone…"
            aria-label="Search leads"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="sr-only">Status</span>
          <select
            name="status"
            defaultValue={current.status}
            className={selectClasses}
          >
            <option value="">All statuses</option>
            {Object.values(LEAD_STATUSES).map((value) => (
              <option key={value} value={value}>
                {LEAD_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="sr-only">Source</span>
          <select
            name="source"
            defaultValue={current.source}
            className={selectClasses}
          >
            <option value="">All sources</option>
            {Object.values(LEAD_SOURCES).map((value) => (
              <option key={value} value={value}>
                {LEAD_SOURCE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        {services.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only">Service</span>
            <select
              name="service"
              defaultValue={current.service}
              className={selectClasses}
            >
              <option value="">All services</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="sr-only">Follow-up state</span>
          <select
            name="followUp"
            defaultValue={current.followUp}
            className={selectClasses}
          >
            <option value="">Any follow-up</option>
            {Object.values(FOLLOW_UP_STATES).map((value) => (
              <option key={value} value={value}>
                {FOLLOW_UP_STATE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        {showAdminFilters && importBatches.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only">Import batch</span>
            <select
              name="importBatch"
              defaultValue={current.importBatch}
              className={selectClasses}
            >
              <option value="">Any import</option>
              {importBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.importCode} · {batch.fileName} ({batch.importedRows})
                </option>
              ))}
            </select>
          </label>
        )}

        {showAdminFilters && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only">Assigned marketing user</span>
            <select
              name="assignedTo"
              defaultValue={current.assignedTo}
              className={selectClasses}
            >
              <option value="">Any owner</option>
              <option value={ASSIGNMENT_FILTER_ASSIGNED}>Assigned</option>
              <option value={ASSIGNMENT_FILTER_UNASSIGNED}>
                Unassigned
              </option>
              {marketingUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                  {user.marketingCode ? ` (${user.marketingCode})` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="sr-only">Sort by</span>
          <select
            name="sort"
            defaultValue={current.sort}
            className={selectClasses}
          >
            {Object.values(LEAD_SORTS).map((value) => (
              <option key={value} value={value}>
                {LEAD_SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="sr-only">Rows per page</span>
          <select
            name="limit"
            defaultValue={String(current.limit)}
            className={selectClasses}
          >
            {LEAD_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </label>
      </div>

      {showAdminFilters && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">Created from</span>
            <input
              type="date"
              name="createdFrom"
              defaultValue={current.createdFrom}
              className={selectClasses}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">Created to</span>
            <input
              type="date"
              name="createdTo"
              defaultValue={current.createdTo}
              className={selectClasses}
            />
          </label>
        </div>
      )}

      <div className="flex items-center gap-2 sm:justify-end">
        <Link
          href={endpoint}
          className={cn(
            'inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          Clear
        </Link>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Apply
        </button>
      </div>
    </form>
  );
}