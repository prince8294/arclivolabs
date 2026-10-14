import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/admin/pagination';
import TaskPriorityBadge from '@/components/tasks/task-priority-badge';
import TaskStatusBadge from '@/components/tasks/task-status-badge';
import TaskSubNav from '@/components/tasks/task-sub-nav';
import { requireRole } from '@/lib/auth/authorization';
import { listTasks, getAdminTaskStats } from '@/lib/queries/tasks';
import { formatDate } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Completed Tasks',
  description: 'Verified and approved completed tasks archive.',
};

interface CompletedPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function AdminCompletedTasksPage(props: CompletedPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 20;

  const [{ items, total }, stats] = await Promise.all([
    listTasks({
      completedOnly: true,
      page,
      limit,
    }),
    getAdminTaskStats(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Completed Tasks"
        description="Historical log of approved and completed deliverables."
      />

      <TaskSubNav counts={{ overdue: stats.overdueTasks, pendingReview: stats.pendingReviews }} />

      {total === 0 ? (
        <EmptyState
          title="No completed tasks yet"
          description="Approved tasks will appear in this archive once reviewed."
          icon={<CheckCircle2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
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
                  <th scope="col" className="px-4 py-3">Completed On</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((task) => (
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
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-foreground">
                      {task.assignee ? task.assignee.name : 'Unassigned'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <TaskPriorityBadge priority={task.priority} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {task.completedAt ? formatDate(task.completedAt) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                      <Link
                        href={`/admin/tasks/${task._id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            baseUrl="/admin/tasks/completed"
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
