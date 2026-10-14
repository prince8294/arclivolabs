'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  History,
  LayoutDashboard,
  ListTodo,
  Milestone as MilestoneIcon,
  Users,
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';

interface ProjectSubNavProps {
  projectId: string;
  pendingReviewCount?: number;
  milestoneCount?: number;
}

/** Tab strip for the project detail section (§31). */
export default function ProjectSubNav({
  projectId,
  pendingReviewCount = 0,
  milestoneCount = 0,
}: ProjectSubNavProps) {
  const pathname = usePathname();
  const base = `/admin/projects/${projectId}`;

  const links = [
    { title: 'Overview', href: base, icon: LayoutDashboard, exact: true },
    { title: 'Milestones', href: `${base}/milestones`, icon: MilestoneIcon, badge: milestoneCount },
    { title: 'Team', href: `${base}/team`, icon: Users },
    { title: 'Tasks', href: `${base}/tasks`, icon: ListTodo },
    {
      title: 'Timeline',
      href: `${base}/timeline`,
      icon: History,
      badge: pendingReviewCount || undefined,
    },
  ];

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border pb-px">
      {links.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);

        const Icon = link.icon;

        return (
          <Link
            key={link.title}
            href={link.href}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              isActive
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{link.title}</span>
            {link.badge ? (
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground">
                {link.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
