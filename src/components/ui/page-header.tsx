import { cn } from '@/lib/utils/cn';
import { HTMLAttributes } from 'react';

export interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({
  title,
  description,
  action,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn('flex items-center justify-between border-b border-border pb-5', className)}
      {...props}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
