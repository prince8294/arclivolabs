'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import {
  Ban,
  CalendarPlus,
  CheckCircle2,
  CircleSlash,
  Loader2,
} from 'lucide-react';

import FormDialog from '@/components/ui/form-dialog';
import {
  cancelMeeting,
  completeMeeting,
  markMeetingNoShow,
  scheduleMeeting,
} from '@/lib/actions/meetings';
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  MEETING_DURATION_OPTIONS,
  MEETING_DURATION_DEFAULT,
  MEETING_TYPES,
  MEETING_TYPE_LABELS,
  type LeadStatus,
} from '@/lib/constants/enums';
import { toDateTimeLocalValue } from '@/lib/utils/follow-up';
import {
  INITIAL_ACTIVITY_STATE,
  type ActivityActionState,
} from '@/lib/validations/communication';
import type { MeetingActionState } from '@/lib/validations/meeting';

const inputClasses =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const selectClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const labelClasses = 'text-sm font-medium text-foreground';

const triggerClasses =
  'inline-flex h-8 items-center gap-x-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

const submitClasses =
  'inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60';

const cancelClasses =
  'inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

/**
 * "Schedule Meeting" dialog.
 *
 * Fields: title, date, time, type, duration, location or link,
 * description. The lead status only moves when the user ticks
 * the opt-in checkbox — scheduling never rewrites the pipeline
 * on its own.
 */
export function ScheduleMeetingDialog({
  leadId,
  leadCode,
  leadName,
  currentStatus,
  defaultAssigneeName,
}: {
  leadId: string;
  leadCode: string;
  leadName: string;
  currentStatus: LeadStatus;
  defaultAssigneeName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(false);
  const [state, action, pending] = useActionState<
    MeetingActionState,
    FormData
  >(scheduleMeeting, INITIAL_ACTIVITY_STATE);

  const [acknowledged, setAcknowledged] =
    useState<typeof state | null>(null);
  if (state.ok && acknowledged !== state) {
    setAcknowledged(state);
    setOpen(false);
  }

  const refreshed = useRef<typeof state | null>(null);
  useEffect(() => {
    if (state.ok && refreshed.current !== state) {
      refreshed.current = state;
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-x-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        Schedule Meeting
      </button>

      {open && (
        <FormDialog
          title={`Schedule meeting — ${leadName}`}
          description={`Recorded on ${leadCode}. No calendar or conferencing integration — the link is whatever you paste in.`}
          pending={pending}
          error={state.error}
          onClose={() => setOpen(false)}
          size="lg"
        >
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="leadId" value={leadId} />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="meeting-title" className={labelClasses}>
                Title
              </label>
              <input
                id="meeting-title"
                name="title"
                type="text"
                required
                maxLength={150}
                placeholder="Website requirement discussion"
                className={inputClasses}
              />
              <FieldError message={state.fieldErrors?.title} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="meeting-scheduledAt"
                  className={labelClasses}
                >
                  Date &amp; time
                </label>
                <input
                  id="meeting-scheduledAt"
                  name="scheduledAt"
                  type="datetime-local"
                  required
                  className={inputClasses}
                />
                <FieldError
                  message={state.fieldErrors?.scheduledAt}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="meeting-duration"
                  className={labelClasses}
                >
                  Duration
                </label>
                <select
                  id="meeting-duration"
                  name="durationMinutes"
                  defaultValue={String(MEETING_DURATION_DEFAULT)}
                  className={selectClasses}
                >
                  {MEETING_DURATION_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutes
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className={labelClasses}>Meeting type</legend>
              <div className="flex flex-wrap gap-2">
                {Object.values(MEETING_TYPES).map((type) => (
                  <label
                    key={type}
                    className="inline-flex cursor-pointer items-center gap-x-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                  >
                    <input
                      type="radio"
                      name="type"
                      value={type}
                      defaultChecked={type === MEETING_TYPES.PHONE}
                      className="h-4 w-4"
                    />
                    {MEETING_TYPE_LABELS[type]}
                  </label>
                ))}
              </div>
              <FieldError message={state.fieldErrors?.type} />
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="meeting-location"
                className={labelClasses}
              >
                Location (in-person meetings)
              </label>
              <input
                id="meeting-location"
                name="location"
                type="text"
                maxLength={200}
                placeholder="Arclivo Labs office, 2nd floor"
                className={inputClasses}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="meeting-url"
                className={labelClasses}
              >
                Meeting link (video meetings)
              </label>
              <input
                id="meeting-url"
                name="meetingUrl"
                type="url"
                maxLength={500}
                placeholder="https://meet.example.com/abc"
                className={inputClasses}
              />
              <FieldError message={state.fieldErrors?.meetingUrl} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="meeting-description"
                className={labelClasses}
              >
                Description (optional)
              </label>
              <textarea
                id="meeting-description"
                name="description"
                rows={2}
                maxLength={2000}
                placeholder="Agenda, what to bring, who is attending…"
                className={inputClasses}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-x-2 rounded-lg border border-input bg-background px-3 py-2">
              <input
                type="checkbox"
                name="updateLeadStatus"
                value="yes"
                checked={updateStatus}
                onChange={(event) =>
                  setUpdateStatus(event.target.checked)
                }
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm text-foreground">
                Also move this lead to the Meeting stage
              </span>
            </label>

            {updateStatus && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="meeting-status"
                  className={labelClasses}
                >
                  Lead status
                </label>
                <select
                  id="meeting-status"
                  name="status"
                  defaultValue={LEAD_STATUSES.MEETING}
                  className={selectClasses}
                >
                  {Object.values(LEAD_STATUSES).map((value) => (
                    <option key={value} value={value}>
                      {LEAD_STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
                <FieldError message={state.fieldErrors?.status} />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Currently {LEAD_STATUS_LABELS[currentStatus]}
              {defaultAssigneeName
                ? ` · the meeting is assigned to ${defaultAssigneeName}`
                : ''}
              .
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className={cancelClasses}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className={submitClasses}
              >
                {pending && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {pending ? 'Scheduling…' : 'Schedule meeting'}
              </button>
            </div>
          </form>
        </FormDialog>
      )}
    </>
  );
}

/**
 * Complete / cancel / no-show actions for one scheduled meeting.
 *
 * Each action is its own dialog so the fields stay minimal and
 * the intent is explicit. All three keep the meeting record —
 * history is never deleted.
 */
export function MeetingLifecycleActions({
  meetingId,
  meetingTitle,
  leadId,
  leadCode,
  leadName,
  currentStatus,
}: {
  meetingId: string;
  meetingTitle: string;
  leadId: string;
  leadCode: string;
  leadName: string;
  currentStatus: LeadStatus;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<
    'complete' | 'cancel' | 'noshow' | null
  >(null);

  const [completeState, completeAction, completePending] =
    useActionState<MeetingActionState, FormData>(
      completeMeeting,
      INITIAL_ACTIVITY_STATE
    );
  const [cancelState, cancelAction, cancelPending] =
    useActionState<MeetingActionState, FormData>(
      cancelMeeting,
      INITIAL_ACTIVITY_STATE
    );
  const [noShowState, noShowAction, noShowPending] =
    useActionState<MeetingActionState, FormData>(
      markMeetingNoShow,
      INITIAL_ACTIVITY_STATE
    );

  const refreshed = useRef<ActivityActionState | null>(null);
  useEffect(() => {
    const latest = completeState.ok
      ? completeState
      : cancelState.ok
        ? cancelState
        : noShowState.ok
          ? noShowState
          : null;
    if (latest && refreshed.current !== latest) {
      refreshed.current = latest;
      setMode(null);
      router.refresh();
    }
  }, [completeState, cancelState, noShowState, router]);

  const pending = completePending || cancelPending || noShowPending;
  const error =
    completeState.error ?? cancelState.error ?? noShowState.error;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={triggerClasses}
          onClick={() => setMode('complete')}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Complete
        </button>
        <button
          type="button"
          className={triggerClasses}
          onClick={() => setMode('cancel')}
        >
          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
          Cancel
        </button>
        <button
          type="button"
          className={triggerClasses}
          onClick={() => setMode('noshow')}
        >
          <CircleSlash className="h-3.5 w-3.5" aria-hidden="true" />
          No-show
        </button>
      </div>

      {mode === 'complete' && (
        <FormDialog
          title={`Complete meeting — ${meetingTitle}`}
          description={`${leadName} · ${leadCode}. The outcome is kept on the meeting and the timeline.`}
          pending={completePending}
          error={completeState.error}
          onClose={() => setMode(null)}
          size="lg"
        >
          <form action={completeAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={meetingId} />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="complete-outcome"
                className={labelClasses}
              >
                Outcome
              </label>
              <textarea
                id="complete-outcome"
                name="outcome"
                rows={3}
                maxLength={2000}
                required
                placeholder="Client requested a formal quotation."
                className={inputClasses}
              />
              <FieldError message={completeState.fieldErrors?.outcome} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="complete-notes"
                className={labelClasses}
              >
                Notes (optional)
              </label>
              <textarea
                id="complete-notes"
                name="notes"
                rows={2}
                maxLength={4000}
                placeholder="Private working notes."
                className={inputClasses}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="complete-status"
                className={labelClasses}
              >
                Update lead status (optional)
              </label>
              <select
                id="complete-status"
                name="status"
                defaultValue=""
                className={selectClasses}
              >
                <option value="">
                  Keep {LEAD_STATUS_LABELS[currentStatus]}
                </option>
                {Object.values(LEAD_STATUSES).map((value) => (
                  <option key={value} value={value}>
                    {LEAD_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
              <FieldError message={completeState.fieldErrors?.status} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="complete-next"
                className={labelClasses}
              >
                Next follow-up (optional)
              </label>
              <input
                id="complete-next"
                name="nextFollowUpAt"
                type="datetime-local"
                className={inputClasses}
              />
              <FieldError
                message={completeState.fieldErrors?.nextFollowUpAt}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setMode(null)}
                disabled={completePending}
                className={cancelClasses}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={completePending}
                className={submitClasses}
              >
                {completePending ? 'Saving…' : 'Mark completed'}
              </button>
            </div>
          </form>
        </FormDialog>
      )}

      {mode === 'cancel' && (
        <FormDialog
          title={`Cancel meeting — ${meetingTitle}`}
          description="The meeting stays in the history with its cancellation reason."
          pending={cancelPending}
          error={cancelState.error}
          onClose={() => setMode(null)}
        >
          <form action={cancelAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={meetingId} />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="cancel-reason"
                className={labelClasses}
              >
                Reason (optional)
              </label>
              <textarea
                id="cancel-reason"
                name="reason"
                rows={3}
                maxLength={500}
                placeholder="Client asked to move the meeting."
                className={inputClasses}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setMode(null)}
                disabled={cancelPending}
                className={cancelClasses}
              >
                Keep meeting
              </button>
              <button
                type="submit"
                disabled={cancelPending}
                className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
              >
                {cancelPending ? 'Cancelling…' : 'Cancel meeting'}
              </button>
            </div>
          </form>
        </FormDialog>
      )}

      {mode === 'noshow' && (
        <FormDialog
          title={`No-show — ${meetingTitle}`}
          description="Record that the client did not attend. The meeting stays in the history."
          pending={noShowPending}
          error={noShowState.error}
          onClose={() => setMode(null)}
        >
          <form action={noShowAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={meetingId} />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="noshow-notes"
                className={labelClasses}
              >
                Notes (optional)
              </label>
              <textarea
                id="noshow-notes"
                name="notes"
                rows={3}
                maxLength={1000}
                placeholder="Tried calling ahead; number unreachable."
                className={inputClasses}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setMode(null)}
                disabled={noShowPending}
                className={cancelClasses}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={noShowPending}
                className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
              >
                {noShowPending ? 'Saving…' : 'Mark as no-show'}
              </button>
            </div>
          </form>
        </FormDialog>
      )}
    </>
  );
}
