import { z } from 'zod';

import {
  LEAD_STATUSES,
  MEETING_DURATION_OPTIONS,
  MEETING_STATUSES,
  MEETING_TYPES,
} from '@/lib/constants/enums';
import { enumField, isUrl } from './common';
import type { ActivityActionState } from './communication';

/**
 * Validation schemas for CRM meetings.
 *
 * A meeting is scheduled ahead of time (unlike a logged call), carries its
 * own lifecycle, and may be finished with an outcome plus an optional lead
 * status change and next follow-up. All of that is validated here so the
 * server action never has to guess what a form meant.
 *
 * `status` transitions themselves are checked in the action (a completed
 * meeting cannot be cancelled), not here — the form only ever submits the
 * target status it wants.
 */

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const objectIdField = (message: string) =>
  z.string().trim().refine((value) => OBJECT_ID_PATTERN.test(value), { message });

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === '' ? null : value));

/** Meetings may be scheduled up to a year ahead, never in the past. */
const MAX_SCHEDULE_YEARS = 1;
const PAST_GRACE_MS = 60 * 1000;

const scheduledAtSchema = z
  .string()
  .trim()
  .refine((value) => DATETIME_LOCAL_PATTERN.test(value), {
    message: 'Choose a meeting date and time.',
  })
  .transform((value) => new Date(value))
  .refine((value) => !Number.isNaN(value.getTime()), {
    message: 'Choose a meeting date and time.',
  })
  .refine((value) => value.getTime() >= Date.now() - PAST_GRACE_MS, {
    message: 'Choose a meeting time in the future.',
  })
  .refine(
    (value) => value.getFullYear() <= new Date().getFullYear() + MAX_SCHEDULE_YEARS,
    { message: 'Choose a meeting time in the future.' }
  );

export const MEETING_FIELDS = [
  'title',
  'description',
  'scheduledAt',
  'durationMinutes',
  'type',
  'location',
  'meetingUrl',
] as const;

/**
 * Schedule a meeting. Video meetings need a link and in-person meetings
 * need a location; a phone call needs neither. `updateLeadStatus` is an
 * explicit opt-in so scheduling never silently moves the pipeline — the
 * user is asked instead.
 */
export const meetingScheduleSchema = z
  .object({
    leadId: objectIdField('Invalid lead reference.'),
    title: z
      .string()
      .trim()
      .min(3, 'Enter a meeting title.')
      .max(150, 'Title is limited to 150 characters.'),
    description: optionalText(
      2000,
      'Description is limited to 2000 characters.'
    ),
    scheduledAt: scheduledAtSchema,
    durationMinutes: z
      .string()
      .trim()
      .transform((value) => Number(value))
      .refine(
        (value) =>
          (MEETING_DURATION_OPTIONS as readonly number[]).includes(value),
        { message: 'Select a valid duration.' }
      ),
    type: enumField(MEETING_TYPES, 'Select a meeting type.'),
    location: optionalText(
      200,
      'Location is limited to 200 characters.'
    ),
    meetingUrl: z
      .string()
      .trim()
      .max(500, 'Meeting link is limited to 500 characters.')
      .refine((value) => value === '' || isUrl(value), {
        message: 'Enter a valid meeting link, for example https://meet.example.com/abc.',
      })
      .transform((value) => (value === '' ? null : value)),
    updateLeadStatus: z
      .string()
      .trim()
      .transform((value) => value === 'yes'),
    status: enumField(LEAD_STATUSES, 'Select a valid lead status.').or(
      z.literal('')
    ),
  })
  .superRefine((data, ctx) => {
    if (data.type === MEETING_TYPES.VIDEO && !data.meetingUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['meetingUrl'],
        message: 'Add the meeting link for a video meeting.',
      });
    }
    if (data.updateLeadStatus && !data.status) {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Select the status to move this lead to.',
      });
    }
  });

export type MeetingScheduleInput = z.infer<typeof meetingScheduleSchema>;

/** Complete a meeting: outcome, optional notes, status and follow-up. */
export const meetingCompleteSchema = z.object({
  id: objectIdField('Invalid meeting reference.'),
  outcome: z
    .string()
    .trim()
    .min(3, 'Describe the outcome of the meeting.')
    .max(2000, 'Outcome is limited to 2000 characters.'),
  notes: optionalText(4000, 'Notes are limited to 4000 characters.'),
  status: enumField(LEAD_STATUSES, 'Select a valid lead status.').or(
    z.literal('')
  ),
  lostReason: z.string().trim(),
  lostReasonNote: optionalText(
    500,
    'Reason detail is limited to 500 characters.'
  ),
  nextFollowUpAt: z
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
      (value) => value === null || value.getTime() >= Date.now() - PAST_GRACE_MS,
      { message: 'Choose a follow-up time in the future.' }
    ),
});

export type MeetingCompleteInput = z.infer<typeof meetingCompleteSchema>;

/** Cancel a meeting — the reason is kept on the record and the timeline. */
export const meetingCancelSchema = z.object({
  id: objectIdField('Invalid meeting reference.'),
  reason: optionalText(500, 'Reason is limited to 500 characters.'),
});

export type MeetingCancelInput = z.infer<typeof meetingCancelSchema>;

/** The client did not attend. */
export const meetingNoShowSchema = z.object({
  id: objectIdField('Invalid meeting reference.'),
  notes: optionalText(1000, 'Notes are limited to 1000 characters.'),
});

export type MeetingNoShowInput = z.infer<typeof meetingNoShowSchema>;

/**
 * The statuses a form may request. Kept as an explicit allow-list so a
 * hand-crafted request cannot move a meeting to an arbitrary state.
 */
export const MEETING_TRANSITIONS = {
  [MEETING_STATUSES.COMPLETED]: MEETING_STATUSES.COMPLETED,
  [MEETING_STATUSES.CANCELLED]: MEETING_STATUSES.CANCELLED,
  [MEETING_STATUSES.NO_SHOW]: MEETING_STATUSES.NO_SHOW,
} as const;

export type MeetingActionState = ActivityActionState;
