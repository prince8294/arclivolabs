'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Pause, Play, ShieldCheck } from 'lucide-react';

import Button from '@/components/ui/button';
import FormDialog from '@/components/ui/form-dialog';
import {
  PROJECT_HEALTHS,
  PROJECT_HEALTH_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TRANSITIONS,
  PROJECT_STATUSES,
  type ProjectHealth,
  type ProjectStatus,
} from '@/lib/constants/enums';
import { changeProjectStatus } from '@/lib/actions/projects';

interface ProjectStatusManagerProps {
  projectId: string;
  currentStatus: ProjectStatus;
  currentHealth: ProjectHealth;
}

export default function ProjectStatusManager({
  projectId,
  currentStatus,
  currentHealth,
}: ProjectStatusManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [target, setTarget] = useState<ProjectStatus | null>(null);
  const [reason, setReason] = useState('');
  const [health, setHealth] = useState<ProjectHealth>(currentHealth);
  const [completionNotes, setCompletionNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Only transitions the server will actually accept are offered (§12).
  const allowed = PROJECT_STATUS_TRANSITIONS[currentStatus] ?? [];

  const needsReason = target === PROJECT_STATUSES.ON_HOLD || target === PROJECT_STATUSES.CANCELLED;
  const needsCompletionNotes = target === PROJECT_STATUSES.COMPLETED;

  const submit = (status: ProjectStatus, extra?: Record<string, unknown>) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await changeProjectStatus(projectId, { status, ...extra });
      if (result.success) {
        setTarget(null);
        setReason('');
        setCompletionNotes('');
        setSuccess(result.message ?? 'Project updated.');
        router.refresh();
        return;
      }
      setError(result.message ?? 'Unable to update the project status.');
    });
  };

  const handleQuickAction = (status: ProjectStatus) => {
    // Pause / resume / complete / cancel all need extra input, so they open the
    // dialog; everything else applies immediately.
    if (
      status === PROJECT_STATUSES.ON_HOLD ||
      status === PROJECT_STATUSES.CANCELLED ||
      status === PROJECT_STATUSES.COMPLETED
    ) {
      setTarget(status);
      setError(null);
      return;
    }
    submit(status);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {allowed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This project is {PROJECT_STATUS_LABELS[currentStatus].toLowerCase()} and has no
            further transitions.
          </p>
        ) : (
          allowed.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={status === PROJECT_STATUSES.CANCELLED ? 'danger' : 'outline'}
              onClick={() => handleQuickAction(status)}
              disabled={isPending}
            >
              {status === PROJECT_STATUSES.IN_PROGRESS &&
              currentStatus === PROJECT_STATUSES.ON_HOLD ? (
                <Play className="h-4 w-4" aria-hidden="true" />
              ) : null}
              {status === PROJECT_STATUSES.ON_HOLD ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : null}
              {status === PROJECT_STATUSES.COMPLETED ? (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              ) : null}
              Move to {PROJECT_STATUS_LABELS[status].toLowerCase()}
            </Button>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <div>
          <label htmlFor="health-select" className="text-sm font-medium text-foreground">
            Delivery health
          </label>
          <select
            id="health-select"
            value={health}
            onChange={(e) => setHealth(e.target.value as ProjectHealth)}
            disabled={isPending}
            className="mt-1.5 h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Object.entries(PROJECT_HEALTH_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => submit(currentStatus, { health })}
          disabled={isPending || health === currentHealth}
        >
          {isPending ? 'Saving...' : 'Update health'}
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

      {target ? (
      <FormDialog
        title={`Move project to ${PROJECT_STATUS_LABELS[target].toLowerCase()}`}
        description={
          target === PROJECT_STATUSES.COMPLETED
            ? 'This records INTERNAL completion. Client acceptance is a separate step and is not implied.'
            : target === PROJECT_STATUSES.CANCELLED
              ? 'Cancelling preserves the project, its team history, milestones and the linked deal. It does not cancel the deal or issue a refund.'
              : 'Add a short reason so the project timeline stays meaningful.'
        }
        pending={isPending}
        error={error ?? undefined}
        onClose={() => {
          setTarget(null);
          setReason('');
          setCompletionNotes('');
          setError(null);
        }}
      >
        <div className="flex flex-col gap-4">
          {needsReason ? (
            <div>
              <label htmlFor="status-reason" className="text-sm font-medium text-foreground">
                Reason <span className="text-destructive">*</span>
              </label>
              <input
                id="status-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  target === PROJECT_STATUSES.ON_HOLD
                    ? 'e.g. Waiting for client content'
                    : 'e.g. Client withdrew the engagement'
                }
                className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ) : null}

          {needsCompletionNotes ? (
            <div>
              <label
                htmlFor="completion-notes"
                className="text-sm font-medium text-foreground"
              >
                Internal completion note <span className="text-destructive">*</span>
              </label>
              <textarea
                id="completion-notes"
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="What was delivered and reviewed internally."
              />
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTarget(null);
                setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={target === PROJECT_STATUSES.CANCELLED ? 'danger' : 'primary'}
              onClick={() => {
                if (!target) return;
                void submit(target, {
                  reason,
                  completionNotes,
                  health: PROJECT_HEALTHS.ON_TRACK,
                });
              }}
              disabled={isPending}
            >
              {isPending ? 'Saving...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </FormDialog>
      ) : null}
    </div>
  );
}
