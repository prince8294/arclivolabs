import Badge from '@/components/ui/badge';
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from '@/lib/constants/enums';

interface TaskStatusBadgeProps {
  status: TaskStatus | string;
  className?: string;
}

export default function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  const label = TASK_STATUS_LABELS[status as TaskStatus] || status;

  switch (status) {
    case TASK_STATUSES.TODO:
      return <Badge variant="secondary" className={className}>{label}</Badge>;
    case TASK_STATUSES.IN_PROGRESS:
      return <Badge variant="info" className={className}>{label}</Badge>;
    case TASK_STATUSES.BLOCKED:
      return <Badge variant="error" className={className}>{label}</Badge>;
    case TASK_STATUSES.IN_REVIEW:
      return <Badge variant="warning" className={className}>{label}</Badge>;
    case TASK_STATUSES.CHANGES_REQUESTED:
      return <Badge variant="warning" className={`bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-400 ${className}`}>{label}</Badge>;
    case TASK_STATUSES.COMPLETED:
      return <Badge variant="success" className={className}>{label}</Badge>;
    case TASK_STATUSES.CANCELLED:
      return <Badge variant="secondary" className={`line-through opacity-75 ${className}`}>{label}</Badge>;
    default:
      return <Badge variant="default" className={className}>{label}</Badge>;
  }
}
