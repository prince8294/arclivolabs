import { Calendar, Clock, MapPin, Video } from 'lucide-react';

import MeetingStatusBadge from '@/components/crm/meeting-status-badge';
import {
  MEETING_TYPE_LABELS,
  type MeetingType,
} from '@/lib/constants/enums';
import { formatDateTime } from '@/lib/utils/format';
import type { MeetingListItem } from '@/lib/queries/meetings';

export interface MeetingCardProps {
  meeting: MeetingListItem;
  /** Route prefix for the lead detail link. */
  leadHref?: string;
  leadCode?: string;
  leadName?: string;
  /** Rendered by the page when actions are allowed. */
  actions?: React.ReactNode;
}

/**
 * One meeting as a card (responsive by construction — no wide
 * tables). Shows everything a staff member needs at a glance:
 * when, what kind, how long, where, and its lifecycle state.
 */
export default function MeetingCard({
  meeting,
  leadHref,
  leadCode,
  leadName,
  actions,
}: MeetingCardProps) {
  const isVideo = meeting.type === 'VIDEO';
  const isInPerson = meeting.type === 'IN_PERSON';

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {leadHref && leadCode ? (
              <a href={leadHref} className="hover:underline">
                {meeting.title}
              </a>
            ) : (
              meeting.title
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-x-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              <time dateTime={meeting.scheduledAt.toISOString()}>
                {formatDateTime(meeting.scheduledAt)}
              </time>
            </span>
            <span className="inline-flex items-center gap-x-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {meeting.durationMinutes} min
            </span>
            <span>{MEETING_TYPE_LABELS[meeting.type as MeetingType]}</span>
          </p>
        </div>
        <MeetingStatusBadge status={meeting.status} />
      </div>

      {(isVideo || isInPerson) && (
        <p className="flex items-center gap-x-1.5 text-xs text-muted-foreground">
          {isVideo ? (
            <Video className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isVideo && meeting.meetingUrl ? (
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate hover:underline"
            >
              {meeting.meetingUrl}
            </a>
          ) : (
            (meeting.location ?? '—')
          )}
        </p>
      )}

      {meeting.description && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {meeting.description}
        </p>
      )}

      {meeting.status !== 'SCHEDULED' && (
        <div className="flex flex-col gap-1 rounded-lg bg-muted/40 px-3 py-2">
          {meeting.outcome && (
            <p className="text-sm text-foreground">
              <span className="font-medium">Outcome: </span>
              {meeting.outcome}
            </p>
          )}
          {meeting.cancelReason && (
            <p className="text-sm text-foreground">
              <span className="font-medium">Reason: </span>
              {meeting.cancelReason}
            </p>
          )}
          {meeting.notes && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {meeting.notes}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          {meeting.assignedToName
            ? `With ${meeting.assignedToName}`
            : 'Unassigned'}
          {leadName ? ` · ${leadName}` : ''}
        </p>
        {actions}
      </div>
    </li>
  );
}
