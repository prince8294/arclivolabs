'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Loader2, Save } from 'lucide-react';

import { updateLeadStatus } from '@/lib/actions/leads';
import {
  INITIAL_LEAD_STATE,
  type LeadActionState,
} from '@/lib/validations/lead';
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LOST_REASONS,
  LOST_REASON_LABELS,
  type LeadStatus,
} from '@/lib/constants/enums';
import { cn } from '@/lib/utils/cn';

export interface LeadStatusFormProps {
  leadId: string;
  leadCode: string;
  status: LeadStatus;
  /** `row` = compact select + icon button; `panel` = labeled form. */
  variant?: 'row' | 'panel';
  lostReason?: string;
  lostReasonNote?: string;
}

const iconButtonClasses =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

/**
 * Quick pipeline status change.
 *
 * Only the approved statuses are offered; moving backwards (e.g.
 * NEGOTIATION → INTERESTED) is allowed because real deals do that.
 * Choosing LOST reveals an optional reason + free-text note, which the
 * server clears again if the lead later leaves the LOST stage.
 *
 * The mutation is a server action that re-checks role and ownership, so
 * this component is presentation only.
 */
export default function LeadStatusForm({
  leadId,
  leadCode,
  status,
  variant = 'row',
  lostReason = '',
  lostReasonNote = '',
}: LeadStatusFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState<LeadActionState, FormData>(
    updateLeadStatus,
    INITIAL_LEAD_STATE
  );
  const [selected, setSelected] = useState<LeadStatus>(status);

  // Keep the local selection in step with the server value after a
  // refresh (render-phase adjustment, no effect writing state).
  const [lastStatus, setLastStatus] = useState<LeadStatus>(status);
  if (lastStatus !== status) {
    setLastStatus(status);
    setSelected(status);
  }

  const refreshed = useRef<LeadActionState | null>(null);
  useEffect(() => {
    if (state.ok && refreshed.current !== state) {
      refreshed.current = state;
      router.refresh();
    }
  }, [state, router]);

  const isLost = selected === LEAD_STATUSES.LOST;
  const dirty = selected !== status;

  if (variant === 'row') {
    return (
      <form action={action} className="inline-flex items-center gap-1">
        <input type="hidden" name="id" value={leadId} />
        <label className="sr-only" htmlFor={`status-${leadId}`}>
          Status for {leadCode}
        </label>
        <select
          id={`status-${leadId}`}
          name="status"
          value={selected}
          onChange={(event) => setSelected(event.target.value as LeadStatus)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Object.values(LEAD_STATUSES).map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        {isLost && (
          <>
            <label className="sr-only" htmlFor={`lostReason-${leadId}`}>
              Loss reason for {leadCode}
            </label>
            <select
              id={`lostReason-${leadId}`}
              name="lostReason"
              defaultValue={lostReason}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Reason…</option>
              {Object.values(LOST_REASONS).map((value) => (
                <option key={value} value={value}>
                  {LOST_REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="submit"
          disabled={pending || !dirty}
          className={iconButtonClasses}
          aria-label={`Update status for ${leadCode}`}
          title={dirty ? 'Save status' : 'Status unchanged'}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={leadId} />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`status-panel-${leadId}`}
          className="text-sm font-medium text-foreground"
        >
          Pipeline status
        </label>
        <select
          id={`status-panel-${leadId}`}
          name="status"
          value={selected}
          onChange={(event) => setSelected(event.target.value as LeadStatus)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Object.values(LEAD_STATUSES).map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {isLost && (
        <>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`lostReason-panel-${leadId}`}
              className="text-sm font-medium text-foreground"
            >
              Lost reason (optional)
            </label>
            <select
              id={`lostReason-panel-${leadId}`}
              name="lostReason"
              defaultValue={lostReason}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Not specified</option>
              {Object.values(LOST_REASONS).map((value) => (
                <option key={value} value={value}>
                  {LOST_REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`lostReasonNote-panel-${leadId}`}
              className="text-sm font-medium text-foreground"
            >
              Reason detail (optional)
            </label>
            <textarea
              id={`lostReasonNote-panel-${leadId}`}
              name="lostReasonNote"
              rows={2}
              maxLength={500}
              defaultValue={lostReasonNote}
              placeholder="A short free-text note about why the deal was lost."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !dirty}
        className={cn(
          'inline-flex h-9 w-fit items-center gap-x-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'
        )}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="h-4 w-4" aria-hidden="true" />
        )}
        {pending ? 'Saving…' : 'Update status'}
      </button>
    </form>
  );
}