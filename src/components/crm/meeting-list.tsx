import { CalendarX } from 'lucide-react';

import EmptyState from '@/components/ui/empty-state';
import MeetingCard from '@/components/crm/meeting-card';
import type { MeetingListItem } from '@/lib/queries/meetings';

export interface MeetingListProps {
  upcoming: MeetingListItem[];
  past: MeetingListItem[];
  /** Rendered above the lists when scheduling is allowed. */
  scheduleAction?: React.ReactNode;
  /** Per-meeting action buttons (complete / cancel / no-show). */
  meetingActions?: (meeting: MeetingListItem) => React.ReactNode;
  /** Link back to the lead, shown on each card. */
  leadHref?: string;
  leadCode?: string;
  leadName?: string;
}

/**
 * A lead's meetings, split into upcoming and past.
 *
 * Both halves are capped server-side, so a long-running lead
 * cannot flood the page. Empty states carry the scheduling
 * action so the first meeting can be created from either
 * state.
 */
export default function MeetingList({
  upcoming,
  past,
  scheduleAction,
  meetingActions,
  leadHref,
  leadCode,
  leadName,
}: MeetingListProps) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="upcoming-meetings">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id="upcoming-meetings"
            className="text-sm font-semibold text-foreground"
          >
            Upcoming meetings
          </h3>
          {scheduleAction}
        </div>
        {upcoming.length === 0 ? (
          <EmptyState
            title="No meetings scheduled."
            description="Schedule the next meeting with this lead."
            icon={
              <CalendarX className="h-8 w-8" aria-hidden="true" />
            }
            action={scheduleAction}
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {upcoming.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                leadHref={leadHref}
                leadCode={leadCode}
                leadName={leadName}
                actions={
                  meetingActions ? meetingActions(meeting) : undefined
                }
              />
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="past-meetings">
        <h3
          id="past-meetings"
          className="text-sm font-semibold text-foreground"
        >
          Past meetings
        </h3>
        {past.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No completed, cancelled or missed meetings yet.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {past.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                leadHref={leadHref}
                leadCode={leadCode}
                leadName={leadName}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
