'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import type { NavigationItem } from '@/lib/constants/navigation';
import { appConfig } from '@/config/app';

export interface SidebarProps {
  navigation: NavigationItem[];
}

export default function Sidebar({ navigation }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-border bg-card">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto px-6 pb-4">
        <div className="flex h-16 shrink-0 items-center">
          <h1 className="text-lg font-bold tracking-tight text-foreground">{appConfig.name}</h1>
        </div>
        <nav className="flex flex-1 flex-col" aria-label="Primary">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const isDirectActive = pathname === item.href;
                  const isAnyChildActive = Boolean(
                    item.children?.some((child) => pathname === child.href || (child.href !== item.href && pathname.startsWith(child.href)))
                  );
                  const isActive = isDirectActive || isAnyChildActive;
                  const showChildren = Boolean(item.children && (isActive || pathname.startsWith(item.href)));
                  const Icon = item.icon;
                  return (
                    <li key={item.title}>
                      <Link
                        href={item.href}
                        aria-current={isDirectActive ? 'page' : undefined}
                        className={cn(
                          'group flex gap-x-3 rounded-lg p-2 text-sm font-medium leading-6 transition-colors',
                          isDirectActive
                            ? 'bg-primary text-primary-foreground'
                            : isAnyChildActive
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              'ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              isDirectActive
                                ? 'bg-primary-foreground/15 text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                      {showChildren && item.children && (
                        <ul className="mt-1 ml-6 space-y-1 border-l border-border pl-2.5">
                          {item.children.map((child) => {
                            const isChildActive = pathname === child.href;
                            return (
                              <li key={child.title}>
                                <Link
                                  href={child.href}
                                  aria-current={isChildActive ? 'page' : undefined}
                                  className={cn(
                                    'block rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                    isChildActive
                                      ? 'bg-primary text-primary-foreground font-semibold'
                                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                  )}
                                >
                                  {child.title}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  );
}
