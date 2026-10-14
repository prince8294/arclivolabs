import type { Metadata } from 'next';
import Link from 'next/link';
import { Kanban, ListTodo, Search, AlertTriangle } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/admin/pagination';
import TaskStatusBadge from '@/components/tasks/task-status-badge';
import TaskPriorityBadge from '@/components/tasks/task-priority-badge';
import ButtonLink from '@/components/ui/button-link';
import { requireRole } from '@/lib/auth/authorization';
import { listTasks } from '@/lib/queries/tasks';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { TASK_STATUS_LABELS, type TaskStatus } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'My Tasks',
  description: 'View and execute tasks assigned to you.',
};

interface EmployeeTasksPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function EmployeeTasksPage(props: EmployeeTasksPageProps) {
  const user = await requireRole(USER_ROLES.EMPLOYEE);
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 20;

  const { items, total } = await listTasks({
    assignedTo: user.id,
    status: searchParams.status,
    search: searchParams.search,
    page,
    limit,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="My Tasks"
          description="Track deadlines, start work, update progress and submit your deliverables."
        />
        <ButtonLink href="/employee/tasks/board" variant="outline" size="sm">
          <Kanban className="h-4 w-4" aria-hidden="true" />
          Task Board
        </ButtonLink>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Link
          href="/employee/tasks"
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !searchParams.status
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          }`}
        >
          All My Tasks
        </Link>
        {Object.entries(TASK_STATUS_LABELS).map(([statusKey, label]) => {
          const isSelected = searchParams.status === statusKey;
          return (
            <Link
              key={statusKey}
              href={`/employee/tasks?status=${statusKey}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {total === 0 ? (
        <EmptyState
          title="No tasks assigned"
          description={
            searchParams.status
              ? 'No tasks match the selected status filter.'
              : 'You have no assigned tasks right now. Once your project manager or admin assigns tasks, they will appear here.'
          }
          icon={<ListTodo className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Task Title</th>
                  <th scope="col" className="px-4 py-3">Project</th>
                  <th scope="col" className="px-4 py-3">Priority</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="hidden px-4 py-3 sm:table-cell">Progress</th>
                  <th scope="col" className="px-4 py-3">Due Date</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((task) => {
                  const isOverdue =
                    task.dueDate &&
                    new Date(task.dueDate) < new Date() &&
                    task.status !== 'COMPLETED' &&
                    task.status !== 'CANCELLED';

                  return (
                    <tr key={task._id} className="hover:bg-muted/20 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">
                        <Link href={`/employee/tasks/${task._id}`} className="hover:underline text-primary">
                          {task.taskCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <Link
                            href={`/employee/tasks/${task._id}`}
                            className="font-medium text-foreground hover:underline line-clamp-1"
                          >
                            {task.title}
                          </Link>
                          {task.blocker && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-medium mt-0.5">
                              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                              Blocked: {task.blocker.reason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {task.project.title}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <TaskPriorityBadge priority={task.priority} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <TaskStatusBadge status={task.status} />
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${task.progressPercentage}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">
                            {task.progressPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        <span className={cn(isOverdue && 'text-destructive font-semibold')}>
                          {task.dueDate ? formatDate(task.dueDate) : '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                        <Link
                          href={`/employee/tasks/${task._id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          Work On Task →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            baseUrl="/employee/tasks"
            page={page}
            limit={limit}
            total={total}
            filters={{ status: searchParams.status ?? '' }}
          />
        </>
      )}
    </div>
  );
}
