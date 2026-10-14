import {
  MEETING_STATUSES,
  MEETING_STATUS_LABELS,
  type MeetingStatus,
} from '@/lib/constants/enums';
import { cn } from '@/lib/utils/cn';

export interface MeetingStatusBadgeProps {
  status: MeetingStatus;
  className?: string;
}

const STATUS_STYLES: Record<MeetingStatus, string> = {
  [MEETING_STATUSES.SCHEDULED]:
    'bg-info/10 text-info border-info/30',
  [MEETING_STATUSES.COMPLETED]:
    'bg-success/10 text-success border-success/30',
  [MEETING_STATUSES.CANCELLED]:
    'bg-muted text-muted-foreground border-border',
  [MEETING_STATUSES.NO_SHOW]:
    'bg-destructive/10 text-destructive border-destructive/30',
};

/** Meeting lifecycle pill. Colour AND label, never colour alone. */
export default function MeetingStatusBadge({
  status,
  className,
}: MeetingStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        STATUS_STYLES[status],
        className
      )}
    >
      {MEETING_STATUS_LABELS[status]}
    </span>
  );
}
