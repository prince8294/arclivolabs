import { ROUTES } from '@/lib/constants/routes';
import { USER_ROLES, type UserRole } from '@/types/auth';

/**
 * Role → portal route mapping. Single source of truth for where each
 * role lands after login and where mis-authorized users are bounced to
 * their own dashboard.
 */

const DASHBOARD_BY_ROLE: Record<UserRole, string> = {
  [USER_ROLES.ADMIN]: ROUTES.ADMIN.DASHBOARD,
  [USER_ROLES.MARKETING]: ROUTES.MARKETING.DASHBOARD,
  [USER_ROLES.EMPLOYEE]: ROUTES.EMPLOYEE.DASHBOARD,
  [USER_ROLES.CLIENT]: ROUTES.CLIENT.DASHBOARD,
};

const ROLE_BY_PORTAL_PREFIX: Array<[string, UserRole]> = [
  [ROUTES.ADMIN.DASHBOARD, USER_ROLES.ADMIN],
  [ROUTES.MARKETING.DASHBOARD, USER_ROLES.MARKETING],
  [ROUTES.EMPLOYEE.DASHBOARD, USER_ROLES.EMPLOYEE],
  [ROUTES.CLIENT.DASHBOARD, USER_ROLES.CLIENT],
];

/** The dashboard route a given role is allowed to live in. */
export function getDashboardRouteForRole(role: UserRole): string {
  return DASHBOARD_BY_ROLE[role];
}

/**
 * Map a request pathname to the portal role that may enter it.
 *
 * - `/admin`, `/admin/clients`, ... → ADMIN
 * - `/marketing/...` → MARKETING, etc.
 * - Anything outside the portals (login, public pages, API) → null.
 */
export function getPortalRoleForPathname(pathname: string): UserRole | null {
  for (const [dashboard, role] of ROLE_BY_PORTAL_PREFIX) {
    if (pathname === dashboard || pathname.startsWith(`${dashboard}/`)) {
      return role;
    }
  }
  return null;
}

export const LOGIN_ROUTE = ROUTES.LOGIN;

/**
 * First-login / forced password change route. Users whose
 * `mustChangePassword` flag is set are routed here by `requireRole` and
 * away from every portal page until they set their own password.
 */
export const CHANGE_PASSWORD_ROUTE = ROUTES.CHANGE_PASSWORD;
