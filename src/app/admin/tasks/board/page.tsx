import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import TaskBoard from '@/components/tasks/task-board';
import TaskSubNav from '@/components/tasks/task-sub-nav';
import { requireRole } from '@/lib/auth/authorization';
import { getTaskBoard, getAdminTaskStats } from '@/lib/queries/tasks';
import { listProjects } from '@/lib/queries/projects';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Task Board',
  description: 'Kanban view of tasks across projects and workflow states.',
};

interface TaskBoardPageProps {
  searchParams: Promise<{
    projectId?: string;
  }>;
}

export default async function AdminTaskBoardPage(props: TaskBoardPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const searchParams = await props.searchParams;

  const [board, stats, projectsResult] = await Promise.all([
    getTaskBoard({
      projectId: searchParams.projectId,
    }),
    getAdminTaskStats(),
    listProjects({ limit: 100 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Task Board"
        description="Visual workflow tracking across all progress stages."
        action={
          <ButtonLink href="/admin/tasks/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Task
          </ButtonLink>
        }
      />

      <TaskSubNav counts={{ overdue: stats.overdueTasks, pendingReview: stats.pendingReviews }} />

      <TaskBoard
        board={board}
        portal="admin"
        projects={projectsResult.items.map((p) => ({ _id: p._id, title: p.title }))}
      />
    </div>
  );
}
