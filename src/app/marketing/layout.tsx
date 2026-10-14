import DashboardShell from '@/components/layout/dashboard-shell';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';

/**
 * Protects /marketing and every nested route. See the admin layout for
 * the enforcement model (proxy + layout + page checks, database-backed
 * role and status).
 */
export default async function MarketingLayout({
  children,
}: LayoutProps<'/marketing'>) {
  const user = await requireRole(USER_ROLES.MARKETING);

  return (
    <DashboardShell user={user}>{children}</DashboardShell>
  );
}
