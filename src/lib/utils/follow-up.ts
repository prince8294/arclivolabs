/**
 * Follow-up date helpers for CRM leads.
 *
 * `Lead.nextFollowUpAt` is always a real `Date` (stored as UTC by
 * MongoDB). The *state* a lead is in — Overdue / Due today / Upcoming /
 * No follow-up — is always derived at read time from that date plus the
 * current clock; it is never persisted as a label or a timezone string.
 *
 * Day boundaries are computed in the server's local timezone so "today"
 * matches what staff see on screen. Because the underlying value is an
 * absolute instant, the stored data stays correct if the deployment
 * later serves multiple timezones.
 */

export const FOLLOW_UP_STATES = {
  OVERDUE: 'OVERDUE',
  DUE_TODAY: 'DUE_TODAY',
  UPCOMING: 'UPCOMING',
  NONE: 'NONE',
} as const;

export type FollowUpState =
  (typeof FOLLOW_UP_STATES)[keyof typeof FOLLOW_UP_STATES];

export const FOLLOW_UP_STATE_LABELS: Record<FollowUpState, string> = {
  [FOLLOW_UP_STATES.OVERDUE]: 'Overdue',
  [FOLLOW_UP_STATES.DUE_TODAY]: 'Due today',
  [FOLLOW_UP_STATES.UPCOMING]: 'Upcoming',
  [FOLLOW_UP_STATES.NONE]: 'No follow-up',
};

/** Local midnight at the start of the day containing `value`. */
export function startOfLocalDay(value: Date): Date {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Local midnight at the start of the next day after `value`. */
export function startOfNextLocalDay(value: Date): Date {
  const start = startOfLocalDay(value);
  start.setDate(start.getDate() + 1);
  return start;
}

/**
 * Classify a follow-up date. Day granularity: anything scheduled before
 * today is overdue, today stays actionable until midnight, and anything
 * from tomorrow onwards is upcoming.
 */
export function getFollowUpState(
  nextFollowUpAt?: Date | string | null,
  now: Date = new Date()
): FollowUpState {
  if (!nextFollowUpAt) {
    return FOLLOW_UP_STATES.NONE;
  }
  const date =
    nextFollowUpAt instanceof Date ? nextFollowUpAt : new Date(nextFollowUpAt);
  if (Number.isNaN(date.getTime())) {
    return FOLLOW_UP_STATES.NONE;
  }
  if (date.getTime() < startOfLocalDay(now).getTime()) {
    return FOLLOW_UP_STATES.OVERDUE;
  }
  if (date.getTime() < startOfNextLocalDay(now).getTime()) {
    return FOLLOW_UP_STATES.DUE_TODAY;
  }
  return FOLLOW_UP_STATES.UPCOMING;
}

/** True when the lead needs attention right now (overdue or due today). */
export function isFollowUpDue(
  nextFollowUpAt?: Date | string | null,
  now: Date = new Date()
): boolean {
  const state = getFollowUpState(nextFollowUpAt, now);
  return (
    state === FOLLOW_UP_STATES.OVERDUE || state === FOLLOW_UP_STATES.DUE_TODAY
  );
}

/**
 * Format a stored UTC instant back into the `datetime-local` value an
 * `<input type="datetime-local">` expects, in local time. Used to
 * pre-fill follow-up inputs on edit forms.
 */
export function toDateTimeLocalValue(value?: Date | string | null): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (part: number) => String(part).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}