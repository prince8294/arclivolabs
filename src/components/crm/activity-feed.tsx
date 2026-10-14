import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import {
  CALL_RESULT_LABELS,
  COMMUNICATION_DIRECTION_LABELS,
  COMMUNICATION_TYPE_LABELS,
} from '@/lib/constants/enums';
import { formatDateTime } from '@/lib/utils/format';
import type { RecentActivityItem } from '@/lib/queries/communications';
import { CommunicationTypePill } from '@/components/crm/communication-item';

export interface ActivityFeedProps {
  items: RecentActivityItem[];
  /** Route prefix for the lead detail links. */
  basePath: string;
}

/**
 * "Recent activity" feed for the CRM overview and the
 * marketing dashboard: the latest timeline entries across
 * every lead in the caller's scope.
 */
export default function ActivityFeed({
  items,
  basePath,
}: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        No activity yet. Log a call, email or note on a lead to
        start the feed.
      </p>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`${basePath}/${item.leadId}`}
            className="group flex items-start gap-3 px-1 py-2.5 transition-colors hover:bg-accent/50"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-foreground">
                <span className="font-medium">
                  {item.createdByName ?? 'System'}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  {activityVerb(item)}
                  {' '}
                </span>
                <span className="font-medium">
                  {item.leadName}
                </span>
                {item.companyName ? (
                  <span className="text-muted-foreground">
                    {' '}
                    · {item.companyName}
                  </span>
                ) : null}
              </span>
              {item.summary && (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {item.summary}
                </span>
              )}
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span className="font-mono">{item.leadCode}</span>
                <CommunicationTypePill type={item.type} />
                {item.direction && (
                  <span>
                    {COMMUNICATION_DIRECTION_LABELS[item.direction]}
                  </span>
                )}
                {item.callResult && (
                  <span>
                    {CALL_RESULT_LABELS[item.callResult]}
                  </span>
                )}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-x-1.5 text-xs text-muted-foreground">
              <time dateTime={item.occurredAt.toISOString()}>
                {formatDateTime(item.occurredAt)}
              </time>
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function activityVerb(item: RecentActivityItem): string {
  switch (item.type) {
    case 'CALL':
      return 'logged a call with';
    case 'WHATSAPP':
      return 'logged a WhatsApp message with';
    case 'EMAIL':
      return 'logged an email with';
    case 'MEETING':
      return 'recorded a meeting for';
    case 'INTERNAL_NOTE':
      return 'added a note on';
    case 'FOLLOW_UP':
      return 'updated the follow-up for';
    default:
      return 'updated';
  }
}
