import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

export type LeadDetailTab =
  | 'overview'
  | 'communication'
  | 'followups'
  | 'meetings';

export const LEAD_DETAIL_TABS: Array<{
  id: LeadDetailTab;
  title: string;
}> = [
  { id: 'overview', title: 'Overview' },
  { id: 'communication', title: 'Communication' },
  { id: 'followups', title: 'Follow-ups' },
  { id: 'meetings', title: 'Meetings' },
];

/** Whitelist the `tab` query param. */
export function parseLeadDetailTab(
  value: string | string[] | undefined
): LeadDetailTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return LEAD_DETAIL_TABS.some((tab) => tab.id === raw)
    ? (raw as LeadDetailTab)
    : 'overview';
}

export interface LeadSectionTabsProps {
  /** Route of the lead detail page, without query. */
  basePath: string;
  active: LeadDetailTab;
}

/**
 * Section navigation for a lead detail page.
 *
 * Server-rendered links (no client JS): the active tab is
 * decided by the `tab` query param, which the page parses and
 * passes in.
 */
export default function LeadSectionTabs({
  basePath,
  active,
}: LeadSectionTabsProps) {
  return (
    <nav
      aria-label="Lead sections"
      className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1"
    >
      {LEAD_DETAIL_TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={
              tab.id === 'overview'
                ? basePath
                : `${basePath}?tab=${tab.id}`
            }
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 items-center whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {tab.title}
          </Link>
        );
      })}
    </nav>
  );
}
