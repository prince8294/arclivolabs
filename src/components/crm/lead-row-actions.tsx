'use client';

import Link from 'next/link';
import { Eye, Pencil } from 'lucide-react';

import LeadAssignmentDialog from '@/components/crm/lead-assignment-dialog';
import LeadStatusForm from '@/components/crm/lead-status-form';
import type { AssignableMarketingUser } from '@/lib/constants/leads';
import type { LeadStatus } from '@/lib/constants/enums';

export interface LeadRowActionsProps {
  leadId: string;
  leadCode: string;
  status: LeadStatus;
  assignedToUserId: string | null;
  assignedToLabel: string | null;
  detailHref: string;
  editHref: string;
  /** Admin-only: assign / reassign. Omitted for marketing rows. */
  marketingUsers?: AssignableMarketingUser[];
  canAssign?: boolean;
}

const iconButtonClasses =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * View / Edit / Update status / Assign for one lead row.
 *
 * Every mutation below is a server action that re-authorizes on the
 * server — these controls are convenience, not the security boundary.
 */
export default function LeadRowActions({
  leadId,
  leadCode,
  status,
  assignedToUserId,
  assignedToLabel,
  detailHref,
  editHref,
  marketingUsers = [],
  canAssign = false,
}: LeadRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={detailHref}
        className={iconButtonClasses}
        aria-label={`View ${leadCode}`}
        title="View lead"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Link>
      <Link
        href={editHref}
        className={iconButtonClasses}
        aria-label={`Edit ${leadCode}`}
        title="Edit lead"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Link>
      {canAssign && (
        <LeadAssignmentDialog
          leadId={leadId}
          leadCode={leadCode}
          currentAssigneeId={assignedToUserId ?? ''}
          currentAssigneeLabel={assignedToLabel}
          marketingUsers={marketingUsers}
          variant="row"
        />
      )}
      <LeadStatusForm
        leadId={leadId}
        leadCode={leadCode}
        status={status}
        variant="row"
      />
    </div>
  );
}