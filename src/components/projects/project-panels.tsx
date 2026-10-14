import { AlertTriangle, CheckCircle2, Clock, OctagonPause } from 'lucide-react';

import Badge from '@/components/ui/badge';
import { ProjectHealthBadge, ProjectStatusBadge } from '@/components/projects/project-badges';
import {
  MILESTONE_DEADLINE_STATES,
  MILESTONE_DEADLINE_STATE_LABELS,
  PROJECT_MILESTONE_STATUSES,
  PROJECT_MILESTONE_STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type MilestoneDeadlineState,
  type ProjectMilestoneStatus,
  type TaskPriority,
} from '@/lib/constants/enums';
import { cn } from '@/lib/utils/cn';

export function ProjectPriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority | string;
  className?: string;
}) {
  const label = TASK_PRIORITY_LABELS[priority as TaskPriority] ?? priority;

  switch (priority) {
    case TASK_PRIORITIES.LOW:
      return (
        <Badge variant="secondary" className={className}>
          {label}
        </Badge>
      );
    case TASK_PRIORITIES.MEDIUM:
      return (
        <Badge variant="info" className={className}>
          {label}
        </Badge>
      );
    case TASK_PRIORITIES.HIGH:
      return (
        <Badge variant="warning" className={className}>
          {label}
        </Badge>
      );
    case TASK_PRIORITIES.URGENT:
      return (
        <Badge variant="error" className={className}>
          {label}
        </Badge>
      );
    default:
      return (
        <Badge variant="default" className={className}>
          {label}
        </Badge>
      );
  }
}

export function MilestoneStatusBadge({
  status,
  className,
}: {
  status: ProjectMilestoneStatus | string;
  className?: string;
}) {
  const label = PROJECT_MILESTONE_STATUS_LABELS[status as ProjectMilestoneStatus] ?? status;

  switch (status) {
    case PROJECT_MILESTONE_STATUSES.NOT_STARTED:
      return (
        <Badge variant="secondary" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_MILESTONE_STATUSES.IN_PROGRESS:
      return (
        <Badge variant="info" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_MILESTONE_STATUSES.BLOCKED:
      return (
        <Badge variant="error" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_MILESTONE_STATUSES.PENDING_REVIEW:
      return (
        <Badge variant="warning" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_MILESTONE_STATUSES.COMPLETED:
      return (
        <Badge variant="success" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_MILESTONE_STATUSES.CANCELLED:
      return (
        <Badge
          variant="secondary"
          className={cn('line-through opacity-75', className)}
        >
          {label}
        </Badge>
      );
    default:
      return (
        <Badge variant="default" className={className}>
          {label}
        </Badge>
      );
  }
}

/**
 * Deadline state badge (§47). Always derived from status + due date, never
 * stored, so it can never contradict the milestone record.
 */
export function MilestoneDeadlineBadge({
  state,
  daysUntilDue,
  className,
}: {
  state: MilestoneDeadlineState | string;
  daysUntilDue?: number | null;
  className?: string;
}) {
  const base = MILESTONE_DEADLINE_STATE_LABELS[state as MilestoneDeadlineState] ?? state;
  const label =
    state === MILESTONE_DEADLINE_STATES.OVERDUE && daysUntilDue !== null && daysUntilDue !== undefined
      ? `${base} by ${Math.abs(daysUntilDue)}d`
      : base;

  switch (state) {
    case MILESTONE_DEADLINE_STATES.COMPLETED:
      return (
        <Badge variant="success" className={className}>
          <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
          {label}
        </Badge>
      );
    case MILESTONE_DEADLINE_STATES.BLOCKED:
      return (
        <Badge variant="error" className={className}>
          <OctagonPause className="mr-1 h-3 w-3" aria-hidden="true" />
          {label}
        </Badge>
      );
    case MILESTONE_DEADLINE_STATES.OVERDUE:
      return (
        <Badge variant="error" className={className}>
          <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
          {label}
        </Badge>
      );
    case MILESTONE_DEADLINE_STATES.DUE_SOON:
      return (
        <Badge variant="warning" className={className}>
          <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
          {label}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className={className}>
          {label}
        </Badge>
      );
  }
}

/**
 * Progress bar with an accessible value. Always fed by the server-calculated
 * percentage - the browser never supplies one.
 */
export function ProjectProgressBar({
  value,
  label = 'Overall progress',
  showValue = true,
  className,
}: {
  value: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value || 0)));

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        {showValue ? (
          <span className="font-mono font-semibold text-foreground">{pct}%</span>
        ) : null}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Small inline stack of the three primary project signals. */
export function ProjectStatusCluster({
  status,
  health,
  priority,
}: {
  status: string;
  health: string;
  priority: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ProjectStatusBadge status={status} />
      <ProjectHealthBadge health={health} />
      <ProjectPriorityBadge priority={priority} />
    </div>
  );
}
