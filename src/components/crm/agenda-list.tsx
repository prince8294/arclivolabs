import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';

import MeetingStatusBadge from '@/components/crm/meeting-status-badge';
import {
  MEETING_TYPE_LABELS,
} from '@/lib/constants/enums';
import { formatDateTime } from '@/lib/utils/format';
import type { AgendaMeetingItem } from '@/lib/queries/meetings';

export interface AgendaListProps {
  items: AgendaMeetingItem[];
  /** Route prefix for the lead detail links. */
  basePath: string;
  variant: 'today' | 'upcoming';
  /** Show the lead code + owner (admin overview). */
  showLead?: boolean;
}

/**
 * "Today's meetings" / "Upcoming meetings" list for the
 * dashboards. Scoped server-side, so a marketing user only
 * ever sees their own agenda.
 */
export default function AgendaList({
  items,
  basePath,
  variant,
  showLead = false,
}: AgendaListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        {variant === 'today'
          ? 'No meetings today.'
          : 'No upcoming meetings.'}
      </p>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`${basePath}/${item.leadId}`}
            className="group flex items-center gap-3 px-1 py-2.5 transition-colors hover:bg-accent/50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <Users className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {item.title}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {showLead && (
                  <>
                    <span className="font-mono">{item.leadCode}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>{MEETING_TYPE_LABELS[item.type]}</span>
                <span>{item.durationMinutes} min</span>
                {item.assignedToName && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{item.assignedToName}</span>
                  </>
                )}
              </span>
            </span>
            <MeetingStatusBadge status={item.status} />
            <span className="hidden shrink-0 text-xs font-medium text-foreground sm:block">
              <time dateTime={item.scheduledAt.toISOString()}>
                {formatDateTime(item.scheduledAt)}
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
