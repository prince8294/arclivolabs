import 'server-only';

import { redirect } from 'next/navigation';

import {
  CHANGE_PASSWORD_ROUTE,
  LOGIN_ROUTE,
  getDashboardRouteForRole,
} from './redirects';
import { getCurrentUser } from './current-user';
import type { AuthUser, UserRole } from '@/types/auth';

/**
 * Route authorization guards.
 *
 * These run in Server Components, layouts, and server actions — i.e. on
 * the server, per request. UI hiding (nav links, etc.) is presentation
 * only and is never treated as a security boundary.
 *
 * `redirect()` throws (Next.js control-flow), so every guard that does
 * not return has already aborted the render.
 */

/**
 * Require an authenticated, ACTIVE user.
 * Unauthenticated (or deactivated / suspended) requests are redirected
 * to /login. Suspended users also get their session ignored, so an old
 * cookie stops working as soon as the next server-side check runs.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(LOGIN_ROUTE);
  }
  return user;
}

/**
 * Require an authenticated user with exactly the given role.
 *
 * A logged-in user with the wrong role is redirected to their own
 * dashboard (e.g. CLIENT visiting /admin → /client), never allowed
 * through. Role is read from the database, so a mid-session role
 * change takes effect immediately.
 */
export async function requireRole(role: UserRole): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== role) {
    redirect(getDashboardRouteForRole(user.role));
  }
  // Forced password change (admin-created account or admin password
  // reset): no portal page renders until /change-password is completed.
  // The /change-password page itself uses `requireAuth`, so this cannot
  // create a redirect loop.
  if (user.mustChangePassword) {
    redirect(CHANGE_PASSWORD_ROUTE);
  }
  return user;
}

/**
 * Require an authenticated user with one of the given roles.
 * Useful for compound checks (e.g. future admin + marketing views).
 */
export async function requireAnyRole(
  roles: readonly UserRole[]
): Promise<AuthUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    redirect(getDashboardRouteForRole(user.role));
  }
  if (user.mustChangePassword) {
    redirect(CHANGE_PASSWORD_ROUTE);
  }
  return user;
}
