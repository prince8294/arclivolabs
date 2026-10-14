'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';

import UserMenu from '@/components/layout/user-menu';
import { ROLE_LABELS, USER_ROLES, type AuthUser } from '@/types/auth';

export interface TopbarProps {
  user: AuthUser;
}

export default function Topbar({ user }: TopbarProps) {
  const notificationsHref =
    user.role === USER_ROLES.ADMIN
      ? '/admin/notifications'
      : user.role === USER_ROLES.MARKETING
        ? '/marketing/notifications'
        : user.role === USER_ROLES.EMPLOYEE
          ? '/employee/notifications'
          : '/client/notifications';

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-card pl-16 pr-4 sm:pr-6 lg:gap-x-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center">
          <span className="text-sm font-medium text-muted-foreground">
            {ROLE_LABELS[user.role]} Portal
          </span>
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <Link
            href={notificationsHref}
            aria-label="View notifications"
            className="relative -m-2.5 rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="sr-only">View notifications</span>
            <Bell className="h-5 w-5" aria-hidden="true" />
          </Link>

          <div
            className="hidden lg:block lg:h-6 lg:w-px lg:bg-border"
            aria-hidden="true"
          />

          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
