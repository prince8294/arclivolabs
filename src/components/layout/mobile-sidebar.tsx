'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { NavigationItem } from '@/lib/constants/navigation';
import { appConfig } from '@/config/app';

export interface MobileSidebarProps {
  navigation: NavigationItem[];
}

export default function MobileSidebar({ navigation }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setOpen((value) => !value)}
        className="fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={close}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-lg">
            <div className="flex h-16 shrink-0 items-center pr-12 pl-16">
              <h1 className="text-lg font-bold tracking-tight text-foreground">{appConfig.name}</h1>
            </div>
            <nav className="flex flex-1 flex-col overflow-y-auto px-6 pb-4" aria-label="Mobile">
              <ul role="list" className="space-y-1">
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
                        onClick={close}
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
                                  onClick={close}
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
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
