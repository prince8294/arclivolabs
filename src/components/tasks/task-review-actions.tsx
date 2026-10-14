'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

import Button from '@/components/ui/button';
import { reviewTask } from '@/lib/actions/tasks';

interface TaskReviewActionsProps {
  taskId: string;
  taskCode: string;
}

export default function TaskReviewActions({ taskId, taskCode }: TaskReviewActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showChangesModal, setShowChangesModal] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const res = await reviewTask(taskId, {
        action: 'APPROVE',
        feedbackNotes: 'Work verified and approved.',
      });
      if (res.success) {
        router.refresh();
      } else {
        setError(res.message || 'Failed to approve task.');
      }
    });
  };

  const handleRequestChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedbackNotes.trim().length < 5) {
      setError('Please provide at least 5 characters of feedback explaining what needs fixing.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await reviewTask(taskId, {
        action: 'REQUEST_CHANGES',
        feedbackNotes,
      });
      if (res.success) {
        setShowChangesModal(false);
        router.refresh();
      } else {
        setError(res.message || 'Failed to request changes.');
      }
    });
  };

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
            Task Awaiting Review
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review the submitted work and deliverables before completing this task.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChangesModal(true)}
            disabled={isPending}
            className="border-warning/40 text-amber-700 hover:bg-warning/10 dark:text-amber-400"
          >
            Request Changes
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApprove}
            disabled={isPending}
            className="bg-success text-white hover:bg-success/90"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Approve Work
              </>
            )}
          </Button>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {/* Request Changes Dialog */}
      {showChangesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h4 className="text-base font-semibold text-foreground mb-1">
              Request Changes on {taskCode}
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              Specify what corrections or adjustments the assigned employee needs to make.
            </p>

            <form onSubmit={handleRequestChanges}>
              <label htmlFor="feedback" className="block text-xs font-medium text-foreground mb-1">
                Reviewer Feedback <span className="text-destructive">*</span>
              </label>
              <textarea
                id="feedback"
                rows={4}
                required
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                placeholder="e.g. Mobile navigation is overflowing on screens below 768px. Please adjust spacing and verify touch targets."
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChangesModal(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isPending ? 'Submitting...' : 'Send Changes Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
