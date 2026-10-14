'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils/cn';

export interface CrmTabsProps {
  items: Array<{ title: string; href: string }>;
  /** Route prefix used to decide which tab is active. */
  basePath: string;
}

/**
 * Section navigation for the CRM.
 *
 * The main sidebar is a flat list (one entry per role area), so the CRM's
 * own Overview / Leads split is exposed as a compact tab strip rendered
 * by the CRM pages themselves — no change to the global navigation
 * model.
 */
export default function CrmTabs({ items, basePath }: CrmTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="CRM sections"
      className="flex items-center gap-1 rounded-lg border border-border bg-card p-1"
    >
      {items.map((item) => {
        const isActive =
          item.href === basePath
            ? pathname === basePath
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}