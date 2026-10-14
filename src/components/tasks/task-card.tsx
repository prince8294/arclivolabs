import Link from 'next/link';
import { Calendar, User, Clock, AlertTriangle } from 'lucide-react';

import TaskPriorityBadge from './task-priority-badge';
import TaskStatusBadge from './task-status-badge';
import type { PopulatedTaskItem } from '@/lib/queries/tasks';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface TaskCardProps {
  task: PopulatedTaskItem;
  portal?: 'admin' | 'employee';
}

export default function TaskCard({ task, portal = 'admin' }: TaskCardProps) {
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== 'COMPLETED' &&
    task.status !== 'CANCELLED';

  const href = portal === 'employee' ? `/employee/tasks/${task._id}` : `/admin/tasks/${task._id}`;

  return (
    <div className="group flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="font-mono text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
            {task.taskCode}
          </span>
          <TaskPriorityBadge priority={task.priority} />
        </div>

        <Link href={href} className="block mb-2 focus-visible:outline-none focus-visible:underline">
          <h4 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {task.title}
          </h4>
        </Link>

        {task.project && (
          <p className="text-xs text-muted-foreground mb-3 truncate">
            📁 {task.project.title}
          </p>
        )}

        {task.blocker && (
          <div className="mb-3 flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate font-medium">{task.blocker.reason}</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                task.status === 'COMPLETED'
                  ? 'bg-success'
                  : task.progressPercentage > 50
                    ? 'bg-primary'
                    : 'bg-primary/70'
              )}
              style={{ width: `${task.progressPercentage}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
            {task.progressPercentage}%
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1 max-w-[50%] truncate">
            <User className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{task.assignee ? task.assignee.name : 'Unassigned'}</span>
          </div>

          {task.dueDate ? (
            <div
              className={cn(
                'flex items-center gap-1 shrink-0 font-medium',
                isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
              )}
            >
              <Calendar className="h-3 w-3" aria-hidden="true" />
              <span>{formatDate(task.dueDate)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground/60 text-[11px]">No due date</span>
          )}
        </div>
      </div>
    </div>
  );
}
