import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import TaskForm, { type ProjectOption, type TaskFormInitialValues } from '@/components/tasks/task-form';
import { requireRole } from '@/lib/auth/authorization';
import connectDB from '@/lib/db/mongoose';
import { Project } from '@/models/Project';
import { ProjectMember } from '@/models/ProjectMember';
import { ProjectMilestone } from '@/models/ProjectMilestone';
import { TASK_PRIORITIES, PROJECT_MEMBER_STATUSES } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Create Task',
  description: 'Create a new task within a project and assign it to team members.',
};

interface NewTaskPageProps {
  searchParams: Promise<{
    projectId?: string;
  }>;
}

export default async function NewTaskPage(props: NewTaskPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const searchParams = await props.searchParams;
  const defaultProjectId = searchParams.projectId;

  await connectDB();

  // Load all active projects
  const rawProjects = await Project.find({
    status: { $nin: ['COMPLETED', 'CANCELLED'] },
  })
    .sort({ title: 1 })
    .lean();

  const projectIds = rawProjects.map((p) => p._id);

  // Load milestones and members for these projects
  const [allMilestones, allMembers] = await Promise.all([
    ProjectMilestone.find({ projectId: { $in: projectIds } })
      .sort({ sequence: 1 })
      .lean(),
    ProjectMember.find({
      projectId: { $in: projectIds },
      status: PROJECT_MEMBER_STATUSES.ACTIVE,
    })
      .populate('userId', 'name email status')
      .lean(),
  ]);

  // Construct ProjectOption array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects: ProjectOption[] = rawProjects.map((p: any) => {
    const pIdStr = p._id.toString();
    const milestones = allMilestones
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m.projectId.toString() === pIdStr)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({
        _id: m._id.toString(),
        milestoneCode: m.milestoneCode,
        title: m.title,
      }));

    const members = allMembers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((mem: any) => mem.projectId.toString() === pIdStr && mem.userId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((mem: any) => ({
        userId: mem.userId._id.toString(),
        name: mem.userId.name || 'Member',
        role: mem.role,
      }));

    return {
      _id: pIdStr,
      projectCode: p.projectCode,
      title: p.title,
      milestones,
      members,
    };
  });

  const initialValues: TaskFormInitialValues = {
    title: '',
    description: '',
    projectId: defaultProjectId || (projects[0]?._id ?? ''),
    priority: TASK_PRIORITIES.MEDIUM,
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Create New Task"
        description="Allocate work to employees actively assigned to the project."
        action={
          <Link
            href="/admin/tasks"
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to tasks
          </Link>
        }
      />

      <TaskForm
        mode="create"
        projects={projects}
        initialValues={initialValues}
        defaultProjectId={defaultProjectId}
      />
    </div>
  );
}
