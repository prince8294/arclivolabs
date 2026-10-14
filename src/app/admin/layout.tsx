import DashboardShell from '@/components/layout/dashboard-shell';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';

/**
 * Protects /admin and every nested route at render time:
 *
 * - no valid session → redirect to /login
 * - session of another role → redirect to that user's dashboard
 * - active account check re-reads the database, so a user suspended
 *   mid-session is locked out on the next server-rendered page.
 *
 * Nested routes (/admin/clients, /admin/projects, ...) inherit this
 * check automatically. Per-request freshness for client-side
 * navigations is additionally enforced by the proxy and by the pages
 * themselves, because layouts are cached across navigations.
 */
export default async function AdminLayout({
  children,
}: LayoutProps<'/admin'>) {
  const user = await requireRole(USER_ROLES.ADMIN);

  return (
    <DashboardShell user={user}>{children}</DashboardShell>
  );
}
