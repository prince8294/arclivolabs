import { z } from 'zod';

import {
  CALL_RESULTS,
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_TYPES,
  COMMUNICATION_TYPE_DIRECTIONS,
  LEAD_STATUSES,
  LOGGABLE_COMMUNICATION_TYPES,
  type CallResult,
  type CommunicationDirection,
  type LoggableCommunicationType,
} from '@/lib/constants/enums';
import { enumField, zodFieldErrors } from './common';

/**
 * Validation schemas for CRM communication / activity entries.
 *
 * Forms always submit strings, so the transforms below normalize them
 * into the exact shapes the Communication model expects. Nothing here
 * trusts the browser: the type, direction, lead reference, dates and
 * follow-up window are all re-checked on the server before any write.
 *
 * `createdBy` is intentionally absent from every schema — the acting user
 * is resolved from the session, never from the request.
 */

/** A `datetime-local` value (`YYYY-MM-DDTHH:mm`, parsed as local time). */
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * Manual logs describe something that already happened, so a timestamp
 * more than a few minutes in the future is rejected. Meetings (which are
 * scheduled ahead of time) use their own schema.
 */
export const FUTURE_LOG_GRACE_MS = 5 * 60 * 1000;

/** A completed follow-up may not be re-planned more than two years out. */
const MAX_FOLLOW_UP_YEARS = 2;

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const objectIdField = (message: string) =>
  z.string().trim().refine((value) => OBJECT_ID_PATTERN.test(value), { message });

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === '' ? null : value));

const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, message);

/**
 * `occurredAt`: an empty field means "now" (the common case), otherwise an
 * exact local `datetime-local` value. Dates before 2000 or more than a few
 * minutes ahead are typos, not history.
 */
const occurredAtSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || DATETIME_LOCAL_PATTERN.test(value),
    { message: 'Enter a valid date and time.' }
  )
  .transform((value) => (value === '' ? new Date() : new Date(value)))
  .refine((value) => !Number.isNaN(value.getTime()), {
    message: 'Enter a valid date and time.',
  })
  .refine((value) => value.getFullYear() >= 2000, {
    message: 'Enter a valid date and time.',
  })
  .refine((value) => value.getTime() <= Date.now() + FUTURE_LOG_GRACE_MS, {
    message: 'Date and time cannot be in the future.',
  });

/**
 * `nextFollowUpAt`: '' clears the follow-up, anything else must be a real
 * instant that is still ahead of "now" (a follow-up is a promise about
 * the future, and the Lead field is what drives the dashboard).
 */
const nextFollowUpSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || DATETIME_LOCAL_PATTERN.test(value),
    { message: 'Enter a valid follow-up date and time.' }
  )
  .transform((value) => (value === '' ? null : new Date(value)))
  .refine(
    (value) => value === null || !Number.isNaN(value.getTime()),
    { message: 'Enter a valid follow-up date and time.' }
  )
  .refine(
    (value) => value === null || value.getTime() >= Date.now() - 60 * 1000,
    { message: 'Choose a follow-up time in the future.' }
  )
  .refine(
    (value) =>
      value === null ||
      value.getFullYear() <= new Date().getFullYear() + MAX_FOLLOW_UP_YEARS,
    { message: 'Choose a follow-up time in the future.' }
  );

const directionSchema = enumField(
  COMMUNICATION_DIRECTIONS,
  'Select a direction.'
);

const callResultSchema = enumField(CALL_RESULTS, 'Select a call result.').or(
  z.literal('')
);

/* ------------------------------------------------------------------ */
/* Manual communication log                                            */
/* ------------------------------------------------------------------ */

export const COMMUNICATION_FIELDS = [
  'type',
  'direction',
  'subject',
  'summary',
  'notes',
  'callResult',
  'occurredAt',
  'nextFollowUpAt',
  'contactPerson',
] as const;

/**
 * Log a call / WhatsApp message / email / internal note.
 *
 * Per-type rules are enforced here so a malformed entry can never reach
 * MongoDB:
 * - the type must be one a human may log (SYSTEM, MEETING and FOLLOW_UP
 *   are server-generated and cannot be forged through the form);
 * - the direction must be one that makes sense for that type;
 * - CALL always carries a call result, EMAIL always carries a subject;
 * - something must actually have been written (summary or notes).
 */
export const communicationCreateSchema = z
  .object({
    leadId: objectIdField('Invalid lead reference.'),
    type: enumField(
      LOGGABLE_COMMUNICATION_TYPES,
      'Select a communication type.'
    ),
    direction: directionSchema,
    subject: optionalText(200, 'Subject is limited to 200 characters.'),
    summary: optionalText(1000, 'Summary is limited to 1000 characters.'),
    notes: optionalText(4000, 'Notes are limited to 4000 characters.'),
    callResult: callResultSchema,
    occurredAt: occurredAtSchema,
    nextFollowUpAt: nextFollowUpSchema,
    contactPerson: optionalText(
      100,
      'Contact person is limited to 100 characters.'
    ),
  })
  .superRefine((data, ctx) => {
    const allowed = COMMUNICATION_TYPE_DIRECTIONS[data.type];

    if (!allowed.includes(data.direction)) {
      ctx.addIssue({
        code: 'custom',
        path: ['direction'],
        message: `Select a valid direction for ${data.type.toLowerCase().replace('_', ' ')}.`,
      });
    }

    if (data.type === COMMUNICATION_TYPES.CALL && data.callResult === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['callResult'],
        message: 'Select the call result.',
      });
    }

    if (data.type === COMMUNICATION_TYPES.EMAIL && !data.subject) {
      ctx.addIssue({
        code: 'custom',
        path: ['subject'],
        message: 'Enter the email subject.',
      });
    }

    if (!data.summary && !data.notes) {
      ctx.addIssue({
        code: 'custom',
        path: ['summary'],
        message: 'Add a short summary or detailed notes.',
      });
    }
  });

export type CommunicationCreateInput = z.infer<typeof communicationCreateSchema>;

/* ------------------------------------------------------------------ */
/* Follow-up actions                                                   */
/* ------------------------------------------------------------------ */

/** Schedule or reschedule `Lead.nextFollowUpAt`. */
export const followUpScheduleSchema = z.object({
  id: objectIdField('Invalid lead reference.'),
  nextFollowUpAt: z
    .string()
    .trim()
    .refine((value) => DATETIME_LOCAL_PATTERN.test(value), {
      message: 'Choose a follow-up date and time.',
    })
    .transform((value) => new Date(value))
    .refine((value) => !Number.isNaN(value.getTime()), {
      message: 'Choose a follow-up date and time.',
    })
    .refine((value) => value.getTime() >= Date.now() - 60 * 1000, {
      message: 'Choose a follow-up time in the future.',
    })
    .refine(
      (value) =>
        value.getFullYear() <= new Date().getFullYear() + MAX_FOLLOW_UP_YEARS,
      { message: 'Choose a follow-up time in the future.' }
    ),
  note: optionalText(500, 'Note is limited to 500 characters.'),
});

export type FollowUpScheduleInput = z.infer<typeof followUpScheduleSchema>;

/**
 * Complete the outstanding follow-up. A new follow-up is optional — when
 * it is left empty `Lead.nextFollowUpAt` is cleared instead. Changing the
 * pipeline status is optional and validated against the same enum the
 * lead form uses.
 */
export const followUpCompleteSchema = z.object({
  id: objectIdField('Invalid lead reference.'),
  outcome: requiredText(1000, 'Describe the outcome of this follow-up.'),
  nextFollowUpAt: nextFollowUpSchema,
  status: enumField(LEAD_STATUSES, 'Select a valid lead status.').or(
    z.literal('')
  ),
  lostReason: z.string().trim(),
  lostReasonNote: optionalText(
    500,
    'Reason detail is limited to 500 characters.'
  ),
});

export type FollowUpCompleteInput = z.infer<typeof followUpCompleteSchema>;

/* ------------------------------------------------------------------ */
/* Action state                                                       */
/* ------------------------------------------------------------------ */

/**
 * Shared result shape for every CRM activity mutation (communication
 * log, follow-up, meeting). `ok` lets the client close its dialog and
 * refresh; `error` is always a safe, human message.
 */
export interface ActivityActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export const INITIAL_ACTIVITY_STATE: ActivityActionState = {};

export function activityFieldErrors(
  error: z.ZodError,
  fields: readonly string[]
): Record<string, string> {
  return zodFieldErrors(error, fields);
}

export type {
  CallResult,
  CommunicationDirection,
  LoggableCommunicationType,
};
