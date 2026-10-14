import { CLIENT_STATUS, CLIENT_STATUS_LABELS, USER_STATUS, USER_STATUS_LABELS, type ClientStatus, type UserStatus } from '@/lib/constants/enums';
import { cn } from '@/lib/utils/cn';

export interface StatusBadgeProps {
  status: UserStatus | ClientStatus;
  className?: string;
}

/**
 * Account status pill for internal users.
 *
 * Each state gets a distinct color AND a readable label, so meaning
 * never relies on color alone (accessible + unambiguous in print).
 */
const STATUS_STYLES: Record<
  UserStatus,
  { pill: string; dot: string }
> = {
  [USER_STATUS.ACTIVE]: {
    pill: 'bg-success/10 text-success border-success/30',
    dot: 'bg-success',
  },
  [USER_STATUS.SUSPENDED]: {
    pill: 'bg-destructive/10 text-destructive border-destructive/30',
    dot: 'bg-destructive',
  },
  [USER_STATUS.INACTIVE]: {
    pill: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = status === CLIENT_STATUS.BLOCKED
    ? STATUS_STYLES[USER_STATUS.SUSPENDED]
    : STATUS_STYLES[status as UserStatus] ?? STATUS_STYLES[USER_STATUS.INACTIVE];
  const label = status in CLIENT_STATUS_LABELS
    ? CLIENT_STATUS_LABELS[status as ClientStatus]
    : USER_STATUS_LABELS[status as UserStatus];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-x-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        styles.pill,
        className
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', styles.dot)}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
