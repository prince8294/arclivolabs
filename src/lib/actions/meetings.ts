'use server';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';
import type { ClientSession } from 'mongoose';

import {
  applyFollowUpChange,
  applyStatusChange,
  resolveLeadWriteContext,
  type LeadWriteContext,
} from '@/lib/activities/lead-updates';
import { requireAnyRole } from '@/lib/auth/authorization';
import {
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_TYPES,
  COMMUNICATION_VISIBILITIES,
  LEAD_ACTIVITY_EVENTS,
  MEETING_STATUSES,
  type LeadActivityEvent,
  type MeetingStatus,
} from '@/lib/constants/enums';
import { withOptionalTransaction } from '@/lib/db/transaction';
import { formatDateTime } from '@/lib/utils/format';
import {
  MEETING_FIELDS,
  meetingCancelSchema,
  meetingCompleteSchema,
  meetingNoShowSchema,
  meetingScheduleSchema,
  type MeetingActionState,
} from '@/lib/validations/meeting';
import { activityFieldErrors } from '@/lib/validations/communication';
import { Communication } from '@/models/Communication';
import { Meeting } from '@/models/Meeting';
import { USER_ROLES, type AuthUser } from '@/types/auth';
import { createNotification } from '@/lib/notifications/create';

/**
 * Meeting lifecycle: schedule, complete, cancel, no-show.
 *
 * A meeting is the one CRM flow that writes several documents at once (the
 * meeting, the lead status, the next follow-up and the timeline), so each
 * mutation runs inside a MongoDB transaction where one is available and
 * compensates manually where it is not. A partial success is never
 * reported as a success.
 *
 * Authorization mirrors every other Part 6 mutation: ADMIN sees every
 * lead, MARKETING only leads still assigned to them (re-checked in the
 * database on every call), EMPLOYEE and CLIENT never get here.
 *
 * Meetings are never deleted — cancellation and no-show are recorded, so
 * the meeting history stays intact.
 */

const GENERIC_ERROR = 'Unable to save this meeting. Please try again.';
const LEAD_NOT_FOUND = 'Lead not found.';
const MEETING_NOT_FOUND = 'Meeting not found.';

class MeetingActionError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'MeetingActionError';
    this.field = field;
  }
}

function toState(error: unknown): MeetingActionState {
  if (error instanceof MeetingActionError) {
    return error.field
      ? { fieldErrors: { [error.field]: error.message } }
      : { error: error.message };
  }
  console.error('meeting action failed', error);
  return { error: GENERIC_ERROR };
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

async function requireCrmActor(): Promise<AuthUser> {
  return requireAnyRole([USER_ROLES.ADMIN, USER_ROLES.MARKETING]);
}

function revalidateMeetingViews(
  leadId: string,
  touchesMarketing: boolean
): void {
  revalidatePath('/admin');
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/leads');
  revalidatePath(`/admin/crm/leads/${leadId}`);
  if (touchesMarketing) {
    revalidatePath('/marketing');
    revalidatePath('/marketing/leads');
    revalidatePath(`/marketing/leads/${leadId}`);
  }
}

function touchesMarketingViews(
  actor: AuthUser,
  context: { assignedToUserId: string | null }
): boolean {
  return (
    actor.role === USER_ROLES.MARKETING || context.assignedToUserId !== null
  );
}

/* ------------------------------------------------------------------ */
/* Timeline entries                                                   */
/* ------------------------------------------------------------------ */

/**
 * One timeline entry per meeting lifecycle change.
 *
 * The entry is typed MEETING (so the Meetings filter and the meeting cards
 * read the same story) and carries the `event` code, which keeps it
 * queryable without duplicating the sentence into a second SYSTEM entry.
 * `required` failures propagate so an enclosing transaction aborts rather
 * than committing a meeting change with no history.
 */
async function recordMeetingActivity(options: {
  context: LeadWriteContext;
  actorId: string;
  event: LeadActivityEvent;
  summary: string;
  meetingId: string;
  session?: ClientSession;
}): Promise<void> {
  const { context, actorId, event, summary, meetingId, session } = options;

  await Communication.create(
    [
      {
        leadId: context.leadObjectId,
        type: COMMUNICATION_TYPES.MEETING,
        direction: COMMUNICATION_DIRECTIONS.INTERNAL,
        subject: summary,
        createdBy: new Types.ObjectId(actorId),
        occurredAt: new Date(),
        visibility: COMMUNICATION_VISIBILITIES.INTERNAL,
        event,
        metadata: { meetingId },
      },
    ],
    session ? { session } : undefined
  ).catch((error) => {
    console.error('failed to record meeting activity', event, error);
    throw error;
  });
}

/* ------------------------------------------------------------------ */
/* Schedule                                                           */
/* ------------------------------------------------------------------ */

/**
 * Schedule a meeting and record it on the timeline.
 *
 * The lead status is only moved when the user explicitly ticks "update
 * lead status" — scheduling a meeting must never silently rewrite the
 * pipeline. The meeting's `assignedTo` defaults to the lead's current
 * assignee (or the scheduler), so whoever owns the lead is expected to run
 * it.
 */
export async function scheduleMeeting(
  _prev: MeetingActionState,
  formData: FormData
): Promise<MeetingActionState> {
  const actor = await requireCrmActor();

  const parsed = meetingScheduleSchema.safeParse({
    leadId: readString(formData, 'leadId'),
    title: readString(formData, 'title'),
    description: readString(formData, 'description'),
    scheduledAt: readString(formData, 'scheduledAt'),
    durationMinutes: readString(formData, 'durationMinutes'),
    type: readString(formData, 'type'),
    location: readString(formData, 'location'),
    meetingUrl: readString(formData, 'meetingUrl'),
    updateLeadStatus: readString(formData, 'updateLeadStatus'),
    status: readString(formData, 'status'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: activityFieldErrors(parsed.error, [
        'leadId',
        ...MEETING_FIELDS,
        'updateLeadStatus',
        'status',
      ]),
    };
  }

  const input = parsed.data;
  let createdMeetingId = '';
  let wroteInTransaction = false;

  try {
    const context = await resolveLeadWriteContext(input.leadId, actor);
    if (!context) {
      return { error: LEAD_NOT_FOUND };
    }

    await withOptionalTransaction(async (session) => {
      if (session) {
        wroteInTransaction = true;
      }

      const [created] = await Meeting.create(
        [
          {
            leadId: context.leadObjectId,
            title: input.title,
            description: input.description,
            scheduledAt: input.scheduledAt,
            durationMinutes: input.durationMinutes,
            type: input.type,
            location: input.location,
            meetingUrl: input.meetingUrl,
            status: MEETING_STATUSES.SCHEDULED,
            createdBy: new Types.ObjectId(actor.id),
            assignedTo: context.assignedToUserId
              ? new Types.ObjectId(context.assignedToUserId)
              : new Types.ObjectId(actor.id),
          },
        ],
        session ? { session } : undefined
      );

      createdMeetingId = created._id.toString();

      await recordMeetingActivity({
        context,
        actorId: actor.id,
        event: LEAD_ACTIVITY_EVENTS.MEETING_SCHEDULED,
        summary: `Meeting scheduled for ${formatDateTime(input.scheduledAt)}: ${input.title}.`,
        meetingId: createdMeetingId,
        session,
      });

      if (input.updateLeadStatus && input.status !== '') {
        const statusResult = await applyStatusChange(
          context,
          actor,
          input.status,
          null,
          null,
          { required: true, session }
        );
        if (!statusResult.ok) {
          throw new MeetingActionError(LEAD_NOT_FOUND);
        }
      }
    });

    if (!createdMeetingId) {
      throw new MeetingActionError(GENERIC_ERROR);
    }
    const meetingRecipient = context.assignedToUserId ?? actor.id; await createNotification({ recipientUserId: meetingRecipient, type: 'MEETING_SCHEDULED', title: 'Meeting scheduled', message: `${input.title} is scheduled for ${formatDateTime(input.scheduledAt)}.`, resourceType: 'Meeting', resourceId: createdMeetingId, resourceUrl: `/${actor.role === USER_ROLES.ADMIN ? 'admin' : 'marketing'}/leads/${context.leadId}`, idempotencyKey: `meeting-scheduled:${createdMeetingId}:${meetingRecipient}` });

    revalidateMeetingViews(
      context.leadId,
      touchesMarketingViews(actor, context)
    );

    return { ok: true, message: 'Meeting scheduled.' };
  } catch (error) {
    // Standalone MongoDB: undo the meeting when a later write failed, so no
    // half-finished meeting is left behind.
    if (createdMeetingId && !wroteInTransaction) {
      await Meeting.deleteOne({ _id: new Types.ObjectId(createdMeetingId) })
        .exec()
        .catch((cleanupError) =>
          console.error('failed to undo scheduled meeting', cleanupError)
        );
    }
    return toState(error);
  }
}

/* ------------------------------------------------------------------ */
/* Lifecycle transitions                                              */
/* ------------------------------------------------------------------ */

/** A meeting plus the lead context it may be changed from. */
interface ScopedMeeting {
  id: string;
  title: string;
  status: MeetingStatus;
  context: LeadWriteContext;
}

/**
 * Load a meeting together with its lead, but only when both are inside the
 * caller's scope. A meeting on somebody else's lead is reported exactly
 * like a missing one, so ownership is never disclosed.
 */
async function loadScopedMeeting(
  meetingId: string,
  actor: AuthUser
): Promise<ScopedMeeting | null> {
  if (!Types.ObjectId.isValid(meetingId)) {
    return null;
  }

  const meeting = await Meeting.findById(meetingId)
    .select('title status leadId')
    .lean()
    .exec();

  if (!meeting) {
    return null;
  }

  const context = await resolveLeadWriteContext(
    meeting.leadId.toString(),
    actor
  );
  if (!context) {
    return null;
  }

  return {
    id: meetingId,
    title: meeting.title,
    status: meeting.status,
    context,
  };
}

/**
 * Apply a lifecycle transition.
 *
 * The query requires the meeting to still be SCHEDULED, so a double
 * submission cannot overwrite a recorded outcome, and `matchedCount` is
 * checked before anything else is written.
 */
async function transitionMeeting(options: {
  meetingId: string;
  status: MeetingStatus;
  set: Record<string, unknown>;
  session?: ClientSession;
}): Promise<boolean> {
  const result = await Meeting.updateOne(
    {
      _id: new Types.ObjectId(options.meetingId),
      status: MEETING_STATUSES.SCHEDULED,
    },
    { $set: { status: options.status, ...options.set } },
    options.session ? { session: options.session } : undefined
  );

  return result.matchedCount > 0;
}

/**
 * Complete a meeting: outcome, optional notes, an optional pipeline status
 * and an optional next follow-up — all applied together.
 */
export async function completeMeeting(
  _prev: MeetingActionState,
  formData: FormData
): Promise<MeetingActionState> {
  const actor = await requireCrmActor();

  const parsed = meetingCompleteSchema.safeParse({
    id: readString(formData, 'id'),
    outcome: readString(formData, 'outcome'),
    notes: readString(formData, 'notes'),
    status: readString(formData, 'status'),
    lostReason: readString(formData, 'lostReason'),
    lostReasonNote: readString(formData, 'lostReasonNote'),
    nextFollowUpAt: readString(formData, 'nextFollowUpAt'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: activityFieldErrors(parsed.error, [
        'id',
        'outcome',
        'notes',
        'status',
        'lostReason',
        'lostReasonNote',
        'nextFollowUpAt',
      ]),
    };
  }

  const input = parsed.data;

  try {
    const meeting = await loadScopedMeeting(input.id, actor);
    if (!meeting) {
      return { error: MEETING_NOT_FOUND };
    }
    const { context } = meeting;

    await withOptionalTransaction(async (session) => {
      const moved = await transitionMeeting({
        meetingId: meeting.id,
        status: MEETING_STATUSES.COMPLETED,
        set: {
          outcome: input.outcome,
          notes: input.notes,
          completedAt: new Date(),
        },
        session,
      });
      if (!moved) {
        throw new MeetingActionError(MEETING_NOT_FOUND);
      }

      await recordMeetingActivity({
        context,
        actorId: actor.id,
        event: LEAD_ACTIVITY_EVENTS.MEETING_COMPLETED,
        summary: `Meeting completed: ${meeting.title}.`,
        meetingId: meeting.id,
        session,
      });

      if (input.status !== '') {
        const statusResult = await applyStatusChange(
          context,
          actor,
          input.status,
          input.lostReason,
          input.lostReasonNote,
          { required: true, session }
        );
        if (!statusResult.ok) {
          throw new MeetingActionError(LEAD_NOT_FOUND);
        }
      }

      if (input.nextFollowUpAt) {
        const followUp = await applyFollowUpChange(
          context,
          actor,
          input.nextFollowUpAt,
          { required: true, session }
        );
        if (!followUp.ok) {
          throw new MeetingActionError(LEAD_NOT_FOUND);
        }
      }
    });

    revalidateMeetingViews(
      context.leadId,
      touchesMarketingViews(actor, context)
    );

    return { ok: true, message: 'Meeting marked as completed.' };
  } catch (error) {
    return toState(error);
  }
}

/** Cancel a meeting, keeping the record and an optional reason. */
export async function cancelMeeting(
  _prev: MeetingActionState,
  formData: FormData
): Promise<MeetingActionState> {
  const actor = await requireCrmActor();

  const parsed = meetingCancelSchema.safeParse({
    id: readString(formData, 'id'),
    reason: readString(formData, 'reason'),
  });

  if (!parsed.success) {
    return { fieldErrors: activityFieldErrors(parsed.error, ['id', 'reason']) };
  }

  const { id, reason } = parsed.data;

  try {
    const meeting = await loadScopedMeeting(id, actor);
    if (!meeting) {
      return { error: MEETING_NOT_FOUND };
    }
    const { context } = meeting;

    await withOptionalTransaction(async (session) => {
      const moved = await transitionMeeting({
        meetingId: meeting.id,
        status: MEETING_STATUSES.CANCELLED,
        set: { cancelReason: reason, cancelledAt: new Date() },
        session,
      });
      if (!moved) {
        throw new MeetingActionError(MEETING_NOT_FOUND);
      }

      await recordMeetingActivity({
        context,
        actorId: actor.id,
        event: LEAD_ACTIVITY_EVENTS.MEETING_CANCELLED,
        summary: reason
          ? `Meeting cancelled: ${meeting.title}. Reason: ${reason}`
          : `Meeting cancelled: ${meeting.title}.`,
        meetingId: meeting.id,
        session,
      });
    });

    revalidateMeetingViews(
      context.leadId,
      touchesMarketingViews(actor, context)
    );

    return { ok: true, message: 'Meeting cancelled.' };
  } catch (error) {
    return toState(error);
  }
}

/** Record that the client did not attend. */
export async function markMeetingNoShow(
  _prev: MeetingActionState,
  formData: FormData
): Promise<MeetingActionState> {
  const actor = await requireCrmActor();

  const parsed = meetingNoShowSchema.safeParse({
    id: readString(formData, 'id'),
    notes: readString(formData, 'notes'),
  });

  if (!parsed.success) {
    return { fieldErrors: activityFieldErrors(parsed.error, ['id', 'notes']) };
  }

  const { id, notes } = parsed.data;

  try {
    const meeting = await loadScopedMeeting(id, actor);
    if (!meeting) {
      return { error: MEETING_NOT_FOUND };
    }
    const { context } = meeting;

    await withOptionalTransaction(async (session) => {
      const moved = await transitionMeeting({
        meetingId: meeting.id,
        status: MEETING_STATUSES.NO_SHOW,
        set: { notes },
        session,
      });
      if (!moved) {
        throw new MeetingActionError(MEETING_NOT_FOUND);
      }

      await recordMeetingActivity({
        context,
        actorId: actor.id,
        event: LEAD_ACTIVITY_EVENTS.MEETING_NO_SHOW,
        summary: `Meeting marked as no-show: ${meeting.title}.`,
        meetingId: meeting.id,
        session,
      });
    });

    revalidateMeetingViews(
      context.leadId,
      touchesMarketingViews(actor, context)
    );

    return { ok: true, message: 'Meeting marked as no-show.' };
  } catch (error) {
    return toState(error);
  }
}
