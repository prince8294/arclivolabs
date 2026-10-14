import 'server-only';

import { Types } from 'mongoose';

/** Local filter alias - see the note in @/lib/queries/proposals. */
type FilterQuery<T = Record<string, unknown>> = Partial<T> & Record<string, unknown>;

import { toMongoRegex } from '@/lib/utils/regex';
import connectDB from '@/lib/db/mongoose';
import {
  PROPOSAL_PAGE_SIZE_DEFAULT,
  PROPOSAL_PAGE_SIZES,
  PROPOSAL_REQUEST_STATUSES,
  REVISION_REQUEST_STATUSES,
  type ProposalPageSize,
} from '@/lib/constants/proposals';
import { Client } from '@/models/Client';
import { Lead } from '@/models/Lead';
import { Proposal } from '@/models/Proposal';
import { ProposalRequest, RevisionRequest } from '@/models/ProposalRequest';
import { Service } from '@/models/Service';
import { User } from '@/models/User';
import type {
  ProposalRequestListItem,
  RevisionRequestView,
} from '@/types/proposals';

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/* -------------------------------------------------------------------------- */
/* Quotation requests                                                          */
/* -------------------------------------------------------------------------- */

export interface ProposalRequestListParams {
  search: string;
  status: string;
  priority: string;
  /** Admin-only: restrict to one marketing user. */
  requestedBy: string;
  page: number;
  limit: ProposalPageSize;
}

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

/**
 * Parse request-list query state.
 *
 * `scope` decides whether a marketing user may even set `requestedBy`; for
 * them the ownership filter is applied unconditionally from the session, so
 * editing the URL cannot widen their view.
 */
export function parseProposalRequestListParams(
  raw: RawSearchParams,
  scope: 'admin' | 'marketing'
): ProposalRequestListParams {
  const page = Math.max(1, parseInt(firstValue(raw.page) ?? '1', 10) || 1);
  const requestedLimit = parseInt(
    firstValue(raw.limit) ?? String(PROPOSAL_PAGE_SIZE_DEFAULT),
    10
  );
  const limit = (PROPOSAL_PAGE_SIZES as readonly number[]).includes(requestedLimit)
    ? (requestedLimit as ProposalPageSize)
    : PROPOSAL_PAGE_SIZE_DEFAULT;

  const status = (firstValue(raw.status) ?? '').trim();
  const priority = (firstValue(raw.priority) ?? '').trim();
  const requestedBy = scope === 'admin' ? (firstValue(raw.requestedBy) ?? '').trim() : '';

  return {
    search: (firstValue(raw.search) ?? '').trim().slice(0, 100),
    status: Object.values(PROPOSAL_REQUEST_STATUSES).includes(status as never) ? status : '',
    priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority) ? priority : '',
    requestedBy: OBJECT_ID_PATTERN.test(requestedBy) ? requestedBy : '',
    page,
    limit,
  };
}

/**
 * List quotation requests.
 *
 * A marketing user is hard-scoped to `requestedBy = their id` inside
 * MongoDB. Their rows also exclude `adminNotes`, which is admin triage
 * data and must never be shown to the requester.
 */
export async function listProposalRequests(
  params: ProposalRequestListParams,
  scope: { kind: 'admin' } | { kind: 'marketing'; userId: string }
): Promise<{ items: ProposalRequestListItem[]; total: number }> {
  await connectDB();

  const filter: FilterQuery<Record<string, unknown>> = {};
  if (scope.kind === 'marketing') {
    filter.requestedBy = new Types.ObjectId(scope.userId);
  } else if (params.requestedBy) {
    filter.requestedBy = new Types.ObjectId(params.requestedBy);
  }
  if (params.status) {
    filter.status = params.status;
  }
  if (params.priority) {
    filter.priority = params.priority;
  }
  if (params.search) {
    const rx = toMongoRegex(params.search);
    filter.$or = [
      { requestCode: rx },
      { requirements: rx },
      { customerNotes: rx },
      { requestedServices: rx },
    ];
  }

  const [rows, total] = await Promise.all([
    ProposalRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .populate('requestedBy', 'name')
      .populate('proposalId', 'proposalCode')
      .lean()
      .exec(),
    ProposalRequest.countDocuments(filter),
  ]);

  if (rows.length === 0) {
    return { items: [], total };
  }

  const leadIds = rows.map((row) => row.leadId).filter(Boolean) as Types.ObjectId[];
  const clientIds = rows.map((row) => row.clientId).filter(Boolean) as Types.ObjectId[];

  const [leads, clients] = await Promise.all([
    leadIds.length
      ? Lead.find({ _id: { $in: leadIds } }).select('leadCode name').lean().exec()
      : Promise.resolve([]),
    clientIds.length
      ? Client.find({ _id: { $in: clientIds } }).select('clientCode name').lean().exec()
      : Promise.resolve([]),
  ]);

  const leadMap = new Map(leads.map((lead) => [lead._id.toString(), lead]));
  const clientMap = new Map(clients.map((client) => [client._id.toString(), client]));

  return {
    items: rows.map((row) => {
      const lead = row.leadId ? leadMap.get(row.leadId.toString()) : undefined;
      const client = row.clientId ? clientMap.get(row.clientId.toString()) : undefined;
      const proposal = row.proposalId as unknown as
        | { proposalCode?: string }
        | null
        | undefined;

      return {
        id: row._id.toString(),
        requestCode: row.requestCode,
        status: row.status,
        partyLabel: lead
          ? `${lead.leadCode} — ${lead.name}`
          : client
            ? `${client.clientCode} — ${client.name}`
            : '—',
        partyCode: lead?.leadCode ?? client?.clientCode ?? null,
        leadId: row.leadId?.toString() ?? null,
        clientId: row.clientId?.toString() ?? null,
        requestedServices: row.requestedServices ?? [],
        requirements: row.requirements ?? null,
        expectedBudgetMinor: row.expectedBudgetMinor ?? null,
        currency: row.currency,
        expectedTimeline: row.expectedTimeline ?? null,
        customerNotes: row.customerNotes ?? null,
        priority: row.priority,
        requestedByName: (row.requestedBy as { name?: string } | null)?.name ?? null,
        requestedById: row.requestedBy?.toString() ?? null,
        proposalId: row.proposalId?.toString() ?? null,
        proposalCode: proposal?.proposalCode ?? null,
        // Admin triage notes are never exposed to the requesting user.
        adminNotes: scope.kind === 'admin' ? (row.adminNotes ?? null) : null,
        createdAt: row.createdAt,
      };
    }),
    total,
  };
}

/** Request counts for the admin triage badge. */
export async function getProposalRequestCounts(): Promise<{
  total: number;
  open: number;
}> {
  await connectDB();
  const [total, open] = await Promise.all([
    ProposalRequest.countDocuments({}),
    ProposalRequest.countDocuments({
      status: {
        $in: [
          PROPOSAL_REQUEST_STATUSES.SUBMITTED,
          PROPOSAL_REQUEST_STATUSES.IN_REVIEW,
        ],
      },
    }),
  ]);
  return { total, open };
}

/** Load one request for the admin review screen. */
export async function getProposalRequestById(
  requestId: string
): Promise<(ProposalRequestListItem & { adminNotes: string | null }) | null> {
  await connectDB();
  if (!OBJECT_ID_PATTERN.test(requestId)) {
    return null;
  }
  const row = await ProposalRequest.findById(requestId)
    .populate('requestedBy', 'name')
    .populate('proposalId', 'proposalCode')
    .lean()
    .exec();
  if (!row) {
    return null;
  }

  const lead = row.leadId
    ? await Lead.findById(row.leadId).select('leadCode name').lean().exec()
    : null;
  const client = row.clientId
    ? await Client.findById(row.clientId).select('clientCode name').lean().exec()
    : null;
  const proposal = row.proposalId as unknown as { proposalCode?: string } | null | undefined;

  return {
    id: row._id.toString(),
    requestCode: row.requestCode,
    status: row.status,
    partyLabel: lead
      ? `${lead.leadCode} — ${lead.name}`
      : client
        ? `${client.clientCode} — ${client.name}`
        : '—',
    partyCode: lead?.leadCode ?? client?.clientCode ?? null,
    leadId: row.leadId?.toString() ?? null,
    clientId: row.clientId?.toString() ?? null,
    requestedServices: row.requestedServices ?? [],
    requirements: row.requirements ?? null,
    expectedBudgetMinor: row.expectedBudgetMinor ?? null,
    currency: row.currency,
    expectedTimeline: row.expectedTimeline ?? null,
    customerNotes: row.customerNotes ?? null,
    priority: row.priority,
    requestedByName: (row.requestedBy as { name?: string } | null)?.name ?? null,
    requestedById: row.requestedBy?.toString() ?? null,
    proposalId: row.proposalId?.toString() ?? null,
    proposalCode: proposal?.proposalCode ?? null,
    adminNotes: row.adminNotes ?? null,
    createdAt: row.createdAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Revision requests                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Open revision requests for a proposal.
 *
 * Admin sees them all (with the requester name); marketing sees only the
 * ones they raised.
 */
export async function listRevisionRequests(
  proposalId: string,
  scope: { kind: 'admin' } | { kind: 'marketing'; userId: string }
): Promise<RevisionRequestView[]> {
  await connectDB();
  if (!OBJECT_ID_PATTERN.test(proposalId)) {
    return [];
  }

  const filter: FilterQuery<Record<string, unknown>> = {
    proposalId: new Types.ObjectId(proposalId),
  };
  if (scope.kind === 'marketing') {
    filter.requestedBy = new Types.ObjectId(scope.userId);
  }

  const rows = await RevisionRequest.find(filter)
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  if (rows.length === 0) {
    return [];
  }

  const userIds = rows.map((row) => row.requestedBy);
  const users = await User.find({ _id: { $in: userIds } }).select('name').lean().exec();
  const names = new Map(users.map((user) => [user._id.toString(), user.name as string]));

  return rows.map((row) => ({
    id: row._id.toString(),
    proposalId: row.proposalId.toString(),
    againstVersion: row.againstVersion,
    requestedChanges: row.requestedChanges ?? null,
    reason: row.reason ?? null,
    customerFeedback: row.customerFeedback ?? null,
    requestedBudgetMinor: row.requestedBudgetMinor ?? null,
    currency: row.currency,
    status: row.status,
    adminResponse: scope.kind === 'admin' ? (row.adminResponse ?? null) : null,
    resolvedVersion: row.resolvedVersion ?? null,
    requestedByName: names.get(row.requestedBy.toString()) ?? null,
    createdAt: row.createdAt,
  }));
}

/** Open revision request count for the proposal table badge. */
export async function countOpenRevisionRequests(proposalId: string): Promise<number> {
  await connectDB();
  if (!OBJECT_ID_PATTERN.test(proposalId)) {
    return 0;
  }
  return RevisionRequest.countDocuments({
    proposalId: new Types.ObjectId(proposalId),
    status: REVISION_REQUEST_STATUSES.OPEN,
  });
}

/** Marketing users who may be filtered by on the request list (admin only). */
export async function listRequesterOptions(): Promise<
  Array<{ id: string; name: string }>
> {
  await connectDB();
  const rows = await ProposalRequest.distinct('requestedBy');
  const ids = rows.filter((value): value is Types.ObjectId => Boolean(value));
  if (ids.length === 0) {
    return [];
  }
  const users = await User.find({ _id: { $in: ids } })
    .select('name')
    .sort({ name: 1 })
    .lean()
    .exec();
  return users.map((user) => ({ id: user._id.toString(), name: user.name }));
}

/** Distinct service names already requested, for the request form picker. */
export async function listRequestedServiceNames(): Promise<string[]> {
  await connectDB();
  const services = await Service.find({ isActive: true })
    .select('name')
    .sort({ sortOrder: 1, name: 1 })
    .lean()
    .exec();
  return services.map((service) => service.name);
}

/**
 * Proposals a marketing user may act on, for the revision-request form.
 *
 * Only proposals with an issued (SENT) current version can be questioned -
 * there is nothing to revise about an internal draft.
 */
export async function listIssuedProposalsForMarketing(
  marketingUserId: string
): Promise<Array<{ id: string; proposalCode: string; title: string; version: number }>> {
  await connectDB();
  if (!OBJECT_ID_PATTERN.test(marketingUserId)) {
    return [];
  }
  const proposals = await Proposal.find({
    assignedMarketingUserId: new Types.ObjectId(marketingUserId),
    status: { $in: ['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] },
  })
    .select('proposalCode title currentVersion')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean()
    .exec();

  return proposals.map((proposal) => ({
    id: proposal._id.toString(),
    proposalCode: proposal.proposalCode,
    title: proposal.title,
    version: proposal.currentVersion,
  }));
}