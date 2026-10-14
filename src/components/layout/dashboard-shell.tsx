'use client';

import type { ReactNode } from 'react';

import type { AuthUser } from '@/types/auth';
import { getNavigationByRole } from '@/lib/constants/navigation';
import Sidebar from '@/components/layout/sidebar';
import MobileSidebar from '@/components/layout/mobile-sidebar';
import Topbar from '@/components/layout/topbar';

export interface DashboardShellProps {
  user: AuthUser;
  children: ReactNode;
}

/**
 * Shared dashboard shell (sidebar + topbar + content).
 *
 * Rendered from the protected role layout, so `user` is already the
 * verified, database-backed user. The navigation shown here is UI only
 * — access control is enforced server-side.
 */
export default function DashboardShell({ user, children }: DashboardShellProps) {
  const navigation = getNavigationByRole(user.role);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Sidebar navigation={navigation} />
      <MobileSidebar navigation={navigation} />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <Topbar user={user} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
