import 'server-only';

import { Types } from 'mongoose';
import type { PipelineStage as MongoPipelineStage } from 'mongoose';

import {
  FOLLOW_UP_STATES,
  startOfLocalDay,
  startOfNextLocalDay,
  type FollowUpState,
} from '@/lib/utils/follow-up';
import connectDB from '@/lib/db/mongoose';
import {
  LEAD_PIPELINE_STAGES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  MARKETING_STATUS,
  USER_STATUS,
  type LeadSource,
  type LeadStatus,
  type LostReason,
} from '@/lib/constants/enums';
import { toMongoRegex } from '@/lib/utils/regex';
import {
  ASSIGNMENT_FILTER_ASSIGNED,
  ASSIGNMENT_FILTER_UNASSIGNED,
  LEAD_PAGE_SIZE_DEFAULT,
  LEAD_PAGE_SIZES,
  LEAD_SORTS,
  type AssignableMarketingUser,
  type LeadListParams,
  type LeadPageSize,
  type LeadSort,
  type PipelineStage,
  type ServiceOption,
} from '@/lib/constants/leads';
import { DISTRIBUTION_FILTER_INACTIVE_OWNER } from '@/lib/constants/lead-import';
import { Lead } from '@/models/Lead';
import { LeadImport } from '@/models/LeadImport';
import { MarketingProfile } from '@/models/MarketingProfile';
import { Service } from '@/models/Service';
import { User } from '@/models/User';
import { USER_ROLES, type UserRole } from '@/types/auth';

export type { LeadListParams } from '@/lib/constants/leads';

/**
 * Server-side data access for the CRM (leads).
 *
 * Every function returns plain, serializable objects — never Mongoose
 * documents — so pages can hand them to client components without leaking
 * internals. Search, filtering, sorting and pagination all happen in
 * MongoDB; no page loads the whole collection.
 *
 * Two rules are enforced here as well as in the actions, because read
 * paths matter just as much:
 * 1. Marketing access is always narrowed to `assignedTo = currentUser`
 *    inside the query, so a marketing user cannot widen a result set by
 *    tampering with URL params.
 * 2. Assigned-user data is projected to the minimum needed (name, email,
 *    marketing code). Password hashes, salary and commission
 *    configuration are never selected or populated here.
 */

/* ------------------------------------------------------------------ */
/* Scope + list parameters                                           */
/* ------------------------------------------------------------------ */

/**
 * Who is asking. `'admin'` sees every lead; `'marketing'` is hard-scoped
 * to a single assignee id.
 */
export type LeadScope =
  | { kind: 'admin' }
  | { kind: 'marketing'; userId: string };

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isOneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[]
): value is T {
  return (
    typeof value === 'string' && (allowed as readonly string[]).includes(value)
  );
}

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse and whitelist every URL query param. Unknown values silently fall
 * back to "no filter" instead of reaching MongoDB, so query params are
 * never spread into a query document.
 */
export function parseLeadListParams(raw: RawSearchParams): LeadListParams {
  const search = (firstValue(raw.search) ?? '').trim().slice(0, 100);

  const page = Math.max(1, parseInt(firstValue(raw.page) ?? '1', 10) || 1);

  const requestedLimit = parseInt(
    firstValue(raw.limit) ?? String(LEAD_PAGE_SIZE_DEFAULT),
    10
  );
  const limit = (LEAD_PAGE_SIZES as readonly number[]).includes(requestedLimit)
    ? (requestedLimit as LeadPageSize)
    : LEAD_PAGE_SIZE_DEFAULT;

  const status = firstValue(raw.status);
  const source = firstValue(raw.source);
  const followUp = firstValue(raw.followUp);
  const sort = firstValue(raw.sort);
  const assignedTo = (firstValue(raw.assignedTo) ?? '').trim();
  const service = (firstValue(raw.service) ?? '').trim();
  const createdFrom = (firstValue(raw.createdFrom) ?? '').trim();
  const createdTo = (firstValue(raw.createdTo) ?? '').trim();
  const importBatch = (firstValue(raw.importBatch) ?? '').trim();

  return {
    search,
    status: isOneOf(status, Object.values(LEAD_STATUSES)) ? status : '',
    source: isOneOf(source, Object.values(LEAD_SOURCES)) ? source : '',
    assignedTo:
      assignedTo === ASSIGNMENT_FILTER_UNASSIGNED ||
      assignedTo === ASSIGNMENT_FILTER_ASSIGNED ||
      assignedTo === DISTRIBUTION_FILTER_INACTIVE_OWNER ||
      OBJECT_ID_PATTERN.test(assignedTo)
        ? assignedTo
        : '',
    service: OBJECT_ID_PATTERN.test(service) ? service : '',
    createdFrom: DATE_INPUT_PATTERN.test(createdFrom) ? createdFrom : '',
    createdTo: DATE_INPUT_PATTERN.test(createdTo) ? createdTo : '',
    followUp: isOneOf(followUp, Object.values(FOLLOW_UP_STATES))
      ? followUp
      : '',
    importBatch: OBJECT_ID_PATTERN.test(importBatch) ? importBatch : '',
    sort: isOneOf(sort, Object.values(LEAD_SORTS)) ? sort : LEAD_SORTS.NEWEST,
    page,
    limit,
  };
}

/** True when the list has any narrowing filter applied (not sort/page). */
export function hasLeadFilters(params: LeadListParams): boolean {
  return Boolean(
    params.search ||
      params.status ||
      params.source ||
      params.assignedTo ||
      params.service ||
      params.createdFrom ||
      params.createdTo ||
      params.followUp ||
      params.importBatch
  );
}

/* ------------------------------------------------------------------ */
/* Query building                                                    */
/* ------------------------------------------------------------------ */

/**
 * Hard ownership filter. For a marketing scope this is always present, so
 * no combination of search terms or filters can surface another user's
 * leads.
 */
function scopeFilter(scope: LeadScope): Record<string, unknown> {
  return scope.kind === 'admin'
    ? {}
    : { assignedTo: new Types.ObjectId(scope.userId) };
}

/** Date range on `createdAt`, inclusive on both ends, in local time. */
function createdRangeFilter(
  from: string,
  to: string
): { createdAt: Record<string, Date> } | null {
  if (!from && !to) {
    return null;
  }
  const range: Record<string, Date> = {};
  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(start.getTime())) {
      range.$gte = start;
    }
  }
  if (to) {
    // Inclusive whole-day upper bound: the next midnight, exclusive.
    const end = new Date(`${to}T00:00:00`);
    if (!Number.isNaN(end.getTime())) {
      end.setDate(end.getDate() + 1);
      range.$lt = end;
    }
  }
  return Object.keys(range).length > 0 ? { createdAt: range } : null;
}

/** Day-bounded filter for a derived follow-up state. */
function followUpFilter(
  state: FollowUpState | '',
  now: Date
): { nextFollowUpAt: Record<string, unknown> | null } | null {
  if (state === '') {
    return null;
  }
  const today = startOfLocalDay(now);
  const tomorrow = startOfNextLocalDay(now);

  switch (state) {
    case FOLLOW_UP_STATES.NONE:
      return { nextFollowUpAt: { $eq: null } };
    case FOLLOW_UP_STATES.OVERDUE:
      return { nextFollowUpAt: { $ne: null, $lt: today } };
    case FOLLOW_UP_STATES.DUE_TODAY:
      return { nextFollowUpAt: { $gte: today, $lt: tomorrow } };
    case FOLLOW_UP_STATES.UPCOMING:
      return { nextFollowUpAt: { $gte: tomorrow } };
  }
}

/**
 * Compose the MongoDB filter for a lead list. Search uses escaped regex
 * (`toMongoRegex`), so a user-supplied term can never inject regex
 * metacharacters or a pathological pattern.
 */
export function buildLeadFilter(
  params: LeadListParams,
  scope: LeadScope,
  now: Date = new Date()
): Record<string, unknown> {
  const filter: Record<string, unknown> = { ...scopeFilter(scope) };

  if (params.search) {
    const rx = toMongoRegex(params.search);
    filter.$or = [
      { leadCode: rx },
      { name: rx },
      { companyName: rx },
      { email: rx },
      { phone: rx },
      { website: rx },
    ];
  }
  if (params.status) {
    filter.status = params.status;
  }
  if (params.source) {
    filter.source = params.source;
  }
  if (params.assignedTo && scope.kind === 'admin') {
    if (params.assignedTo === ASSIGNMENT_FILTER_UNASSIGNED) {
      filter.assignedTo = null;
    } else if (params.assignedTo === ASSIGNMENT_FILTER_ASSIGNED) {
      filter.assignedTo = { $ne: null };
    } else if (OBJECT_ID_PATTERN.test(params.assignedTo)) {
      filter.assignedTo = new Types.ObjectId(params.assignedTo);
    }
    // Any other sentinel (e.g. inactive_owner) is resolved by the
    // caller, which knows the database state it depends on.
  }
  if (params.service) {
    filter.serviceInterest = new Types.ObjectId(params.service);
  }
  if (params.importBatch) {
    filter.importBatchId = new Types.ObjectId(params.importBatch);
  }

  const created = createdRangeFilter(params.createdFrom, params.createdTo);
  if (created) {
    filter.createdAt = created.createdAt;
  }

  const followUp = followUpFilter(params.followUp, now);
  if (followUp) {
    filter.nextFollowUpAt = followUp.nextFollowUpAt;
  }

  return filter;
}

/**
 * Whitelisted sort spec. No user-supplied value is ever used as a field
 * name.
 */
function buildLeadSort(
  sort: LeadSort
): Record<string, 1 | -1> | Array<Record<string, -1 | 1>> {
  switch (sort) {
    case LEAD_SORTS.OLDEST:
      return { createdAt: 1 };
    case LEAD_SORTS.UPDATED:
      return { updatedAt: -1, createdAt: -1 };
    case LEAD_SORTS.FOLLOW_UP:
      // Leads with no follow-up sink to the bottom instead of leading.
      return [
        { __hasFollowUp: -1 },
        { nextFollowUpAt: 1 },
        { createdAt: -1 },
      ];
    case LEAD_SORTS.NEWEST:
    default:
      return { createdAt: -1 };
  }
}

/* ------------------------------------------------------------------ */
/* List                                                              */
/* ------------------------------------------------------------------ */

export interface LeadListItem {
  id: string;
  leadCode: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  serviceNames: string[];
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedToMarketingCode: string | null;
  estimatedBudget: number | null;
  currency: string;
  nextFollowUpAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RawListRow {
  _id: Types.ObjectId;
  leadCode: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  source: LeadSource;
  status: LeadStatus;
  estimatedBudget?: number | null;
  currency: string;
  nextFollowUpAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: Types.ObjectId | null;
  serviceNames?: string[];
  assigneeName?: string | null;
  assigneeMarketingCode?: string | null;
}

interface FacetResult {
  rows?: RawListRow[];
  total?: Array<{ value: number }>;
}

/**
 * Paginated lead list with search + filters + sorting.
 *
 * One aggregation round trip returns the page rows *and* the total count,
 * and resolves service names, the assignee name and the marketing code
 * through `$lookup` — no per-row queries, no N+1.
 */
export async function listLeads(
  params: LeadListParams,
  scope: LeadScope
): Promise<{ items: LeadListItem[]; total: number }> {
  await connectDB();

  const filter = buildLeadFilter(params, scope);
  const sort = buildLeadSort(params.sort);

  const pipeline: Record<string, unknown>[] = [];
  if (params.sort === LEAD_SORTS.FOLLOW_UP) {
    pipeline.push({
      $addFields: {
        __hasFollowUp: { $cond: [{ $gt: ['$nextFollowUpAt', null] }, 1, 0] },
      },
    });
  }
  pipeline.push(
    { $match: filter },
    { $sort: sort },
    {
      $facet: {
        rows: [
          { $skip: (params.page - 1) * params.limit },
          { $limit: params.limit },
          {
            $lookup: {
              from: 'services',
              localField: 'serviceInterest',
              foreignField: '_id',
              as: '__services',
            },
          },
          {
            $addFields: {
              serviceNames: {
                $map: { input: '$__services', as: 'svc', in: '$$svc.name' },
              },
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'assignedTo',
              foreignField: '_id',
              as: '__assignee',
            },
          },
          {
            $addFields: {
              assigneeName: { $arrayElemAt: ['$__assignee.name', 0] },
            },
          },
          {
            $lookup: {
              from: 'marketing_profiles',
              let: { uid: '$assignedTo' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$userId', '$$uid'] },
                        { $ne: ['$$uid', null] },
                      ],
                    },
                  },
                },
                { $limit: 1 },
              ],
              as: '__assigneeProfiles',
            },
          },
          {
            $addFields: {
              assigneeMarketingCode: {
                $arrayElemAt: ['$__assigneeProfiles.marketingCode', 0],
              },
            },
          },
        ],
        total: [{ $count: 'value' }],
      },
    }
  );

  const [result] = (await Lead.aggregate(
    // Built dynamically (conditional sort helper stage), so the pipeline is
    // assembled as plain records and handed to the driver here.
    pipeline as unknown as MongoPipelineStage[]
  ).exec()) as FacetResult[];
  const rows = result?.rows ?? [];

  const items: LeadListItem[] = rows.map((row) => ({
    id: row._id.toString(),
    leadCode: row.leadCode,
    name: row.name,
    companyName: row.companyName ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    source: row.source,
    status: row.status,
    serviceNames: [...(row.serviceNames ?? [])]
      .filter((name): name is string => typeof name === 'string' && !!name)
      .sort(),
    assignedToUserId: row.assignedTo ? row.assignedTo.toString() : null,
    assignedToName: row.assigneeName ?? null,
    assignedToMarketingCode: row.assigneeMarketingCode ?? null,
    estimatedBudget: row.estimatedBudget ?? null,
    currency: row.currency,
    nextFollowUpAt: row.nextFollowUpAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return { items, total: result?.total?.[0]?.value ?? 0 };
}

/* ------------------------------------------------------------------ */
/* Detail                                                            */
/* ------------------------------------------------------------------ */

export interface LeadDetail {
  id: string;
  leadCode: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  website: string | null;
  source: LeadSource;
  serviceInterest: Array<{ id: string; name: string }>;
  estimatedBudget: number | null;
  currency: string;
  status: LeadStatus;
  assignedTo: {
    userId: string;
    name: string;
    marketingCode: string | null;
  } | null;
  nextFollowUpAt: Date | null;
  statusChangedAt: Date | null;
  notes: string | null;
  lostReason: LostReason | null;
  lostReasonNote: string | null;
  convertedClientId: string | null;
  convertedAt: Date | null;
  createdBy: { id: string; name: string; role: UserRole } | null;
  updatedBy: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PopulatedRef {
  _id: Types.ObjectId;
  name?: string;
  role?: UserRole;
  marketingCode?: string;
}

/**
 * Full lead detail.
 *
 * When `ownerUserId` is supplied the query is narrowed to
 * `assignedTo = ownerUserId`, so a marketing user asking for somebody
 * else's lead gets `null` — indistinguishable from a missing record, and
 * the caller answers with `notFound()`.
 */
async function loadLeadDetail(
  leadId: string,
  ownerUserId?: string
): Promise<LeadDetail | null> {
  if (!Types.ObjectId.isValid(leadId)) {
    return null;
  }
  await connectDB();

  const filter: Record<string, unknown> = { _id: new Types.ObjectId(leadId) };
  if (ownerUserId) {
    if (!Types.ObjectId.isValid(ownerUserId)) {
      return null;
    }
    filter.assignedTo = new Types.ObjectId(ownerUserId);
  }

  const lead = await Lead.findOne(filter)
    .populate('serviceInterest', 'name')
    .populate('assignedTo', 'name')
    .populate('createdBy', 'name role')
    .populate('updatedBy', 'name')
    .lean()
    .exec();

  if (!lead) {
    return null;
  }

  // One extra query (not per lead) resolves the assignee's marketing code.
  let marketingCode: string | null = null;
  if (lead.assignedTo) {
    const profile = await MarketingProfile.findOne({
      userId: lead.assignedTo._id,
    })
      .select('marketingCode')
      .lean();
    marketingCode = profile?.marketingCode ?? null;
  }

  const services = Array.isArray(lead.serviceInterest)
    ? (lead.serviceInterest as unknown as PopulatedRef[])
    : [];
  const assignee = lead.assignedTo as unknown as PopulatedRef | null;
  const createdBy = lead.createdBy as unknown as PopulatedRef | null;
  const updatedBy = lead.updatedBy as unknown as PopulatedRef | null;

  return {
    id: lead._id.toString(),
    leadCode: lead.leadCode,
    name: lead.name,
    companyName: lead.companyName ?? null,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    alternatePhone: lead.alternatePhone ?? null,
    website: lead.website ?? null,
    source: lead.source,
    serviceInterest: services
      .filter((service) => service && typeof service.name === 'string')
      .map((service) => ({
        id: service._id.toString(),
        name: service.name as string,
      })),
    estimatedBudget: lead.estimatedBudget ?? null,
    currency: lead.currency,
    status: lead.status,
    assignedTo: assignee
      ? {
          userId: assignee._id.toString(),
          name: assignee.name ?? '',
          marketingCode,
        }
      : null,
    nextFollowUpAt: lead.nextFollowUpAt ?? null,
    statusChangedAt: lead.statusChangedAt ?? null,
    notes: lead.notes ?? null,
    lostReason: lead.lostReason ?? null,
    lostReasonNote: lead.lostReasonNote ?? null,
    convertedClientId: lead.convertedClientId
      ? lead.convertedClientId.toString()
      : null,
    convertedAt: lead.convertedAt ?? null,
    createdBy: createdBy
      ? {
          id: createdBy._id.toString(),
          name: createdBy.name ?? '',
          role: createdBy.role ?? USER_ROLES.CLIENT,
        }
      : null,
    updatedBy: updatedBy
      ? { id: updatedBy._id.toString(), name: updatedBy.name ?? '' }
      : null,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

/** Admin lead detail (any lead). */
export function getLeadDetail(leadId: string): Promise<LeadDetail | null> {
  return loadLeadDetail(leadId);
}

/**
 * Marketing lead detail, hard-scoped to the assignee. Returns null for a
 * lead owned by somebody else, so the page can answer `notFound()` and
 * never reveal that the record exists.
 */
export function getAssignedLeadDetail(
  leadId: string,
  marketingUserId: string
): Promise<LeadDetail | null> {
  return loadLeadDetail(leadId, marketingUserId);
}

/* ------------------------------------------------------------------ */
/* Overview / statistics                                             */
/* ------------------------------------------------------------------ */

export interface LeadCounts {
  total: number;
  byStatus: Record<LeadStatus, number>;
  /** Only the admin scope can meaningfully report unassigned leads. */
  unassigned: number;
  followUps: {
    overdue: number;
    dueToday: number;
    upcoming: number;
  };
}

function emptyStatusCounts(): Record<LeadStatus, number> {
  const base = {} as Record<LeadStatus, number>;
  for (const status of Object.values(LEAD_STATUSES)) {
    base[status] = 0;
  }
  return base;
}

/**
 * Real CRM statistics for the overview pages and dashboards.
 *
 * Two aggregations (status distribution; totals + follow-up buckets) run
 * in parallel — nothing is loaded into memory just to be counted. Scoped
 * exactly like the list, so a marketing user only ever sees their own
 * numbers.
 */
export async function getLeadCounts(scope: LeadScope): Promise<LeadCounts> {
  await connectDB();

  const match = scopeFilter(scope);
  const today = startOfLocalDay(new Date());
  const tomorrow = startOfNextLocalDay(new Date());

  const [statusRows, totals] = await Promise.all([
    Lead.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec(),
    Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unassigned: {
            $sum: { $cond: [{ $eq: ['$assignedTo', null] }, 1, 0] },
          },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$nextFollowUpAt', null] },
                    { $lt: ['$nextFollowUpAt', today] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          dueToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$nextFollowUpAt', today] },
                    { $lt: ['$nextFollowUpAt', tomorrow] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          upcoming: {
            $sum: {
              $cond: [{ $gte: ['$nextFollowUpAt', tomorrow] }, 1, 0],
            },
          },
        },
      },
    ]).exec(),
  ]);

  const byStatus = emptyStatusCounts();
  for (const row of statusRows) {
    if (row && typeof row._id === 'string' && row._id in byStatus) {
      byStatus[row._id as LeadStatus] = Number(row.count ?? 0);
    }
  }

  const row = (
    totals[0] as
      | {
          total: number;
          unassigned: number;
          overdue: number;
          dueToday: number;
          upcoming: number;
        }
      | undefined
  ) ?? {
    total: 0,
    unassigned: 0,
    overdue: 0,
    dueToday: 0,
    upcoming: 0,
  };

  return {
    total: row.total,
    byStatus,
    unassigned: row.unassigned,
    followUps: {
      overdue: row.overdue,
      dueToday: row.dueToday,
      upcoming: row.upcoming,
    },
  };
}

/**
 * Pipeline rows for the overview board, in the approved stage order
 * (LOST is terminal and reported separately by the caller).
 */
export async function getPipeline(scope: LeadScope): Promise<PipelineStage[]> {
  const counts = await getLeadCounts(scope);
  return LEAD_PIPELINE_STAGES.map((status) => ({
    status,
    label: LEAD_STATUS_LABELS[status],
    count: counts.byStatus[status],
  }));
}

/* ------------------------------------------------------------------ */
/* Activity + follow-up helpers (communication timeline)               */
/* ------------------------------------------------------------------ */

/**
 * The subset of a lead the activity log needs: ownership, current
 * pipeline status and the current follow-up instant.
 *
 * Pass a marketing `scope` to hard-narrow the lookup to leads the user
 * still owns; a lead that has since been reassigned (or unassigned)
 * returns `null`, so a stale page cannot read or write activity for it.
 */
export interface LeadActivityContext {
  id: string;
  leadCode: string;
  name: string;
  companyName: string | null;
  status: LeadStatus;
  nextFollowUpAt: Date | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  createdByName: string | null;
}

export async function getLeadActivityContext(
  leadId: string,
  scope: LeadScope
): Promise<LeadActivityContext | null> {
  if (!Types.ObjectId.isValid(leadId)) {
    return null;
  }
  await connectDB();

  const filter: Record<string, unknown> = {
    _id: new Types.ObjectId(leadId),
  };
  if (scope.kind === 'marketing') {
    if (!Types.ObjectId.isValid(scope.userId)) {
      return null;
    }
    filter.assignedTo = new Types.ObjectId(scope.userId);
  }

  const lead = await Lead.findOne(filter)
    .populate('assignedTo', 'name')
    .populate('createdBy', 'name')
    .select(
      'leadCode name companyName status nextFollowUpAt assignedTo createdBy'
    )
    .lean()
    .exec();

  if (!lead) {
    return null;
  }

  const assignee = lead.assignedTo as unknown as PopulatedRef | null;
  const createdBy = lead.createdBy as unknown as PopulatedRef | null;

  return {
    id: lead._id.toString(),
    leadCode: lead.leadCode,
    name: lead.name,
    companyName: lead.companyName ?? null,
    status: lead.status,
    nextFollowUpAt: lead.nextFollowUpAt ?? null,
    assignedToUserId: assignee ? assignee._id.toString() : null,
    assignedToName: assignee?.name ?? null,
    createdByName: createdBy?.name ?? null,
  };
}

/**
 * Resolve display names for user ids in one query.
 *
 * Used to compose assignment activity sentences from database values —
 * never from ids submitted by a browser.
 */
export async function resolveUserNames(
  userIds: Array<string | Types.ObjectId | null | undefined>
): Promise<Map<string, string>> {
  await connectDB();

  const ids = [
    ...new Set(
      userIds
        .filter((id): id is string | Types.ObjectId => Boolean(id))
        .map((id) => String(id))
        .filter((id) => OBJECT_ID_PATTERN.test(id))
    ),
  ].map((id) => new Types.ObjectId(id));

  if (ids.length === 0) {
    return new Map();
  }

  const users = await User.find({ _id: { $in: ids } })
    .select('name')
    .lean();

  return new Map(
    users.map((user) => [user._id.toString(), user.name as string])
  );
}

/** Minimal lead row for the dashboard follow-up lists. */
export interface FollowUpLeadItem {
  id: string;
  leadCode: string;
  name: string;
  companyName: string | null;
  status: LeadStatus;
  nextFollowUpAt: Date;
  assignedToName: string | null;
  assignedToUserId: string | null;
}

/**
 * Leads whose follow-up falls on the given derived day bucket, soonest
 * first — the real data behind "Today's follow-ups" and "Overdue
 * follow-ups" on both dashboards.
 */
export async function listFollowUpLeads(
  scope: LeadScope,
  state: 'TODAY' | 'OVERDUE',
  limit = 10
): Promise<FollowUpLeadItem[]> {
  await connectDB();

  const today = startOfLocalDay(new Date());
  const tomorrow = startOfNextLocalDay(new Date());
  const range =
    state === 'OVERDUE'
      ? { $ne: null, $lt: today }
      : { $gte: today, $lt: tomorrow };

  const rows = await Lead.aggregate([
    { $match: { ...scopeFilter(scope), nextFollowUpAt: range } },
    { $sort: { nextFollowUpAt: 1 } },
    { $limit: Math.min(Math.max(limit, 1), 50) },
    {
      $lookup: {
        from: 'users',
        localField: 'assignedTo',
        foreignField: '_id',
        as: '__assignee',
      },
    },
    {
      $addFields: {
        assigneeName: { $arrayElemAt: ['$__assignee.name', 0] },
      },
    },
  ]).exec();

  return (rows as Array<Record<string, unknown>>).map((row) => {
    const assigneeId = row.assignedTo as Types.ObjectId | null | undefined;
    return {
      id: String(row._id),
      leadCode: String(row.leadCode),
      name: String(row.name),
      companyName: (row.companyName as string | null) ?? null,
      status: row.status as LeadStatus,
      nextFollowUpAt: row.nextFollowUpAt as Date,
      assignedToName: (row.assigneeName as string | null) ?? null,
      assignedToUserId: assigneeId ? assigneeId.toString() : null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Reference data                                                    */
/* ------------------------------------------------------------------ */

/** Users a lead may be assigned to (see `listAssignableMarketingUsers`). */
export async function listAssignableMarketingUsers(): Promise<
  AssignableMarketingUser[]
> {
  await connectDB();

  const users = await User.find({
    role: USER_ROLES.MARKETING,
    status: USER_STATUS.ACTIVE,
  })
    .select('_id name email')
    .sort({ name: 1 })
    .lean();

  if (users.length === 0) {
    return [];
  }

  const profiles = await MarketingProfile.find({
    userId: { $in: users.map((user) => user._id) },
    status: MARKETING_STATUS.ACTIVE,
  })
    .select('userId marketingCode')
    .lean();

  const codeByUser = new Map<string, string>();
  for (const profile of profiles) {
    codeByUser.set(profile.userId.toString(), profile.marketingCode);
  }

  return users
    .filter((user) => codeByUser.has(user._id.toString()))
    .map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      marketingCode: codeByUser.get(user._id.toString()) ?? null,
    }));
}

/** Active services, pre-ordered for select inputs. */
export async function listActiveServices(): Promise<ServiceOption[]> {
  await connectDB();
  const services = await Service.find({ isActive: true })
    .select('_id name')
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  return services.map((service) => ({
    id: service._id.toString(),
    name: service.name,
  }));
}

/** One CSV import batch for filter dropdowns and badges. */
export interface ImportBatchOption {
  id: string;
  importCode: string;
  fileName: string;
  importedRows: number;
  createdAt: Date;
}

/**
 * Recent CSV import batches (newest first), for the "Import batch"
 * filter on the admin lead list.
 */
export async function listImportBatchOptions(
  limit = 50
): Promise<ImportBatchOption[]> {
  await connectDB();
  const batches = await LeadImport.find({ status: { $in: ['COMPLETED', 'PARTIAL'] } })
    .select('importCode fileName importedRows createdAt')
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .lean();
  return batches.map((batch) => ({
    id: batch._id.toString(),
    importCode: batch.importCode,
    fileName: batch.fileName,
    importedRows: batch.importedRows,
    createdAt: batch.createdAt,
  }));
}

/* ------------------------------------------------------------------ */
/* Duplicate detection (advisory)                                    */
/* ------------------------------------------------------------------ */

export interface DuplicateLead {
  id: string;
  leadCode: string;
  name: string;
  companyName: string | null;
  status: LeadStatus;
  createdAt: Date;
}

/**
 * Possible existing leads sharing the same email or phone.
 *
 * Advisory only — the create action warns but never blocks, because the
 * same person may legitimately enquire more than once.
 */
export async function findPossibleDuplicateLeads(
  email: string | null,
  phone: string | null
): Promise<DuplicateLead[]> {
  const clauses: Record<string, unknown>[] = [];
  if (email) {
    clauses.push({ email });
  }
  if (phone) {
    clauses.push({ phone });
  }
  if (clauses.length === 0) {
    return [];
  }

  await connectDB();
  const leads = await Lead.find({ $or: clauses })
    .select('leadCode name companyName status createdAt')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return leads.map((lead) => ({
    id: lead._id.toString(),
    leadCode: lead.leadCode,
    name: lead.name,
    companyName: lead.companyName ?? null,
    status: lead.status,
    createdAt: lead.createdAt,
  }));
}
