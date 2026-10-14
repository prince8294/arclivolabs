import 'server-only';

import { Types } from 'mongoose';

import {
  COMMUNICATION_SORTS,
  COMMUNICATION_TYPES,
  USER_STATUS,
  type CallResult,
  type CommunicationDirection,
  type CommunicationSort,
  type CommunicationType,
  type CommunicationVisibility,
  type LeadActivityEvent,
} from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { toMongoRegex } from '@/lib/utils/regex';
import { Communication } from '@/models/Communication';
import type { CommunicationMetadata } from '@/models/Communication';
import { Lead } from '@/models/Lead';
import { USER_ROLES, type UserRole } from '@/types/auth';

/**
 * Read access to the lead communication timeline.
 *
 * Every function returns plain, serializable objects. Two rules hold here
 * as well as in the actions:
 *
 * 1. Scope is enforced in the database. A marketing caller passes
 *    `ownerUserId`; the lead is first re-read with
 *    `assignedTo = ownerUserId`, so a lead reassigned away from them stops
 *    returning data immediately.
 * 2. `createdBy` is populated with only `name role avatarUrl`. Password
 *    hashes and unrelated user data are never selected.
 */

export const COMMUNICATION_PAGE_SIZES = [20, 50] as const;
export type CommunicationPageSize =
  (typeof COMMUNICATION_PAGE_SIZES)[number];
export const COMMUNICATION_PAGE_SIZE_DEFAULT: CommunicationPageSize = 20;

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export interface CommunicationTimelineParams {
  /** '' = every type. */
  type: CommunicationType | '';
  sort: CommunicationSort;
  page: number;
  limit: CommunicationPageSize;
}

/** Parse and whitelist the timeline's URL query params. */
export function parseCommunicationTimelineParams(
  raw: RawSearchParams
): CommunicationTimelineParams {
  const type = firstValue(raw.type);
  const sort = firstValue(raw.sort);

  const page = Math.max(1, parseInt(firstValue(raw.page) ?? '1', 10) || 1);
  const requestedLimit = parseInt(
    firstValue(raw.limit) ?? String(COMMUNICATION_PAGE_SIZE_DEFAULT),
    10
  );
  const limit = (
    COMMUNICATION_PAGE_SIZES as readonly number[]
  ).includes(requestedLimit)
    ? (requestedLimit as CommunicationPageSize)
    : COMMUNICATION_PAGE_SIZE_DEFAULT;

  return {
    type:
      type && Object.values(COMMUNICATION_TYPES).includes(type as CommunicationType)
        ? (type as CommunicationType)
        : '',
    sort:
      sort && Object.values(COMMUNICATION_SORTS).includes(sort as CommunicationSort)
        ? (sort as CommunicationSort)
        : COMMUNICATION_SORTS.NEWEST,
    page,
    limit,
  };
}

export interface CommunicationListItem {
  id: string;
  type: CommunicationType;
  direction: CommunicationDirection | null;
  subject: string | null;
  summary: string | null;
  notes: string | null;
  callResult: CallResult | null;
  contactPerson: string | null;
  occurredAt: Date;
  nextFollowUpAt: Date | null;
  visibility: CommunicationVisibility;
  event: LeadActivityEvent | null;
  metadata: CommunicationMetadata | null;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string;
    role: UserRole;
    avatarUrl: string | null;
  } | null;
}

interface PopulatedCreator {
  _id: Types.ObjectId;
  name?: string;
  role?: UserRole;
  avatarUrl?: string | null;
}

interface RawTimelineRow {
  _id: Types.ObjectId;
  type: CommunicationType;
  direction?: CommunicationDirection | null;
  subject?: string | null;
  summary?: string | null;
  notes?: string | null;
  callResult?: CallResult | null;
  contactPerson?: string | null;
  occurredAt: Date;
  nextFollowUpAt?: Date | null;
  visibility: CommunicationVisibility;
  event?: LeadActivityEvent | null;
  metadata?: CommunicationMetadata | null;
  createdAt: Date;
  createdBy?: PopulatedCreator | null;
}

/**
 * Confirm the lead exists and is still inside the caller's scope.
 *
 * Returns the lead id, or null when the lead does not exist, the id is
 * malformed, or a marketing user no longer owns it. Callers treat null as
 * "not found" and never create orphan communication documents.
 */
export async function resolveScopedLeadId(
  leadId: string,
  ownerUserId?: string
): Promise<string | null> {
  if (!Types.ObjectId.isValid(leadId)) {
    return null;
  }
  await connectDB();

  const filter: Record<string, unknown> = {
    _id: new Types.ObjectId(leadId),
  };
  if (ownerUserId) {
    if (!Types.ObjectId.isValid(ownerUserId)) {
      return null;
    }
    filter.assignedTo = new Types.ObjectId(ownerUserId);
  }

  const lead = await Lead.findOne(filter)
    .select('_id')
    .lean()
    .exec();

  return lead ? lead._id.toString() : null;
}

function emptyTypeCounts(): Record<CommunicationType, number> {
  const base = {} as Record<CommunicationType, number>;
  for (const type of Object.values(COMMUNICATION_TYPES)) {
    base[type] = 0;
  }
  return base;
}

function toListItem(row: RawTimelineRow): CommunicationListItem {
  const creator = row.createdBy ?? null;
  return {
    id: row._id.toString(),
    type: row.type,
    direction: row.direction ?? null,
    subject: row.subject ?? null,
    summary: row.summary ?? null,
    notes: row.notes ?? null,
    callResult: row.callResult ?? null,
    contactPerson: row.contactPerson ?? null,
    occurredAt: row.occurredAt,
    nextFollowUpAt: row.nextFollowUpAt ?? null,
    visibility: row.visibility,
    event: row.event ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
    createdBy: creator
      ? {
          id: creator._id.toString(),
          name: creator.name ?? '',
          role: creator.role ?? USER_ROLES.CLIENT,
          avatarUrl: creator.avatarUrl ?? null,
        }
      : null,
  };
}

export interface LeadCommunicationTimeline {
  items: CommunicationListItem[];
  /** Entries matching the active filter (drives pagination). */
  total: number;
  /** Every entry on the lead, regardless of the filter. */
  totalAll: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Per-type counts for the lead, for the filter chips. */
  counts: Record<CommunicationType, number>;
}

/**
 * Paginated, filterable, sortable lead timeline.
 *
 * One query resolves the page plus the per-type counts, so the filter bar
 * always shows real numbers without a second round trip. Access is
 * re-verified inside the database before anything is read.
 */
export async function listLeadCommunications(
  leadId: string,
  params: CommunicationTimelineParams,
  ownerUserId?: string
): Promise<LeadCommunicationTimeline> {
  const scopedLeadId = await resolveScopedLeadId(leadId, ownerUserId);
  const empty = emptyTypeCounts();

  if (!scopedLeadId) {
    return {
      items: [],
      total: 0,
      totalAll: 0,
      page: 1,
      limit: params.limit,
      totalPages: 1,
      counts: empty,
    };
  }

  await connectDB();

  const leadObjectId = new Types.ObjectId(scopedLeadId);
  const sort: Record<string, 1 | -1> =
    params.sort === COMMUNICATION_SORTS.OLDEST
      ? { occurredAt: 1, createdAt: 1 }
      : { occurredAt: -1, createdAt: -1 };

  const filter: Record<string, unknown> = { leadId: leadObjectId };
  if (params.type) {
    filter.type = params.type;
  }

  const [entries, counts] = await Promise.all([
    Communication.find(filter)
      .populate('createdBy', 'name role avatarUrl')
      .sort(sort)
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean()
      .exec(),
    Communication.aggregate([
      { $match: { leadId: leadObjectId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]).exec(),
  ]);

  for (const row of counts) {
    const key = row?._id as CommunicationType | undefined;
    if (key && key in empty) {
      empty[key] = Number(row.count ?? 0);
    }
  }

  const totalAll = Object.values(empty).reduce((sum, value) => sum + value, 0);

  return {
    items: (entries as unknown as RawTimelineRow[]).map(toListItem),
    total: params.type ? (empty[params.type] ?? 0) : totalAll,
    totalAll,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil((params.type ? empty[params.type] ?? 0 : totalAll) / params.limit)),
    counts: empty,
  };
}

/* ------------------------------------------------------------------ */
/* Dashboards                                                         */
/* ------------------------------------------------------------------ */

export interface RecentActivityItem {
  id: string;
  type: CommunicationType;
  direction: CommunicationDirection | null;
  summary: string | null;
  subject: string | null;
  callResult: CallResult | null;
  event: LeadActivityEvent | null;
  occurredAt: Date;
  leadId: string;
  leadCode: string;
  leadName: string;
  companyName: string | null;
  createdByName: string | null;
}

export interface CommunicationFeedItem extends CommunicationListItem {
  leadId: string;
  leadCode: string;
  leadName: string;
  companyName: string | null;
}

export interface CommunicationFeedParams {
  search: string;
  type: CommunicationType | '';
  page: number;
  limit: CommunicationPageSize;
}

/** Parse the global communication-feed filters from URL search params. */
export function parseCommunicationFeedParams(
  raw: Record<string, string | string[] | undefined>
): CommunicationFeedParams {
  const parsed = parseCommunicationTimelineParams(raw);
  const value = raw.search;
  return {
    search: (Array.isArray(value) ? value[0] : value ?? '').trim().slice(0, 100),
    type: parsed.type,
    page: parsed.page,
    limit: parsed.limit,
  };
}

/**
 * Paginated activity across leads.
 *
 * Marketing ownership and client visibility are applied before communication
 * rows are loaded, so the feed cannot reveal an out-of-scope lead.
 */
export async function listCommunicationFeed(
  params: CommunicationFeedParams,
  options: {
    ownerUserId?: string;
    leadIds?: string[];
    clientVisibleOnly?: boolean;
  } = {}
): Promise<{ items: CommunicationFeedItem[]; total: number }> {
  await connectDB();

  const leadFilter: Record<string, unknown> = {};
  if (options.ownerUserId) {
    if (!Types.ObjectId.isValid(options.ownerUserId)) return { items: [], total: 0 };
    leadFilter.assignedTo = new Types.ObjectId(options.ownerUserId);
  }
  if (options.leadIds) {
    const ids = options.leadIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (ids.length === 0) return { items: [], total: 0 };
    leadFilter._id = { $in: ids };
  }
  if (params.search) {
    const rx = toMongoRegex(params.search);
    leadFilter.$or = [{ leadCode: rx }, { name: rx }, { companyName: rx }];
  }

  const leads = await Lead.find(leadFilter)
    .select('leadCode name companyName')
    .lean()
    .exec();
  if (leads.length === 0) return { items: [], total: 0 };

  const filter: Record<string, unknown> = {
    leadId: { $in: leads.map((lead) => lead._id) },
  };
  if (params.type) filter.type = params.type;
  if (options.clientVisibleOnly) filter.visibility = 'CLIENT_VISIBLE';

  const [rows, total] = await Promise.all([
    Communication.find(filter)
      .populate('createdBy', 'name role avatarUrl')
      .sort({ occurredAt: -1, createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean()
      .exec(),
    Communication.countDocuments(filter),
  ]);
  const leadMap = new Map(leads.map((lead) => [lead._id.toString(), lead]));

  return {
    total,
    items: (rows as unknown as RawTimelineRow[]).map((row) => {
      const leadId = (row as RawTimelineRow & { leadId: Types.ObjectId }).leadId.toString();
      const lead = leadMap.get(leadId);
      return {
        ...toListItem(row),
        leadId,
        leadCode: lead?.leadCode ?? '',
        leadName: lead?.name ?? 'Unknown lead',
        companyName: lead?.companyName ?? null,
      };
    }),
  };
}

/**
 * Latest CRM activity for the dashboards, newest first.
 *
 * The lead is joined in the aggregation (not fetched afterwards), so
 * marketing scoping stays a single indexed query and the list can never
 * reveal a lead outside the caller's scope.
 */
export async function listRecentLeadActivity(options: {
  ownerUserId?: string;
  limit?: number;
}): Promise<RecentActivityItem[]> {
  await connectDB();

  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const match: Record<string, unknown> = {};
  if (options.ownerUserId) {
    if (!Types.ObjectId.isValid(options.ownerUserId)) {
      return [];
    }
    match.assignedTo = new Types.ObjectId(options.ownerUserId);
  }

  const rows = await Communication.aggregate([
    { $match: match },
    { $sort: { occurredAt: -1, createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'leads',
        localField: 'leadId',
        foreignField: '_id',
        as: '__lead',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: '__creator',
      },
    },
    {
      $project: {
        type: 1,
        direction: 1,
        summary: 1,
        subject: 1,
        callResult: 1,
        event: 1,
        occurredAt: 1,
        leadId: 1,
        leadCode: { $arrayElemAt: ['$__lead.leadCode', 0] },
        leadName: { $arrayElemAt: ['$__lead.name', 0] },
        companyName: { $arrayElemAt: ['$__lead.companyName', 0] },
        createdByName: { $arrayElemAt: ['$__creator.name', 0] },
      },
    },
  ]).exec();

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row._id),
    type: row.type as CommunicationType,
    direction: (row.direction as CommunicationDirection | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    subject: (row.subject as string | null) ?? null,
    callResult: (row.callResult as CallResult | null) ?? null,
    event: (row.event as LeadActivityEvent | null) ?? null,
    occurredAt: row.occurredAt as Date,
    leadId: String(row.leadId),
    leadCode: (row.leadCode as string | undefined) ?? '',
    leadName: (row.leadName as string | undefined) ?? 'Unknown lead',
    companyName: (row.companyName as string | null) ?? null,
    createdByName: (row.createdByName as string | undefined) ?? null,
  }));
}

/**
 * Company-wide (or own) count of entries logged in the last `days` days.
 * Used for the "logged this week" line on the CRM overview.
 */
export async function countRecentCommunications(
  ownerUserId: string | undefined,
  days = 7
): Promise<number> {
  await connectDB();

  const match: Record<string, unknown> = {
    occurredAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
  };
  if (ownerUserId) {
    if (!Types.ObjectId.isValid(ownerUserId)) {
      return 0;
    }
    match.createdBy = new Types.ObjectId(ownerUserId);
  }

  return Communication.countDocuments(match).exec();
}
