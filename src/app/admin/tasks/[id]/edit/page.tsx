import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import TaskForm, { type ProjectOption, type TaskFormInitialValues } from '@/components/tasks/task-form';
import { requireRole } from '@/lib/auth/authorization';
import connectDB from '@/lib/db/mongoose';
import { getTaskById } from '@/lib/queries/tasks';
import { Project } from '@/models/Project';
import { ProjectMember } from '@/models/ProjectMember';
import { ProjectMilestone } from '@/models/ProjectMilestone';
import { PROJECT_MEMBER_STATUSES } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Edit Task',
  description: 'Update task assignment, priority, dates or parameters.',
};

interface EditTaskPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditTaskPage(props: EditTaskPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await props.params;

  const task = await getTaskById(id);
  if (!task) {
    notFound();
  }

  await connectDB();

  // Load all active projects
  const rawProjects = await Project.find({
    status: { $nin: ['COMPLETED', 'CANCELLED'] },
  })
    .sort({ title: 1 })
    .lean();

  const projectIds = rawProjects.map((p) => p._id);

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
    _id: task._id,
    title: task.title,
    description: task.description || '',
    projectId: task.project._id,
    milestoneId: task.milestone?._id || '',
    assignedTo: task.assignee?._id || '',
    priority: task.priority,
    startDate: task.startDate || '',
    dueDate: task.dueDate || '',
    estimatedHours: task.estimatedMinutes ? task.estimatedMinutes / 60 : undefined,
    labels: task.labels ? task.labels.join(', ') : '',
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title={`Edit Task: ${task.taskCode}`}
        description="Update assignment, dates, priority or requirements."
        action={
          <Link
            href={`/admin/tasks/${task._id}`}
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to task
          </Link>
        }
      />

      <TaskForm
        mode="edit"
        projects={projects}
        initialValues={initialValues}
      />
    </div>
  );
}
