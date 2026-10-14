'use server';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

import { describeFollowUpCompleted } from '@/lib/activities/lead-activity';
import {
  applyFollowUpChange,
  applyStatusChange,
  resolveLeadWriteContext,
} from '@/lib/activities/lead-updates';
import { requireAnyRole } from '@/lib/auth/authorization';
import {
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_TYPES,
  COMMUNICATION_VISIBILITIES,
} from '@/lib/constants/enums';
import { withOptionalTransaction } from '@/lib/db/transaction';
import {
  activityFieldErrors,
  communicationCreateSchema,
  followUpCompleteSchema,
  followUpScheduleSchema,
  COMMUNICATION_FIELDS,
  type ActivityActionState,
} from '@/lib/validations/communication';
import { Communication } from '@/models/Communication';
import { USER_ROLES, type AuthUser } from '@/types/auth';

/**
 * Manual CRM activity: communication logs and follow-up actions.
 *
 * Security model (repeated per action, because the client is never
 * trusted):
 *   1. Resolve the current user from the session AND re-read the User
 *      document, so a suspended marketing user is rejected immediately.
 *   2. Require ADMIN or MARKETING — EMPLOYEE and CLIENT are redirected to
 *      their own dashboard before anything is read.
 *   3. Re-read the lead inside the caller's scope: admin sees every lead,
 *      marketing only leads still assigned to them. A lead that has been
 *      reassigned answers "Lead not found." and nothing is written.
 *   4. Re-validate the raw FormData with zod.
 *   5. Perform the write, together with the timeline entry it implies.
 *
 * Logging a call / WhatsApp message / email writes a record only: nothing
 * is dialled, sent or connected to any external service.
 *
 * There is deliberately no delete and no edit action — business
 * communication history is immutable in this phase.
 */

const GENERIC_ERROR = 'Unable to save this activity. Please try again.';
const LEAD_NOT_FOUND = 'Lead not found.';

class ActivityActionError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ActivityActionError';
    this.field = field;
  }
}

function toState(error: unknown): ActivityActionState {
  if (error instanceof ActivityActionError) {
    return error.field
      ? { fieldErrors: { [error.field]: error.message } }
      : { error: error.message };
  }
  console.error('communication action failed', error);
  return { error: GENERIC_ERROR };
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

async function requireCrmActor(): Promise<AuthUser> {
  return requireAnyRole([USER_ROLES.ADMIN, USER_ROLES.MARKETING]);
}

/**
 * Refresh every surface whose content changes when a lead gains activity:
 * the CRM overview, both dashboards, the lead lists (own counts) and the
 * lead detail page with its tabs.
 */
function revalidateActivityViews(
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

/** A lead that belongs to a marketing user also affects their dashboard. */
function touchesMarketingViews(
  actor: AuthUser,
  context: { assignedToUserId: string | null }
): boolean {
  return actor.role === USER_ROLES.MARKETING || context.assignedToUserId !== null;
}

/* ------------------------------------------------------------------ */
/* Log a call / WhatsApp message / email / internal note              */
/* ------------------------------------------------------------------ */

/**
 * Create one manual timeline entry, optionally scheduling the lead's next
 * follow-up in the same operation.
 *
 * The optional follow-up is part of the same write: where transactions are
 * supported the entry and `Lead.nextFollowUpAt` commit together, so a
 * communication can never be logged without the follow-up that was ticked
 * next to it. On a standalone MongoDB the entry is written first and is
 * removed again if the lead write then fails, so the history never
 * contradicts the lead.
 */
export async function logCommunication(
  _prev: ActivityActionState,
  formData: FormData
): Promise<ActivityActionState> {
  const actor = await requireCrmActor();

  const parsed = communicationCreateSchema.safeParse({
    leadId: readString(formData, 'leadId'),
    type: readString(formData, 'type'),
    direction: readString(formData, 'direction'),
    subject: readString(formData, 'subject'),
    summary: readString(formData, 'summary'),
    notes: readString(formData, 'notes'),
    callResult: readString(formData, 'callResult'),
    occurredAt: readString(formData, 'occurredAt'),
    nextFollowUpAt: readString(formData, 'nextFollowUpAt'),
    contactPerson: readString(formData, 'contactPerson'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: activityFieldErrors(parsed.error, [
        'leadId',
        ...COMMUNICATION_FIELDS,
      ]),
    };
  }

  const input = parsed.data;
  let createdEntryId = '';
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

      const [created] = await Communication.create(
        [
          {
            leadId: context.leadObjectId,
            type: input.type,
            // Internal notes are always INTERNAL; every other direction was
            // already checked against COMMUNICATION_TYPE_DIRECTIONS.
            direction:
              input.type === COMMUNICATION_TYPES.INTERNAL_NOTE
                ? COMMUNICATION_DIRECTIONS.INTERNAL
                : input.direction,
            subject: input.subject,
            summary: input.summary,
            notes: input.notes,
            callResult: input.callResult === '' ? null : input.callResult,
            contactPerson: input.contactPerson,
            // The acting user — never a value from the request body.
            createdBy: new Types.ObjectId(actor.id),
            occurredAt: input.occurredAt,
            nextFollowUpAt: input.nextFollowUpAt,
            visibility: COMMUNICATION_VISIBILITIES.INTERNAL,
          },
        ],
        session ? { session } : undefined
      );

      createdEntryId = created._id.toString();

      if (input.nextFollowUpAt) {
        const followUp = await applyFollowUpChange(
          context,
          actor,
          input.nextFollowUpAt,
          { required: true, session }
        );
        if (!followUp.ok) {
          throw new ActivityActionError(LEAD_NOT_FOUND);
        }
      }
    });

    revalidateActivityViews(
      context.leadId,
      touchesMarketingViews(actor, context)
    );

    return {
      ok: true,
      message: input.nextFollowUpAt
        ? 'Communication logged and follow-up scheduled.'
        : 'Communication logged.',
    };
  } catch (error) {
    // Without a transaction the lead write is not atomic with the entry:
    // undo the entry so the timeline stays consistent with the lead.
    if (createdEntryId && !wroteInTransaction) {
      await Communication.deleteOne({ _id: new Types.ObjectId(createdEntryId) })
        .exec()
        .catch((cleanupError) =>
          console.error('failed to undo communication entry', cleanupError)
        );
    }
    return toState(error);
  }
}

/* ------------------------------------------------------------------ */
/* Follow-up                                                          */
/* ------------------------------------------------------------------ */

/**
 * Schedule or reschedule `Lead.nextFollowUpAt`.
 *
 * The timeline entry explains the change ("Follow-up rescheduled from 07
 * Oct to 10 Oct."), so the whole follow-up history stays recoverable from
 * the timeline without a second collection. The optional note is stored as
 * an internal note beside it.
 */
export async function scheduleFollowUp(
  _prev: ActivityActionState,
  formData: FormData
): Promise<ActivityActionState> {
  const actor = await requireCrmActor();

  const parsed = followUpScheduleSchema.safeParse({
    id: readString(formData, 'id'),
    nextFollowUpAt: readString(formData, 'nextFollowUpAt'),
    note: readString(formData, 'note'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: activityFieldErrors(parsed.error, [
        'id',
        'nextFollowUpAt',
        'note',
      ]),
    };
  }

  const { id, nextFollowUpAt, note } = parsed.data;

  try {
    const context = await resolveLeadWriteContext(id, actor);
    if (!context) {
      return { error: LEAD_NOT_FOUND };
    }

    const result = await applyFollowUpChange(context, actor, nextFollowUpAt, {
      required: true,
    });
    if (!result.ok) {
      return { error: LEAD_NOT_FOUND };
    }

    if (note) {
      await Communication.create({
        leadId: context.leadObjectId,
        type: COMMUNICATION_TYPES.INTERNAL_NOTE,
        direction: COMMUNICATION_DIRECTIONS.INTERNAL,
        summary: note,
        createdBy: new Types.ObjectId(actor.id),
        occurredAt: new Date(),
        visibility: COMMUNICATION_VISIBILITIES.INTERNAL,
      });
    }

    revalidateActivityViews(
      context.leadId,
      touchesMarketingViews(actor, context)
    );

    return {
      ok: true,
      message: result.previous
        ? 'Follow-up rescheduled.'
        : 'Follow-up scheduled.',
    };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Complete the outstanding follow-up.
 *
 * Writes a FOLLOW_UP entry with the outcome, optionally moves the pipeline
 * status, and either schedules the next follow-up or clears
 * `Lead.nextFollowUpAt`. A new follow-up is never forced: leaving the
 * field empty simply closes the loop.
 */
export async function completeFollowUp(
  _prev: ActivityActionState,
  formData: FormData
): Promise<ActivityActionState> {
  const actor = await requireCrmActor();

  const parsed = followUpCompleteSchema.safeParse({
    id: readString(formData, 'id'),
    outcome: readString(formData, 'outcome'),
    nextFollowUpAt: readString(formData, 'nextFollowUpAt'),
    status: readString(formData, 'status'),
    lostReason: readString(formData, 'lostReason'),
    lostReasonNote: readString(formData, 'lostReasonNote'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: activityFieldErrors(parsed.error, [
        'id',
        'outcome',
        'nextFollowUpAt',
        'status',
        'lostReason',
        'lostReasonNote',
      ]),
    };
  }

  const { id, outcome, nextFollowUpAt, status, lostReason, lostReasonNote } =
    parsed.data;

  try {
    const context = await resolveLeadWriteContext(id, actor);
    if (!context) {
      return { error: LEAD_NOT_FOUND };
    }

    await withOptionalTransaction(async (session) => {
      const [entry] = await Communication.create(
        [
          {
            leadId: context.leadObjectId,
            type: COMMUNICATION_TYPES.FOLLOW_UP,
            direction: COMMUNICATION_DIRECTIONS.INTERNAL,
            summary: describeFollowUpCompleted(outcome).summary,
            createdBy: new Types.ObjectId(actor.id),
            occurredAt: new Date(),
            nextFollowUpAt,
            visibility: COMMUNICATION_VISIBILITIES.INTERNAL,
          },
        ],
        session ? { session } : undefined
      );
      if (!entry) {
        throw new ActivityActionError(GENERIC_ERROR);
      }

      if (status !== '') {
        const statusResult = await applyStatusChange(
          context,
          actor,
          status,
          lostReason,
          lostReasonNote,
          { required: true, session }
        );
        if (!statusResult.ok) {
          throw new ActivityActionError(LEAD_NOT_FOUND);
        }
      }

      const followUp = await applyFollowUpChange(
        context,
        actor,
        nextFollowUpAt,
        { required: true, session }
      );
      if (!followUp.ok) {
        throw new ActivityActionError(LEAD_NOT_FOUND);
      }
    });

    revalidateActivityViews(
      context.leadId,
      touchesMarketingViews(actor, context)
    );

    return { ok: true, message: 'Follow-up completed.' };
  } catch (error) {
    return toState(error);
  }
}
