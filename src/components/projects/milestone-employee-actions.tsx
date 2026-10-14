'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Send } from 'lucide-react';

import Button from '@/components/ui/button';
import {
  PROJECT_MILESTONE_STATUSES,
  type ProjectMilestoneStatus,
} from '@/lib/constants/enums';
import {
  submitMilestoneForReview,
  updateMilestoneProgress,
} from '@/lib/actions/projects';

interface EmployeeMilestoneActionsProps {
  projectId: string;
  milestoneId: string;
  milestoneCode: string;
  status: ProjectMilestoneStatus;
  progressPercentage: number;
  /** True when the signed-in user is the assigned employee (or the manager). */
  canUpdate: boolean;
}

const inputClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const textareaClasses =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Employee controls for a milestone: record progress and submit for review.
 *
 * No completion control is rendered - a milestone can only become COMPLETE via
 * an admin review, and this component never accepts a self-approval path.
 */
export default function EmployeeMilestoneActions({
  projectId,
  milestoneId,
  milestoneCode,
  status,
  progressPercentage,
  canUpdate,
}: EmployeeMilestoneActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [progress, setProgress] = useState(String(progressPercentage));
  const [note, setNote] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const locked =
    status === PROJECT_MILESTONE_STATUSES.COMPLETED ||
    status === PROJECT_MILESTONE_STATUSES.CANCELLED;
  const awaitingReview = status === PROJECT_MILESTONE_STATUSES.PENDING_REVIEW;

  const saveProgress = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateMilestoneProgress(projectId, milestoneId, {
        progressPercentage: progress === '' ? 0 : Number(progress),
        note,
      });
      if (result.success) {
        setSuccess(result.message ?? 'Progress updated.');
        setNote('');
        router.refresh();
        return;
      }
      setError(result.message ?? 'Unable to update progress.');
    });
  };

  const submit = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await submitMilestoneForReview(projectId, milestoneId, {
        notes: submitNotes,
      });
      if (result.success) {
        setSuccess(result.message ?? 'Submitted for review.');
        setSubmitNotes('');
        router.refresh();
        return;
      }
      setError(result.message ?? 'Unable to submit for review.');
    });
  };

  if (!canUpdate) return null;

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3">
      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 text-xs text-destructive"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="flex items-center gap-2 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {success}
        </p>
      ) : null}

      {locked ? (
        <p className="text-xs text-muted-foreground">
          {milestoneCode} is {status.replace(/_/g, ' ').toLowerCase()} and no longer accepts
          updates.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor={`progress-${milestoneId}`} className="text-xs font-medium text-foreground">
                Progress %
              </label>
              <input
                id={`progress-${milestoneId}`}
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                disabled={isPending || awaitingReview}
                className={`${inputClasses} mt-1 w-24`}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={saveProgress}
              disabled={isPending || awaitingReview}
            >
              Save progress
            </Button>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            disabled={isPending || awaitingReview}
            placeholder="Optional note about what was completed."
            aria-label="Progress note"
            className={textareaClasses}
          />

          {awaitingReview ? (
            <p className="text-xs text-muted-foreground">
              Submitted for review. An admin will approve it or send it back with notes.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                value={submitNotes}
                onChange={(e) => setSubmitNotes(e.target.value)}
                rows={2}
                disabled={isPending}
                placeholder="Anything the reviewer should know before approving."
                aria-label="Submission notes"
                className={textareaClasses}
              />
              <div>
                <Button
                  type="button"
                  size="sm"
                  onClick={submit}
                  disabled={isPending}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {isPending ? 'Submitting...' : 'Submit for review'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
