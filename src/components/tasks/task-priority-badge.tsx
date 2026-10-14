import { AlertCircle, AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';
import Badge from '@/components/ui/badge';
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, type TaskPriority } from '@/lib/constants/enums';

interface TaskPriorityBadgeProps {
  priority: TaskPriority | string;
  className?: string;
}

export default function TaskPriorityBadge({ priority, className }: TaskPriorityBadgeProps) {
  const label = TASK_PRIORITY_LABELS[priority as TaskPriority] || priority;

  switch (priority) {
    case TASK_PRIORITIES.LOW:
      return (
        <Badge variant="secondary" className={`gap-1 ${className}`}>
          <ArrowDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          {label}
        </Badge>
      );
    case TASK_PRIORITIES.MEDIUM:
      return (
        <Badge variant="info" className={`gap-1 ${className}`}>
          {label}
        </Badge>
      );
    case TASK_PRIORITIES.HIGH:
      return (
        <Badge variant="warning" className={`gap-1 ${className}`}>
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
          {label}
        </Badge>
      );
    case TASK_PRIORITIES.URGENT:
      return (
        <Badge variant="error" className={`gap-1 font-bold ${className}`}>
          <AlertCircle className="h-3 w-3 animate-pulse" aria-hidden="true" />
          {label}
        </Badge>
      );
    default:
      return <Badge variant="default" className={className}>{label}</Badge>;
  }
}
