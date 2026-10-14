import 'server-only';

import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import {
  type LeadDistributionMode,
} from '@/lib/constants/lead-import';
import { LeadDistribution } from '@/models/LeadDistribution';
import { Lead } from '@/models/Lead';
import { User } from '@/models/User';
import { MarketingProfile } from '@/models/MarketingProfile';
import {
  LEAD_STATUSES,
  MARKETING_STATUS,
  USER_STATUS,
  type LeadStatus,
} from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export interface LeadDistributionHistoryItem {
  id: string;
  distributionCode: string;
  mode: LeadDistributionMode;
  leadCount: number;
  userAllocation: Array<{
    userId: string;
    name: string;
    marketingCode: string | null;
    count: number;
  }>;
  filtersSnapshot: Array<{ label: string; value: string }>;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  createdBy: string;
  createdAt: Date;
  completedAt: Date | null;
}

export interface LeadDistributionDetail extends LeadDistributionHistoryItem {
  errorMessage: string | null;
}

/** Shape of the populated `createdBy` reference. */
interface PopulatedCreator {
  name?: string;
}

function creatorName(doc: { createdBy: unknown }): string {
  const creator = doc.createdBy as PopulatedCreator | null;
  return creator?.name ?? 'Unknown';
}

function toAllocation(
  marketingUsers: Array<{
    userId: Types.ObjectId;
    name: string;
    marketingCode: string | null;
    assigned: number;
  }>
) {
  return marketingUsers.map((user) => ({
    userId: user.userId.toString(),
    name: user.name,
    marketingCode: user.marketingCode ?? null,
    count: user.assigned,
  }));
}

/**
 * List recent distribution batches.
 */
export async function listRecentLeadDistributions(
  limit = 20
): Promise<LeadDistributionHistoryItem[]> {
  await connectDB();

  const docs = await LeadDistribution.find({})
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    distributionCode: doc.distributionCode,
    mode: doc.mode,
    leadCount: doc.leadCount,
    userAllocation: toAllocation(doc.marketingUsers),
    filtersSnapshot: doc.filtersSnapshot,
    status: doc.status,
    createdBy: creatorName(doc),
    createdAt: doc.createdAt,
    completedAt: doc.completedAt ?? null,
  }));
}

/**
 * Get a single distribution batch.
 */
export async function getLeadDistributionDetail(
  id: string
): Promise<LeadDistributionDetail | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  await connectDB();

  const doc = await LeadDistribution.findById(id)
    .populate('createdBy', 'name')
    .lean();

  if (!doc) {
    return null;
  }

  return {
    id: doc._id.toString(),
    distributionCode: doc.distributionCode,
    mode: doc.mode,
    leadCount: doc.leadCount,
    userAllocation: toAllocation(doc.marketingUsers),
    filtersSnapshot: doc.filtersSnapshot,
    status: doc.status,
    createdBy: creatorName(doc),
    createdAt: doc.createdAt,
    completedAt: doc.completedAt ?? null,
    errorMessage: doc.errorMessage ?? null,
  };
}

/**
 * Assignable marketing users with their current lead load, for
 * the distribution user picker.
 */
export async function listActiveMarketingUsers(): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
    marketingCode: string | null;
    assignedLeadCount: number;
  }>
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

  const userIds = users.map((user) => user._id);

  const profiles = await MarketingProfile.find({
    userId: { $in: userIds },
    status: MARKETING_STATUS.ACTIVE,
  })
    .select('userId marketingCode')
    .lean();

  const profileMap = new Map<string, string>();
  for (const profile of profiles) {
    profileMap.set(profile.userId.toString(), profile.marketingCode);
  }

  // Current lead load per user.
  const counts = await Lead.aggregate([
    { $match: { assignedTo: { $in: userIds } } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]).exec();

  const countMap = new Map<string, number>();
  for (const entry of counts) {
    if (entry._id) {
      countMap.set(entry._id.toString(), entry.count);
    }
  }

  return users
    .filter((user) => profileMap.has(user._id.toString()))
    .map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      marketingCode: profileMap.get(user._id.toString()) ?? null,
      assignedLeadCount: countMap.get(user._id.toString()) ?? 0,
    }));
}

/**
 * Count leads assigned to suspended/inactive marketing users.
 * Used for the "reassign suspended user's leads" pool.
 */
export async function countInactiveOwnerLeads(): Promise<number> {
  await connectDB();

  const inactiveUsers = await User.find({
    role: USER_ROLES.MARKETING,
    status: { $ne: USER_STATUS.ACTIVE },
  })
    .select('_id')
    .lean();

  if (inactiveUsers.length === 0) {
    return 0;
  }

  const ids = inactiveUsers.map((user) => user._id);
  return Lead.countDocuments({ assignedTo: { $in: ids } });
}

/**
 * Ids of suspended/inactive marketing users.
 */
export async function listInactiveMarketingUserIds(): Promise<string[]> {
  await connectDB();

  const users = await User.find({
    role: USER_ROLES.MARKETING,
    status: { $ne: USER_STATUS.ACTIVE },
  })
    .select('_id')
    .lean();

  return users.map((user) => user._id.toString());
}

/**
 * Count leads per status (for distribution filter chips).
 */
export async function getLeadStatusCounts(
  extraFilter: Record<string, unknown> = {}
): Promise<Record<LeadStatus, number>> {
  await connectDB();

  const rows = await Lead.aggregate([
    { $match: extraFilter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]).exec();

  const counts = {} as Record<LeadStatus, number>;
  for (const status of Object.values(LEAD_STATUSES)) {
    counts[status] = 0;
  }
  for (const row of rows) {
    if (row && typeof row._id === 'string' && row._id in counts) {
      counts[row._id as LeadStatus] = Number(row.count ?? 0);
    }
  }
  return counts;
}
