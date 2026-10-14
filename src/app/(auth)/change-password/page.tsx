import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import ChangePasswordForm from '@/components/auth/change-password-form';
import { requireAuth } from '@/lib/auth/authorization';
import { getDashboardRouteForRole } from '@/lib/auth/redirects';

export const metadata: Metadata = {
  title: 'Set your password',
  description: 'Choose your own password.',
};

/**
 * /change-password
 *
 * Shown to any authenticated user whose `mustChangePassword` flag is
 * set (admin-created account or admin password reset). `requireRole`
 * blocks every portal page for such users, so this is the only place
 * they can be until they set their own password.
 *
 * - No session → /login (also enforced by the proxy).
 * - Authenticated but no pending change → own dashboard.
 */
export default async function ChangePasswordPage() {
  const user = await requireAuth();

  if (!user.mustChangePassword) {
    redirect(getDashboardRouteForRole(user.role));
  }

  return <ChangePasswordForm />;
}
