'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ListTodo,
  Kanban,
  AlertCircle,
  Clock,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TaskSubNavProps {
  counts?: {
    overdue?: number;
    pendingReview?: number;
  };
}

export default function TaskSubNav({ counts }: TaskSubNavProps) {
  const pathname = usePathname();

  const links = [
    { title: 'All Tasks', href: '/admin/tasks', icon: ListTodo, exact: true },
    { title: 'Task Board', href: '/admin/tasks/board', icon: Kanban },
    {
      title: 'Pending Review',
      href: '/admin/tasks/review',
      icon: Clock,
      badge: counts?.pendingReview ? String(counts.pendingReview) : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    },
    {
      title: 'Overdue',
      href: '/admin/tasks/overdue',
      icon: AlertCircle,
      badge: counts?.overdue ? String(counts.overdue) : undefined,
      badgeColor: 'bg-destructive/15 text-destructive',
    },
    { title: 'Completed', href: '/admin/tasks/completed', icon: CheckCircle2 },
  ];

  return (
    <div className="flex overflow-x-auto border-b border-border gap-1 pb-px">
      {links.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname === link.href || (link.href !== '/admin/tasks' && pathname.startsWith(link.href));

        const Icon = link.icon;

        return (
          <Link
            key={link.title}
            href={link.href}
            className={cn(
              'inline-flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{link.title}</span>
            {link.badge && (
              <span
                className={cn(
                  'ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                  link.badgeColor
                )}
              >
                {link.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
