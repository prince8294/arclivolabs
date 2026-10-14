'use client';

import { Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface FilterFieldDef {
  name: string;
  label: string;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
}

export interface ListFiltersProps {
  /** Route the form GET-submits to, e.g. `/admin/employees`. */
  endpoint: string;
  searchPlaceholder?: string;
  /** Currently active values (rendered as input defaults). */
  current: {
    search?: string;
    status?: string;
    extra?: Record<string, string>;
  };
  statusOptions: Array<{ value: string; label: string }>;
  extraFilters?: FilterFieldDef[];
}

/**
 * Search + filter bar. A plain GET form: submitting navigates to the
 * list route with query params (page is dropped, so results always
 * restart from page 1) and the server does the actual filtering.
 */
export default function ListFilters({
  endpoint,
  searchPlaceholder = 'Search...',
  current,
  statusOptions,
  extraFilters = [],
}: ListFiltersProps) {
  const selectClasses =
    'h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <form
      action={endpoint}
      method="get"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <div className="relative min-w-56 flex-1">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          name="search"
          defaultValue={current.search}
          placeholder={searchPlaceholder}
          aria-label="Search"
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="sr-only">Status</span>
        <select
          name="status"
          defaultValue={current.status ?? ''}
          className={selectClasses}
        >
          <option value="">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {extraFilters.map((filter) => (
        <label
          key={filter.name}
          className={cn('flex items-center gap-2 text-sm text-muted-foreground')}
        >
          <span className="sr-only">{filter.label}</span>
          <select
            name={filter.name}
            defaultValue={current.extra?.[filter.name] ?? ''}
            className={selectClasses}
          >
            <option value="">{filter.allLabel}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      <div className="flex items-center gap-2 sm:ml-auto">
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
