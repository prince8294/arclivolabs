import { ROLE_LABELS, type UserRole } from '@/types/auth';
import { cn } from '@/lib/utils/cn';

export interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

export default function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground',
        className
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
