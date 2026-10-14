import 'server-only';

import { cache } from 'react';

import { USER_STATUS } from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { User, type UserDocument } from '@/models/User';
import type { AuthUser, UserRole } from '@/types/auth';

import { getSession } from './session-store';

/**
 * Serialize a Mongoose user into the safe AuthUser shape.
 *
 * `passwordHash` is already excluded from query results via
 * `select: false` in the schema and stripped by the model output
 * transform — but we still project explicitly so no future schema
 * change can leak internal fields to the client.
 */
export function toAuthUser(user: UserDocument): AuthUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    mustChangePassword: user.mustChangePassword ?? false,
  };
}

/**
 * Resolve the currently authenticated user from the database.
 *
 * The session token only proves the user existed and was ACTIVE at
 * login time. This re-reads the User document so suspensions,
 * deactivation, role changes, and renames apply on the very next
 * request — never on stale cookie data.
 *
 * - Returns null when: no session, unknown user, or status !== ACTIVE.
 * - Returns null (fail closed) when the database is unreachable;
 *   callers surface a generic "try again later" experience.
 *
 * Memoized with React `cache()` so layouts and pages that run in the
 * same request share one database read.
 */
export const getCurrentUser = cache(
  async (): Promise<AuthUser | null> => {
    const session = await getSession();
    if (!session) {
      return null;
    }

    try {
      await connectDB();
      const user = await User.findById(session.userId);
      if (!user || user.status !== USER_STATUS.ACTIVE) {
        return null;
      }
      return toAuthUser(user);
    } catch (error) {
      // Log for diagnostics without exposing the failure to the client.
      console.error('getCurrentUser: failed to load user from database', error);
      return null;
    }
  }
);

/** True when a given user id belongs to an active user of the role. */
export async function hasActiveRole(userId: string, role: UserRole): Promise<boolean> {
  try {
    await connectDB();
    const user = await User.findById(userId).select('role status');
    return !!user && user.role === role && user.status === USER_STATUS.ACTIVE;
  } catch (error) {
    console.error('hasActiveRole: failed to load user from database', error);
    return false;
  }
}
