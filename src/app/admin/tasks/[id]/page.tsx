import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit,
  ExternalLink,
  FolderKanban,
  Milestone,
  User,
  AlertTriangle,
  GitPullRequest,
  CheckCircle2,
} from 'lucide-react';

import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import TaskStatusBadge from '@/components/tasks/task-status-badge';
import TaskPriorityBadge from '@/components/tasks/task-priority-badge';
import TaskReviewActions from '@/components/tasks/task-review-actions';
import TaskCommentList from '@/components/tasks/task-comment-list';
import TaskActivityTimeline from '@/components/tasks/task-activity-timeline';
import TaskFileAttachments from '@/components/files/task-file-attachments';
import { requireRole } from '@/lib/auth/authorization';
import { getTaskById, getTaskComments, getTaskActivities } from '@/lib/queries/tasks';
import { listFiles } from '@/lib/queries/files';
import { formatDate } from '@/lib/utils/format';
import { TASK_STATUSES } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

interface TaskDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata(props: TaskDetailPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const task = await getTaskById(id);
  if (!task) return { title: 'Task Not Found' };
  return {
    title: `${task.taskCode}: ${task.title}`,
    description: task.description || 'Task details, assignments and activity.',
  };
}

export default async function AdminTaskDetailPage(props: TaskDetailPageProps) {
  const user = await requireRole(USER_ROLES.ADMIN);
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
      <div className="flex items-center justify-between">
        <Link
          href="/admin/tasks"
          className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to tasks
        </Link>
        <div className="flex items-center gap-2">
          <ButtonLink href={`/admin/tasks/${task._id}/edit`} variant="outline" size="sm">
            <Edit className="h-3.5 w-3.5" aria-hidden="true" />
            Edit Task
          </ButtonLink>
        </div>
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
              <Link href={`/admin/projects/${task.project._id}`} className="font-medium text-foreground hover:underline">
                [{task.project.projectCode}] {task.project.title}
              </Link>
            </p>
          </div>

          {/* Quick Metrics */}
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

      {/* Review Banner if awaiting review */}
      {task.status === TASK_STATUSES.IN_REVIEW && (
        <TaskReviewActions taskId={task._id} taskCode={task.taskCode} />
      )}

      {/* Main Grid: Overview & Details on Left, Meta & Timeline on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <h3 className="text-sm font-semibold text-foreground mb-3">Description & Requirements</h3>
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

          {/* Submission Deliverables & Review Feedback (if submitted) */}
          {(task.submittedAt || task.submissionNotes || task.submissionLinks.length > 0) && (
            <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <GitPullRequest className="h-4 w-4 text-primary" aria-hidden="true" />
                Submitted Deliverables & Evidence
              </h3>

              {task.submissionNotes && (
                <div className="mb-4 rounded-md bg-muted/40 p-3.5 text-xs text-foreground/90 whitespace-pre-wrap">
                  <span className="font-semibold block mb-1">Work Summary:</span>
                  {task.submissionNotes}
                </div>
              )}

              {task.submissionLinks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground block">
                    Deliverable Links:
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

              {task.reviewNotes && (
                <div className="mt-4 pt-4 border-t border-border">
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">
                    Reviewer Notes / Feedback:
                  </span>
                  <p className="text-xs text-foreground/90 bg-muted/30 p-3 rounded-md">
                    {task.reviewNotes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Task File Attachments */}
          <TaskFileAttachments
            taskId={task._id}
            projectId={task.project._id}
            files={taskFilesResult.files}
            userRole={user.role}
            canAttach={true}
          />

          {/* Subtasks */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground mb-3">Subtasks</h3>
              <div className="space-y-2">
                {task.subtasks.map((st) => (
                  <div
                    key={st._id}
                    className="flex items-center justify-between rounded-md border border-border p-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">{st.taskCode}</span>
                      <Link href={`/admin/tasks/${st._id}`} className="font-medium hover:underline">
                        {st.title}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{st.assigneeName}</span>
                      <TaskStatusBadge status={st.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground mb-3">Task Dependencies</h3>
              <div className="space-y-2">
                {task.dependencies.map((dep: { _id: string; taskCode: string; title: string; status: string }) => (
                  <div
                    key={dep._id}
                    className="flex items-center justify-between rounded-md border border-border p-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">{dep.taskCode}</span>
                      <Link href={`/admin/tasks/${dep._id}`} className="font-medium hover:underline">
                        {dep.title}
                      </Link>
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
          {/* Metadata Card */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
              Assignment & Schedule
            </h3>

            <div>
              <span className="text-xs text-muted-foreground block">Assigned Employee</span>
              <div className="flex items-center gap-2 mt-1">
                <User className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                {task.assignee ? (
                  <div>
                    <span className="text-xs font-medium text-foreground block">{task.assignee.name}</span>
                    <span className="text-[11px] text-muted-foreground">{task.assignee.email}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Unassigned</span>
                )}
              </div>
            </div>

            {task.milestone && (
              <div>
                <span className="text-xs text-muted-foreground block">Milestone</span>
                <div className="flex items-center gap-2 mt-1 text-xs font-medium text-foreground">
                  <Milestone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span>[{task.milestone.milestoneCode}] {task.milestone.title}</span>
                </div>
              </div>
            )}

            <div>
              <span className="text-xs text-muted-foreground block">Estimated Time</span>
              <div className="flex items-center gap-2 mt-1 text-xs font-mono text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>{formatMinutes(task.estimatedMinutes)}</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block">Start Date</span>
              <div className="flex items-center gap-2 mt-1 text-xs text-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>{task.startDate ? formatDate(task.startDate) : 'Not started'}</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-muted-foreground block">Due Date</span>
              <div className="flex items-center gap-2 mt-1 text-xs text-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>{task.dueDate ? formatDate(task.dueDate) : 'No due date'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground block">Created By</span>
              <span className="text-xs font-medium text-foreground mt-0.5 block">
                {task.creator.name} ({formatDate(task.createdAt)})
              </span>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
            <TaskActivityTimeline activities={activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
