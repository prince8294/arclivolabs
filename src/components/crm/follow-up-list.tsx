import Link from 'next/link';
import { ArrowRight, CalendarClock, Clock } from 'lucide-react';

import {
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from '@/lib/constants/enums';
import { formatDateTime } from '@/lib/utils/format';
import type { FollowUpLeadItem } from '@/lib/queries/leads';

export interface FollowUpListProps {
  items: FollowUpLeadItem[];
  /** Route prefix for the lead detail links. */
  basePath: string;
  /** `today` or `overdue`, for the empty-state copy. */
  variant: 'today' | 'overdue';
  /** Admin sees every lead; marketing only their own. */
  showOwner?: boolean;
}

/**
 * "Today's follow-ups" / "Overdue follow-ups" list.
 *
 * Real database rows, soonest first, linking straight into the
 * lead. Marketing users only ever see their own leads because
 * the query is scoped server-side.
 */
export default function FollowUpList({
  items,
  basePath,
  variant,
  showOwner = false,
}: FollowUpListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        {variant === 'overdue'
          ? 'No overdue follow-ups. Nice.'
          : 'No follow-ups due today.'}
      </p>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`${basePath}/${item.id}`}
            className="group flex items-center gap-3 px-1 py-2.5 transition-colors hover:bg-accent/50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
              <CalendarClock
                className="h-4 w-4"
                aria-hidden="true"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {item.name}
                {item.companyName ? (
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    · {item.companyName}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span className="font-mono">{item.leadCode}</span>
                <span>
                  {LEAD_STATUS_LABELS[item.status as LeadStatus]}
                </span>
                {showOwner && item.assignedToName && (
                  <span>{item.assignedToName}</span>
                )}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-x-1 text-xs font-medium text-foreground">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <time dateTime={item.nextFollowUpAt.toISOString()}>
                {formatDateTime(item.nextFollowUpAt)}
              </time>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}
