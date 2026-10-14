import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle, Clock } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/admin/pagination';
import TaskStatusBadge from '@/components/tasks/task-status-badge';
import TaskPriorityBadge from '@/components/tasks/task-priority-badge';
import TaskSubNav from '@/components/tasks/task-sub-nav';
import { requireRole } from '@/lib/auth/authorization';
import { listTasks, getAdminTaskStats } from '@/lib/queries/tasks';
import { formatDate } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Overdue Tasks',
  description: 'Unfinished tasks that have exceeded their scheduled deadlines.',
};

interface OverduePageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function AdminOverdueTasksPage(props: OverduePageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 20;

  const [{ items, total }, stats] = await Promise.all([
    listTasks({
      overdueOnly: true,
      page,
      limit,
    }),
    getAdminTaskStats(),
  ]);

  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overdue Tasks"
        description="Monitor tasks that have exceeded their scheduled deadlines and need attention."
      />

      <TaskSubNav counts={{ overdue: stats.overdueTasks, pendingReview: stats.pendingReviews }} />

      {total === 0 ? (
        <EmptyState
          title="No overdue tasks"
          description="Great job! All active tasks are currently on schedule."
          icon={<Clock className="h-8 w-8 text-success" aria-hidden="true" />}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3">Task Code</th>
                  <th scope="col" className="px-4 py-3">Task Title</th>
                  <th scope="col" className="px-4 py-3">Project</th>
                  <th scope="col" className="px-4 py-3">Assignee</th>
                  <th scope="col" className="px-4 py-3">Priority</th>
                  <th scope="col" className="px-4 py-3">Due Date</th>
                  <th scope="col" className="px-4 py-3">Days Overdue</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((task) => {
                  const daysOverdue = task.dueDate
                    ? Math.max(1, Math.floor((now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
                    : 0;

                  return (
                    <tr key={task._id} className="hover:bg-muted/20 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">
                        <Link href={`/admin/tasks/${task._id}`} className="hover:underline text-primary">
                          {task.taskCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/tasks/${task._id}`}
                          className="font-medium text-foreground hover:underline line-clamp-1"
                        >
                          {task.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {task.project.title}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs">
                        {task.assignee ? task.assignee.name : <span className="italic text-muted-foreground">Unassigned</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <TaskPriorityBadge priority={task.priority} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-destructive font-medium">
                        {task.dueDate ? formatDate(task.dueDate) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <TaskStatusBadge status={task.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                        <Link
                          href={`/admin/tasks/${task._id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          Review & Reassign
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            baseUrl="/admin/tasks/overdue"
            page={page}
            limit={limit}
            total={total}
            filters={{}}
          />
        </>
      )}
    </div>
  );
}
