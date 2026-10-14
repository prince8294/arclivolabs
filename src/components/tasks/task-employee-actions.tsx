'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Play,
  Send,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Loader2,
  Sliders,
} from 'lucide-react';

import Button from '@/components/ui/button';
import {
  reportTaskBlocker,
  resolveTaskBlocker,
  startTaskWork,
  submitTaskForReview,
  updateTaskProgress,
} from '@/lib/actions/tasks';
import { TASK_STATUSES, type TaskStatus } from '@/lib/constants/enums';

interface TaskEmployeeActionsProps {
  taskId: string;
  taskCode: string;
  currentStatus: TaskStatus;
  currentProgress: number;
  reviewNotes?: string | null;
  blocker?: {
    reason: string;
    description?: string | null;
  } | null;
}

export default function TaskEmployeeActions({
  taskId,
  taskCode,
  currentStatus,
  currentProgress,
  reviewNotes,
  blocker,
}: TaskEmployeeActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Progress state
  const [progressVal, setProgressVal] = useState(currentProgress);
  const [showProgressSave, setShowProgressSave] = useState(false);

  // Modals state
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [blockerReason, setBlockerReason] = useState('');
  const [blockerDesc, setBlockerDesc] = useState('');

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionLinks, setSubmissionLinks] = useState<Array<{ title: string; url: string }>>([
    { title: 'GitHub PR', url: '' },
  ]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartWork = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await startTaskWork(taskId);
      if (res.success) {
        router.refresh();
      } else {
        setErrorMessage(res.message || 'Failed to start work.');
      }
    });
  };

  const handleSaveProgress = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await updateTaskProgress(taskId, progressVal);
      if (res.success) {
        setShowProgressSave(false);
        router.refresh();
      } else {
        setErrorMessage(res.message || 'Failed to update progress.');
      }
    });
  };

  const handleReportBlocker = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    startTransition(async () => {
      const res = await reportTaskBlocker(taskId, {
        reason: blockerReason,
        description: blockerDesc,
      });
      if (res.success) {
        setShowBlockerModal(false);
        router.refresh();
      } else {
        setErrorMessage(res.message || 'Failed to report blocker.');
      }
    });
  };

  const handleResolveBlocker = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    startTransition(async () => {
      const res = await resolveTaskBlocker(taskId, {
        resolutionNotes,
      });
      if (res.success) {
        setShowResolveModal(false);
        router.refresh();
      } else {
        setErrorMessage(res.message || 'Failed to resolve blocker.');
      }
    });
  };

  const handleAddLink = () => {
    setSubmissionLinks((links) => [...links, { title: '', url: '' }]);
  };

  const handleRemoveLink = (index: number) => {
    setSubmissionLinks((links) => links.filter((_, i) => i !== index));
  };

  const handleLinkChange = (index: number, field: 'title' | 'url', value: string) => {
    setSubmissionLinks((links) =>
      links.map((link, i) => (i === index ? { ...link, [field]: value } : link))
    );
  };

  const handleSubmitForReview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validLinks = submissionLinks.filter((l) => l.title.trim() && l.url.trim());

    startTransition(async () => {
      const res = await submitTaskForReview(taskId, {
        submissionNotes,
        submissionLinks: validLinks,
      });
      if (res.success) {
        setShowSubmitModal(false);
        router.refresh();
      } else {
        setErrorMessage(res.message || 'Failed to submit work.');
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Changes requested banner */}
      {currentStatus === TASK_STATUSES.CHANGES_REQUESTED && (
        <div className="rounded-lg border border-amber-300 bg-amber-500/10 p-4 text-xs dark:border-amber-700">
          <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Changes Requested by Reviewer
          </div>
          <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
            {reviewNotes || 'Please make the required revisions and submit again.'}
          </p>
        </div>
      )}

      {/* Active blocker banner */}
      {currentStatus === TASK_STATUSES.BLOCKED && blocker && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Task is Currently Blocked: {blocker.reason}
          </div>
          {blocker.description && (
            <p className="mt-1 text-muted-foreground">{blocker.description}</p>
          )}
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowResolveModal(true)}
              className="text-xs"
            >
              Resolve Blocker & Resume Work
            </Button>
          </div>
        </div>
      )}

      {/* Primary Actions based on status */}
      <div className="flex flex-wrap items-center gap-3">
        {currentStatus === TASK_STATUSES.TODO && (
          <Button size="sm" onClick={handleStartWork} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            Start Working
          </Button>
        )}

        {(currentStatus === TASK_STATUSES.IN_PROGRESS ||
          currentStatus === TASK_STATUSES.CHANGES_REQUESTED) && (
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setShowSubmitModal(true)}
              disabled={isPending}
              className="bg-primary text-white"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Submit for Review
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBlockerModal(true)}
              disabled={isPending}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Report Blocker
            </Button>
          </>
        )}

        {currentStatus === TASK_STATUSES.IN_REVIEW && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Work submitted. Awaiting manager review and approval.
          </div>
        )}

        {currentStatus === TASK_STATUSES.COMPLETED && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Approved and Completed
          </div>
        )}
      </div>

      {/* Progress Adjustment (Available while in progress) */}
      {(currentStatus === TASK_STATUSES.IN_PROGRESS ||
        currentStatus === TASK_STATUSES.CHANGES_REQUESTED) && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              Update Work Progress
            </span>
            <span className="text-xs font-mono font-semibold text-primary">
              {progressVal}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progressVal}
              onChange={(e) => {
                setProgressVal(parseInt(e.target.value, 10));
                setShowProgressSave(true);
              }}
              className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
            />
            {showProgressSave && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveProgress}
                disabled={isPending}
                className="shrink-0 text-xs py-1 px-2.5 h-8"
              >
                {isPending ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Report Blocker Modal */}
      {showBlockerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h4 className="text-base font-semibold text-foreground mb-1">
              Report Blocker on {taskCode}
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              Flag why work cannot continue (e.g. missing credentials, pending assets, design questions).
            </p>

            <form onSubmit={handleReportBlocker} className="space-y-3">
              <div>
                <label htmlFor="reason" className="block text-xs font-medium text-foreground">
                  Reason <span className="text-destructive">*</span>
                </label>
                <input
                  id="reason"
                  type="text"
                  required
                  value={blockerReason}
                  onChange={(e) => setBlockerReason(e.target.value)}
                  placeholder="e.g. Missing AWS credentials"
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="desc" className="block text-xs font-medium text-foreground">
                  Additional Details
                </label>
                <textarea
                  id="desc"
                  rows={3}
                  value={blockerDesc}
                  onChange={(e) => setBlockerDesc(e.target.value)}
                  placeholder="Explain what has been tried and what is required to unblock..."
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBlockerModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {isPending ? 'Reporting...' : 'Report Blocker'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Blocker Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h4 className="text-base font-semibold text-foreground mb-1">
              Resolve Blocker
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              Mark this blocker as resolved and move the task back to In Progress.
            </p>

            <form onSubmit={handleResolveBlocker} className="space-y-3">
              <div>
                <label htmlFor="resNotes" className="block text-xs font-medium text-foreground">
                  Resolution Notes
                </label>
                <textarea
                  id="resNotes"
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Received API keys from lead developer. Ready to proceed."
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResolveModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? 'Resolving...' : 'Resolve & Resume'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit for Review Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h4 className="text-base font-semibold text-foreground mb-1">
              Submit {taskCode} for Review
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              Provide a clear summary of your work and optional evidence URLs for the reviewer.
            </p>

            <form onSubmit={handleSubmitForReview} className="space-y-4">
              <div>
                <label htmlFor="subNotes" className="block text-xs font-medium text-foreground">
                  Work Summary <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="subNotes"
                  rows={3}
                  required
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="e.g. Completed responsive layout for homepage and verified across mobile and tablet. Integrated contact form with validation."
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-foreground">
                    Evidence & Deliverable Links (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    Add Link
                  </button>
                </div>

                <div className="space-y-2">
                  {submissionLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Title (e.g. GitHub PR)"
                        value={link.title}
                        onChange={(e) => handleLinkChange(idx, 'title', e.target.value)}
                        className="w-1/3 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="url"
                        placeholder="https://github.com/..."
                        value={link.url}
                        onChange={(e) => handleLinkChange(idx, 'url', e.target.value)}
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {submissionLinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(idx)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSubmitModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? 'Submitting...' : 'Submit Work'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
