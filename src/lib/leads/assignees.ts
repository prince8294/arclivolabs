import 'server-only';

import { Types } from 'mongoose';

import { MarketingProfile } from '@/models/MarketingProfile';
import { User } from '@/models/User';
import {
  MARKETING_STATUS,
  USER_STATUS,
} from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const NOT_ASSIGNABLE =
  'Selected marketing user is unavailable. Choose an active marketing user.';

/**
 * Confirm the given id is still an assignable marketing user:
 *   User.role = MARKETING, User.status = ACTIVE, and a linked
 *   MarketingProfile with status = ACTIVE.
 *
 * Returns the resolved ObjectId, or null when the caller asked to
 * unassign (empty/null input).
 *
 * Anything else (admin, employee, client, suspended, inactive,
 * inconsistent profile, invalid ObjectId) fails safely.
 */
export async function resolveAssignableMarketingUser(
  userId: string | null | undefined
): Promise<Types.ObjectId | null> {
  if (!userId) {
    return null;
  }

  if (!Types.ObjectId.isValid(userId)) {
    throw new Error(NOT_ASSIGNABLE);
  }

  const assigneeId = new Types.ObjectId(userId);

  const user = await User.findById(assigneeId)
    .select('role status')
    .lean();

  if (
    !user ||
    user.role !== USER_ROLES.MARKETING ||
    user.status !== USER_STATUS.ACTIVE
  ) {
    throw new Error(NOT_ASSIGNABLE);
  }

  const profile = await MarketingProfile.findOne({
    userId: assigneeId,
    status: MARKETING_STATUS.ACTIVE,
  })
    .select('_id')
    .lean();

  if (!profile) {
    throw new Error(NOT_ASSIGNABLE);
  }

  return assigneeId;
}

/**
 * Validate a list of marketing users in one pass.
 * Returns the resolved ObjectIds in the same order as the input.
 * Throws on the first invalid user.
 */
export async function resolveAssignableMarketingUsers(
  userIds: string[]
): Promise<Types.ObjectId[]> {
  const objectIds = userIds.map((id) => {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new Error(NOT_ASSIGNABLE);
    }
    return new Types.ObjectId(id);
  });

  const users = await User.find({
    _id: { $in: objectIds },
    role: USER_ROLES.MARKETING,
    status: USER_STATUS.ACTIVE,
  })
    .select('_id role status')
    .lean();

  const userMap = new Map<string, Types.ObjectId>();
  for (const user of users) {
    userMap.set(user._id.toString(), user._id);
  }

  const profiles = await MarketingProfile.find({
    userId: { $in: objectIds },
    status: MARKETING_STATUS.ACTIVE,
  })
    .select('userId')
    .lean();

  const profileSet = new Set(
    profiles.map((p) => p.userId.toString())
  );

  const resolved: Types.ObjectId[] = [];
  for (const id of objectIds) {
    const key = id.toString();
    if (!userMap.has(key) || !profileSet.has(key)) {
      throw new Error(NOT_ASSIGNABLE);
    }
    resolved.push(userMap.get(key)!);
  }

  return resolved;
}