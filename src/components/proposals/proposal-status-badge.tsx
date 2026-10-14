import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  DEAL_STATUS_LABELS,
  DEAL_STATUS_VARIANTS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_VARIANTS,
  type DealStatus,
  type ProposalStatus,
} from '@/lib/constants/proposals';

export interface ProposalStatusBadgeProps {
  status: ProposalStatus;
  className?: string;
}

/** Consistent status chip used by every proposal table, detail page and row action. */
export function ProposalStatusBadge({ status, className }: ProposalStatusBadgeProps) {
  return (
    <Badge variant={PROPOSAL_STATUS_VARIANTS[status] ?? 'secondary'} className={className}>
      {PROPOSAL_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export interface DealStatusBadgeProps {
  status: DealStatus;
  className?: string;
}

/** Deal status chip. Ready-for-project reads green; conversion-pending amber. */
export function DealStatusBadge({ status, className }: DealStatusBadgeProps) {
  return (
    <Badge variant={DEAL_STATUS_VARIANTS[status] ?? 'secondary'} className={cn(className)}>
      {DEAL_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export interface StatusDotProps {
  icon?: LucideIcon;
  tone?: 'success' | 'warning' | 'error' | 'info' | 'muted';
  label: string;
}

/** Small inline status marker used in detail-page section headers. */
export function StatusDot({ icon: Icon, tone = 'muted', label }: StatusDotProps) {
  const toneClass = {
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-destructive/10 text-destructive',
    info: 'bg-info/10 text-info',
    muted: 'bg-muted text-muted-foreground',
  }[tone];

  return (
    <span
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg',
        toneClass
      )}
      aria-hidden="true"
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span className="sr-only">{label}</span>
    </span>
  );
}