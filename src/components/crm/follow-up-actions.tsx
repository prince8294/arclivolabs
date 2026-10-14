'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { CalendarPlus, CheckCircle2, Loader2 } from 'lucide-react';

import FormDialog from '@/components/ui/form-dialog';
import {
  completeFollowUp,
  scheduleFollowUp,
} from '@/lib/actions/communications';
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LOST_REASONS,
  LOST_REASON_LABELS,
  type LeadStatus,
} from '@/lib/constants/enums';
import { toDateTimeLocalValue } from '@/lib/utils/follow-up';
import {
  INITIAL_ACTIVITY_STATE,
  type ActivityActionState,
} from '@/lib/validations/communication';

export interface FollowUpActionsProps {
  leadId: string;
  leadCode: string;
  leadName: string;
  currentStatus: LeadStatus;
  nextFollowUpAt: Date | null;
}

const inputClasses =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const selectClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const labelClasses = 'text-sm font-medium text-foreground';

const triggerClasses =
  'inline-flex h-9 items-center gap-x-2 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

const submitClasses =
  'inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60';

/**
 * Follow-up quick actions.
 *
 * "Schedule follow-up" writes `Lead.nextFollowUpAt` plus a timeline entry;
 * "Complete follow-up" records the outcome, optionally moves the pipeline
 * status and either schedules the next follow-up or clears the field.
 *
 * The current follow-up is always prefilled, so "reschedule" is just the
 * same dialog with a value in it. Nothing here forces a new follow-up.
 */
export default function FollowUpActions({
  leadId,
  leadCode,
  leadName,
  currentStatus,
  nextFollowUpAt,
}: FollowUpActionsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'schedule' | 'complete' | null>(null);

  const [scheduleState, scheduleAction, schedulePending] = useActionState<
    ActivityActionState,
    FormData
  >(scheduleFollowUp, INITIAL_ACTIVITY_STATE);

  const [completeState, completeAction, completePending] = useActionState<
    ActivityActionState,
    FormData
  >(completeFollowUp, INITIAL_ACTIVITY_STATE);

  const refreshed = useRef<ActivityActionState | null>(null);
  useEffect(() => {
    if (
      (scheduleState.ok || completeState.ok) &&
      refreshed.current !== completeState
    ) {
      refreshed.current = completeState;
      setMode(null);
      router.refresh();
    }
  }, [scheduleState, completeState, router]);

  const scheduleDialogOpen = mode === 'schedule';
  const completeDialogOpen = mode === 'complete';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={triggerClasses}
        onClick={() => setMode('schedule')}
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        {nextFollowUpAt ? 'Reschedule follow-up' : 'Schedule follow-up'}
      </button>

      {nextFollowUpAt && (
        <button
          type="button"
          className={triggerClasses}
          onClick={() => setMode('complete')}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Complete follow-up
        </button>
      )}

      {scheduleDialogOpen && (
        <FormDialog
          title={
            nextFollowUpAt ? 'Reschedule follow-up' : 'Schedule follow-up'
          }
          description={`${leadName} · ${leadCode}. The current follow-up is ${
            nextFollowUpAt ? toDateTimeLocalValue(nextFollowUpAt) : 'not set'
          }.`}
          pending={schedulePending}
          error={scheduleState.error}
          onClose={() => setMode(null)}
        >
          <form action={scheduleAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={leadId} />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`followUpAt-${leadId}`}
                className={labelClasses}
              >
                Follow-up date &amp; time
              </label>
              <input
                id={`followUpAt-${leadId}`}
                name="nextFollowUpAt"
                type="datetime-local"
                required
                defaultValue={toDateTimeLocalValue(nextFollowUpAt)}
                className={inputClasses}
              />
              {scheduleState.fieldErrors?.nextFollowUpAt && (
                <p role="alert" className="text-xs text-destructive">
                  {scheduleState.fieldErrors.nextFollowUpAt}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`followUpNote-${leadId}`} className={labelClasses}>
                Note (optional)
              </label>
              <textarea
                id={`followUpNote-${leadId}`}
                name="note"
                rows={3}
                maxLength={500}
                placeholder="Confirm the budget, share the revised quote…"
                className={inputClasses}
              />
              {scheduleState.fieldErrors?.note && (
                <p role="alert" className="text-xs text-destructive">
                  {scheduleState.fieldErrors.note}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setMode(null)}
                disabled={schedulePending}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={schedulePending}
                className={submitClasses}
              >
                {schedulePending && (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {schedulePending ? 'Saving…' : 'Save follow-up'}
              </button>
            </div>
          </form>
        </FormDialog>
      )}

      {completeDialogOpen && (
        <FormDialog
          title="Complete follow-up"
          description={`${leadName} · ${leadCode}. Record what happened; a new follow-up is optional.`}
          pending={completePending}
          error={completeState.error}
          onClose={() => setMode(null)}
          size="lg"
        >
          <form action={completeAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={leadId} />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`followUpOutcome-${leadId}`}
                className={labelClasses}
              >
                Outcome
              </label>
              <textarea
                id={`followUpOutcome-${leadId}`}
                name="outcome"
                rows={3}
                maxLength={1000}
                required
                placeholder="Spoke to the owner; he wants a revised quote by Friday."
                className={inputClasses}
              />
              {completeState.fieldErrors?.outcome && (
                <p role="alert" className="text-xs text-destructive">
                  {completeState.fieldErrors.outcome}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`followUpStatus-${leadId}`}
                className={labelClasses}
              >
                Update lead status (optional)
              </label>
              <select
                id={`followUpStatus-${leadId}`}
                name="status"
                defaultValue=""
                className={selectClasses}
              >
                <option value="">Keep {LEAD_STATUS_LABELS[currentStatus as never] ?? 'current status'}</option>
                {Object.values(LEAD_STATUSES).map((value) => (
                  <option key={value} value={value}>
                    {LEAD_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
              {completeState.fieldErrors?.status && (
                <p role="alert" className="text-xs text-destructive">
                  {completeState.fieldErrors.status}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`followUpLostReason-${leadId}`}
                className={labelClasses}
              >
                Lost reason (only if the lead was marked lost)
              </label>
              <select
                id={`followUpLostReason-${leadId}`}
                name="lostReason"
                defaultValue=""
                className={selectClasses}
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
                htmlFor={`followUpNext-${leadId}`}
                className={labelClasses}
              >
                Next follow-up (optional)
              </label>
              <input
                id={`followUpNext-${leadId}`}
                name="nextFollowUpAt"
                type="datetime-local"
                className={inputClasses}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to clear the current follow-up.
              </p>
              {completeState.fieldErrors?.nextFollowUpAt && (
                <p role="alert" className="text-xs text-destructive">
                  {completeState.fieldErrors.nextFollowUpAt}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setMode(null)}
                disabled={completePending}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={completePending}
                className={submitClasses}
              >
                {completePending && (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {completePending ? 'Saving…' : 'Complete follow-up'}
              </button>
            </div>
          </form>
        </FormDialog>
      )}
    </div>
  );
}
