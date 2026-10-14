'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquarePlus } from 'lucide-react';

import FormDialog from '@/components/ui/form-dialog';
import { logCommunication } from '@/lib/actions/communications';
import {
  CALL_RESULTS,
  CALL_RESULT_LABELS,
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_DIRECTION_LABELS,
  COMMUNICATION_TYPE_DIRECTIONS,
  COMMUNICATION_TYPES,
  COMMUNICATION_TYPE_LABELS,
  LOGGABLE_COMMUNICATION_TYPES,
  type LoggableCommunicationType,
} from '@/lib/constants/enums';
import { toDateTimeLocalValue } from '@/lib/utils/follow-up';
import { INITIAL_ACTIVITY_STATE } from '@/lib/validations/communication';

export interface CommunicationDialogProps {
  leadId: string;
  leadCode: string;
  /** Lead name, shown in the dialog heading for context. */
  leadName: string;
  /** Pre-selected type when the dialog is opened from a type chip. */
  initialType?: LoggableCommunicationType;
  /** Current follow-up, pre-filled when rescheduling. */
  nextFollowUpAt?: Date | null;
}

const inputClasses =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const selectClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const labelClasses = 'text-sm font-medium text-foreground';

function fieldError(
  state: { fieldErrors?: Record<string, string> },
  field: string
): string | undefined {
  return state.fieldErrors?.[field];
}

/**
 * "Log Communication" dialog.
 *
 * One reusable form whose fields adapt to the selected type (spec: no
 * single form with every possible input):
 * - CALL      → direction, call result, summary, contact person, follow-up
 * - WHATSAPP  → direction, summary, contact person, follow-up
 * - EMAIL     → direction, subject, summary, follow-up
 * - NOTE      → notes only (always internal)
 *
 * Logging records the interaction — it never dials, sends or connects to
 * anything. The optional follow-up writes `Lead.nextFollowUpAt` in the
 * same operation.
 */
export default function CommunicationDialog({
  leadId,
  leadCode,
  leadName,
  initialType = COMMUNICATION_TYPES.CALL,
  nextFollowUpAt = null,
}: CommunicationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<LoggableCommunicationType>(initialType);
  const [state, action, pending] = useActionState(
    logCommunication,
    INITIAL_ACTIVITY_STATE
  );

  const [acknowledged, setAcknowledged] = useState<typeof state | null>(null);
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

  const directions = COMMUNICATION_TYPE_DIRECTIONS[type];
  const isNote = type === COMMUNICATION_TYPES.INTERNAL_NOTE;
  const isCall = type === COMMUNICATION_TYPES.CALL;
  const isEmail = type === COMMUNICATION_TYPES.EMAIL;
  const supportsDirection = directions.length > 0;
  const defaultDirection = isNote
    ? COMMUNICATION_DIRECTIONS.INTERNAL
    : directions[0];

  function showDialog() {
    setType(initialType);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={showDialog}
        className="inline-flex h-9 items-center gap-x-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        Log Communication
      </button>

      {open && (
        <FormDialog
          title={`Log communication — ${leadName}`}
          description={`Recorded on ${leadCode}. This only stores the interaction; nothing is sent or dialled.`}
          pending={pending}
          error={state.error}
          onClose={() => setOpen(false)}
          size="lg"
        >
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="leadId" value={leadId} />

            <fieldset className="flex flex-col gap-2">
              <legend className={labelClasses}>Communication type</legend>
              <div className="flex flex-wrap gap-2">
                {LOGGABLE_COMMUNICATION_TYPES.map((value) => (
                  <label
                    key={value}
                    className={`inline-flex cursor-pointer items-center gap-x-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                      type === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={value}
                      checked={type === value}
                      onChange={() => setType(value)}
                      className="h-4 w-4"
                    />
                    {COMMUNICATION_TYPE_LABELS[value]}
                  </label>
                ))}
              </div>
              {fieldError(state, 'type') && (
                <p role="alert" className="text-xs text-destructive">
                  {fieldError(state, 'type')}
                </p>
              )}
            </fieldset>

            {supportsDirection && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`direction-${leadId}`} className={labelClasses}>
                  Direction
                </label>
                <select
                  id={`direction-${leadId}`}
                  name="direction"
                  defaultValue={defaultDirection}
                  className={selectClasses}
                >
                  {directions.map((value) => (
                    <option key={value} value={value}>
                      {COMMUNICATION_DIRECTION_LABELS[value]}
                    </option>
                  ))}
                </select>
                {fieldError(state, 'direction') && (
                  <p role="alert" className="text-xs text-destructive">
                    {fieldError(state, 'direction')}
                  </p>
                )}
              </div>
            )}

            {isCall && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`callResult-${leadId}`} className={labelClasses}>
                  Call result
                </label>
                <select
                  id={`callResult-${leadId}`}
                  name="callResult"
                  defaultValue={CALL_RESULTS.CONNECTED}
                  className={selectClasses}
                >
                  {Object.values(CALL_RESULTS).map((value) => (
                    <option key={value} value={value}>
                      {CALL_RESULT_LABELS[value]}
                    </option>
                  ))}
                </select>
                {fieldError(state, 'callResult') && (
                  <p role="alert" className="text-xs text-destructive">
                    {fieldError(state, 'callResult')}
                  </p>
                )}
              </div>
            )}

            {isEmail && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`subject-${leadId}`} className={labelClasses}>
                  Subject
                </label>
                <input
                  id={`subject-${leadId}`}
                  name="subject"
                  type="text"
                  maxLength={200}
                  placeholder="Proposal for restaurant website"
                  className={inputClasses}
                />
                {fieldError(state, 'subject') && (
                  <p role="alert" className="text-xs text-destructive">
                    {fieldError(state, 'subject')}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`occurredAt-${leadId}`}
                className={labelClasses}
              >
                Date &amp; time
              </label>
              <input
                id={`occurredAt-${leadId}`}
                name="occurredAt"
                type="datetime-local"
                className={inputClasses}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to record &ldquo;now&rdquo;. Past interactions
                can be back-dated.
              </p>
              {fieldError(state, 'occurredAt') && (
                <p role="alert" className="text-xs text-destructive">
                  {fieldError(state, 'occurredAt')}
                </p>
              )}
            </div>

            {!isNote && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`summary-${leadId}`} className={labelClasses}>
                  Summary
                </label>
                <textarea
                  id={`summary-${leadId}`}
                  name="summary"
                  rows={2}
                  maxLength={1000}
                  placeholder="What was discussed and what the lead wants next."
                  className={inputClasses}
                />
                {fieldError(state, 'summary') && (
                  <p role="alert" className="text-xs text-destructive">
                    {fieldError(state, 'summary')}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`notes-${leadId}`} className={labelClasses}>
                {isNote ? 'Note' : 'Notes (optional)'}
              </label>
              <textarea
                id={`notes-${leadId}`}
                name="notes"
                rows={3}
                maxLength={4000}
                placeholder={
                  isNote
                    ? 'Internal context — never shown to the client.'
                    : 'Anything worth remembering for the next conversation.'
                }
                className={inputClasses}
              />
              {fieldError(state, 'notes') && (
                <p role="alert" className="text-xs text-destructive">
                  {fieldError(state, 'notes')}
                </p>
              )}
            </div>

            {!isNote && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`contactPerson-${leadId}`}
                  className={labelClasses}
                >
                  Contact person (optional)
                </label>
                <input
                  id={`contactPerson-${leadId}`}
                  name="contactPerson"
                  type="text"
                  maxLength={100}
                  placeholder="Owner, Front desk, …"
                  className={inputClasses}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`nextFollowUpAt-${leadId}`}
                className={labelClasses}
              >
                Schedule follow-up (optional)
              </label>
              <input
                id={`nextFollowUpAt-${leadId}`}
                name="nextFollowUpAt"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(nextFollowUpAt)}
                className={inputClasses}
              />
              <p className="text-xs text-muted-foreground">
                Updates the lead&rsquo;s next follow-up and adds a timeline
                entry.
              </p>
              {fieldError(state, 'nextFollowUpAt') && (
                <p role="alert" className="text-xs text-destructive">
                  {fieldError(state, 'nextFollowUpAt')}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
              >
                {pending && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {pending ? 'Saving…' : 'Log communication'}
              </button>
            </div>
          </form>
        </FormDialog>
      )}
    </>
  );
}
