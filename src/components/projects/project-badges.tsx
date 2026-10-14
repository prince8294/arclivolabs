import Badge from '@/components/ui/badge';
import {
  PROJECT_HEALTHS,
  PROJECT_HEALTH_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectHealth,
  type ProjectStatus,
} from '@/lib/constants/enums';

/** Project lifecycle badge. Terminal states are visually de-emphasised. */
export function ProjectStatusBadge({
  status,
  className,
}: {
  status: ProjectStatus | string;
  className?: string;
}) {
  const label = PROJECT_STATUS_LABELS[status as ProjectStatus] ?? status;

  switch (status) {
    case PROJECT_STATUSES.PLANNING:
      return (
        <Badge variant="secondary" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_STATUSES.NOT_STARTED:
      return (
        <Badge variant="secondary" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_STATUSES.IN_PROGRESS:
      return (
        <Badge variant="info" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_STATUSES.ON_HOLD:
      return (
        <Badge variant="warning" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_STATUSES.IN_REVIEW:
      return (
        <Badge variant="warning" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_STATUSES.COMPLETED:
      return (
        <Badge variant="success" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_STATUSES.CANCELLED:
      return (
        <Badge
          variant="secondary"
          className={`line-through opacity-75 ${className ?? ''}`}
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
 * Delivery health. Deliberately independent of status - an IN_PROGRESS project
 * can legitimately be DELAYED.
 */
export function ProjectHealthBadge({
  health,
  className,
}: {
  health: ProjectHealth | string;
  className?: string;
}) {
  const label = PROJECT_HEALTH_LABELS[health as ProjectHealth] ?? health;

  switch (health) {
    case PROJECT_HEALTHS.ON_TRACK:
      return (
        <Badge variant="success" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_HEALTHS.AT_RISK:
      return (
        <Badge variant="warning" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_HEALTHS.DELAYED:
      return (
        <Badge variant="error" className={className}>
          {label}
        </Badge>
      );
    case PROJECT_HEALTHS.BLOCKED:
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

export default ProjectStatusBadge;
