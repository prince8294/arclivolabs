import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export interface PaginationProps {
  /** Route without query string, e.g. `/admin/employees`. */
  baseUrl: string;
  page: number;
  limit: number;
  total: number;
  /**
   * Active filter params to carry over to page links (search, status,
   * department, ...). The current `page` is excluded on purpose —
   * navigation always targets the requested page.
   */
  filters: Record<string, string>;
}

function buildHref(
  baseUrl: string,
  page: number,
  filters: Record<string, string>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const query = params.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

/**
 * Server-rendered pagination: Previous / Next plus page + total context.
 * Plain links keep it dependency-free and work with any query-driven
 * list page.
 */
export default function Pagination({
  baseUrl,
  page,
  limit,
  total,
  filters,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1 && total <= limit) {
    // Still show the record count when there is nothing to page.
    return (
      <p className="text-sm text-muted-foreground">
        Showing {total} {total === 1 ? 'record' : 'records'}
      </p>
    );
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} · {total}{' '}
        {total === 1 ? 'record' : 'records'}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={buildHref(baseUrl, page - 1, filters)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : 0}
          onClick={(event) => {
            if (page <= 1) {
              event.preventDefault();
            }
          }}
          className={cn(
            'inline-flex h-9 items-center gap-x-1 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent',
            page <= 1 &&
              'pointer-events-none text-muted-foreground/50'
          )}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </Link>
        <Link
          href={buildHref(baseUrl, page + 1, filters)}
          aria-disabled={page >= totalPages}
          tabIndex={page >= totalPages ? -1 : 0}
          onClick={(event) => {
            if (page >= totalPages) {
              event.preventDefault();
            }
          }}
          className={cn(
            'inline-flex h-9 items-center gap-x-1 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent',
            page >= totalPages &&
              'pointer-events-none text-muted-foreground/50'
          )}
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
