'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { ChevronDown, LogOut, User } from 'lucide-react';
import Link from 'next/link';

import { logout } from '@/lib/actions/auth';
import { ROLE_LABELS, USER_ROLES, type AuthUser } from '@/types/auth';
import { getInitials } from '@/lib/utils/initials';
import { cn } from '@/lib/utils/cn';

export interface UserMenuProps {
  user: AuthUser;
}

/**
 * Topbar user menu: identity (name, email, role), role-aware account
 * navigation, and a working logout.
 *
 * Logout calls the `logout` server action, which destroys the session
 * (cookie expired + deleted) and redirects to /login — the redirect is
 * not done client-side, so the session really is gone.
 */
export default function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const accountHref = user.role === USER_ROLES.CLIENT ? '/client/profile' : '/change-password';
  const accountLabel = user.role === USER_ROLES.CLIENT ? 'Profile' : 'Change password';

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const handleLogout = () => {
    if (isPending) {
      return;
    }
    close();
    startTransition(async () => {
      await logout();
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className="-m-1.5 flex items-center gap-x-2 rounded-lg p-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          {getInitials(user.name)}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-medium text-foreground lg:inline">
          {user.name}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-lg"
        >
          <div className="flex flex-col gap-0.5 px-3 py-2.5">
            <span className="truncate text-sm font-semibold text-foreground">
              {user.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
            <span className="mt-1 inline-flex w-fit items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
              {ROLE_LABELS[user.role]}
            </span>
          </div>

          <div className="my-1 h-px bg-border" aria-hidden="true" />

          <div className="flex flex-col">
            <Link
              href={accountHref}
              role="menuitem"
              onClick={close}
              className="flex items-center gap-x-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              {accountLabel}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={isPending}
              className="flex items-center gap-x-2 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {isPending ? 'Signing out…' : 'Logout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
