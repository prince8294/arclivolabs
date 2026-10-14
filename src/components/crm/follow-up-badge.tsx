import { CalendarClock } from 'lucide-react';

import {
  FOLLOW_UP_STATES,
  getFollowUpState,
  type FollowUpState,
} from '@/lib/utils/follow-up';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/format';

export interface FollowUpBadgeProps {
  nextFollowUpAt: Date | null;
  /**
   * Server render time, passed in by the caller so the derived state is
   * computed on the server only (never in the browser, which keeps the
   * markup hydration-safe).
   */
  now?: Date;
  className?: string;
}

const STATE_STYLES: Record<FollowUpState, string> = {
  [FOLLOW_UP_STATES.OVERDUE]:
    'bg-destructive/10 text-destructive border-destructive/30',
  [FOLLOW_UP_STATES.DUE_TODAY]:
    'bg-warning/10 text-warning border-warning/30',
  [FOLLOW_UP_STATES.UPCOMING]:
    'bg-info/10 text-info border-info/30',
  [FOLLOW_UP_STATES.NONE]: 'bg-muted text-muted-foreground border-border',
};

/**
 * Follow-up state pill derived from `nextFollowUpAt`.
 *
 * The label is never stored — it is computed from the date and the
 * current clock on every render, so a lead can never be stuck showing
 * "Yesterday" after the fact.
 */
export default function FollowUpBadge({
  nextFollowUpAt,
  now,
  className,
}: FollowUpBadgeProps) {
  const state = getFollowUpState(nextFollowUpAt, now);

  if (state === FOLLOW_UP_STATES.NONE) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
          STATE_STYLES[FOLLOW_UP_STATES.NONE],
          className
        )}
      >
        No follow-up
      </span>
    );
  }

  const label =
    state === FOLLOW_UP_STATES.OVERDUE
      ? 'Overdue'
      : state === FOLLOW_UP_STATES.DUE_TODAY
        ? 'Today'
        : 'Upcoming';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-x-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        STATE_STYLES[state],
        className
      )}
      title={formatDateTime(nextFollowUpAt)}
    >
      <CalendarClock className="h-3 w-3" aria-hidden="true" />
      <span className="font-semibold">{label}</span>
      <span aria-hidden="true">·</span>
      <span>{formatDateTime(nextFollowUpAt)}</span>
    </span>
  );
}