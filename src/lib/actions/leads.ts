'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Types } from 'mongoose';
import type { z } from 'zod';

import { requireAnyRole, requireRole } from '@/lib/auth/authorization';
import {
  createLeadSystemActivity,
  describeAssignment,
  describeFollowUpChange,
  describeStatusChange,
} from '@/lib/activities/lead-activity';
import {
  LEAD_ACTIVITY_EVENTS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from '@/lib/constants/enums';
import { generateSequentialCode } from '@/lib/db/generate-code';
import { resolveAssignableMarketingUser } from '@/lib/leads/assignees';
import {
  findPossibleDuplicateLeads,
  resolveUserNames,
} from '@/lib/queries/leads';
import {
  ADMIN_LEAD_FIELDS,
  LEAD_FIELDS,
  MARKETING_LEAD_FIELDS,
  leadAssignmentSchema,
  leadCreateSchema,
  leadFieldErrors,
  leadStatusSchema,
  leadUpdateSchema,
  marketingLeadCreateSchema,
  marketingLeadUpdateSchema,
  type DuplicateLeadHint,
  type LeadActionState,
  type NewLeadPayload,
} from '@/lib/validations/lead';
import { Lead } from '@/models/Lead';
import { Service } from '@/models/Service';
import { USER_ROLES, type AuthUser } from '@/types/auth';
import { createNotification } from '@/lib/notifications/create';

/**
 * CRM mutations for leads.
 *
 * Security model — every action repeats this whole chain, because the
 * client is never trusted:
 *   1. Resolve the current user from the session cookie AND re-read the
 *      User document (so suspensions apply immediately).
 *   2. Verify the role.
 *   3. For marketing operations verify ownership — inside the database
 *      query, not after fetching the record.
 *   4. Re-validate the raw FormData with zod.
 *   5. Perform the write.
 *
 * Assignment targets are validated against the database on every write
 * (role MARKETING + account ACTIVE + ACTIVE MarketingProfile), so a stale
 * or hand-crafted dropdown can never hand a lead to the wrong person.
 *
 * Every mutation that changes the pipeline status or the follow-up date
 * also appends a concise activity entry to the lead's communication
 * timeline (see `createLeadSystemActivity`), so the timeline explains how
 * a lead reached its current state without anyone remembering to type it.
 *
 * There is deliberately no delete action: leads leave the active funnel
 * through the LOST status, and records are preserved.
 */

const GENERIC_ERROR = 'Unable to save lead. Please try again.';
const NOT_ASSIGNABLE =
  'Selected marketing user is unavailable. Choose an active marketing user.';
const LEAD_NOT_FOUND = 'Lead not found.';

/** Error carrying a user-safe message and (optionally) its form field. */
class LeadActionError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'LeadActionError';
    this.field = field;
  }
}

function toState(error: unknown): LeadActionState {
  if (error instanceof LeadActionError) {
    return error.field
      ? { fieldErrors: { [error.field]: error.message } }
      : { error: error.message };
  }
  console.error('lead action failed', error);
  return { error: GENERIC_ERROR };
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/** Repeated form fields (multi-select / checkbox groups). */
function readStrings(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string');
}

function fieldErrors(
  error: z.ZodError,
  names: readonly string[]
): Record<string, string> {
  return leadFieldErrors(error, names);
}

/**
 * Only ADMIN and MARKETING may touch CRM data. EMPLOYEE and CLIENT are
 * redirected to their own dashboard before anything is read.
 */
async function requireCrmActor(): Promise<AuthUser> {
  return requireAnyRole([USER_ROLES.ADMIN, USER_ROLES.MARKETING]);
}

/* ------------------------------------------------------------------ */
/* Revalidation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Refresh the pages whose rendered numbers change after a lead mutation:
 * the CRM overview, both lead lists (own counts) and the dashboards.
 * Marketing routes are only revalidated when the lead is actually inside
 * a marketing user's scope.
 */
function revalidateLeadViews(leadId: string, touchesMarketing: boolean): void {
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

/* ------------------------------------------------------------------ */
/* Reference validation                                              */
/* ------------------------------------------------------------------ */

/**
 * Confirm the selected id is still an assignable marketing user.
 * Delegates to the shared resolver so the single-lead form, the
 * CSV import and the bulk distribution actions all apply the
 * identical rule (`User.role = MARKETING`, `User.status = ACTIVE`,
 * linked `MarketingProfile` with `status = ACTIVE`).
 *
 * Returns the resolved ObjectId, or null when the caller asked to
 * unassign.
 */
async function resolveAssignee(
  assignedTo: string | null
): Promise<Types.ObjectId | null> {
  try {
    return await resolveAssignableMarketingUser(assignedTo);
  } catch (error) {
    throw new LeadActionError(
      error instanceof Error ? error.message : NOT_ASSIGNABLE,
      'assignedTo'
    );
  }
}

/**
 * Service references arrive straight from the form, so verify each one
 * exists and is active before storing. Unknown ids are dropped instead of
 * creating a dangling reference.
 */
async function resolveServiceIds(ids: string[]): Promise<Types.ObjectId[]> {
  const valid = ids
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  if (valid.length === 0) {
    return [];
  }
  const services = await Service.find({
    _id: { $in: valid },
    isActive: true,
  })
    .select('_id')
    .lean();
  return services.map((service) => service._id);
}

/**
 * Loss metadata only applies while the lead is LOST; returning it to an
 * active stage clears it so a stale reason is never displayed.
 */
function lostFields(
  status: LeadStatus,
  lostReason: string,
  lostReasonNote: string | null
): Record<string, unknown> {
  if (status !== LEAD_STATUSES.LOST) {
    return { lostReason: null, lostReasonNote: null };
  }
  return {
    lostReason: lostReason === '' ? null : lostReason,
    lostReasonNote,
  };
}

function duplicateHints(
  leads: Array<{
    leadCode: string;
    name: string;
    companyName: string | null;
    status: LeadStatus;
    createdAt: Date;
  }>
): DuplicateLeadHint[] {
  return leads.map((lead) => ({
    leadCode: lead.leadCode,
    name: lead.name,
    companyName: lead.companyName,
    status: lead.status,
    createdAt: lead.createdAt.toISOString(),
  }));
}

/** Shared shape of the raw form fields used by both create variants. */
function readCoreFields(formData: FormData) {
  return {
    name: readString(formData, 'name'),
    companyName: readString(formData, 'companyName'),
    email: readString(formData, 'email'),
    phone: readString(formData, 'phone'),
    alternatePhone: readString(formData, 'alternatePhone'),
    website: readString(formData, 'website'),
    serviceInterest: readStrings(formData, 'serviceInterest'),
    estimatedBudget: readString(formData, 'estimatedBudget'),
    currency: readString(formData, 'currency'),
    source: readString(formData, 'source'),
    nextFollowUpAt: readString(formData, 'nextFollowUpAt'),
    notes: readString(formData, 'notes'),
  };
}

/* ------------------------------------------------------------------ */
/* Create                                                            */
/* ------------------------------------------------------------------ */

/**
 * Append the timeline entries for a lead edit form.
 *
 * The Part 5 edit form submits every field, so the status and follow-up are
 * compared against the values read before the write: nothing is recorded
 * when nothing actually changed. Assignment changes made here are recorded
 * by `assignLead` instead, which owns that transition.
 */
async function recordLeadEdits(input: {
  leadId: string;
  actorId: string;
  previousStatus: LeadStatus;
  nextStatus: LeadStatus;
  previousFollowUpAt: Date | null;
  nextFollowUpAt: Date | null;
}): Promise<void> {
  if (input.previousStatus !== input.nextStatus) {
    const change = describeStatusChange(
      input.previousStatus,
      input.nextStatus,
      LEAD_STATUS_LABELS[input.previousStatus],
      LEAD_STATUS_LABELS[input.nextStatus]
    );
    await createLeadSystemActivity({
      leadId: input.leadId,
      actorId: input.actorId,
      event: change.event,
      summary: change.summary,
      metadata: change.metadata,
    });
  }

  const previousTime = input.previousFollowUpAt?.getTime() ?? null;
  const nextTime = input.nextFollowUpAt?.getTime() ?? null;
  if (previousTime !== nextTime) {
    const followUp = describeFollowUpChange(
      input.previousFollowUpAt,
      input.nextFollowUpAt
    );
    await createLeadSystemActivity({
      leadId: input.leadId,
      actorId: input.actorId,
      event: followUp.event,
      summary: followUp.summary,
      metadata: followUp.metadata,
    });
  }
}

/**
 * Create a lead.
 *
 * ADMIN may set source, status and the owning marketing user (including
 * leaving it unassigned). MARKETING may create leads but never for
 * somebody else: the action forces `assignedTo = createdBy = currentUser`
 * and `status = NEW`, ignoring anything the form submitted for those.
 *
 * Advisory duplicate detection runs first: a matching email/phone shows a
 * warning plus an explicit "create anyway" path. Creation is never
 * blocked by a duplicate, because the same person may legitimately
 * enquire more than once.
 */
export async function createLead(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const actor = await requireCrmActor();
  const isAdmin = actor.role === USER_ROLES.ADMIN;
  const confirmDuplicate = readString(formData, 'confirmDuplicate') === 'yes';

  const raw = readCoreFields(formData);

  let payload: NewLeadPayload;
  let status: LeadStatus;
  let requestedAssignee: string | null = null;

  if (isAdmin) {
    const parsed = leadCreateSchema.safeParse({
      ...raw,
      status: readString(formData, 'status'),
      assignedTo: readString(formData, 'assignedTo'),
    });
    if (!parsed.success) {
      return { fieldErrors: fieldErrors(parsed.error, ADMIN_LEAD_FIELDS) };
    }
    payload = parsed.data;
    status = parsed.data.status;
    requestedAssignee = parsed.data.assignedTo;
  } else {
    const parsed = marketingLeadCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return { fieldErrors: fieldErrors(parsed.error, MARKETING_LEAD_FIELDS) };
    }
    payload = parsed.data;
    // A marketing user can never create work for another marketing user.
    status = LEAD_STATUSES.NEW;
    requestedAssignee = actor.id;
  }

  let leadId = '';

  try {
    if (!confirmDuplicate) {
      const duplicates = await findPossibleDuplicateLeads(
        payload.email,
        payload.phone
      );
      if (duplicates.length > 0) {
        return {
          warning:
            'A lead with this email or phone already exists. Review the matches below, then choose "Create lead anyway" if this is a separate enquiry.',
          duplicates: duplicateHints(duplicates),
        };
      }
    }

    const serviceInterest = await resolveServiceIds(payload.serviceInterest);

    // The lead code comes from the shared atomic Counter, so concurrent
    // creations can never collide. Never countDocuments() + 1.
    const leadCode = await generateSequentialCode('lead', 'LEAD');

    const assignedTo = await resolveAssignee(requestedAssignee);

    const created = await Lead.create({
      leadCode,
      name: payload.name,
      companyName: payload.companyName,
      email: payload.email,
      phone: payload.phone,
      alternatePhone: payload.alternatePhone,
      website: payload.website,
      source: payload.source,
      serviceInterest,
      estimatedBudget: payload.estimatedBudget,
      currency: payload.currency,
      status,
      assignedTo,
      createdBy: new Types.ObjectId(actor.id),
      updatedBy: new Types.ObjectId(actor.id),
      nextFollowUpAt: payload.nextFollowUpAt,
      statusChangedAt: new Date(),
      notes: payload.notes,
    });

    leadId = created._id.toString();

    // Automatic activity: a new lead always starts its timeline with
    // "Lead created by …", plus a follow-up entry when one was scheduled
    // on the create form.
    await createLeadSystemActivity({
      leadId,
      actorId: actor.id,
      event: LEAD_ACTIVITY_EVENTS.LEAD_CREATED,
      summary: `Lead created by ${actor.name}.`,
      metadata: { leadCode },
    });

    if (payload.nextFollowUpAt) {
      const followUp = describeFollowUpChange(null, payload.nextFollowUpAt);
      await createLeadSystemActivity({
        leadId,
        actorId: actor.id,
        event: followUp.event,
        summary: followUp.summary,
        metadata: followUp.metadata,
      });
    }
  } catch (error) {
    return toState(error);
  }

  revalidateLeadViews(leadId, true);
  redirect(
    `${isAdmin ? '/admin/crm/leads' : '/marketing/leads'}/${leadId}?notice=created`
  );
}

/* ------------------------------------------------------------------ */
/* Update (admin)                                                    */
/* ------------------------------------------------------------------ */

/**
 * Admin edit of any lead: contact details, source, status, services,
 * budget, follow-up, notes and assignment. `leadCode` and `createdBy`
 * are not part of the payload and therefore cannot be changed.
 */
export async function updateLead(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  const parsed = leadUpdateSchema.safeParse({
    id: readString(formData, 'id'),
    ...readCoreFields(formData),
    status: readString(formData, 'status'),
    assignedTo: readString(formData, 'assignedTo'),
    lostReason: readString(formData, 'lostReason'),
    lostReasonNote: readString(formData, 'lostReasonNote'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error, [
        'id',
        ...ADMIN_LEAD_FIELDS,
        'lostReason',
        'lostReasonNote',
      ]),
    };
  }

  const input = parsed.data;
  const leadId = input.id;

  try {
    if (!Types.ObjectId.isValid(leadId)) {
      return { error: LEAD_NOT_FOUND };
    }

    const existing = await Lead.findById(leadId)
      .select('assignedTo status nextFollowUpAt')
      .lean();
    if (!existing) {
      return { error: LEAD_NOT_FOUND };
    }

    const serviceInterest = await resolveServiceIds(input.serviceInterest);
    const assignedTo = await resolveAssignee(input.assignedTo);

    const result = await Lead.updateOne(
      { _id: new Types.ObjectId(leadId) },
      {
        $set: {
          name: input.name,
          companyName: input.companyName,
          email: input.email,
          phone: input.phone,
          alternatePhone: input.alternatePhone,
          website: input.website,
          source: input.source,
          serviceInterest,
          estimatedBudget: input.estimatedBudget,
          currency: input.currency,
          status: input.status,
          statusChangedAt: new Date(),
          assignedTo,
          nextFollowUpAt: input.nextFollowUpAt,
          notes: input.notes,
          updatedBy: new Types.ObjectId(actor.id),
          ...lostFields(input.status, input.lostReason, input.lostReasonNote),
        },
      }
    );

    if (result.matchedCount === 0) {
      return { error: LEAD_NOT_FOUND };
    }

    await recordLeadEdits({
      leadId,
      actorId: actor.id,
      previousStatus: existing.status,
      nextStatus: input.status,
      previousFollowUpAt: existing.nextFollowUpAt ?? null,
      nextFollowUpAt: input.nextFollowUpAt,
    });

    revalidateLeadViews(
      leadId,
      Boolean(existing.assignedTo) || Boolean(assignedTo)
    );
  } catch (error) {
    return toState(error);
  }

  redirect(`/admin/crm/leads/${leadId}`);
}

/* ------------------------------------------------------------------ */
/* Update (marketing)                                                */
/* ------------------------------------------------------------------ */

/**
 * Marketing edit of an assigned lead.
 *
 * `assignedTo`, `createdBy` and `leadCode` are absent from the schema, so
 * they cannot be changed here, and `source` stays with admin as the
 * acquisition-attribution field. Ownership is part of the update query, so
 * a page that was open before an unassignment writes nothing.
 */
export async function updateMyLead(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const actor = await requireRole(USER_ROLES.MARKETING);

  const parsed = marketingLeadUpdateSchema.safeParse({
    id: readString(formData, 'id'),
    ...readCoreFields(formData),
    status: readString(formData, 'status'),
    lostReason: readString(formData, 'lostReason'),
    lostReasonNote: readString(formData, 'lostReasonNote'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error, [
        'id',
        ...LEAD_FIELDS,
        'source',
        'status',
        'nextFollowUpAt',
        'lostReason',
        'lostReasonNote',
      ]),
    };
  }

  const input = parsed.data;
  const leadId = input.id;

  try {
    if (!Types.ObjectId.isValid(leadId)) {
      return { error: LEAD_NOT_FOUND };
    }

    const existing = await Lead.findOne({
      _id: new Types.ObjectId(leadId),
      assignedTo: new Types.ObjectId(actor.id),
    })
      .select('status nextFollowUpAt')
      .lean()
      .exec();

    if (!existing) {
      return { error: LEAD_NOT_FOUND };
    }

    const serviceInterest = await resolveServiceIds(input.serviceInterest);

    const result = await Lead.updateOne(
      {
        _id: new Types.ObjectId(leadId),
        assignedTo: new Types.ObjectId(actor.id),
      },
      {
        $set: {
          name: input.name,
          companyName: input.companyName,
          email: input.email,
          phone: input.phone,
          alternatePhone: input.alternatePhone,
          website: input.website,
          serviceInterest,
          estimatedBudget: input.estimatedBudget,
          currency: input.currency,
          status: input.status,
          statusChangedAt: new Date(),
          nextFollowUpAt: input.nextFollowUpAt,
          notes: input.notes,
          updatedBy: new Types.ObjectId(actor.id),
          ...lostFields(input.status, input.lostReason, input.lostReasonNote),
        },
      }
    );

    // matchedCount 0 covers "not yours" and "no longer assigned to you"
    // with one identical answer, so ownership is never disclosed.
    if (result.matchedCount === 0) {
      return { error: LEAD_NOT_FOUND };
    }

    await recordLeadEdits({
      leadId,
      actorId: actor.id,
      previousStatus: existing.status,
      nextStatus: input.status,
      previousFollowUpAt: existing.nextFollowUpAt ?? null,
      nextFollowUpAt: input.nextFollowUpAt,
    });
  } catch (error) {
    return toState(error);
  }

  revalidatePath('/marketing');
  revalidatePath('/marketing/leads');
  revalidatePath(`/marketing/leads/${leadId}`);
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/leads');
  redirect(`/marketing/leads/${leadId}`);
}

/* ------------------------------------------------------------------ */
/* Assignment                                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin assign / reassign / unassign.
 *
 * Only `assignedTo`, `updatedBy` and `updatedAt` change: the lead is
 * never duplicated and no history is rewritten. An empty assignee moves
 * the lead back to the unassigned pool; the previous marketing user loses
 * access on their very next request, because every marketing query
 * re-checks ownership.
 */
export async function assignLead(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  const parsed = leadAssignmentSchema.safeParse({
    id: readString(formData, 'id'),
    assignedTo: readString(formData, 'assignedTo'),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error, ['id', 'assignedTo']) };
  }

  const { id, assignedTo } = parsed.data;

  try {
    if (!Types.ObjectId.isValid(id)) {
      return { error: LEAD_NOT_FOUND };
    }

    const existing = await Lead.findById(id)
      .select('assignedTo')
      .lean();
    if (!existing) {
      return { error: LEAD_NOT_FOUND };
    }

    const assigneeId = await resolveAssignee(assignedTo);

    const result = await Lead.updateOne(
      { _id: new Types.ObjectId(id) },
      {
        $set: {
          assignedTo: assigneeId,
          updatedBy: new Types.ObjectId(actor.id),
        },
      }
    );

    if (result.matchedCount === 0) {
      return { error: LEAD_NOT_FOUND };
    }

    // "Lead assigned to …" / "Lead reassigned from … to …" — names come
    // from the database, never from the submitted form.
    const names = await resolveUserNames([existing.assignedTo, assigneeId]);
    const change = describeAssignment(
      existing.assignedTo ? (names.get(existing.assignedTo.toString()) ?? null) : null,
      assigneeId ? (names.get(assigneeId.toString()) ?? null) : null
    );
    await createLeadSystemActivity({
      leadId: id,
      actorId: actor.id,
      event: change.event,
      summary: change.summary,
      metadata: change.metadata,
    });

    if (assigneeId) {
      await createNotification({
        recipientUserId: assigneeId,
        type: 'LEAD_ASSIGNED',
        title: 'Lead assigned',
        message: 'A lead has been assigned to you.',
        resourceType: 'Lead',
        resourceId: id,
        resourceUrl: `/marketing/leads/${id}`,
        idempotencyKey: `lead-assigned:${id}:${assigneeId}:${result.modifiedCount}`,
      });
    }

    revalidateLeadViews(id, Boolean(existing.assignedTo) || Boolean(assigneeId));

    return {
      ok: true,
      message: assigneeId
        ? 'Lead assigned.'
        : 'Lead moved to the unassigned pool.',
    };
  } catch (error) {
    return toState(error);
  }
}

/* ------------------------------------------------------------------ */
/* Status                                                            */
/* ------------------------------------------------------------------ */

/**
 * Quick status change from the list or the detail page.
 *
 * ADMIN may update any lead. MARKETING may only update a lead still
 * assigned to them (checked inside the query itself). Every value comes
 * from the approved status set; pipeline stages may move in either
 * direction, and LOST optionally records a reason.
 *
 * Marking a lead WON deliberately does NOT create a Client record:
 * conversion is a separate, controlled workflow in a later phase.
 */
export async function updateLeadStatus(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const actor = await requireCrmActor();

  const parsed = leadStatusSchema.safeParse({
    id: readString(formData, 'id'),
    status: readString(formData, 'status'),
    lostReason: readString(formData, 'lostReason'),
    lostReasonNote: readString(formData, 'lostReasonNote'),
  });

  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error, ['id', 'status', 'lostReason']),
    };
  }

  const { id, status, lostReason, lostReasonNote } = parsed.data;

  try {
    if (!Types.ObjectId.isValid(id)) {
      return { error: LEAD_NOT_FOUND };
    }

    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
    };
    if (actor.role === USER_ROLES.MARKETING) {
      filter.assignedTo = new Types.ObjectId(actor.id);
    }

    const existing = await Lead.findOne(filter)
      .select('assignedTo status')
      .lean();
    if (!existing) {
      return { error: LEAD_NOT_FOUND };
    }

    const result = await Lead.updateOne(filter, {
      $set: {
        status,
        statusChangedAt: new Date(),
        ...lostFields(status, lostReason, lostReasonNote),
        updatedBy: new Types.ObjectId(actor.id),
      },
    });

    if (result.matchedCount === 0) {
      return { error: LEAD_NOT_FOUND };
    }

    if (existing.status !== status) {
      const change = describeStatusChange(
        existing.status,
        status,
        LEAD_STATUS_LABELS[existing.status],
        LEAD_STATUS_LABELS[status]
      );
      await createLeadSystemActivity({
        leadId: id,
        actorId: actor.id,
        event: change.event,
        summary: change.summary,
        metadata: change.metadata,
      });
    }

    revalidateLeadViews(id, Boolean(existing.assignedTo));

    return {
      ok: true,
      message:
        status === LEAD_STATUSES.WON
          ? 'Lead marked as won. It is ready for client conversion.'
          : 'Lead status updated.',
    };
  } catch (error) {
    return toState(error);
  }
}
