'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Plus } from 'lucide-react';

import Button from '@/components/ui/button';
import FormDialog from '@/components/ui/form-dialog';
import { PROJECT_MILESTONE_STATUSES } from '@/lib/constants/enums';
import {
  cancelProjectMilestone,
  createProjectMilestone,
  reviewMilestone,
} from '@/lib/actions/projects';
import type { ProjectMemberItem, ProjectMilestoneItem } from '@/lib/queries/projects';
import {
  MilestoneDeadlineBadge,
  MilestoneStatusBadge,
  ProjectProgressBar,
} from './project-panels';

interface ProjectMilestoneManagerProps {
  projectId: string;
  milestones: ProjectMilestoneItem[];
  members: ProjectMemberItem[];
}

const selectClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const inputClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const textareaClasses =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function ProjectMilestoneManager({
  projectId,
  milestones,
  members,
}: ProjectMilestoneManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [sequence, setSequence] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [clientVisible, setClientVisible] = useState(false);

  const [reviewTarget, setReviewTarget] = useState<ProjectMilestoneItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [cancelTarget, setCancelTarget] = useState<ProjectMilestoneItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleCreate = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await createProjectMilestone(projectId, {
        title,
        description,
        deliverables,
        sequence: sequence ? Number(sequence) : undefined,
        startDate,
        dueDate,
        assignedTo,
        clientVisible,
      });

      if (result.success) {
        setCreateOpen(false);
        setTitle('');
        setDescription('');
        setDeliverables('');
        setSequence('');
        setStartDate('');
        setDueDate('');
        setAssignedTo('');
        setClientVisible(false);
        setSuccess(result.message ?? 'Milestone created.');
        router.refresh();
        return;
      }
      setError(result.message ?? 'Unable to create the milestone.');
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    });
  };

  const handleReview = (decision: 'APPROVE' | 'REQUEST_CHANGES') => {
    if (!reviewTarget) return;
    startTransition(async () => {
      const result = await reviewMilestone(projectId, reviewTarget._id, {
        decision,
        reviewNotes,
      });
      if (result.success) {
        setReviewTarget(null);
        setReviewNotes('');
        setError(null);
        setSuccess(result.message ?? 'Review saved.');
        router.refresh();
        return;
      }
      setError(result.message ?? 'Unable to record the review.');
    });
  };

  const handleCancel = () => {
    if (!cancelTarget) return;
    startTransition(async () => {
      const result = await cancelProjectMilestone(projectId, cancelTarget._id, {
        reason: cancelReason,
      });
      if (result.success) {
        setCancelTarget(null);
        setCancelReason('');
        setError(null);
        setSuccess(result.message ?? 'Milestone cancelled.');
        router.refresh();
        return;
      }
      setError(result.message ?? 'Unable to cancel the milestone.');
    });
  };

  const pendingReview = milestones.filter(
    (m) => m.status === PROJECT_MILESTONE_STATUSES.PENDING_REVIEW
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {milestones.length} milestone{milestones.length === 1 ? '' : 's'} ·{' '}
            {pendingReview.length} awaiting review
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Project progress is the average of these milestones, calculated on the
            server.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)} disabled={isPending}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add milestone
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{success}</span>
        </div>
      ) : null}

      {milestones.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No milestones yet. Define the phases this project moves through.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {milestones.map((milestone) => (
            <li key={milestone._id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">
                      {milestone.milestoneCode}
                    </span>
                    <span className="font-medium text-foreground">{milestone.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sequence {milestone.sequence} ·{' '}
                    {milestone.assignee ? milestone.assignee.name : 'Unassigned'} ·{' '}
                    {milestone.dueDate
                      ? `Due ${new Date(milestone.dueDate).toLocaleDateString('en-GB')}`
                      : 'No deadline'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <MilestoneStatusBadge status={milestone.status} />
                  <MilestoneDeadlineBadge
                    state={milestone.deadlineState}
                    daysUntilDue={milestone.daysUntilDue}
                  />
                  {milestone.clientVisible ? (
                    <span className="text-xs text-muted-foreground">Client visible</span>
                  ) : null}
                </div>
              </div>

              {milestone.description ? (
                <p className="mt-2 text-sm text-muted-foreground">{milestone.description}</p>
              ) : null}

              {milestone.deliverables.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                  {milestone.deliverables.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}

              <ProjectProgressBar
                className="mt-3"
                label="Milestone progress"
                value={milestone.progressPercentage}
              />

              {milestone.dependsOn.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Depends on:{' '}
                  {milestone.dependsOn.map((d) => d.milestoneCode).join(', ')}
                </p>
              ) : null}

              {milestone.review.submissionNotes ? (
                <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  Submitted by {milestone.review.submittedBy?.name ?? 'employee'}:{' '}
                  {milestone.review.submissionNotes}
                </p>
              ) : null}

              {milestone.review.reviewNotes ? (
                <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  Reviewer note: {milestone.review.reviewNotes}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {milestone.status === PROJECT_MILESTONE_STATUSES.PENDING_REVIEW ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setError(null);
                        setReviewTarget(milestone);
                      }}
                      disabled={isPending}
                    >
                      Review submission
                    </Button>
                    {milestone.canSelfApprove ? (
                      <span className="self-center text-xs text-muted-foreground">
                        You submitted this, so another admin must approve it.
                      </span>
                    ) : null}
                  </>
                ) : null}

                {milestone.status !== PROJECT_MILESTONE_STATUSES.COMPLETED &&
                milestone.status !== PROJECT_MILESTONE_STATUSES.CANCELLED ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setError(null);
                      setCancelTarget(milestone);
                    }}
                    disabled={isPending}
                  >
                    Cancel milestone
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create milestone */}
      {createOpen ? (
      <FormDialog
        title="Add milestone"
        description="Milestones drive project progress and the delivery schedule."
        size="lg"
        pending={isPending}
        error={error ?? undefined}
        onClose={() => {
          setCreateOpen(false);
          setError(null);
          setFieldErrors({});
        }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="ms-title" className="text-sm font-medium text-foreground">
              Milestone title <span className="text-destructive">*</span>
            </label>
            <input
              id="ms-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${inputClasses} mt-1.5`}
              placeholder="e.g. UI/UX Design"
            />
            {fieldErrors.title ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.title}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="ms-desc" className="text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="ms-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${textareaClasses} mt-1.5`}
            />
          </div>

          <div>
            <label htmlFor="ms-deliverables" className="text-sm font-medium text-foreground">
              Deliverables
            </label>
            <textarea
              id="ms-deliverables"
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              rows={3}
              className={`${textareaClasses} mt-1.5`}
              placeholder="One per line"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ms-sequence" className="text-sm font-medium text-foreground">
                Sequence
              </label>
              <input
                id="ms-sequence"
                type="number"
                min={1}
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                className={`${inputClasses} mt-1.5`}
                placeholder="Auto"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave empty to append automatically.
              </p>
              {fieldErrors.sequence ? (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.sequence}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="ms-assignee" className="text-sm font-medium text-foreground">
                Responsible person
              </label>
              <select
                id="ms-assignee"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className={`${selectClasses} mt-1.5`}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
              {fieldErrors.assignedTo ? (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.assignedTo}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="ms-start" className="text-sm font-medium text-foreground">
                Start date
              </label>
              <input
                id="ms-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`${inputClasses} mt-1.5`}
              />
            </div>

            <div>
              <label htmlFor="ms-due" className="text-sm font-medium text-foreground">
                Due date
              </label>
              <input
                id="ms-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${inputClasses} mt-1.5`}
              />
              {fieldErrors.dueDate ? (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.dueDate}</p>
              ) : null}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={clientVisible}
              onChange={(e) => setClientVisible(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Summarise this milestone in the client portal later
          </label>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={isPending}>
              {isPending ? 'Creating...' : 'Create milestone'}
            </Button>
          </div>
        </div>
      </FormDialog>
      ) : null}

      {/* Review */}
      {reviewTarget ? (
      <FormDialog
        title={`Review ${reviewTarget.milestoneCode}`}
        description="Approving marks the milestone complete at 100%. Requesting changes returns it to the assignee with your notes."
        pending={isPending}
        error={error ?? undefined}
        onClose={() => {
          setReviewTarget(null);
          setReviewNotes('');
          setError(null);
        }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="review-notes" className="text-sm font-medium text-foreground">
              Review notes
            </label>
            <textarea
              id="review-notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              className={`${textareaClasses} mt-1.5`}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleReview('REQUEST_CHANGES')}
              disabled={isPending}
            >
              Request changes
            </Button>
            <Button
              type="button"
              onClick={() => handleReview('APPROVE')}
              disabled={isPending}
            >
              {isPending ? 'Saving...' : 'Approve'}
            </Button>
          </div>
        </div>
      </FormDialog>
      ) : null}

      {/* Cancel */}
      {cancelTarget ? (
      <FormDialog
        title={`Cancel ${cancelTarget.milestoneCode}`}
        description="The milestone is kept for history but stops counting towards project progress."
        pending={isPending}
        error={error ?? undefined}
        onClose={() => {
          setCancelTarget(null);
          setCancelReason('');
          setError(null);
        }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="cancel-reason" className="text-sm font-medium text-foreground">
              Reason <span className="text-destructive">*</span>
            </label>
            <input
              id="cancel-reason"
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className={`${inputClasses} mt-1.5`}
              placeholder="e.g. Scope reduced by the client"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={isPending}
            >
              Keep milestone
            </Button>
            <Button type="button" variant="danger" onClick={handleCancel} disabled={isPending}>
              {isPending ? 'Cancelling...' : 'Cancel milestone'}
            </Button>
          </div>
        </div>
      </FormDialog>
      ) : null}
    </div>
  );
}
