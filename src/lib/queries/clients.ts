import 'server-only';

import { Types } from 'mongoose';
import type { PipelineStage as MongoPipelineStage } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import {
  CLIENT_SOURCES,
  CLIENT_STATUSES,
  CLIENT_TYPES,
  type ClientSource,
  type ClientStatus,
  type ClientType,
  type UserStatus,
} from '@/lib/constants/enums';
import { toMongoRegex } from '@/lib/utils/regex';
import { Client } from '@/models/Client';
import { MarketingProfile } from '@/models/MarketingProfile';
import { User } from '@/models/User';
import { USER_ROLES, type UserRole } from '@/types/auth';

/**
 * Server-side data access for Client management.
 *
 * Every function returns plain, serializable objects. Search, filtering,
 * sorting and pagination all happen in MongoDB.
 *
 * Marketing access is always narrowed to assignedMarketingUserId = currentUser.
 */

export type ClientScope =
  | { kind: 'admin' }
  | { kind: 'marketing'; userId: string }
  | { kind: 'client'; userId: string };

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isOneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[]
): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const CLIENT_PAGE_SIZE_DEFAULT = 20;
const CLIENT_PAGE_SIZES = [10, 20, 50, 100] as const;

export type ClientPageSize = (typeof CLIENT_PAGE_SIZES)[number];

export const CLIENT_SORTS = {
  NEWEST: 'NEWEST',
  OLDEST: 'OLDEST',
  UPDATED: 'UPDATED',
  NAME: 'NAME',
  CODE: 'CODE',
} as const;

export type ClientSort = (typeof CLIENT_SORTS)[keyof typeof CLIENT_SORTS];

export const PORTAL_FILTER_ENABLED = 'PORTAL_ENABLED';
export const PORTAL_FILTER_DISABLED = 'PORTAL_DISABLED';

export function parseClientListParams(raw: RawSearchParams): ClientListParams {
  const search = (firstValue(raw.search) ?? '').trim().slice(0, 100);

  const page = Math.max(1, parseInt(firstValue(raw.page) ?? '1', 10) || 1);

  const requestedLimit = parseInt(
    firstValue(raw.limit) ?? String(CLIENT_PAGE_SIZE_DEFAULT),
    10
  );
  const limit = (CLIENT_PAGE_SIZES as readonly number[]).includes(requestedLimit)
    ? (requestedLimit as ClientPageSize)
    : CLIENT_PAGE_SIZE_DEFAULT;

  const status = firstValue(raw.status);
  const type = firstValue(raw.type);
  const source = firstValue(raw.source);
  const portalAccess = firstValue(raw.portalAccess);
  const sort = firstValue(raw.sort);
  const assignedTo = (firstValue(raw.assignedTo) ?? '').trim();
  const createdFrom = (firstValue(raw.createdFrom) ?? '').trim();
  const createdTo = (firstValue(raw.createdTo) ?? '').trim();

  return {
    search,
    status: isOneOf(status, Object.values(CLIENT_STATUSES)) ? status : '',
    type: isOneOf(type, Object.values(CLIENT_TYPES)) ? type : '',
    source: isOneOf(source, Object.values(CLIENT_SOURCES)) ? source : '',
    portalAccess: portalAccess === PORTAL_FILTER_ENABLED || portalAccess === PORTAL_FILTER_DISABLED
      ? portalAccess
      : '',
    assignedTo: OBJECT_ID_PATTERN.test(assignedTo) ? assignedTo : '',
    createdFrom: DATE_INPUT_PATTERN.test(createdFrom) ? createdFrom : '',
    createdTo: DATE_INPUT_PATTERN.test(createdTo) ? createdTo : '',
    sort: isOneOf(sort, Object.values(CLIENT_SORTS)) ? sort : CLIENT_SORTS.NEWEST,
    page,
    limit,
  };
}

export interface ClientListParams {
  search: string;
  status: ClientStatus | '';
  type: ClientType | '';
  source: ClientSource | '';
  portalAccess: typeof PORTAL_FILTER_ENABLED | typeof PORTAL_FILTER_DISABLED | '';
  assignedTo: string;
  createdFrom: string;
  createdTo: string;
  sort: ClientSort;
  page: number;
  limit: ClientPageSize;
}

export function hasClientFilters(params: ClientListParams): boolean {
  return Boolean(
    params.search ||
      params.status ||
      params.type ||
      params.source ||
      params.portalAccess ||
      params.assignedTo ||
      params.createdFrom ||
      params.createdTo
  );
}

function scopeFilter(scope: ClientScope): Record<string, unknown> {
  switch (scope.kind) {
    case 'admin':
      return {};
    case 'marketing':
      return { assignedMarketingUserId: new Types.ObjectId(scope.userId) };
    case 'client':
      return { userId: new Types.ObjectId(scope.userId) };
  }
}

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
    const end = new Date(`${to}T00:00:00`);
    if (!Number.isNaN(end.getTime())) {
      end.setDate(end.getDate() + 1);
      range.$lt = end;
    }
  }
  return Object.keys(range).length > 0 ? { createdAt: range } : null;
}

export function buildClientFilter(
  params: ClientListParams,
  scope: ClientScope
): Record<string, unknown> {
  const filter: Record<string, unknown> = { ...scopeFilter(scope) };

  if (params.search) {
    const rx = toMongoRegex(params.search);
    filter.$or = [
      { clientCode: rx },
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
  if (params.type) {
    filter.type = params.type;
  }
  if (params.source) {
    filter.source = params.source;
  }
  if (params.portalAccess) {
    if (params.portalAccess === PORTAL_FILTER_ENABLED) {
      filter.userId = { $ne: null };
    } else if (params.portalAccess === PORTAL_FILTER_DISABLED) {
      filter.userId = null;
    }
  }
  if (params.assignedTo && scope.kind === 'admin') {
    filter.assignedMarketingUserId = new Types.ObjectId(params.assignedTo);
  }

  const created = createdRangeFilter(params.createdFrom, params.createdTo);
  if (created) {
    filter.createdAt = created.createdAt;
  }

  return filter;
}

function buildClientSort(
  sort: ClientSort
): Record<string, 1 | -1> {
  switch (sort) {
    case CLIENT_SORTS.OLDEST:
      return { createdAt: 1 };
    case CLIENT_SORTS.UPDATED:
      return { updatedAt: -1, createdAt: -1 };
    case CLIENT_SORTS.NAME:
      return { name: 1 };
    case CLIENT_SORTS.CODE:
      return { clientCode: 1 };
    case CLIENT_SORTS.NEWEST:
    default:
      return { createdAt: -1 };
  }
}

export interface ClientListItem {
  id: string;
  clientCode: string;
  name: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  type: ClientType;
  status: ClientStatus;
  source: ClientSource;
  hasPortalAccess: boolean;
  assignedMarketingUserId: string | null;
  assignedMarketingName: string | null;
  assignedMarketingCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RawClientRow {
  _id: Types.ObjectId;
  clientCode: string;
  name: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  type: ClientType;
  status: ClientStatus;
  source: ClientSource;
  userId: Types.ObjectId | null;
  assignedMarketingUserId: Types.ObjectId | null;
  assigneeName: string | null;
  assigneeMarketingCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FacetResult {
  rows?: RawClientRow[];
  total?: Array<{ value: number }>;
}

export async function listClients(
  params: ClientListParams,
  scope: ClientScope
): Promise<{ items: ClientListItem[]; total: number }> {
  await connectDB();

  const filter = buildClientFilter(params, scope);
  const sort = buildClientSort(params.sort);

  const pipeline: Record<string, unknown>[] = [
    { $match: filter },
    { $sort: sort },
    {
      $facet: {
        rows: [
          { $skip: (params.page - 1) * params.limit },
          { $limit: params.limit },
          {
            $lookup: {
              from: 'users',
              localField: 'assignedMarketingUserId',
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
              let: { uid: '$assignedMarketingUserId' },
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
              assigneeMarketingCode: { $arrayElemAt: ['$__assigneeProfiles.marketingCode', 0] },
            },
          },
        ],
        total: [{ $count: 'value' }],
      },
    },
  ];

  const [result] = (await Client.aggregate(
    pipeline as unknown as MongoPipelineStage[]
  ).exec()) as FacetResult[];
  const rows = result?.rows ?? [];

  const items: ClientListItem[] = rows.map((row) => ({
    id: row._id.toString(),
    clientCode: row.clientCode,
    name: row.name,
    companyName: row.companyName ?? null,
    email: row.email,
    phone: row.phone ?? null,
    type: row.type,
    status: row.status,
    source: row.source,
    hasPortalAccess: !!row.userId,
    assignedMarketingUserId: row.assignedMarketingUserId
      ? row.assignedMarketingUserId.toString()
      : null,
    assignedMarketingName: row.assigneeName ?? null,
    assignedMarketingCode: row.assigneeMarketingCode ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return { items, total: result?.total?.[0]?.value ?? 0 };
}

export interface ClientDetail {
  id: string;
  clientCode: string;
  type: ClientType;
  name: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  alternatePhone: string | null;
  website: string | null;
  billingAddress: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  shippingAddress: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  taxId: string | null;
  notes: string | null;
  status: ClientStatus;
  source: ClientSource;
  originLeadId: string | null;
  hasPortalAccess: boolean;
  portalUserId: string | null;
  portalEmail: string | null;
  portalStatus: UserStatus | null;
  portalLastLoginAt: Date | null;
  assignedMarketingUserId: string | null;
  assignedMarketingName: string | null;
  assignedMarketingCode: string | null;
  createdBy: { id: string; name: string; role: UserRole } | null;
  updatedBy: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PopulatedRef {
  _id: Types.ObjectId;
  name?: string;
  role?: UserRole;
  email?: string;
  status?: string;
  lastLoginAt?: Date;
  marketingCode?: string;
  mustChangePassword?: boolean;
}

async function loadClientDetail(
  clientId: string,
  scope: ClientScope
): Promise<ClientDetail | null> {
  if (!Types.ObjectId.isValid(clientId)) {
    return null;
  }
  await connectDB();

  const filter: Record<string, unknown> = { _id: new Types.ObjectId(clientId) };
  if (scope.kind === 'marketing') {
    filter.assignedMarketingUserId = new Types.ObjectId(scope.userId);
  } else if (scope.kind === 'client') {
    filter.userId = new Types.ObjectId(scope.userId);
  }

  const client = await Client.findOne(filter)
    .populate('assignedMarketingUserId', 'name')
    .populate('createdBy', 'name role')
    .populate('updatedBy', 'name')
    .populate('userId', 'email status lastLoginAt')
    .populate('originLeadId', 'leadCode')
    .lean()
    .exec();

  if (!client) {
    return null;
  }

  let marketingCode: string | null = null;
  if (client.assignedMarketingUserId) {
    const profile = await MarketingProfile.findOne({
      userId: client.assignedMarketingUserId,
    })
      .select('marketingCode')
      .lean();
    marketingCode = profile?.marketingCode ?? null;
  }

  const assignee = client.assignedMarketingUserId as unknown as PopulatedRef | null;
  const createdBy = client.createdBy as unknown as PopulatedRef | null;
  const updatedBy = client.updatedBy as unknown as PopulatedRef | null;
  const portalUser = client.userId as unknown as PopulatedRef | null;

  return {
    id: client._id.toString(),
    clientCode: client.clientCode,
    type: client.type,
    name: client.name,
    companyName: client.companyName ?? null,
    email: client.email,
    phone: client.phone ?? null,
    alternatePhone: client.alternatePhone ?? null,
    website: client.website ?? null,
    billingAddress: client.billingAddress
      ? {
          line1: client.billingAddress.line1 ?? null,
          line2: client.billingAddress.line2 ?? null,
          city: client.billingAddress.city ?? null,
          state: client.billingAddress.state ?? null,
          postalCode: client.billingAddress.postalCode ?? null,
          country: client.billingAddress.country ?? null,
        }
      : null,
    shippingAddress: client.shippingAddress
      ? {
          line1: client.shippingAddress.line1 ?? null,
          line2: client.shippingAddress.line2 ?? null,
          city: client.shippingAddress.city ?? null,
          state: client.shippingAddress.state ?? null,
          postalCode: client.shippingAddress.postalCode ?? null,
          country: client.shippingAddress.country ?? null,
        }
      : null,
    taxId: client.taxId ?? null,
    notes: client.notes ?? null,
    status: client.status,
    source: client.source,
    originLeadId: client.originLeadId ? client.originLeadId.toString() : null,
    hasPortalAccess: !!client.userId,
    portalUserId: portalUser?._id.toString() ?? null,
    portalEmail: portalUser?.email ?? null,
    portalStatus: (portalUser?.status as UserStatus | undefined) ?? null,
    portalLastLoginAt: portalUser?.lastLoginAt ?? null,
    assignedMarketingUserId: client.assignedMarketingUserId
      ? client.assignedMarketingUserId.toString()
      : null,
    assignedMarketingName: assignee?.name ?? null,
    assignedMarketingCode: marketingCode,
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
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

export function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  return loadClientDetail(clientId, { kind: 'admin' });
}

export function getAssignedClientDetail(
  clientId: string,
  marketingUserId: string
): Promise<ClientDetail | null> {
  return loadClientDetail(clientId, { kind: 'marketing', userId: marketingUserId });
}

export function getClientProfile(
  clientUserId: string
): Promise<ClientDetail | null> {
  return loadClientDetail(clientUserId, { kind: 'client', userId: clientUserId });
}

export interface ClientCounts {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
  portalEnabled: number;
  portalDisabled: number;
}

export async function getClientCounts(scope: ClientScope): Promise<ClientCounts> {
  await connectDB();

  const match = scopeFilter(scope);

  const [statusRows, portalRows] = await Promise.all([
    Client.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec(),
    Client.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          portalEnabled: {
            $sum: { $cond: [{ $ne: ['$userId', null] }, 1, 0] },
          },
        },
      },
    ]).exec(),
  ]);

  const counts: ClientCounts = {
    total: 0,
    active: 0,
    inactive: 0,
    blocked: 0,
    portalEnabled: 0,
    portalDisabled: 0,
  };

  for (const row of statusRows) {
    if (row && typeof row._id === 'string') {
      if (row._id === CLIENT_STATUSES.ACTIVE) counts.active = Number(row.count ?? 0);
      else if (row._id === CLIENT_STATUSES.INACTIVE) counts.inactive = Number(row.count ?? 0);
      else if (row._id === CLIENT_STATUSES.BLOCKED) counts.blocked = Number(row.count ?? 0);
    }
  }

  const portalRow = portalRows[0] as { total: number; portalEnabled: number } | undefined;
  if (portalRow) {
    counts.total = portalRow.total;
    counts.portalEnabled = portalRow.portalEnabled;
    counts.portalDisabled = portalRow.total - portalRow.portalEnabled;
  }

  return counts;
}

export async function listAssignableMarketingUsers(): Promise<
  Array<{ id: string; name: string; email: string; marketingCode: string | null }>
> {
  await connectDB();

  const users = await User.find({
    role: USER_ROLES.MARKETING,
    status: 'ACTIVE',
  })
    .select('_id name email')
    .sort({ name: 1 })
    .lean();

  if (users.length === 0) {
    return [];
  }

  const profiles = await MarketingProfile.find({
    userId: { $in: users.map((user) => user._id) },
    status: 'ACTIVE',
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

export async function findPossibleDuplicateClients(
  email: string | null,
  phone: string | null,
  companyName: string | null
): Promise<
  Array<{ id: string; clientCode: string; name: string; companyName: string | null; email: string; phone: string | null }>
> {
  const clauses: Record<string, unknown>[] = [];
  if (email) {
    clauses.push({ email });
  }
  if (phone) {
    clauses.push({ phone });
  }
  if (companyName) {
    clauses.push({ companyName });
  }
  if (clauses.length === 0) {
    return [];
  }

  await connectDB();
  const clients = await Client.find({ $or: clauses })
    .select('clientCode name companyName email phone')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return clients.map((client) => ({
    id: client._id.toString(),
    clientCode: client.clientCode,
    name: client.name,
    companyName: client.companyName ?? null,
    email: client.email,
    phone: client.phone ?? null,
  }));
}

export async function getClientByLeadId(
  leadId: string
): Promise<{ id: string; clientCode: string; name: string } | null> {
  if (!Types.ObjectId.isValid(leadId)) {
    return null;
  }
  await connectDB();

  const client = await Client.findOne({ originLeadId: new Types.ObjectId(leadId) })
    .select('clientCode name')
    .lean();

  if (!client) {
    return null;
  }

  return {
    id: client._id.toString(),
    clientCode: client.clientCode,
    name: client.name,
  };
}

export interface ClientUserStatus {
  userId: string;
  email: string;
  status: string;
  lastLoginAt: Date | null;
  mustChangePassword: boolean;
}

export async function getClientPortalUser(
  clientId: string
): Promise<ClientUserStatus | null> {
  if (!Types.ObjectId.isValid(clientId)) {
    return null;
  }
  await connectDB();

  const client = await Client.findById(clientId)
    .populate('userId', 'email status lastLoginAt mustChangePassword')
    .lean()
    .exec();

  if (!client || !client.userId) {
    return null;
  }

  const user = client.userId as PopulatedRef;
  return {
    userId: user._id.toString(),
    email: user.email ?? '',
    status: user.status ?? 'ACTIVE',
    lastLoginAt: user.lastLoginAt ?? null,
    mustChangePassword: user.mustChangePassword ?? false,
  };
}
