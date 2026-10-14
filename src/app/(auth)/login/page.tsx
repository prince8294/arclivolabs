import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import LoginForm from '@/components/auth/login-form';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getDashboardRouteForRole } from '@/lib/auth/redirects';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to the Arclivo Labs management platform.',
};

/**
 * /login
 *
 * - Unauthenticated users see the login form.
 * - Already-authenticated users are redirected to their own dashboard
 *   (defense in depth: the proxy does the same before rendering).
 */
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(getDashboardRouteForRole(user.role));
  }

  return <LoginForm />;
}
