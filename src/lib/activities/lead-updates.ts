import 'server-only';

import { Types } from 'mongoose';
import type { ClientSession } from 'mongoose';

import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
  type LostReason,
} from '@/lib/constants/enums';
import { getLeadActivityContext, type LeadScope } from '@/lib/queries/leads';
import { Lead } from '@/models/Lead';
import { USER_ROLES, type AuthUser } from '@/types/auth';

import {
  createLeadSystemActivity,
  describeFollowUpChange,
  describeStatusChange,
} from './lead-activity';

/**
 * Shared write helpers for the lead fields that carry timeline meaning:
 * the next follow-up and the pipeline status.
 *
 * Every Part 6 mutation (logging a communication, completing a follow-up,
 * scheduling / completing / cancelling a meeting) changes one or both of
 * these, so the write + the matching timeline entry live here instead of
 * being repeated per action.
 *
 * Each helper:
 * - re-reads the lead inside the caller's scope, so ownership is checked
 *   in the database and a reassigned lead can no longer be written to;
 * - returns `{ ok: false }` (never throws) when the lead disappeared or
 *   is no longer the caller's, which the caller reports as a plain
 *   "Lead not found." — identical for both cases, so ownership is never
 *   disclosed;
 * - writes exactly one concise activity entry when something changed.
 */

/** Read/write scope derived from the acting user. */
export function leadScopeFor(user: AuthUser): LeadScope {
  return user.role === USER_ROLES.ADMIN
    ? { kind: 'admin' }
    : { kind: 'marketing', userId: user.id };
}

/**
 * Owner constraint for hand-written queries: `undefined` for admin (no
 * constraint) and the user's id for marketing.
 */
export function ownerUserIdFor(user: AuthUser): string | undefined {
  return user.role === USER_ROLES.ADMIN ? undefined : user.id;
}

export interface LeadWriteContext {
  leadId: string;
  leadObjectId: Types.ObjectId;
  actorId: string;
  /** Current owner, or null while the lead sits in the unassigned pool. */
  assignedToUserId: string | null;
  session?: ClientSession;
}

export interface LeadUpdateResult {
  ok: boolean;
  /** The value before the change, when it was read successfully. */
  previous: LeadStatus | Date | null;
}

/**
 * Resolve the lead once and build the context every write helper needs.
 * Returns null when the lead is missing or outside the caller's scope.
 */
export async function resolveLeadWriteContext(
  leadId: string,
  user: AuthUser
): Promise<LeadWriteContext | null> {
  if (!Types.ObjectId.isValid(leadId)) {
    return null;
  }

  const scope = leadScopeFor(user);
  const lead = await getLeadActivityContext(leadId, scope);
  if (!lead) {
    return null;
  }

  return {
    leadId: lead.id,
    leadObjectId: new Types.ObjectId(lead.id),
    actorId: user.id,
    assignedToUserId: lead.assignedToUserId,
  };
}

function ownershipFilter(
  context: LeadWriteContext,
  user: AuthUser
): Record<string, unknown> {
  const filter: Record<string, unknown> = { _id: context.leadObjectId };
  if (user.role === USER_ROLES.MARKETING) {
    filter.assignedTo = new Types.ObjectId(user.id);
  }
  return filter;
}

/**
 * Set (or clear) `Lead.nextFollowUpAt` and record the change on the
 * timeline.
 *
 * `next = null` clears the follow-up — that is what happens when a
 * follow-up or a meeting is completed without scheduling a new one.
 */
export async function applyFollowUpChange(
  context: LeadWriteContext,
  user: AuthUser,
  next: Date | null,
  options: { occurredAt?: Date; required?: boolean; session?: ClientSession } = {}
): Promise<LeadUpdateResult> {
  const current = await Lead.findOne(ownershipFilter(context, user))
    .select('nextFollowUpAt')
    .session(options.session ?? null)
    .lean()
    .exec();

  if (!current) {
    return { ok: false, previous: null };
  }

  const previous = current.nextFollowUpAt ?? null;
  if (previous?.getTime() === (next?.getTime() ?? null)) {
    return { ok: true, previous };
  }

  const result = await Lead.updateOne(
    ownershipFilter(context, user),
    {
      $set: {
        nextFollowUpAt: next,
        updatedBy: new Types.ObjectId(context.actorId),
      },
    },
    options.session ? { session: options.session } : undefined
  );

  if (result.matchedCount === 0) {
    return { ok: false, previous };
  }

  const { event, summary, metadata } = describeFollowUpChange(previous, next);
  await createLeadSystemActivity({
    leadId: context.leadObjectId,
    actorId: context.actorId,
    event,
    summary,
    metadata,
    occurredAt: options.occurredAt,
    required: options.required,
    session: options.session,
  });

  return { ok: true, previous };
}

/**
 * Move the lead through the pipeline and record the transition.
 *
 * A no-op (same status) writes nothing, so a form resubmission does not
 * pollute the history. LOST-only fields are cleared automatically when the
 * lead leaves the LOST stage, matching the Part 5 lead forms.
 */
export async function applyStatusChange(
  context: LeadWriteContext,
  user: AuthUser,
  next: LeadStatus,
  lostReason?: string | null,
  lostReasonNote?: string | null,
  options: { required?: boolean; session?: ClientSession } = {}
): Promise<LeadUpdateResult> {
  const current = await Lead.findOne(ownershipFilter(context, user))
    .select('status')
    .session(options.session ?? null)
    .lean()
    .exec();

  if (!current) {
    return { ok: false, previous: null };
  }

  const previous = current.status;
  if (previous === next) {
    return { ok: true, previous };
  }

  const lostFields =
    next === LEAD_STATUSES.LOST
      ? {
          lostReason:
            lostReason && lostReason !== '' ? (lostReason as LostReason) : null,
          lostReasonNote: lostReasonNote ?? null,
        }
      : { lostReason: null, lostReasonNote: null };

  const result = await Lead.updateOne(
    ownershipFilter(context, user),
    {
      $set: {
        status: next,
        statusChangedAt: new Date(),
        updatedBy: new Types.ObjectId(context.actorId),
        ...lostFields,
      },
    },
    options.session ? { session: options.session } : undefined
  );

  if (result.matchedCount === 0) {
    return { ok: false, previous };
  }

  const { event, summary, metadata } = describeStatusChange(
    previous,
    next,
    LEAD_STATUS_LABELS[previous] ?? previous,
    LEAD_STATUS_LABELS[next] ?? next
  );
  await createLeadSystemActivity({
    leadId: context.leadObjectId,
    actorId: context.actorId,
    event,
    summary,
    metadata,
    required: options.required,
    session: options.session,
  });

  return { ok: true, previous };
}
