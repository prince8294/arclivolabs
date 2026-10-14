import 'server-only';

import { Types } from 'mongoose';
import type { PipelineStage as MongoPipelineStage } from 'mongoose';

/**
 * Local filter alias.
 *
 * Mongoose 9 no longer re-exports FilterQuery from the package root, and
 * the Part 8 modules only needed PipelineStage. A plain
 * Record<string, unknown> keeps the query builders honest without pulling
 * in a deep internal import path.
 */
type FilterQuery<T = Record<string, unknown>> = Partial<T> & Record<string, unknown>;

import { toMongoRegex } from '@/lib/utils/regex';
import connectDB from '@/lib/db/mongoose';
import {
  PROPOSAL_PAGE_SIZES,
  PROPOSAL_PAGE_SIZE_DEFAULT,
  PROPOSAL_SORTS,
  PROPOSAL_STATUSES,
  VALIDITY_FILTER_ACTIVE,
  VALIDITY_FILTER_EXPIRED,
  VALIDITY_FILTER_EXPIRING,
  type ProposalPageSize,
  type ProposalSort,
  type ProposalStatus,
} from '@/lib/constants/proposals';
import {
  MARKETING_VISIBLE_STATUSES,
  OPEN_PROPOSAL_STATUSES,
} from '@/lib/constants/proposals';
import { Client } from '@/models/Client';
import { Deal } from '@/models/Deal';
import { Lead } from '@/models/Lead';
import { Proposal } from '@/models/Proposal';
import { ProposalRequest, RevisionRequest } from '@/models/ProposalRequest';
import { ProposalVersion } from '@/models/ProposalVersion';
import { Service } from '@/models/Service';
import { User } from '@/models/User';
import { USER_ROLES } from '@/types/auth';
import type {
  ProposalCounts,
  ProposalDetail,
  ProposalListItem,
  ProposalPartyOption,
  ProposalScope,
  ProposalVersionView,
  RevisionRequestView,
  ServiceCatalogOption,
  VersionComparisonRow,
} from '@/types/proposals';

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isOneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[]
): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Derived status                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Read-time expiry.
 *
 * There is NO background job in this phase and we do not pretend there is
 * one. Instead expiry is derived from `validUntil` whenever a version is
 * read, and every server mutation that depends on "is this offer still
 * open" (acceptance, deal finalization) recomputes the same value instead
 * of trusting the stored `status`.
 */
export function isVersionExpired(
  validUntil: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!validUntil) {
    return false;
  }
  // `validUntil` is inclusive of the whole day: an offer valid until
  // 21 Oct stays open through 23:59:59 on 21 Oct.
  const end = new Date(validUntil);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < now.getTime();
}

/**
 * The status a version should be treated as RIGHT NOW.
 *
 * An issued version whose validity has lapsed reports EXPIRED even though
 * the stored status is still SENT, so every screen and every mutation
 * agrees on the answer without a scheduler.
 */
export function effectiveVersionStatus(
  storedStatus: ProposalStatus,
  validUntil: Date | null | undefined,
  now: Date = new Date()
): ProposalStatus {
  if (
    storedStatus === PROPOSAL_STATUSES.SENT &&
    isVersionExpired(validUntil, now)
  ) {
    return PROPOSAL_STATUSES.EXPIRED;
  }
  return storedStatus;
}

/* -------------------------------------------------------------------------- */
/* List parameters                                                             */
/* -------------------------------------------------------------------------- */

export interface ProposalListParams {
  search: string;
  status: ProposalStatus | '';
  /** '' | VALIDITY_FILTER_* | `YYYY-MM-DD` upper bound on validUntil. */
  validity: string;
  assignedTo: string;
  service: string;
  currency: string;
  createdFrom: string;
  createdTo: string;
  sort: ProposalSort;
  page: number;
  limit: ProposalPageSize;
}

/**
 * Parse whitelisted query state.
 *
 * Unknown values are dropped rather than passed through, so a hand-edited
 * URL can never smuggle a field name or operator into a MongoDB query.
 */
export function parseProposalListParams(raw: RawSearchParams): ProposalListParams {
  const search = (firstValue(raw.search) ?? '').trim().slice(0, 100);

  const page = Math.max(1, parseInt(firstValue(raw.page) ?? '1', 10) || 1);

  const requestedLimit = parseInt(
    firstValue(raw.limit) ?? String(PROPOSAL_PAGE_SIZE_DEFAULT),
    10
  );
  const limit = (PROPOSAL_PAGE_SIZES as readonly number[]).includes(requestedLimit)
    ? (requestedLimit as ProposalPageSize)
    : PROPOSAL_PAGE_SIZE_DEFAULT;

  const status = firstValue(raw.status);
  const validity = (firstValue(raw.validity) ?? '').trim();
  const sort = firstValue(raw.sort);
  const assignedTo = (firstValue(raw.assignedTo) ?? '').trim();
  const service = (firstValue(raw.service) ?? '').trim();
  const currency = (firstValue(raw.currency) ?? '').trim().toUpperCase();
  const createdFrom = (firstValue(raw.createdFrom) ?? '').trim();
  const createdTo = (firstValue(raw.createdTo) ?? '').trim();

  const validityFilter =
    validity === VALIDITY_FILTER_ACTIVE ||
    validity === VALIDITY_FILTER_EXPIRED ||
    validity === VALIDITY_FILTER_EXPIRING ||
    DATE_INPUT_PATTERN.test(validity)
      ? validity
      : '';

  return {
    search,
    status: isOneOf(status, Object.values(PROPOSAL_STATUSES)) ? status : '',
    validity: validityFilter,
    assignedTo: OBJECT_ID_PATTERN.test(assignedTo) ? assignedTo : '',
    service: OBJECT_ID_PATTERN.test(service) ? service : '',
    currency: /^[A-Z]{3}$/.test(currency) ? currency : '',
    createdFrom: DATE_INPUT_PATTERN.test(createdFrom) ? createdFrom : '',
    createdTo: DATE_INPUT_PATTERN.test(createdTo) ? createdTo : '',
    sort: isOneOf(sort, Object.values(PROPOSAL_SORTS)) ? sort : PROPOSAL_SORTS.NEWEST,
    page,
    limit,
  };
}

export function hasProposalFilters(params: ProposalListParams): boolean {
  return Boolean(
    params.search ||
      params.status ||
      params.validity ||
      params.assignedTo ||
      params.service ||
      params.currency ||
      params.createdFrom ||
      params.createdTo
  );
}

/**
 * Scope filter.
 *
 * Marketing never sees the whole table: their filter is pinned to
 * proposals whose `assignedMarketingUserId` is their own id. Client users
 * are pinned to proposals linked to their own Client record AND must be an
 * issued version - drafts are excluded at the query level, not just hidden
 * in the UI.
 */
function scopeFilter(scope: ProposalScope): FilterQuery<Record<string, unknown>> {
  switch (scope.kind) {
    case 'admin':
      return {};
    case 'marketing':
      return { assignedMarketingUserId: new Types.ObjectId(scope.userId) };
    case 'client':
      // Client scoping happens in `clientVisibleFilter` below because it
      // depends on the linked Client id; this branch is filled in there.
      return {};
  }
}

/** Resolve the Client id behind a logged-in CLIENT user. */
export async function resolveClientIdForUser(userId: string): Promise<Types.ObjectId | null> {
  await connectDB();
  const client = await Client.findOne({ userId: new Types.ObjectId(userId) })
    .select('_id')
    .lean()
    .exec();
  return client ? (client._id as Types.ObjectId) : null;
}

async function clientVisibleFilter(
  userId: string
): Promise<FilterQuery<Record<string, unknown>>> {
  const clientId = await resolveClientIdForUser(userId);
  if (!clientId) {
    // Fail closed: a client user with no Client record sees nothing.
    return { _id: new Types.ObjectId('000000000000000000000000') };
  }
  return {
    clientId,
    // Only issued versions (SENT / ACCEPTED / REJECTED / EXPIRED) may ever
    // reach a client surface. DRAFT and PENDING_APPROVAL are excluded here.
    status: {
      $in: [
        PROPOSAL_STATUSES.SENT,
        PROPOSAL_STATUSES.ACCEPTED,
        PROPOSAL_STATUSES.REJECTED,
        PROPOSAL_STATUSES.EXPIRED,
      ],
    },
  };
}

export async function buildProposalFilter(
  params: ProposalListParams,
  scope: ProposalScope
): Promise<FilterQuery<Record<string, unknown>>> {
  const filter: FilterQuery<Record<string, unknown>> =
    scope.kind === 'client'
      ? await clientVisibleFilter(scope.userId)
      : scopeFilter(scope);

  if (scope.kind === 'marketing') {
    // A marketing request is not a quotation: drafts stay internal, so the
    // list only returns versions that reached at least internal approval.
    filter.status = { $in: [...MARKETING_VISIBLE_STATUSES] };
  }

  if (params.search) {
    const rx = toMongoRegex(params.search);
    filter.$or = [
      { proposalCode: rx },
      { title: rx },
      { description: rx },
      { leadId: rx },
      { clientId: rx },
    ];
  }
  // Status is applied to the derived `reportedStatus` after the current
  // version lookup in `listProposals`. Applying it here would both mishandle
  // read-time expiry and overwrite the mandatory Marketing/Client status
  // scope with a hand-edited query string.
  if (params.currency) {
    filter.currency = params.currency;
  }
  // Only Admin may widen/narrow by assignee. Marketing ownership is pinned
  // by `scopeFilter` and must never be overwritten by URL input.
  if (params.assignedTo && scope.kind === 'admin') {
    filter.assignedMarketingUserId = new Types.ObjectId(params.assignedTo);
  }
  if (params.service) {
    filter.serviceCategories = new Types.ObjectId(params.service);
  }
  if (params.createdFrom || params.createdTo) {
    const range: Record<string, Date> = {};
    if (params.createdFrom) {
      range.$gte = new Date(`${params.createdFrom}T00:00:00`);
    }
    if (params.createdTo) {
      const end = new Date(`${params.createdTo}T00:00:00`);
      end.setDate(end.getDate() + 1);
      range.$lt = end;
    }
    filter.createdAt = range;
  }
  if (params.validity) {
    const now = new Date();
    if (params.validity === VALIDITY_FILTER_EXPIRED) {
      filter.validUntil = { $ne: null, $lt: now };
    } else if (params.validity === VALIDITY_FILTER_EXPIRING) {
      const soon = new Date(now);
      soon.setDate(soon.getDate() + 7);
      filter.validUntil = { $ne: null, $gte: now, $lte: soon };
    } else if (params.validity === VALIDITY_FILTER_ACTIVE) {
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      filter.validUntil = { $ne: null, $gte: todayEnd };
    } else {
      // Explicit upper bound: offers still valid on that date.
      const upper = new Date(`${params.validity}T23:59:59.999`);
      filter.validUntil = { $ne: null, $gte: upper };
    }
  }

  return filter;
}

/** Whitelisted sort -> Mongo sort document. */
function sortDocument(sort: ProposalSort): Record<string, 1 | -1> {
  switch (sort) {
    case PROPOSAL_SORTS.OLDEST:
      return { createdAt: 1 };
    case PROPOSAL_SORTS.UPDATED:
      return { updatedAt: -1 };
    case PROPOSAL_SORTS.AMOUNT_DESC:
      return { currentVersionTotalMinor: -1, createdAt: -1 };
    case PROPOSAL_SORTS.VALID_SOONEST:
      return { validUntil: 1, createdAt: -1 };
    case PROPOSAL_SORTS.CODE:
      return { proposalCode: 1 };
    case PROPOSAL_SORTS.NEWEST:
    default:
      return { createdAt: -1 };
  }
}

/* -------------------------------------------------------------------------- */
/* Listing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * List proposals with server-side pagination.
 *
 * Uses a `$lookup` onto `ProposalVersion` for the current version's amount
 * and validity, and a single aggregation on Lead/Client/User for the
 * labels the table needs. Lean + `select` throughout so a 20-row page does
 * not pull full documents.
 */
export async function listProposals(
  params: ProposalListParams,
  scope: ProposalScope
): Promise<{ items: ProposalListItem[]; total: number }> {
  await connectDB();
  const filter = await buildProposalFilter(params, scope);
  const now = new Date();

  const pipeline: MongoPipelineStage[] = [
    { $match: filter },
    {
      $lookup: {
        from: 'proposalversions',
        let: { pid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$proposalId', '$$pid'] } } },
          { $sort: { version: -1 } },
          { $limit: 1 },
        ],
        as: 'currentVersion',
      },
    },
    {
      $addFields: {
        currentVersionTotalMinor: {
          $ifNull: [{ $first: '$currentVersion.grandTotalMinor' }, 0],
        },
        validUntil: { $first: '$currentVersion.validUntil' },
        currentVersionNumber: { $ifNull: [{ $first: '$currentVersion.version' }, 1] },
        currentVersionStatus: {
          $ifNull: [{ $first: '$currentVersion.status' }, '$status'],
        },
      },
    },
    // Reported status honours read-time expiry.
    {
      $addFields: {
        reportedStatus: {
          $cond: [
            {
              $and: [
                { $eq: ['$currentVersionStatus', PROPOSAL_STATUSES.SENT] },
                { $ne: ['$validUntil', null] },
                { $lt: ['$validUntil', now] },
              ],
            },
            PROPOSAL_STATUSES.EXPIRED,
            '$currentVersionStatus',
          ],
        },
      },
    },
  ];

  // Apply the requested status only after `reportedStatus` exists. This is
  // expiry-aware and cannot replace the role scope in the initial match.
  if (params.status) {
    pipeline.push({ $match: { reportedStatus: params.status } });
  }

  pipeline.push({ $sort: sortDocument(params.sort) });

  // Counting must omit the trailing sort stage entirely. Leaving an empty
  // object in an aggregation pipeline is invalid (`Arguments must be
  // aggregate pipeline operators`) and only surfaced once the proposal list
  // was wired to a real page.
  const countPipeline = pipeline.slice(0, -1);

  const skip = (params.page - 1) * params.limit;

  const [rows, counted] = await Promise.all([
    Proposal.aggregate([...pipeline, { $skip: skip }, { $limit: params.limit }]).exec(),
    Proposal.aggregate([...countPipeline, { $count: 'total' }]).exec(),
  ]);

  const total = (counted[0]?.total as number | undefined) ?? 0;
  if (rows.length === 0) {
    return { items: [], total };
  }

  return { items: await hydrateProposalRows(rows as ProposalRow[], scope, now), total };
}

/** Raw aggregation row shape (untyped by Mongoose on purpose). */
interface ProposalRow {
  _id: Types.ObjectId;
  proposalCode: string;
  title: string;
  status: ProposalStatus;
  currency: string;
  currentVersionNumber: number;
  currentVersionStatus: ProposalStatus;
  reportedStatus: ProposalStatus;
  currentVersionTotalMinor: number;
  validUntil: Date | null;
  leadId: Types.ObjectId | null;
  clientId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  assignedMarketingUserId: Types.ObjectId | null;
  serviceCategories: Types.ObjectId[];
  createdBy: Types.ObjectId | null;
}

/** Attach lead/client/user/service labels and deal linkage to raw rows. */
async function hydrateProposalRows(
  rows: ProposalRow[],
  scope: ProposalScope,
  now: Date
): Promise<ProposalListItem[]> {
  const leadIds = uniqueIds(rows.map((row) => row.leadId));
  const clientIds = uniqueIds(rows.map((row) => row.clientId));
  const userIds = uniqueIds(rows.map((row) => row.createdBy));
  userIds.push(...uniqueIds(rows.map((row) => row.assignedMarketingUserId)));
  const serviceIds = uniqueIds(rows.flatMap((row) => row.serviceCategories ?? []));

  const [leads, clients, users, services, deals, revisions] = await Promise.all([
    leadIds.length
      ? Lead.find({ _id: { $in: leadIds } })
          .select('leadCode name companyName status assignedTo')
          .lean()
          .exec()
      : Promise.resolve([]),
    clientIds.length
      ? Client.find({ _id: { $in: clientIds } })
          .select('clientCode name companyName')
          .lean()
          .exec()
      : Promise.resolve([]),
    userIds.length
      ? User.find({ _id: { $in: userIds } }).select('name').lean().exec()
      : Promise.resolve([]),
    serviceIds.length
      ? Service.find({ _id: { $in: serviceIds } }).select('name').lean().exec()
      : Promise.resolve([]),
    Deal.find({
      proposalId: { $in: rows.map((row) => row._id) },
    })
      .select('dealCode status proposalId')
      .lean()
      .exec(),
    RevisionRequest.aggregate([
      { $match: { proposalId: { $in: rows.map((row) => row._id) }, status: 'OPEN' } },
      { $group: { _id: '$proposalId', count: { $sum: 1 } } },
    ]).exec(),
  ]);

  const leadMap = new Map(leads.map((lead) => [lead._id.toString(), lead]));
  const clientMap = new Map(clients.map((client) => [client._id.toString(), client]));
  const userMap = new Map(users.map((user) => [user._id.toString(), user]));
  const serviceMap = new Map(services.map((service) => [service._id.toString(), service]));
  const dealMap = new Map(
    deals.map((deal) => [deal.proposalId.toString(), deal] as const)
  );
  const revisionMap = new Map(
    revisions.map((row) => [row._id.toString(), row.count as number] as const)
  );

  return rows.map((row) => {
    const lead = row.leadId ? leadMap.get(row.leadId.toString()) : undefined;
    const client = row.clientId ? clientMap.get(row.clientId.toString()) : undefined;
    const deal = dealMap.get(row._id.toString());
    const status = row.reportedStatus ?? row.status;
    const isCommercialVisible =
      scope.kind === 'admin' || MARKETING_VISIBLE_STATUSES.includes(status);
    const expired = status === PROPOSAL_STATUSES.EXPIRED;

    return {
      id: row._id.toString(),
      proposalCode: row.proposalCode,
      title: row.title,
      status,
      isCommercialVisible,
      leadId: row.leadId?.toString() ?? null,
      leadCode: lead?.leadCode ?? null,
      leadName: lead?.name ?? null,
      leadCompany: lead?.companyName ?? null,
      clientId: row.clientId?.toString() ?? null,
      clientCode: client?.clientCode ?? null,
      clientName: client?.name ?? null,
      clientCompany: client?.companyName ?? null,
      partyLabel: buildPartyLabel(
        lead?.leadCode ?? null,
        lead?.name ?? null,
        client?.clientCode ?? null,
        client?.name ?? null
      ),
      serviceNames: (row.serviceCategories ?? [])
        .map((id) => serviceMap.get(id.toString())?.name)
        .filter((name): name is string => Boolean(name)),
      currency: row.currency,
      currentVersion: row.currentVersionNumber ?? 1,
      // Marketing never sees the amount of an unapproved draft.
      grandTotalMinor:
        isCommercialVisible
          ? (row.currentVersionTotalMinor ?? 0)
          : null,
      validUntil: row.validUntil ?? null,
      createdByName: row.createdBy
        ? (userMap.get(row.createdBy.toString())?.name ?? null)
        : null,
      assignedMarketingName: row.assignedMarketingUserId
        ? (userMap.get(row.assignedMarketingUserId.toString())?.name ?? null)
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isExpired: expired,
      dealId: deal ? deal._id.toString() : null,
      dealCode: deal?.dealCode ?? null,
      openRevisionRequestCount: revisionMap.get(row._id.toString()) ?? 0,
    };
  });
}

function buildPartyLabel(
  leadCode: string | null,
  leadName: string | null,
  clientCode: string | null,
  clientName: string | null
): string {
  if (leadCode) {
    return `${leadCode} — ${leadName ?? 'Lead'}`;
  }
  if (clientCode) {
    return `${clientCode} — ${clientName ?? 'Client'}`;
  }
  return '—';
}

function uniqueIds(values: Array<Types.ObjectId | null | undefined>): Types.ObjectId[] {
  const seen = new Set<string>();
  const out: Types.ObjectId[] = [];
  for (const value of values) {
    if (value) {
      const key = value.toString();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(value);
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Counts                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Real proposal statistics for the admin dashboard.
 *
 * "Estimated Pipeline Value" is grouped BY CURRENCY and only counts OPEN
 * statuses. A DRAFT is an opportunity, not revenue, and no figure here is
 * ever presented as received money.
 */
export async function getProposalCounts(scope: ProposalScope): Promise<ProposalCounts> {
  await connectDB();
  const filter = await buildProposalFilter(
    {
      search: '',
      status: '',
      validity: '',
      assignedTo: '',
      service: '',
      currency: '',
      createdFrom: '',
      createdTo: '',
      sort: PROPOSAL_SORTS.NEWEST,
      page: 1,
      limit: PROPOSAL_PAGE_SIZE_DEFAULT,
    },
    scope
  );

  const [statusRows, valueRows] = await Promise.all([
    Proposal.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
    Proposal.aggregate([
      {
        $lookup: {
          from: 'proposalversions',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$proposalId', '$$pid'] } } },
            { $sort: { version: -1 } },
            { $limit: 1 },
          ],
          as: 'currentVersion',
        },
      },
      {
        $match: {
          ...filter,
          status: { $in: [...OPEN_PROPOSAL_STATUSES] },
        },
      },
      {
        $group: {
          _id: {
            currency: '$currency',
            status: { $first: { $first: '$currentVersion.status' } },
          },
          totalMinor: { $sum: { $first: '$currentVersion.grandTotalMinor' } },
          count: { $sum: 1 },
        },
      },
    ]).exec(),
  ]);

  const byStatus = {} as Record<ProposalStatus, number>;
  for (const status of Object.values(PROPOSAL_STATUSES)) {
    byStatus[status] = 0;
  }
  for (const row of statusRows as Array<{ _id: ProposalStatus; count: number }>) {
    if (row._id in byStatus) {
      byStatus[row._id] = row.count;
    }
  }

  const byCurrency = new Map<string, { currency: string; totalMinor: number; count: number }>();
  for (const row of valueRows as Array<{
    _id: { currency: string };
    totalMinor: number;
    count: number;
  }>) {
    const currency = row._id.currency;
    const existing = byCurrency.get(currency) ?? { currency, totalMinor: 0, count: 0 };
    existing.totalMinor += row.totalMinor ?? 0;
    existing.count += row.count ?? 0;
    byCurrency.set(currency, existing);
  }

  const total = Object.values(byStatus).reduce((sum, value) => sum + value, 0);

  return {
    total,
    byStatus,
    pipelineValueByCurrency: [...byCurrency.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency)
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                      */
/* -------------------------------------------------------------------------- */

/** Serialize a version document for a client component. */
function toVersionView(
  version: Record<string, unknown> & { _id: Types.ObjectId },
  approverName: string | null,
  creatorName: string | null,
  now: Date
): ProposalVersionView {
  const validUntil = (version.validUntil as Date | null) ?? null;
  const storedStatus = version.status as ProposalStatus;
  const status = effectiveVersionStatus(storedStatus, validUntil, now);

  return {
    id: version._id.toString(),
    proposalId: (version.proposalId as Types.ObjectId).toString(),
    version: version.version as number,
    status,
    title: version.title as string,
    description: (version.description as string | null) ?? null,
    overview: (version.overview as string | null) ?? null,
    scope: {
      summary: (version.scope as { summary?: string | null })?.summary ?? null,
      includedFeatures: ((version.scope as { includedFeatures?: string[] })?.includedFeatures ?? []),
      excludedFeatures: ((version.scope as { excludedFeatures?: string[] })?.excludedFeatures ?? []),
      dependencies: ((version.scope as { dependencies?: string[] })?.dependencies ?? []),
      customerResponsibilities:
        ((version.scope as { customerResponsibilities?: string[] })?.customerResponsibilities ?? []),
    },
    deliverables: (version.deliverables as string[]) ?? [],
    currency: version.currency as string,
    lineItems: (
      (version.lineItems as Array<Record<string, unknown>>) ?? []
    ).map((item) => ({
      serviceId: item.serviceId ? (item.serviceId as Types.ObjectId).toString() : null,
      serviceName: item.serviceName as string,
      description: (item.description as string | null) ?? null,
      quantity: item.quantity as number,
      unit: item.unit as string,
      unitPriceMinor: item.unitPriceMinor as number,
      discountType: item.discountType as ProposalVersionView['lineItems'][number]['discountType'],
      discountValueMinor: item.discountValueMinor as number,
      discountMinor: item.discountMinor as number,
      netMinor: item.netMinor as number,
      taxRatePercent: (item.taxRatePercent as number | null) ?? null,
      taxMinor: item.taxRatePercent == null ? 0 : (item.taxMinor as number),
      lineTotalMinor: item.lineTotalMinor as number,
    })),
    subtotalMinor: version.subtotalMinor as number,
    lineDiscountTotalMinor: (version.lineDiscountTotalMinor as number) ?? 0,
    proposalDiscount: {
      type: (version.proposalDiscount as { type: ProposalVersionView['proposalDiscount']['type'] }).type,
      valueMinor: (version.proposalDiscount as { valueMinor: number }).valueMinor ?? 0,
      amountMinor: (version.proposalDiscount as { amountMinor: number }).amountMinor ?? 0,
    },
    lineTaxTotalMinor: (version.lineTaxTotalMinor as number) ?? 0,
    proposalTax: {
      enabled: Boolean((version.proposalTax as { enabled?: boolean })?.enabled),
      ratePercent: (version.proposalTax as { ratePercent?: number | null })?.ratePercent ?? null,
      label: (version.proposalTax as { label?: string | null })?.label ?? null,
      amountMinor: (version.proposalTax as { amountMinor?: number })?.amountMinor ?? 0,
    },
    taxableBaseMinor: (version.taxableBaseMinor as number) ?? 0,
    taxMinor: (version.taxMinor as number) ?? 0,
    grandTotalMinor: version.grandTotalMinor as number,
    paymentMilestones: (
      (version.paymentMilestones as Array<Record<string, unknown>>) ?? []
    ).map((milestone) => ({
      name: milestone.name as string,
      type: milestone.type as ProposalVersionView['paymentMilestones'][number]['type'],
      valueMinor: milestone.valueMinor as number,
      amountMinor: milestone.amountMinor as number,
      condition: (milestone.condition as string | null) ?? null,
      dueDate: (milestone.dueDate as Date | null) ?? null,
      sequence: milestone.sequence as number,
    })),
    timeline: {
      estimatedDuration: (version.timeline as { estimatedDuration?: string | null })?.estimatedDuration ?? null,
      expectedStartDate: (version.timeline as { expectedStartDate?: Date | null })?.expectedStartDate ?? null,
      milestones: (
        (version.timeline as { milestones?: Array<Record<string, unknown>> })?.milestones ?? []
      ).map((milestone, index) => ({
        name: milestone.name as string,
        description: (milestone.description as string | null) ?? null,
        sequence: (milestone.sequence as number) ?? index + 1,
      })),
      deliveryConditions: (version.timeline as { deliveryConditions?: string | null })?.deliveryConditions ?? null,
      revisionAllowance: (version.timeline as { revisionAllowance?: string | null })?.revisionAllowance ?? null,
      supportPeriod: (version.timeline as { supportPeriod?: string | null })?.supportPeriod ?? null,
    },
    terms: (version.terms as Record<string, string | null>) ?? {},
    issueDate: (version.issueDate as Date | null) ?? null,
    validUntil,
    submittedForApprovalAt: (version.submittedForApprovalAt as Date | null) ?? null,
    approvedByName: approverName,
    approvedAt: (version.approvedAt as Date | null) ?? null,
    issuedAt: (version.issuedAt as Date | null) ?? null,
    sentAt: (version.sentAt as Date | null) ?? null,
    delivery: (version.delivery as ProposalVersionView['delivery']) ?? null,
    cancelledAt: (version.cancelledAt as Date | null) ?? null,
    cancellationReason: (version.cancellationReason as string | null) ?? null,
    supersededAt: (version.supersededAt as Date | null) ?? null,
    supersededByVersion: (version.supersededByVersion as number | null) ?? null,
    acceptance: (version.acceptance as ProposalVersionView['acceptance']) ?? null,
    rejection: (version.rejection as ProposalVersionView['rejection']) ?? null,
    changeSummary: (version.changeSummary as string | null) ?? null,
    createdByName: creatorName,
    createdAt: version.createdAt as Date,
    updatedAt: version.updatedAt as Date,
    isExpired: status === PROPOSAL_STATUSES.EXPIRED,
    // Editing is only allowed while the version is an unlocked draft.
    isLocked: Boolean(version.commercialLockedAt) || storedStatus !== PROPOSAL_STATUSES.DRAFT,
  };
}

/**
 * Load one proposal with full version history.
 *
 * `scope` is enforced here, not in the page: an out-of-scope proposal
 * returns `null`, which the page turns into `notFound()`. That prevents
 * record enumeration across roles.
 */
export async function getProposalDetail(
  proposalId: string,
  scope: ProposalScope
): Promise<ProposalDetail | null> {
  await connectDB();
  if (!OBJECT_ID_PATTERN.test(proposalId)) {
    return null;
  }
  const now = new Date();

  const proposal = await Proposal.findById(proposalId)
    .populate('createdBy', 'name')
    .populate('assignedMarketingUserId', 'name')
    .populate('serviceCategories', 'name')
    .lean()
    .exec();

  if (!proposal) {
    return null;
  }

  if (
    scope.kind === 'marketing' &&
    proposal.assignedMarketingUserId?.toString() !== scope.userId
  ) {
    return null;
  }
  if (scope.kind === 'client') {
    const clientId = await resolveClientIdForUser(scope.userId);
    if (
      !clientId ||
      proposal.clientId?.toString() !== clientId.toString()
    ) {
      return null;
    }
  }

  const versions = await ProposalVersion.find({ proposalId: proposal._id })
    .sort({ version: -1 })
    .lean()
    .exec();

  // A client must never receive a draft or internal version.
  const visibleVersions =
    scope.kind === 'client'
      ? versions.filter((version) =>
          [
            PROPOSAL_STATUSES.SENT,
            PROPOSAL_STATUSES.ACCEPTED,
            PROPOSAL_STATUSES.REJECTED,
            PROPOSAL_STATUSES.EXPIRED,
          ].includes(version.status as typeof PROPOSAL_STATUSES.SENT | typeof PROPOSAL_STATUSES.ACCEPTED | typeof PROPOSAL_STATUSES.REJECTED | typeof PROPOSAL_STATUSES.EXPIRED)
        )
      : versions;

  const userIds = uniqueIds([
    ...versions.map((version) => version.approvedBy),
    ...versions.map((version) => version.createdBy),
  ]);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('name').lean().exec()
    : [];
  const userNames = new Map(users.map((user) => [user._id.toString(), user.name as string]));

  const versionViews = visibleVersions.map((version) =>
    toVersionView(
      version as unknown as Record<string, unknown> & { _id: Types.ObjectId },
      version.approvedBy
        ? (userNames.get(version.approvedBy.toString()) ?? null)
        : null,
      userNames.get(version.createdBy.toString()) ?? null,
      now
    )
  );

  const lead = proposal.leadId
    ? await Lead.findById(proposal.leadId).select('leadCode name companyName status').lean().exec()
    : null;
  const client = proposal.clientId
    ? await Client.findById(proposal.clientId)
        .select('clientCode name companyName email phone billingAddress')
        .lean()
        .exec()
    : null;

  const [deal, sourceRequest, revisions] = await Promise.all([
    Deal.findOne({ proposalId: proposal._id }).select('dealCode status _id').lean().exec(),
    proposal.sourceRequestId
      ? await ProposalRequest.findById(proposal.sourceRequestId)
          .populate('requestedBy', 'name')
          .select('requestCode requestedBy')
          .lean()
          .exec()
      : null,
    scope.kind === 'client'
      ? Promise.resolve([])
      : RevisionRequest.find({ proposalId: proposal._id })
          .sort({ createdAt: -1 })
          .populate('requestedBy', 'name')
          .lean()
          .exec(),
  ]);

  const revisionAuthorIds = uniqueIds(revisions.map((item) => item.requestedBy));
  const revisionAuthors = revisionAuthorIds.length
    ? await User.find({ _id: { $in: revisionAuthorIds } }).select('name').lean().exec()
    : [];
  const revisionAuthorNames = new Map(
    revisionAuthors.map((user) => [user._id.toString(), user.name as string])
  );

  const revisionViews: RevisionRequestView[] = revisions.map((item) => ({
    id: item._id.toString(),
    proposalId: item.proposalId.toString(),
    againstVersion: item.againstVersion,
    requestedChanges: item.requestedChanges ?? null,
    reason: item.reason ?? null,
    customerFeedback: item.customerFeedback ?? null,
    requestedBudgetMinor: item.requestedBudgetMinor ?? null,
    currency: item.currency,
    status: item.status,
    adminResponse: item.adminResponse ?? null,
    resolvedVersion: item.resolvedVersion ?? null,
    requestedByName: revisionAuthorNames.get(item.requestedBy.toString()) ?? null,
    createdAt: item.createdAt,
  }));

  const currentVersionView =
    versionViews.find((view) => view.version === proposal.currentVersion) ??
    versionViews[0] ??
    null;

  const address = client?.billingAddress as
    | { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null }
    | null
    | undefined;

  return {
    id: proposal._id.toString(),
    proposalCode: proposal.proposalCode,
    title: proposal.title,
    description: proposal.description ?? null,
    status: effectiveVersionStatus(
      (currentVersionView?.status ?? proposal.status) as ProposalStatus,
      currentVersionView?.validUntil ?? null,
      now
    ),
    currency: proposal.currency,
    currentVersion: proposal.currentVersion,
    leadId: proposal.leadId?.toString() ?? null,
    leadCode: lead?.leadCode ?? null,
    leadName: lead?.name ?? null,
    leadCompany: lead?.companyName ?? null,
    leadStatus: lead?.status ?? null,
    clientId: proposal.clientId?.toString() ?? null,
    clientCode: client?.clientCode ?? null,
    clientName: client?.name ?? null,
    clientCompany: client?.companyName ?? null,
    clientEmail: client?.email ?? null,
    clientPhone: client?.phone ?? null,
    clientAddress: address
      ? [
          address.line1,
          address.line2,
          address.city,
          address.state,
          address.postalCode,
          address.country,
        ]
          .filter(Boolean)
          .join(', ') || null
      : null,
    serviceNames: (
      (proposal.serviceCategories as Array<{ name?: string }> | undefined) ?? []
    )
      .map((service) => service?.name)
      .filter((name): name is string => Boolean(name)),
    serviceCategoryIds: (proposal.serviceCategories ?? []).map((id) => id.toString()),
    createdByName: (proposal.createdBy as { name?: string } | null)?.name ?? null,
    assignedMarketingName:
      (proposal.assignedMarketingUserId as { name?: string } | null)?.name ?? null,
    assignedMarketingUserId: proposal.assignedMarketingUserId?.toString() ?? null,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    canViewInternal: scope.kind === 'admin',
    currentVersionDetail: currentVersionView,
    versions: versionViews,
    revisionRequests: revisionViews,
    deal: deal
      ? { id: deal._id.toString(), dealCode: deal.dealCode, status: deal.status }
      : null,
    sourceRequest: sourceRequest
      ? {
          id: sourceRequest._id.toString(),
          requestCode: sourceRequest.requestCode,
          requestedByName:
            (sourceRequest.requestedBy as { name?: string } | null)?.name ?? null,
        }
      : null,
  };
}

/** Fetch one version by id, with the same scope checks applied by the caller. */
export async function getProposalVersionById(
  versionId: string
): Promise<(Record<string, unknown> & { _id: Types.ObjectId }) | null> {
  await connectDB();
  if (!OBJECT_ID_PATTERN.test(versionId)) {
    return null;
  }
  const version = await ProposalVersion.findById(versionId).lean().exec();
  return version as unknown as (Record<string, unknown> & { _id: Types.ObjectId }) | null;
}

/** All versions of a proposal, newest first (for the versions screen). */
export async function listProposalVersions(
  proposalId: string
): Promise<Array<Record<string, unknown> & { _id: Types.ObjectId }>> {
  await connectDB();
  return (await ProposalVersion.find({ proposalId: new Types.ObjectId(proposalId) })
    .sort({ version: -1 })
    .lean()
    .exec()) as unknown as Array<Record<string, unknown> & { _id: Types.ObjectId }>;
}

/* -------------------------------------------------------------------------- */
/* Version comparison                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Structured version comparison.
 *
 * Deliberately not a document diff engine: it highlights the four things a
 * negotiation actually turns on - the amount, the deliverables, the
 * timeline and the payment plan - against the previous version.
 */
export async function getVersionComparison(
  proposalId: string
): Promise<VersionComparisonRow[]> {
  await connectDB();
  if (!OBJECT_ID_PATTERN.test(proposalId)) {
    return [];
  }

  const versions = (await ProposalVersion.find({
    proposalId: new Types.ObjectId(proposalId),
  })
    .sort({ version: 1 })
    .lean()
    .exec()) as unknown as Array<Record<string, unknown> & { _id: Types.ObjectId }>;

  if (versions.length === 0) {
    return [];
  }

  const userIds = uniqueIds([
    ...versions.map((version) => version.approvedBy as Types.ObjectId | undefined),
    ...versions.map((version) => version.createdBy as Types.ObjectId | undefined),
  ]);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('name').lean().exec()
    : [];
  const names = new Map(users.map((user) => [user._id.toString(), user.name as string]));
  const now = new Date();

  return versions
    .map((version, index) => {
      const previous = index > 0 ? versions[index - 1] : null;
      const status = effectiveVersionStatus(
        version.status as ProposalStatus,
        (version.validUntil as Date | null) ?? null,
        now
      );

      const sameList = (a: unknown, b: unknown) =>
        JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

      const currentDeliverables = (version.deliverables as string[]) ?? [];
      const currentTimeline = (version.timeline as Record<string, unknown>) ?? {};
      const currentPayment = (version.paymentMilestones as unknown[]) ?? [];
      const currentScope = (version.scope as Record<string, unknown>) ?? {};

      return {
        version: version.version as number,
        status,
        grandTotalMinor: version.grandTotalMinor as number,
        currency: version.currency as string,
        issuedAt: (version.issuedAt as Date | null) ?? null,
        validUntil: (version.validUntil as Date | null) ?? null,
        createdByName:
          names.get((version.createdBy as Types.ObjectId).toString()) ?? null,
        approvedByName: version.approvedBy
          ? (names.get((version.approvedBy as Types.ObjectId).toString()) ?? null)
          : null,
        changeSummary: (version.changeSummary as string | null) ?? null,
        changes: {
          amountFromMinor: previous ? (previous.grandTotalMinor as number) : null,
          amountToMinor: version.grandTotalMinor as number,
          deliverablesChanged: previous
            ? !sameList(previous.deliverables, currentDeliverables)
            : false,
          timelineChanged: previous
            ? !sameList(
                (previous.timeline as { milestones?: unknown })?.milestones,
                currentTimeline.milestones
              ) ||
              (previous.timeline as { estimatedDuration?: string })?.estimatedDuration !==
                (currentTimeline.estimatedDuration as string | undefined)
            : false,
          paymentTermsChanged: previous
            ? !sameList(previous.paymentMilestones, currentPayment)
            : false,
          scopeChanged: previous
            ? !sameList((previous.scope as { includedFeatures?: unknown[] } | undefined)?.includedFeatures, currentScope.includedFeatures) ||
              !sameList((previous.scope as { excludedFeatures?: unknown[] } | undefined)?.excludedFeatures, currentScope.excludedFeatures)
            : false,
        },
      } satisfies VersionComparisonRow;
    })
    .reverse();
}

/* -------------------------------------------------------------------------- */
/* Select options                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Leads and Clients an admin may start a proposal for.
 *
 * Both are returned as options against ONE list so the form can search a
 * single control; the action still enforces "exactly one of leadId /
 * clientId" and that both really exist.
 */
export async function listProposalPartyOptions(params?: {
  search?: string;
  limit?: number;
  /** Restrict to a subset, used by the marketing portal. */
  assignedToUserId?: string;
}): Promise<ProposalPartyOption[]> {
  await connectDB();
  const search = (params?.search ?? '').trim().slice(0, 100);
  const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
  const rx = search ? toMongoRegex(search) : null;

  const leadFilter: FilterQuery<Record<string, unknown>> = {};
  if (params?.assignedToUserId) {
    leadFilter.assignedTo = new Types.ObjectId(params.assignedToUserId);
  }
  if (rx) {
    leadFilter.$or = [{ leadCode: rx }, { name: rx }, { companyName: rx }];
  }

  const clientFilter: FilterQuery<Record<string, unknown>> = {};
  if (params?.assignedToUserId) {
    clientFilter.assignedMarketingUserId = new Types.ObjectId(params.assignedToUserId);
  }
  if (rx) {
    clientFilter.$or = [{ clientCode: rx }, { name: rx }, { companyName: rx }];
  }

  const [leads, clients] = await Promise.all([
    Lead.find(leadFilter)
      .select('leadCode name companyName status assignedTo')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('assignedTo', 'name')
      .lean()
      .exec(),
    Client.find(clientFilter)
      .select('clientCode name companyName')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
      .exec(),
  ]);

  return [
    ...leads.map((lead) => ({
      kind: 'lead' as const,
      id: lead._id.toString(),
      code: lead.leadCode,
      name: lead.name,
      company: lead.companyName ?? null,
      extra: (lead.assignedTo as { name?: string } | null)?.name
        ? `Assigned: ${(lead.assignedTo as { name?: string }).name}`
        : 'Unassigned lead',
    })),
    ...clients.map((client) => ({
      kind: 'client' as const,
      id: client._id.toString(),
      code: client.clientCode,
      name: client.name,
      company: client.companyName ?? null,
      extra: 'Existing client',
    })),
  ];
}

/** Active service catalogue options (names only - never catalogue prices). */
export async function listServiceCatalogOptions(): Promise<ServiceCatalogOption[]> {
  await connectDB();
  const services = await Service.find({ isActive: true })
    .select('serviceCode name description')
    .sort({ sortOrder: 1, name: 1 })
    .lean()
    .exec();
  return services.map((service) => ({
    id: service._id.toString(),
    code: service.serviceCode,
    name: service.name,
    description: service.description ?? null,
  }));
}

/** Marketing users assignable to a proposal (admin only). */
export async function listProposalMarketingUsers(): Promise<
  Array<{ id: string; name: string; marketingCode: string | null }>
> {
  await connectDB();
  const users = await User.find({ role: USER_ROLES.MARKETING, status: 'ACTIVE' })
    .select('name')
    .sort({ name: 1 })
    .lean()
    .exec();
  const ids = users.map((user) => user._id);
  const profiles = ids.length
    ? await (await import('@/models/MarketingProfile')).MarketingProfile.find({
        userId: { $in: ids },
      })
        .select('userId marketingCode')
        .lean()
        .exec()
    : [];
  const codeMap = new Map(
    profiles.map((profile) => [
      (profile.userId as Types.ObjectId).toString(),
      profile.marketingCode as string,
    ])
  );
  return users.map((user) => ({
    id: user._id.toString(),
    name: user.name,
    marketingCode: codeMap.get(user._id.toString()) ?? null,
  }));
}

/* -------------------------------------------------------------------------- */
/* Deal queries                                                                */
/* -------------------------------------------------------------------------- */

export interface DealListParams {
  search: string;
  status: string;
  sort: string;
  page: number;
  limit: number;
}

export async function listDeals(
  params: DealListParams
): Promise<{ items: import('@/types/proposals').DealListItem[]; total: number }> {
  await connectDB();

  const filter: FilterQuery<Record<string, unknown>> = {};
  if (params.status) {
    filter.status = params.status;
  }
  if (params.search) {
    const rx = toMongoRegex(params.search);
    filter.$or = [{ dealCode: rx }, { title: rx }];
  }

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    NEWEST: { createdAt: -1 },
    OLDEST: { createdAt: 1 },
    AMOUNT_DESC: { agreedAmountMinor: -1, createdAt: -1 },
    CODE: { dealCode: 1 },
  };
  const sort = sortMap[params.sort] ?? sortMap.NEWEST;

  const [rows, counted] = await Promise.all([
    Deal.find(filter)
      .sort(sort)
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean()
      .exec(),
    Deal.countDocuments(filter),
  ]);

  if (rows.length === 0) {
    return { items: [], total: counted };
  }

  const leadIds = uniqueIds(rows.map((row) => row.leadId));
  const clientIds = uniqueIds(rows.map((row) => row.clientId));

  const [leads, clients] = await Promise.all([
    leadIds.length
      ? Lead.find({ _id: { $in: leadIds } }).select('leadCode name').lean().exec()
      : Promise.resolve([]),
    clientIds.length
      ? Client.find({ _id: { $in: clientIds } })
          .select('clientCode name companyName')
          .lean()
          .exec()
      : Promise.resolve([]),
  ]);

  const leadMap = new Map(leads.map((lead) => [lead._id.toString(), lead]));
  const clientMap = new Map(clients.map((client) => [client._id.toString(), client]));

  return {
    items: rows.map((row) => {
      const lead = row.leadId ? leadMap.get(row.leadId.toString()) : undefined;
      const client = row.clientId ? clientMap.get(row.clientId.toString()) : undefined;
      return {
        id: row._id.toString(),
        dealCode: row.dealCode,
        title: row.title,
        status: row.status,
        proposalId: row.proposalId.toString(),
        proposalCode: row.commercialSnapshot?.proposalCode ?? '—',
        acceptedVersion: row.acceptedVersion,
        leadId: row.leadId?.toString() ?? null,
        leadCode: lead?.leadCode ?? null,
        clientId: row.clientId?.toString() ?? null,
        clientCode: client?.clientCode ?? null,
        clientName: client?.name ?? null,
        clientCompany: client?.companyName ?? null,
        partyLabel: buildPartyLabel(
          lead?.leadCode ?? null,
          lead?.name ?? null,
          client?.clientCode ?? null,
          client?.name ?? null
        ),
        agreedAmountMinor: row.agreedAmountMinor,
        currency: row.currency,
        finalizedAt: row.finalizedAt,
      };
    }),
    total: counted,
  };
}

export async function getDealCounts(): Promise<import('@/types/proposals').DealCounts> {
  await connectDB();
  const [statusRows, valueRows] = await Promise.all([
    Deal.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
    Deal.aggregate([
      { $match: { status: { $ne: 'CANCELLED' } } },
      {
        $group: {
          _id: '$currency',
          totalMinor: { $sum: '$agreedAmountMinor' },
          count: { $sum: 1 },
        },
      },
    ]).exec(),
  ]);

  const byStatus = {
    FINALIZED: 0,
    PENDING_CLIENT_CONVERSION: 0,
    READY_FOR_PROJECT: 0,
    CANCELLED: 0,
  } as import('@/types/proposals').DealCounts['byStatus'];

  for (const row of statusRows as Array<{ _id: keyof typeof byStatus; count: number }>) {
    if (row._id in byStatus) {
      byStatus[row._id] = row.count;
    }
  }

  return {
    total: Object.values(byStatus).reduce((sum, value) => sum + value, 0),
    byStatus,
    // Grouped by currency: there is no conversion rate in this system, so
    // INR and USD are reported side by side and never added together.
    agreedValueByCurrency: (
      valueRows as Array<{ _id: string; totalMinor: number; count: number }>
    )
      .map((row) => ({
        currency: row._id,
        totalMinor: row.totalMinor ?? 0,
        count: row.count ?? 0,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}

/** Full deal record with related lead/client labels for the detail page. */
export async function getDealDetail(
  dealId: string
): Promise<import('@/types/proposals').DealDetail | null> {
  await connectDB();
  if (!OBJECT_ID_PATTERN.test(dealId)) {
    return null;
  }

  const deal = await Deal.findById(dealId)
    .populate('finalizedBy', 'name')
    .lean()
    .exec();
  if (!deal) {
    return null;
  }

  const [lead, client, version] = await Promise.all([
    deal.leadId
      ? Lead.findById(deal.leadId).select('leadCode name status').lean().exec()
      : Promise.resolve(null),
    deal.clientId
      ? Client.findById(deal.clientId)
          .select('clientCode name companyName email')
          .lean()
          .exec()
      : Promise.resolve(null),
    ProposalVersion.findById(deal.acceptedProposalVersionId).lean().exec(),
  ]);

  const snapshot = deal.commercialSnapshot;

  return {
    id: deal._id.toString(),
    dealCode: deal.dealCode,
    title: deal.title,
    status: deal.status,
    proposalId: deal.proposalId.toString(),
    proposalCode: snapshot?.proposalCode ?? '—',
    acceptedProposalVersionId: deal.acceptedProposalVersionId.toString(),
    acceptedVersion: deal.acceptedVersion,
    leadId: deal.leadId?.toString() ?? null,
    leadCode: lead?.leadCode ?? null,
    leadName: lead?.name ?? null,
    leadStatus: lead?.status ?? null,
    clientId: deal.clientId?.toString() ?? null,
    clientCode: client?.clientCode ?? null,
    clientName: client?.name ?? null,
    clientCompany: client?.companyName ?? null,
    clientEmail: client?.email ?? null,
    agreedAmountMinor: deal.agreedAmountMinor,
    currency: deal.currency,
    paymentPlan: (deal.paymentPlanSnapshot ?? []).map((milestone) => ({
      name: milestone.name,
      type: milestone.type as 'FIXED' | 'PERCENTAGE',
      valueMinor: milestone.valueMinor,
      amountMinor: milestone.amountMinor,
      condition: milestone.condition ?? null,
      dueDate: milestone.dueDate ?? null,
      sequence: milestone.sequence,
    })),
    commercialSnapshot: {
      proposalCode: snapshot?.proposalCode ?? '—',
      overview: snapshot?.overview ?? null,
      deliverables: snapshot?.deliverables ?? [],
      includedFeatures: snapshot?.includedFeatures ?? [],
      excludedFeatures: snapshot?.excludedFeatures ?? [],
      estimatedDuration: snapshot?.estimatedDuration ?? null,
      expectedStartDate: snapshot?.expectedStartDate ?? null,
      deliveryMilestones: (snapshot?.deliveryMilestones ?? []).map((milestone) => ({
        name: milestone.name,
        description: milestone.description ?? null,
        sequence: milestone.sequence,
      })),
      validUntil: snapshot?.validUntil ?? null,
      subtotalMinor: snapshot?.subtotalMinor ?? 0,
      discountMinor: snapshot?.discountMinor ?? 0,
      taxMinor: snapshot?.taxMinor ?? 0,
      terms: (snapshot?.terms as Record<string, string | null>) ?? {},
    },
    acceptance: version?.acceptance
      ? {
          acceptedBy: version.acceptance.acceptedBy,
          acceptedAt: version.acceptance.acceptedAt,
          method: version.acceptance.method,
          evidence: version.acceptance.evidence ?? null,
          notes: version.acceptance.notes ?? null,
        }
      : null,
    acceptedAt: deal.acceptedAt ?? null,
    finalizedAt: deal.finalizedAt,
    finalizedByName: (deal.finalizedBy as { name?: string } | null)?.name ?? null,
    agreementReference: deal.agreementReference ?? null,
    notes: deal.notes ?? null,
    createdAt: deal.createdAt,
  };
}
