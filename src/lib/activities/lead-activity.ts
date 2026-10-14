import 'server-only';

import type { ClientSession } from 'mongoose';
import { Types } from 'mongoose';

import {
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_TYPES,
  COMMUNICATION_VISIBILITIES,
  LEAD_ACTIVITY_EVENTS,
  type LeadActivityEvent,
} from '@/lib/constants/enums';
import { formatDateTime } from '@/lib/utils/format';
import { Communication, type CommunicationMetadata } from '@/models/Communication';

/**
 * Single place where automatic lead activity is written to the timeline.
 *
 * Every entry is a `SYSTEM` communication whose `event` holds a stable
 * code and whose `summary` is a short human sentence composed here. No
 * caller hand-writes timeline text, so the wording stays consistent
 * ("Lead reassigned from Rahul Sharma to Aman Kumar.") and the timeline
 * can be filtered by event code later.
 *
 * Activity is written with the lead reference it belongs to; the caller is
 * responsible for authorizing the business operation first.
 */

export interface LeadSystemActivityInput {
  leadId: Types.ObjectId | string;
  /** Acting user id. Stamped as `createdBy` on the timeline entry. */
  actorId: Types.ObjectId | string;
  event: LeadActivityEvent;
  /** Human sentence stored on the entry. */
  summary: string;
  metadata?: CommunicationMetadata;
  /**
   * When the event happened. Defaults to now; pass the original instant
   * when back-dating (e.g. a follow-up completed late).
   */
  occurredAt?: Date;
  /**
   * When true the write is essential to the operation: a failure is
   * rethrown so an enclosing transaction aborts instead of committing a
   * business change without its timeline entry. Standalone calls leave
   * this off and only log.
   */
  required?: boolean;
  /** Join an enclosing transaction. */
  session?: ClientSession;
}

/**
 * Write one automatic timeline entry.
 *
 * Never throws by default: an activity log is an audit trail, and a
 * failure to append it must not roll back a business operation that
 * already succeeded. The failure is logged server-side instead. Operations
 * where the entry is essential — completing a meeting — pass
 * `required: true` and run inside a transaction, so their writes fail
 * together.
 */
export async function createLeadSystemActivity({
  leadId,
  actorId,
  event,
  summary,
  metadata,
  occurredAt,
  required = false,
  session,
}: LeadSystemActivityInput): Promise<void> {
  try {
    await Communication.create(
      [
        {
          leadId:
            leadId instanceof Types.ObjectId
              ? leadId
              : new Types.ObjectId(String(leadId)),
          type: COMMUNICATION_TYPES.SYSTEM,
          direction: COMMUNICATION_DIRECTIONS.INTERNAL,
          subject: null,
          summary,
          notes: null,
          createdBy:
            actorId instanceof Types.ObjectId
              ? actorId
              : new Types.ObjectId(String(actorId)),
          occurredAt: occurredAt ?? new Date(),
          nextFollowUpAt: null,
          visibility: COMMUNICATION_VISIBILITIES.INTERNAL,
          event,
          metadata: metadata ?? undefined,
        },
      ],
      session ? { session } : undefined
    );
  } catch (error) {
    console.error('failed to record lead activity', event, error);
    if (required) {
      throw error;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Sentence builders                                                  */
/* ------------------------------------------------------------------ */

/**
 * "Follow-up scheduled for 08 Oct 2026, 3:00 PM." /
 * "Follow-up rescheduled from 07 Oct 2026, 11:00 AM to 10 Oct 2026, 3:00 PM."
 * "Follow-up cleared."
 *
 * Concise by design: the lead's own `nextFollowUpAt` always holds the
 * current value, and the timeline only has to explain what changed.
 */
export function describeFollowUpChange(
  previous: Date | null | undefined,
  next: Date | null | undefined
): { event: LeadActivityEvent; summary: string; metadata?: CommunicationMetadata } {
  if (!next) {
    return {
      event: LEAD_ACTIVITY_EVENTS.FOLLOW_UP_CLEARED,
      summary: 'Follow-up cleared.',
    };
  }
  if (!previous) {
    return {
      event: LEAD_ACTIVITY_EVENTS.FOLLOW_UP_SCHEDULED,
      summary: `Follow-up scheduled for ${formatDateTime(next)}.`,
      metadata: { nextFollowUpAt: next.toISOString() },
    };
  }
  return {
    event: LEAD_ACTIVITY_EVENTS.FOLLOW_UP_RESCHEDULED,
    summary: `Follow-up rescheduled from ${formatDateTime(previous)} to ${formatDateTime(next)}.`,
    metadata: {
      previousFollowUpAt: previous.toISOString(),
      nextFollowUpAt: next.toISOString(),
    },
  };
}

/**
 * "Follow-up completed. Called back and confirmed the budget."
 *
 * Follow-up entries are a distinct timeline type (not SYSTEM) because they
 * are part of the staff-facing follow-up history, while SYSTEM entries are
 * the automatic audit trail.
 */
export function describeFollowUpCompleted(
  outcome: string
): { summary: string } {
  return { summary: `Follow-up completed. ${outcome}` };
}

/** "Status changed from Interested to Meeting." */
export function describeStatusChange(
  previous: string,
  next: string,
  fromLabel: string,
  toLabel: string
): { event: LeadActivityEvent; summary: string; metadata?: CommunicationMetadata } {
  return {
    event: LEAD_ACTIVITY_EVENTS.LEAD_STATUS_CHANGED,
    summary: `Status changed from ${fromLabel} to ${toLabel}.`,
    metadata: { from: previous, to: next },
  };
}

/**
 * "Lead assigned to Rahul Sharma." /
 * "Lead reassigned from Rahul Sharma to Aman Kumar." /
 * "Lead returned to the unassigned pool."
 */
export function describeAssignment(
  previousName: string | null,
  nextName: string | null
): { event: LeadActivityEvent; summary: string; metadata?: CommunicationMetadata } {
  if (!nextName) {
    return {
      event: LEAD_ACTIVITY_EVENTS.LEAD_UNASSIGNED,
      summary: previousName
        ? `Lead unassigned from ${previousName}.`
        : 'Lead left in the unassigned pool.',
      metadata: previousName ? { previousAssignee: previousName } : undefined,
    };
  }
  if (!previousName) {
    return {
      event: LEAD_ACTIVITY_EVENTS.LEAD_ASSIGNED,
      summary: `Lead assigned to ${nextName}.`,
      metadata: { assignee: nextName },
    };
  }
  return {
    event: LEAD_ACTIVITY_EVENTS.LEAD_REASSIGNED,
    summary: `Lead reassigned from ${previousName} to ${nextName}.`,
    metadata: { previousAssignee: previousName, assignee: nextName },
  };
}
