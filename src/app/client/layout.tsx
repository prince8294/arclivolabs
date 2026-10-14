import DashboardShell from '@/components/layout/dashboard-shell';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';
import { getClientProfileForUser } from '@/lib/auth/client-profile';
import { CLIENT_STATUS } from '@/lib/constants/enums';
import { redirect } from 'next/navigation';

/**
 * Protects /client and every nested route. See the admin layout for the
 * enforcement model (proxy + layout + page checks, database-backed role
 * and status).
 *
 * A CLIENT user must have a linked Client record with ACTIVE status to
 * access the portal. BLOCKED or missing profiles are denied access.
 */
export default async function ClientLayout({
  children,
}: LayoutProps<'/client'>) {
  const user = await requireRole(USER_ROLES.CLIENT);

  const profile = await getClientProfileForUser(user.id);
  if (!profile || profile.status !== CLIENT_STATUS.ACTIVE) {
    redirect('/login?error=client_inactive');
  }

  return (
    <DashboardShell user={user}>{children}</DashboardShell>
  );
}
