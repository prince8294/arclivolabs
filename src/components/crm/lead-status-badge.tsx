import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from '@/lib/constants/enums';
import { cn } from '@/lib/utils/cn';

export interface LeadStatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

/**
 * Pipeline status pill. Every state carries a distinct colour AND its
 * readable label, so the meaning never depends on colour alone.
 */
const STATUS_STYLES: Record<LeadStatus, string> = {
  [LEAD_STATUSES.NEW]: 'bg-info/10 text-info border-info/30',
  [LEAD_STATUSES.CONTACTED]: 'bg-primary/10 text-primary border-primary/30',
  [LEAD_STATUSES.INTERESTED]: 'bg-primary/10 text-primary border-primary/30',
  [LEAD_STATUSES.MEETING]: 'bg-warning/10 text-warning border-warning/30',
  [LEAD_STATUSES.PROPOSAL_SENT]:
    'bg-warning/10 text-warning border-warning/30',
  [LEAD_STATUSES.NEGOTIATION]:
    'bg-warning/10 text-warning border-warning/30',
  [LEAD_STATUSES.WON]: 'bg-success/10 text-success border-success/30',
  [LEAD_STATUSES.LOST]:
    'bg-destructive/10 text-destructive border-destructive/30',
};

export default function LeadStatusBadge({
  status,
  className,
}: LeadStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        STATUS_STYLES[status] ?? STATUS_STYLES[LEAD_STATUSES.NEW],
        className
      )}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}