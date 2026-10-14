import { NextResponse, type NextRequest } from 'next/server';

import {
  SESSION_COOKIE_NAME,
} from '@/lib/auth/config';
import { verifySessionToken } from '@/lib/auth/session';
import {
  CHANGE_PASSWORD_ROUTE,
  LOGIN_ROUTE,
  getDashboardRouteForRole,
  getPortalRoleForPathname,
} from '@/lib/auth/redirects';

/**
 * Route-level guard that runs before rendering, on every matched request
 * — including client-side navigations, where layouts are cached and do
 * not re-execute.
 *
 * This layer is intentionally optimistic: it only verifies the signed
 * session cookie (no database access, per Next.js guidance for the
 * proxy). The authoritative, database-backed checks (account status,
 * current role) run in the portal layouts and pages via
 * `requireAuth`/`requireRole`.
 *
 * Behavior:
 * - Unauthenticated request to a portal → /login
 * - Authenticated request to the wrong portal → that user's dashboard
 * - Authenticated request to /login → that user's dashboard
 * - Public website routes (including /) remain accessible to everyone
 * - /change-password requires a session; whether the user actually still
 *   has to change their password is enforced server-side in the page.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Forced password change: needs a session, but is not a portal, so
  // handle it before the portal logic. The page re-checks the
  // `mustChangePassword` flag against the database and redirects users
  // who do not need it to their dashboard.
  if (pathname === CHANGE_PASSWORD_ROUTE) {
    if (!session) {
      return NextResponse.redirect(new URL(LOGIN_ROUTE, request.url));
    }
    return NextResponse.next();
  }

  const portalRole = getPortalRoleForPathname(pathname);
  if (portalRole) {
    if (!session) {
      return NextResponse.redirect(new URL(LOGIN_ROUTE, request.url));
    }
    if (session.role !== portalRole) {
      return NextResponse.redirect(
        new URL(getDashboardRouteForRole(session.role), request.url)
      );
    }
    return NextResponse.next();
  }

  if (session) {
    // Already signed in: send to their dashboard from the login page.
    if (pathname === LOGIN_ROUTE) {
      return NextResponse.redirect(
        new URL(getDashboardRouteForRole(session.role), request.url)
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/marketing/:path*',
    '/employee/:path*',
    '/client/:path*',
    '/change-password',
    '/login',
  ],
};
