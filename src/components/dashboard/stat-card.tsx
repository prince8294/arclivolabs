import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
}

export default function StatCard({
  title,
  value,
  description,
  subtitle,
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-5 shadow-sm', className)}>
      <div className="flex items-center justify-between gap-4">
        <p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      {(description || subtitle) && <p className="mt-1 text-xs text-muted-foreground">{description || subtitle}</p>}
    </div>
  );
}
