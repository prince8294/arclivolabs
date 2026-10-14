import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Search, Filter, AlertTriangle } from 'lucide-react';

import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/admin/pagination';
import TaskStatusBadge from '@/components/tasks/task-status-badge';
import TaskPriorityBadge from '@/components/tasks/task-priority-badge';
import TaskSubNav from '@/components/tasks/task-sub-nav';
import { requireRole } from '@/lib/auth/authorization';
import { listTasks, getAdminTaskStats } from '@/lib/queries/tasks';
import { listProjects } from '@/lib/queries/projects';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_PRIORITIES, TASK_PRIORITY_LABELS } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Tasks',
  description: 'Manage agency projects tasks, team assignments and workflows.',
};

interface TasksPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    priority?: string;
    projectId?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function AdminTasksPage(props: TasksPageProps) {
  await requireRole(USER_ROLES.ADMIN);

  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '20', 10);

  const [{ items, total, totalPages }, stats, projectsResult] = await Promise.all([
    listTasks({
      search: searchParams.search,
      status: searchParams.status,
      priority: searchParams.priority,
      projectId: searchParams.projectId,
      page,
      limit,
    }),
    getAdminTaskStats(),
    listProjects({ limit: 100 }),
  ]);

  const hasActiveFilters = Boolean(
    searchParams.search || searchParams.status || searchParams.priority || searchParams.projectId
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tasks"
        description="Plan, assign, monitor, and review tasks across all active projects."
        action={
          <ButtonLink href="/admin/tasks/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Task
          </ButtonLink>
        }
      />

      <TaskSubNav counts={{ overdue: stats.overdueTasks, pendingReview: stats.pendingReviews }} />

      {/* Search & Filter Bar */}
      <form method="get" action="/admin/tasks" className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label htmlFor="search" className="block text-xs font-medium text-muted-foreground mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <input
                id="search"
                name="search"
                type="text"
                defaultValue={searchParams.search || ''}
                placeholder="Code, title, label..."
                className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="projectId" className="block text-xs font-medium text-muted-foreground mb-1">
              Project
            </label>
            <select
              id="projectId"
              name="projectId"
              defaultValue={searchParams.projectId || ''}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Projects</option>
              {projectsResult.items.map((p) => (
                <option key={p._id} value={p._id}>
                  [{p.projectCode}] {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-xs font-medium text-muted-foreground mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={searchParams.status || ''}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              {Object.entries(TASK_STATUS_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="priority" className="block text-xs font-medium text-muted-foreground mb-1">
              Priority
            </label>
            <div className="flex gap-2">
              <select
                id="priority"
                name="priority"
                defaultValue={searchParams.priority || ''}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Priorities</option>
                {Object.entries(TASK_PRIORITY_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Filter
              </button>
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-end">
            <Link href="/admin/tasks" className="text-xs text-muted-foreground hover:text-foreground underline">
              Clear filters
            </Link>
          </div>
        )}
      </form>

      {/* Tasks Table */}
      {total === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No tasks match your filters"
            description="Try modifying search keywords or status/project filters."
            action={
              <ButtonLink href="/admin/tasks" variant="outline" size="sm">
                Reset filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No tasks created yet"
            description="Break down client projects into manageable tasks and assign them to team members."
            icon={<Plus className="h-8 w-8" aria-hidden="true" />}
            action={
              <ButtonLink href="/admin/tasks/new" size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create First Task
              </ButtonLink>
            }
          />
        )
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Task Title</th>
                  <th scope="col" className="px-4 py-3">Project</th>
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">Assignee</th>
                  <th scope="col" className="px-4 py-3">Priority</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="hidden px-4 py-3 sm:table-cell">Progress</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Due Date</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((task) => {
                  const isOverdue =
                    task.dueDate &&
                    new Date(task.dueDate) < new Date() &&
                    task.status !== TASK_STATUSES.COMPLETED &&
                    task.status !== TASK_STATUSES.CANCELLED;

                  return (
                    <tr key={task._id} className="hover:bg-muted/20 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">
                        <Link href={`/admin/tasks/${task._id}`} className="hover:underline text-primary">
                          {task.taskCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <Link
                            href={`/admin/tasks/${task._id}`}
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
                        <Link href={`/admin/projects/${task.project._id}`} className="hover:underline">
                          {task.project.title}
                        </Link>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-foreground md:table-cell">
                        {task.assignee ? task.assignee.name : <span className="text-muted-foreground italic">Unassigned</span>}
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
                      <td className="hidden whitespace-nowrap px-4 py-3 text-xs lg:table-cell">
                        <span className={cn(isOverdue && 'text-destructive font-semibold')}>
                          {task.dueDate ? formatDate(task.dueDate) : '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/admin/tasks/${task._id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            View
                          </Link>
                          <Link
                            href={`/admin/tasks/${task._id}/edit`}
                            className="font-medium text-muted-foreground hover:text-foreground"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            baseUrl="/admin/tasks"
            page={page}
            limit={limit}
            total={total}
            filters={{
              search: searchParams.search ?? '',
              status: searchParams.status ?? '',
              priority: searchParams.priority ?? '',
              projectId: searchParams.projectId ?? '',
            }}
          />
        </>
      )}
    </div>
  );
}
