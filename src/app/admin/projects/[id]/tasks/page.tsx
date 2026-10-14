import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Plus, Filter, Search } from 'lucide-react';

import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/admin/pagination';
import TaskStatusBadge from '@/components/tasks/task-status-badge';
import TaskPriorityBadge from '@/components/tasks/task-priority-badge';
import { requireRole } from '@/lib/auth/authorization';
import { getProjectById } from '@/lib/queries/projects';
import { listTasks } from '@/lib/queries/tasks';
import { formatDate } from '@/lib/utils/format';
import { TASK_STATUSES, TASK_STATUS_LABELS } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

interface ProjectTasksPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export async function generateMetadata(props: ProjectTasksPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const project = await getProjectById(id);
  if (!project) return { title: 'Project Not Found' };
  return {
    title: `Tasks: ${project.title}`,
    description: `All tasks and work packages for project ${project.projectCode}.`,
  };
}

export default async function AdminProjectTasksPage(props: ProjectTasksPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 20;

  const project = await getProjectById(id);
  if (!project) {
    notFound();
  }

  const { items, total } = await listTasks({
    projectId: id,
    status: searchParams.status,
    page,
    limit,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/admin/projects/${project._id}`}
          className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to project overview
        </Link>
      </div>

      <PageHeader
        title={`Project Tasks: ${project.title}`}
        description={`Manage work items allocated specifically under project [${project.projectCode}].`}
        action={
          <ButtonLink href={`/admin/tasks/new?projectId=${project._id}`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Task
          </ButtonLink>
        }
      />

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/projects/${project._id}/tasks`}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !searchParams.status
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          }`}
        >
          All Tasks
        </Link>
        {Object.entries(TASK_STATUS_LABELS).map(([statusKey, label]) => {
          const isSelected = searchParams.status === statusKey;
          return (
            <Link
              key={statusKey}
              href={`/admin/projects/${project._id}/tasks?status=${statusKey}`}
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
          title="No tasks found for this project"
          description="Create your first work package for this project."
          icon={<Plus className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
          action={
            <ButtonLink href={`/admin/tasks/new?projectId=${project._id}`} size="sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Task
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Task Title</th>
                  <th scope="col" className="px-4 py-3">Assignee</th>
                  <th scope="col" className="px-4 py-3">Priority</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Progress</th>
                  <th scope="col" className="px-4 py-3">Due Date</th>
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
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-foreground">
                      {task.assignee ? task.assignee.name : <span className="italic text-muted-foreground">Unassigned</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <TaskPriorityBadge priority={task.priority} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <TaskStatusBadge status={task.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                      {task.progressPercentage}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {task.dueDate ? formatDate(new Date(task.dueDate)) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                      <Link
                        href={`/admin/tasks/${task._id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            baseUrl={`/admin/projects/${project._id}/tasks`}
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
