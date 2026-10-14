'use server';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

import { requireRole } from '@/lib/auth/authorization';
import {
  createLeadSystemActivity,
  describeAssignment,
  describeStatusChange,
} from '@/lib/activities/lead-activity';
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LOST_REASONS,
  type LeadStatus,
} from '@/lib/constants/enums';
import {
  DISTRIBUTION_FILTER_INACTIVE_OWNER,
  LEAD_BULK_ACTIVITY_LIMIT,
  LEAD_DISTRIBUTION_MODES,
  LEAD_DISTRIBUTION_STATUSES,
  type LeadDistributionMode,
} from '@/lib/constants/lead-import';
import {
  summariseRoundRobin,
  summariseSingleUser,
  type RoundRobinAllocation,
} from '@/lib/distribution/lead-distribution';
import { generateSequentialCode } from '@/lib/db/generate-code';
import {
  resolveAssignableMarketingUser,
  resolveAssignableMarketingUsers,
} from '@/lib/leads/assignees';
import {
  buildLeadFilter,
  listImportBatchOptions,
  parseLeadListParams,
  type LeadListParams,
} from '@/lib/queries/leads';
import { listInactiveMarketingUserIds } from '@/lib/queries/lead-distribution';
import { LeadDistribution } from '@/models/LeadDistribution';
import { Lead } from '@/models/Lead';
import { MarketingProfile } from '@/models/MarketingProfile';
import { Service } from '@/models/Service';
import { User } from '@/models/User';
import { USER_ROLES } from '@/types/auth';
import type { BulkActionResult } from '@/types/lead-import';

/**
 * Lead distribution + bulk operations (admin only).
 *
 * Security model — every action repeats this chain:
 *   1. `requireRole(ADMIN)`.
 *   2. Re-validate every id against the database (marketing
 *      users must be ACTIVE with an ACTIVE MarketingProfile;
 *      lead ids must be real 24-char ObjectIds).
 *   3. Perform the write, then revalidate the affected views.
 *
 * The distribution pool is defined by the same whitelisted
 * filters as the lead list (`parseLeadListParams` +
 * `buildLeadFilter`), so a pool can never be widened by
 * tampering. Round-robin is deterministic: matching leads are
 * ordered oldest-first and split `i % n` across the selected
 * users.
 */

const NOT_ASSIGNABLE =
  'Selected marketing user is unavailable. Choose an active marketing user.';
const EMPTY_SELECTION_ERROR = 'Select at least one lead.';
const EMPTY_USERS_ERROR = 'Select at least one active marketing user.';

/** Ceiling on how many lead ids a single bulk operation accepts. */
const BULK_LEAD_ID_LIMIT = 1000;

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/**
 * Parse a JSON array of strings with a hard ceiling.
 * Returns null when the payload is malformed.
 */
function parseStringArray(raw: string, limit: number): string[] | null {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    if (!parsed.every((item) => typeof item === 'string')) {
      return null;
    }
    if (parsed.length > limit) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Parse the distribution pool filters from the form fields. */
function parseDistributionParams(formData: FormData): LeadListParams {
  const raw: Record<string, string | string[] | undefined> = {
    search: readString(formData, 'search'),
    status: readString(formData, 'status'),
    source: readString(formData, 'source'),
    service: readString(formData, 'service'),
    createdFrom: readString(formData, 'createdFrom'),
    createdTo: readString(formData, 'createdTo'),
    importBatch: readString(formData, 'importBatch'),
    assignedTo: readString(formData, 'assignedTo'),
  };
  const params = parseLeadListParams(raw);
  // Distribution is not paginated or sorted by the caller — the
  // pool is the complete matching set.
  return { ...params, page: 1, limit: 20, sort: params.sort };
}

/**
 * Build the MongoDB filter for a distribution pool.
 *
 * The special `inactive_owner` pool (leads whose marketing owner
 * is suspended/inactive) depends on live user state, so it is
 * resolved here rather than inside the pure `buildLeadFilter`.
 */
function buildDistributionFilter(
  params: LeadListParams,
  inactiveOwnerIds: string[]
): Record<string, unknown> {
  const stripped: LeadListParams = {
    ...params,
    assignedTo:
      params.assignedTo === DISTRIBUTION_FILTER_INACTIVE_OWNER
        ? ''
        : params.assignedTo,
  };
  const filter = buildLeadFilter(stripped, { kind: 'admin' });
  if (params.assignedTo === DISTRIBUTION_FILTER_INACTIVE_OWNER) {
    filter.assignedTo = {
      $in: inactiveOwnerIds.map((id) => new Types.ObjectId(id)),
    };
  }
  return filter;
}

/** Human-readable snapshot of the active filters (audit trail). */
async function buildFiltersSnapshot(
  params: LeadListParams
): Promise<Array<{ label: string; value: string }>> {
  const snapshot: Array<{ label: string; value: string }> = [];

  if (params.search) {
    snapshot.push({ label: 'Search', value: params.search });
  }
  if (params.status) {
    snapshot.push({
      label: 'Status',
      value: LEAD_STATUS_LABELS[params.status as keyof typeof LEAD_STATUS_LABELS],
    });
  }
  if (params.source) {
    snapshot.push({
      label: 'Source',
      value:
        LEAD_SOURCE_LABELS[params.source as keyof typeof LEAD_SOURCE_LABELS] ??
        params.source,
    });
  }
  if (params.service) {
    const service = await Service.findById(params.service)
      .select('name')
      .lean();
    snapshot.push({
      label: 'Service',
      value: service?.name ?? params.service,
    });
  }
  if (params.importBatch) {
    const batches = await listImportBatchOptions(100);
    const batch = batches.find((item) => item.id === params.importBatch);
    snapshot.push({
      label: 'Import batch',
      value: batch ? `${batch.importCode} (${batch.fileName})` : params.importBatch,
    });
  }
  if (params.assignedTo === DISTRIBUTION_FILTER_INACTIVE_OWNER) {
    snapshot.push({ label: 'Pool', value: 'Suspended / inactive owner' });
  } else if (params.assignedTo === 'unassigned') {
    snapshot.push({ label: 'Pool', value: 'Unassigned leads' });
  }
  if (params.createdFrom || params.createdTo) {
    snapshot.push({
      label: 'Created',
      value: `${params.createdFrom || '…'} → ${params.createdTo || '…'}`,
    });
  }

  return snapshot;
}

/** Resolve the display names + marketing codes for a set of users. */
async function resolveDistributionUsers(
  userIds: Array<Types.ObjectId>
): Promise<
  Array<{
    userId: string;
    name: string;
    marketingCode: string | null;
  }>
> {
  if (userIds.length === 0) {
    return [];
  }
  const users = await User.find({ _id: { $in: userIds } })
    .select('name')
    .lean();
  const profiles = await MarketingProfile.find({
    userId: { $in: userIds },
  })
    .select('userId marketingCode')
    .lean();
  const codeByUser = new Map(
    profiles.map((profile) => [
      profile.userId.toString(),
      profile.marketingCode,
    ])
  );
  const nameById = new Map(users.map((user) => [user._id.toString(), user.name]));

  return userIds.map((id) => {
    const key = id.toString();
    return {
      userId: key,
      name: nameById.get(key) ?? 'Marketing user',
      marketingCode: codeByUser.get(key) ?? null,
    };
  });
}

/** Convert an allocation summary into the audit-record shape. */
function toAuditAllocation(
  allocation: RoundRobinAllocation[],
  users: Array<{ userId: string; name: string; marketingCode: string | null }>
) {
  const userById = new Map(users.map((user) => [user.userId, user]));
  return allocation
    .filter((entry) => entry.userId && entry.count > 0)
    .map((entry) => {
      const user = userById.get(entry.userId);
      return {
        userId: new Types.ObjectId(entry.userId),
        name: user?.name ?? 'Marketing user',
        marketingCode: user?.marketingCode ?? null,
        assigned: entry.count,
      };
    });
}

/* ------------------------------------------------------------------ */
/* Preview                                                           */
/* ------------------------------------------------------------------ */

export interface DistributionUserAllocation {
  userId: string;
  name: string;
  marketingCode: string | null;
  count: number;
}

export interface DistributionPreviewState {
  ok: boolean;
  error?: string;
  preview?: {
    totalLeads: number;
    userIds: string[];
    allocation: DistributionUserAllocation[];
  };
}

export interface RunDistributionState {
  ok: boolean;
  error?: string;
  result?: {
    totalLeads: number;
    distributionCode: string;
    distributionId: string;
    allocation: DistributionUserAllocation[];
  };
}

/**
 * Preview a distribution: how many leads the current filters
 * select, and how they would split across the selected users.
 * Read-only — no writes happen here.
 */
export async function previewLeadDistribution(
  formData: FormData
): Promise<DistributionPreviewState> {
  await requireRole(USER_ROLES.ADMIN);

  const params = parseDistributionParams(formData);
  const mode = readString(formData, 'mode') as LeadDistributionMode;
  if (!Object.values(LEAD_DISTRIBUTION_MODES).includes(mode)) {
    return { ok: false, error: 'Select a valid distribution mode.' };
  }
  if (mode === LEAD_DISTRIBUTION_MODES.UNASSIGNED) {
    return { ok: false, error: 'Choose how to assign the selected leads.' };
  }

  const userIdsRaw = readString(formData, 'userIds');
  const userIds = parseStringArray(userIdsRaw, 100);
  if (userIds === null || userIds.length === 0) {
    return { ok: false, error: EMPTY_USERS_ERROR };
  }

  // Validate assignees against the database.
  let assigneeIds: Types.ObjectId[];
  try {
    assigneeIds = await resolveAssignableMarketingUsers(userIds);
  } catch {
    return { ok: false, error: NOT_ASSIGNABLE };
  }

  const inactiveOwnerIds = await listInactiveMarketingUserIds();
  const filter = buildDistributionFilter(params, inactiveOwnerIds);
  const totalLeads = await Lead.countDocuments(filter);

  const users = await resolveDistributionUsers(assigneeIds);
  const allocation =
    mode === LEAD_DISTRIBUTION_MODES.SINGLE_USER
      ? summariseSingleUser(totalLeads, assigneeIds[0].toString())
      : summariseRoundRobin(totalLeads, assigneeIds.map((id) => id.toString()));

  return {
    ok: true,
    preview: {
      totalLeads,
      userIds: assigneeIds.map((id) => id.toString()),
      allocation: allocation.map((entry) => {
        const user = users.find((item) => item.userId === entry.userId);
        return {
          userId: entry.userId,
          name: user?.name ?? 'Marketing user',
          marketingCode: user?.marketingCode ?? null,
          count: entry.count,
        };
      }),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Run distribution                                                  */
/* ------------------------------------------------------------------ */

/**
 * Execute a distribution over the filtered pool.
 *
 * The pool is recomputed from the filters at run time (never
 * taken from the preview), matching leads are ordered
 * oldest-first, and each is assigned `i % n` across the selected
 * users. A `LeadDistribution` audit record is always written.
 */
export async function runLeadDistribution(
  formData: FormData
): Promise<RunDistributionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  const params = parseDistributionParams(formData);
  const mode = readString(formData, 'mode') as LeadDistributionMode;
  if (
    mode !== LEAD_DISTRIBUTION_MODES.SINGLE_USER &&
    mode !== LEAD_DISTRIBUTION_MODES.ROUND_ROBIN
  ) {
    return { ok: false, error: 'Select a valid distribution mode.' };
  }

  const userIdsRaw = readString(formData, 'userIds');
  const userIds = parseStringArray(userIdsRaw, 100);
  if (userIds === null || userIds.length === 0) {
    return { ok: false, error: EMPTY_USERS_ERROR };
  }

  let assigneeIds: Types.ObjectId[];
  try {
    assigneeIds = await resolveAssignableMarketingUsers(userIds);
  } catch {
    return { ok: false, error: NOT_ASSIGNABLE };
  }

  const inactiveOwnerIds = await listInactiveMarketingUserIds();
  const filter = buildDistributionFilter(params, inactiveOwnerIds);

  // The complete, deterministically ordered pool.
  const pool = await Lead.find(filter)
    .select('_id assignedTo')
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (pool.length === 0) {
    return { ok: false, error: 'No leads match the selected filters.' };
  }

  // Per-lead assignment.
  const assignments: Array<Types.ObjectId> =
    mode === LEAD_DISTRIBUTION_MODES.SINGLE_USER
      ? new Array(pool.length).fill(assigneeIds[0])
      : pool.map((_, index) => assigneeIds[index % assigneeIds.length]);

  // Group lead ids by assignee for efficient updateMany.
  const idsByAssignee = new Map<string, Types.ObjectId[]>();
  pool.forEach((lead, index) => {
    const key = assignments[index].toString();
    const arr = idsByAssignee.get(key) ?? [];
    arr.push(lead._id);
    idsByAssignee.set(key, arr);
  });

  const actorId = new Types.ObjectId(actor.id);

  await Promise.all(
    [...idsByAssignee.entries()].map(async ([assigneeKey, leadIds]) => {
      await Lead.updateMany(
        { _id: { $in: leadIds } },
        {
          $set: {
            assignedTo: new Types.ObjectId(assigneeKey),
            updatedBy: actorId,
          },
        }
      );
    })
  );

  const users = await resolveDistributionUsers(assigneeIds);
  const allocation =
    mode === LEAD_DISTRIBUTION_MODES.SINGLE_USER
      ? summariseSingleUser(pool.length, assigneeIds[0].toString())
      : summariseRoundRobin(pool.length, assigneeIds.map((id) => id.toString()));

  const filtersSnapshot = await buildFiltersSnapshot(params);

  // Audit record — always written, even when nothing changed.
  const distribution = await LeadDistribution.create({
    distributionCode: await generateSequentialCode('distribution', 'DIST'),
    mode,
    leadCount: pool.length,
    marketingUsers: toAuditAllocation(allocation, users),
    filtersSnapshot,
    status: LEAD_DISTRIBUTION_STATUSES.COMPLETED,
    createdBy: actorId,
    completedAt: new Date(),
  });

  // Per-lead timeline entries for small distributions only.
  if (pool.length <= LEAD_BULK_ACTIVITY_LIMIT) {
    const nameById = new Map(users.map((user) => [user.userId, user.name]));
    const previousIds = [
      ...new Set(
        pool
          .map((lead) => lead.assignedTo)
          .filter((id): id is Types.ObjectId => Boolean(id))
      ),
    ];
    const previousNames = await resolveDistributionUsers(previousIds);
    const previousNameById = new Map(
      previousNames.map((user) => [user.userId, user.name])
    );

    for (let index = 0; index < pool.length; index++) {
      const lead = pool[index];
      const assigneeId = assignments[index];
      const previousName = lead.assignedTo
        ? (previousNameById.get(lead.assignedTo.toString()) ?? null)
        : null;
      const nextName = nameById.get(assigneeId.toString()) ?? null;
      const change = describeAssignment(previousName, nextName);
      await createLeadSystemActivity({
        leadId: lead._id,
        actorId,
        event: change.event,
        summary: change.summary,
        metadata: change.metadata,
      });
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/leads');
  revalidatePath('/admin/crm/distribution');
  revalidatePath('/marketing');
  revalidatePath('/marketing/leads');

  return {
    ok: true,
    result: {
      totalLeads: pool.length,
      distributionCode: distribution.distributionCode,
      distributionId: distribution._id.toString(),
      allocation: allocation.map((entry) => {
        const user = users.find((item) => item.userId === entry.userId);
        return {
          userId: entry.userId,
          name: user?.name ?? 'Marketing user',
          marketingCode: user?.marketingCode ?? null,
          count: entry.count,
        };
      }),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Bulk operations on selected leads                                 */
/* ------------------------------------------------------------------ */

/** Parse + validate a non-empty list of lead ids. */
function parseLeadIds(raw: string): Types.ObjectId[] | null {
  const ids = parseStringArray(raw, BULK_LEAD_ID_LIMIT);
  if (ids === null || ids.length === 0) {
    return null;
  }
  const objectIds: Types.ObjectId[] = [];
  for (const id of ids) {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    objectIds.push(new Types.ObjectId(id));
  }
  return [...new Set(objectIds)];
}

/**
 * Bulk assign the selected leads to one marketing user.
 *
 * Reassignment is allowed (the lead simply moves owner; the
 * former owner loses access on their next request). Per-lead
 * timeline entries are written for selections up to
 * `LEAD_BULK_ACTIVITY_LIMIT`.
 */
export async function bulkAssignLeads(
  formData: FormData
): Promise<BulkActionResult> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  const leadIds = parseLeadIds(readString(formData, 'leadIds'));
  if (!leadIds) {
    return { ok: false, error: EMPTY_SELECTION_ERROR };
  }

  const assignedToUserId = readString(formData, 'assignedToUserId');
  let assigneeId: Types.ObjectId;
  try {
    const resolved = await resolveAssignableMarketingUser(assignedToUserId);
    if (!resolved) {
      return { ok: false, error: NOT_ASSIGNABLE };
    }
    assigneeId = resolved;
  } catch {
    return { ok: false, error: NOT_ASSIGNABLE };
  }

  const actorId = new Types.ObjectId(actor.id);
  const result = await Lead.updateMany(
    { _id: { $in: leadIds } },
    { $set: { assignedTo: assigneeId, updatedBy: actorId } }
  );

  if (result.modifiedCount > 0 && result.modifiedCount <= LEAD_BULK_ACTIVITY_LIMIT) {
    const assigneeName = (await resolveDistributionUsers([assigneeId]))[0]?.name ?? 'marketing user';
    const affected = await Lead.find({ _id: { $in: leadIds } })
      .select('assignedTo')
      .lean();
    const previousIds = [
      ...new Set(
        affected
          .map((lead) => lead.assignedTo)
          .filter((id): id is Types.ObjectId => Boolean(id))
      ),
    ];
    const previousNames = await resolveDistributionUsers(previousIds);
    const previousNameById = new Map(
      previousNames.map((user) => [user.userId, user.name])
    );

    for (const lead of affected) {
      const previousName = lead.assignedTo
        ? (previousNameById.get(lead.assignedTo.toString()) ?? null)
        : null;
      const change = describeAssignment(previousName, assigneeName);
      await createLeadSystemActivity({
        leadId: lead._id,
        actorId,
        event: change.event,
        summary: change.summary,
        metadata: change.metadata,
      });
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/leads');
  revalidatePath('/marketing');
  revalidatePath('/marketing/leads');

  return {
    ok: true,
    updatedCount: result.modifiedCount,
    message: `${result.modifiedCount} lead(s) assigned.`,
  };
}

/**
 * Bulk unassign: return the selected leads to the shared pool.
 */
export async function bulkUnassignLeads(
  formData: FormData
): Promise<BulkActionResult> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  const leadIds = parseLeadIds(readString(formData, 'leadIds'));
  if (!leadIds) {
    return { ok: false, error: EMPTY_SELECTION_ERROR };
  }

  const actorId = new Types.ObjectId(actor.id);
  const result = await Lead.updateMany(
    { _id: { $in: leadIds }, assignedTo: { $ne: null } },
    { $set: { assignedTo: null, updatedBy: actorId } }
  );

  if (result.modifiedCount > 0 && result.modifiedCount <= LEAD_BULK_ACTIVITY_LIMIT) {
    const affected = await Lead.find({ _id: { $in: leadIds } })
      .select('assignedTo')
      .lean();
    const previousIds = [
      ...new Set(
        affected
          .map((lead) => lead.assignedTo)
          .filter((id): id is Types.ObjectId => Boolean(id))
      ),
    ];
    const previousNames = await resolveDistributionUsers(previousIds);
    const previousNameById = new Map(
      previousNames.map((user) => [user.userId, user.name])
    );

    for (const lead of affected) {
      if (!lead.assignedTo) {
        continue;
      }
      const previousName = previousNameById.get(lead.assignedTo.toString()) ?? null;
      const change = describeAssignment(previousName, null);
      await createLeadSystemActivity({
        leadId: lead._id,
        actorId,
        event: change.event,
        summary: change.summary,
        metadata: change.metadata,
      });
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/leads');
  revalidatePath('/marketing');
  revalidatePath('/marketing/leads');

  return {
    ok: true,
    updatedCount: result.modifiedCount,
    message: `${result.modifiedCount} lead(s) moved to the unassigned pool.`,
  };
}

/**
 * Bulk pipeline status change. Choosing WON or LOST is a
 * significant transition, so the client confirms it first — the
 * server still re-validates the status against the allow-list.
 */
export async function bulkUpdateLeadStatus(
  formData: FormData
): Promise<BulkActionResult> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  const leadIds = parseLeadIds(readString(formData, 'leadIds'));
  if (!leadIds) {
    return { ok: false, error: EMPTY_SELECTION_ERROR };
  }

  const status = readString(formData, 'status') as LeadStatus;
  if (!(status in LEAD_STATUSES)) {
    return { ok: false, error: 'Select a valid lead status.' };
  }
  const lostReason = readString(formData, 'lostReason');
  const lostReasonNote = readString(formData, 'lostReasonNote');

  const actorId = new Types.ObjectId(actor.id);
  const lostFields: Record<string, unknown> =
    status === LEAD_STATUSES.LOST
      ? {
          lostReason: lostReason && lostReason in LOST_REASONS ? lostReason : null,
          lostReasonNote: lostReasonNote.slice(0, 500) || null,
        }
      : { lostReason: null, lostReasonNote: null };

  const result = await Lead.updateMany(
    { _id: { $in: leadIds } },
    {
      $set: {
        status,
        statusChangedAt: new Date(),
        updatedBy: actorId,
        ...lostFields,
      },
    }
  );

  if (result.modifiedCount > 0 && result.modifiedCount <= LEAD_BULK_ACTIVITY_LIMIT) {
    const affected = await Lead.find({ _id: { $in: leadIds } })
      .select('status')
      .lean();
    for (const lead of affected) {
      if (lead.status === status) {
        continue;
      }
      const change = describeStatusChange(
        lead.status,
        status,
        LEAD_STATUS_LABELS[lead.status],
        LEAD_STATUS_LABELS[status]
      );
      await createLeadSystemActivity({
        leadId: lead._id,
        actorId,
        event: change.event,
        summary: change.summary,
        metadata: change.metadata,
      });
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/leads');
  revalidatePath('/marketing');
  revalidatePath('/marketing/leads');

  return {
    ok: true,
    updatedCount: result.modifiedCount,
    message: `${result.modifiedCount} lead(s) moved to ${LEAD_STATUS_LABELS[status]}.`,
  };
}

/**
 * Bulk round-robin distribution over an explicit selection of
 * leads. The selection is ordered oldest-first so the split is
 * fair and deterministic.
 */
export async function bulkDistributeLeads(
  formData: FormData
): Promise<BulkActionResult> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  const leadIds = parseLeadIds(readString(formData, 'leadIds'));
  if (!leadIds) {
    return { ok: false, error: EMPTY_SELECTION_ERROR };
  }

  const userIds = parseStringArray(readString(formData, 'userIds'), 100);
  if (userIds === null || userIds.length === 0) {
    return { ok: false, error: EMPTY_USERS_ERROR };
  }

  let assigneeIds: Types.ObjectId[];
  try {
    assigneeIds = await resolveAssignableMarketingUsers(userIds);
  } catch {
    return { ok: false, error: NOT_ASSIGNABLE };
  }

  // Deterministic order: oldest first.
  const selected = await Lead.find({ _id: { $in: leadIds } })
    .select('_id')
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (selected.length === 0) {
    return { ok: false, error: 'No matching leads found.' };
  }

  const idsByAssignee = new Map<string, Types.ObjectId[]>();
  selected.forEach((lead, index) => {
    const assignee = assigneeIds[index % assigneeIds.length];
    const key = assignee.toString();
    const arr = idsByAssignee.get(key) ?? [];
    arr.push(lead._id);
    idsByAssignee.set(key, arr);
  });

  const actorId = new Types.ObjectId(actor.id);
  let updatedCount = 0;
  await Promise.all(
    [...idsByAssignee.entries()].map(async ([assigneeKey, ids]) => {
      const result = await Lead.updateMany(
        { _id: { $in: ids } },
        { $set: { assignedTo: new Types.ObjectId(assigneeKey), updatedBy: actorId } }
      );
      updatedCount += result.modifiedCount;
    })
  );

  revalidatePath('/admin');
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/leads');
  revalidatePath('/marketing');
  revalidatePath('/marketing/leads');

  return {
    ok: true,
    updatedCount,
    message: `${updatedCount} lead(s) distributed across ${assigneeIds.length} marketing user(s).`,
  };
}
