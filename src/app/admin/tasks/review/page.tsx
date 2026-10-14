import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, CheckCircle2 } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/admin/pagination';
import TaskPriorityBadge from '@/components/tasks/task-priority-badge';
import TaskSubNav from '@/components/tasks/task-sub-nav';
import { requireRole } from '@/lib/auth/authorization';
import { listTasks, getAdminTaskStats } from '@/lib/queries/tasks';
import { formatDate } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Pending Review',
  description: 'Tasks submitted by employees awaiting verification and approval.',
};

interface ReviewPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function AdminReviewTasksPage(props: ReviewPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 20;

  const [{ items, total }, stats] = await Promise.all([
    listTasks({
      pendingReviewOnly: true,
      page,
      limit,
    }),
    getAdminTaskStats(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pending Task Reviews"
        description="Review submitted employee deliverables and approve or request revisions."
      />

      <TaskSubNav counts={{ overdue: stats.overdueTasks, pendingReview: stats.pendingReviews }} />

      {total === 0 ? (
        <EmptyState
          title="No tasks awaiting review"
          description="All submitted deliverables have been reviewed."
          icon={<CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3">Task</th>
                  <th scope="col" className="px-4 py-3">Project</th>
                  <th scope="col" className="px-4 py-3">Submitted By</th>
                  <th scope="col" className="px-4 py-3">Submitted At</th>
                  <th scope="col" className="px-4 py-3">Priority</th>
                  <th scope="col" className="px-4 py-3">Deadline</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((task) => (
                  <tr key={task._id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-semibold text-primary">
                          {task.taskCode}
                        </span>
                        <Link
                          href={`/admin/tasks/${task._id}`}
                          className="font-medium text-foreground hover:underline line-clamp-1"
                        >
                          {task.title}
                        </Link>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {task.project.title}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-foreground">
                      {task.assignee ? task.assignee.name : 'Unknown'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {task.submittedAt ? formatDate(task.submittedAt) : 'Recently'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <TaskPriorityBadge priority={task.priority} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {task.dueDate ? formatDate(task.dueDate) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                      <Link
                        href={`/admin/tasks/${task._id}`}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline bg-primary/10 px-2.5 py-1 rounded-md"
                      >
                        Review Work
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            baseUrl="/admin/tasks/review"
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
