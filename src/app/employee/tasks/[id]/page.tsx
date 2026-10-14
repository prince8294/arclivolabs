import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  FolderKanban,
  Milestone,
  GitPullRequest,
  CheckCircle2,
} from 'lucide-react';

import TaskStatusBadge from '@/components/tasks/task-status-badge';
import TaskPriorityBadge from '@/components/tasks/task-priority-badge';
import TaskEmployeeActions from '@/components/tasks/task-employee-actions';
import TaskCommentList from '@/components/tasks/task-comment-list';
import TaskActivityTimeline from '@/components/tasks/task-activity-timeline';
import TaskFileAttachments from '@/components/files/task-file-attachments';
import { requireRole } from '@/lib/auth/authorization';
import { canViewTask } from '@/lib/auth/project-permissions';
import { getTaskById, getTaskComments, getTaskActivities } from '@/lib/queries/tasks';
import { listFiles } from '@/lib/queries/files';
import { formatDate } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';

interface EmployeeTaskDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata(props: EmployeeTaskDetailPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const task = await getTaskById(id);
  if (!task) return { title: 'Task Not Found' };
  return {
    title: `${task.taskCode}: ${task.title}`,
    description: task.description || 'Employee task detail and workflow.',
  };
}

export default async function EmployeeTaskDetailPage(props: EmployeeTaskDetailPageProps) {
  const user = await requireRole(USER_ROLES.EMPLOYEE);
  const { id } = await props.params;

  const [task, comments, activities, taskFilesResult] = await Promise.all([
    getTaskById(id),
    getTaskComments(id),
    getTaskActivities(id),
    listFiles({ taskId: id }, user),
  ]);

  if (!task) {
    notFound();
  }

  // Security check: Must be assigned or active project member
  // (We check user id matches assignedTo or user has project access)
  const isAssigned = task.assignee?._id === user.id;
  if (!isAssigned) {
    // If not assigned to this employee, redirect to my tasks
    redirect('/employee/tasks');
  }

  const formatMinutes = (mins: number) => {
    if (!mins) return 'Not estimated';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h} hrs`;
    return `${m} mins`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/employee/tasks"
          className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to my tasks
        </Link>
      </div>

      {/* Task Header */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary">{task.taskCode}</span>
              <TaskPriorityBadge priority={task.priority} />
              <TaskStatusBadge status={task.status} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {task.title}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Project: </span>
              <span className="font-medium text-foreground">
                [{task.project.projectCode}] {task.project.title}
              </span>
            </p>
          </div>

          <div className="flex flex-row md:flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Progress:</span>
              <span className="font-mono text-sm font-bold text-foreground">
                {task.progressPercentage}%
              </span>
            </div>
            <div className="h-2 w-32 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${task.progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Execution Actions */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          Actions & Work Status
        </h2>
        <TaskEmployeeActions
          taskId={task._id}
          taskCode={task.taskCode}
          currentStatus={task.status}
          currentProgress={task.progressPercentage}
          reviewNotes={task.reviewNotes}
          blocker={task.blocker}
        />
      </div>

      {/* Main Grid: Overview & Comments on Left, Schedule & Timeline on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <h3 className="text-sm font-semibold text-foreground mb-3">Task Requirements</h3>
            {task.description ? (
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No detailed description provided.</p>
            )}

            {task.labels && task.labels.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">Labels:</span>
                {task.labels.map((l: string) => (
                  <span
                    key={l}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground"
                  >
                    #{l}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submitted Deliverables (if any) */}
          {(task.submittedAt || task.submissionNotes || task.submissionLinks.length > 0) && (
            <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <GitPullRequest className="h-4 w-4 text-primary" aria-hidden="true" />
                Submitted Deliverables
              </h3>

              {task.submissionNotes && (
                <div className="mb-4 rounded-md bg-muted/40 p-3.5 text-xs text-foreground/90 whitespace-pre-wrap">
                  <span className="font-semibold block mb-1">Your Submission Summary:</span>
                  {task.submissionNotes}
                </div>
              )}

              {task.submissionLinks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground block">
                    Evidence Links:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {task.submissionLinks.map((link: { title: string; url: string }, idx: number) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted/50 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        <span>{link.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task Attachments */}
          <TaskFileAttachments
            taskId={task._id}
            projectId={task.project._id}
            files={taskFilesResult.files}
            userRole={user.role}
            canAttach={true}
          />

          {/* Dependencies (if any) */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground mb-3">Prerequisite Dependencies</h3>
              <div className="space-y-2">
                {task.dependencies.map((dep: { _id: string; taskCode: string; title: string; status: string }) => (
                  <div
                    key={dep._id}
                    className="flex items-center justify-between rounded-md border border-border p-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">{dep.taskCode}</span>
                      <span className="font-medium text-foreground">{dep.title}</span>
                    </div>
                    <TaskStatusBadge status={dep.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <TaskCommentList taskId={task._id} comments={comments} />
          </div>
        </div>

        {/* Right Column (Meta & Timeline) */}
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
              Schedule & Targets
            </h3>

            {task.milestone && (
              <div>
                <span className="text-xs text-muted-foreground block">Project Milestone</span>
                <div className="flex items-center gap-2 mt-1 text-xs font-medium text-foreground">
                  <Milestone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span>[{task.milestone.milestoneCode}] {task.milestone.title}</span>
                </div>
              </div>
            )}

            <div>
              <span className="text-xs text-muted-foreground block">Estimated Duration</span>
              <div className="flex items-center gap-2 mt-1 text-xs font-mono text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>{formatMinutes(task.estimatedMinutes)}</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block">Due Date</span>
              <div className="flex items-center gap-2 mt-1 text-xs text-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>{task.dueDate ? formatDate(task.dueDate) : 'No deadline'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground block">Created By</span>
              <span className="text-xs font-medium text-foreground mt-0.5 block">
                {task.creator.name} ({formatDate(task.createdAt)})
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <TaskActivityTimeline activities={activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
