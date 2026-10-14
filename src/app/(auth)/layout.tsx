import type { Metadata } from 'next';
import { Briefcase } from 'lucide-react';

import { appConfig } from '@/config/app';

export const metadata: Metadata = {
  title: {
    default: 'Sign in',
    template: '%s | Sign in',
  },
  robots: { index: false, follow: false },
};

/**
 * Shared shell for authentication pages (login, forgot password).
 *
 * Keep this a server component with minimal client JS: the only client
 * code inside the group is the login form itself.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
            aria-hidden="true"
          >
            <Briefcase className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {appConfig.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {appConfig.description}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Restricted internal platform. Accounts are provisioned by Arclivo
          Labs administration.
        </p>
      </div>
    </div>
  );
}
