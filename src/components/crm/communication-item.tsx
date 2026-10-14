import {
  CalendarClock,
  CheckCircle2,
  Info,
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from 'lucide-react';

import {
  CALL_RESULT_LABELS,
  COMMUNICATION_DIRECTION_LABELS,
  COMMUNICATION_TYPE_LABELS,
  COMMUNICATION_TYPES,
  type CallResult,
  type CommunicationDirection,
  type CommunicationType,
  type LeadActivityEvent,
} from '@/lib/constants/enums';
import { formatDateTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { CommunicationListItem } from '@/lib/queries/communications';

export const COMMUNICATION_ICONS: Record<
  CommunicationType,
  LucideIcon
> = {
  [COMMUNICATION_TYPES.CALL]: Phone,
  [COMMUNICATION_TYPES.WHATSAPP]: MessageSquare,
  [COMMUNICATION_TYPES.EMAIL]: Mail,
  [COMMUNICATION_TYPES.MEETING]: Users,
  [COMMUNICATION_TYPES.INTERNAL_NOTE]: StickyNote,
  [COMMUNICATION_TYPES.FOLLOW_UP]: CalendarClock,
  [COMMUNICATION_TYPES.SYSTEM]: Info,
};

const TYPE_ACCENTS: Record<CommunicationType, string> = {
  [COMMUNICATION_TYPES.CALL]: 'bg-info/10 text-info',
  [COMMUNICATION_TYPES.WHATSAPP]: 'bg-success/10 text-success',
  [COMMUNICATION_TYPES.EMAIL]: 'bg-primary/10 text-primary',
  [COMMUNICATION_TYPES.MEETING]: 'bg-warning/10 text-warning',
  [COMMUNICATION_TYPES.INTERNAL_NOTE]:
    'bg-secondary text-secondary-foreground',
  [COMMUNICATION_TYPES.FOLLOW_UP]: 'bg-info/10 text-info',
  [COMMUNICATION_TYPES.SYSTEM]: 'bg-muted text-muted-foreground',
};

/**
 * One timeline entry.
 *
 * Rendered as a card (not a table row) so the timeline stays
 * readable on phones. The icon, type label, direction and call
 * result are all derived from the stored enum values — never from
 * the raw string — so a new type cannot render as an empty chip.
 */
export default function CommunicationItem({
  item,
}: {
  item: CommunicationListItem;
}) {
  const Icon = COMMUNICATION_ICONS[item.type];
  const isSystem = item.type === COMMUNICATION_TYPES.SYSTEM;
  const title =
    item.subject ??
    (isSystem || item.event
      ? COMMUNICATION_TYPE_LABELS[item.type]
      : COMMUNICATION_TYPE_LABELS[item.type]);

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {/* Timeline rail */}
      <span
        className="absolute left-[17px] top-10 bottom-0 w-px bg-border"
        aria-hidden="true"
      />
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          TYPE_ACCENTS[item.type]
        )}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-sm font-semibold text-foreground">
            {title}
          </p>
          <span className="text-xs text-muted-foreground">
            {COMMUNICATION_TYPE_LABELS[item.type]}
            {item.direction &&
            item.direction !== 'INTERNAL' &&
            item.type !== COMMUNICATION_TYPES.SYSTEM
              ? ` · ${COMMUNICATION_DIRECTION_LABELS[item.direction]}`
              : ''}
            {item.callResult
              ? ` · ${CALL_RESULT_LABELS[item.callResult as CallResult]}`
              : ''}
          </span>
        </div>

        {item.summary && (
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {item.summary}
          </p>
        )}
        {item.notes && (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {item.notes}
          </p>
        )}
        {item.contactPerson && (
          <p className="mt-1 text-xs text-muted-foreground">
            Contact: {item.contactPerson}
          </p>
        )}
        {item.nextFollowUpAt && (
          <p className="mt-1 inline-flex items-center gap-x-1 text-xs text-info">
            <CalendarClock className="h-3 w-3" aria-hidden="true" />
            Follow-up: {formatDateTime(item.nextFollowUpAt)}
          </p>
        )}

        <p className="mt-1.5 text-xs text-muted-foreground">
          {item.createdBy?.name ?? 'System'}
          <span aria-hidden="true"> · </span>
          <time dateTime={item.occurredAt.toISOString()}>
            {formatDateTime(item.occurredAt)}
          </time>
        </p>
      </div>
    </li>
  );
}

/** Direction pill for compact contexts (dashboard feeds). */
export function CommunicationDirectionPill({
  direction,
}: {
  direction: CommunicationDirection | null;
}) {
  if (!direction) {
    return null;
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {COMMUNICATION_DIRECTION_LABELS[direction]}
    </span>
  );
}

/** Type pill for compact contexts. */
export function CommunicationTypePill({
  type,
}: {
  type: CommunicationType;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        TYPE_ACCENTS[type],
        'border-border'
      )}
    >
      {COMMUNICATION_TYPE_LABELS[type]}
    </span>
  );
}

/** Event code → short label, for system entries in feeds. */
export function systemEventLabel(
  event: LeadActivityEvent | null
): string | null {
  if (!event) {
    return null;
  }
  return event
    .split('_')
    .map((part) => (part.length ? part[0] + part.slice(1).toLowerCase() : part))
    .join(' ');
}
