'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import LeadAssignmentDialog from '@/components/crm/lead-assignment-dialog';
import LeadStatusForm from '@/components/crm/lead-status-form';
import type { AssignableMarketingUser } from '@/lib/constants/leads';
import type { LeadStatus, LostReason } from '@/lib/constants/enums';

export interface LeadDetailActionsProps {
  leadId: string;
  leadCode: string;
  status: LeadStatus;
  lostReason: LostReason | null;
  lostReasonNote: string | null;
  assignedToUserId: string | null;
  assignedToLabel: string | null;
  editHref: string;
  /** Admin-only: assign / reassign / unassign. */
  marketingUsers?: AssignableMarketingUser[];
  canAssign?: boolean;
}

const labelButtonClasses =
  'inline-flex h-9 items-center gap-x-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Detail-page action bar: Edit, Assign/Reassign (admin) and the quick
 * status form.
 *
 * Both mutations are server actions that re-authorize the actor and the
 * lead ownership on every call.
 */
export default function LeadDetailActions({
  leadId,
  leadCode,
  status,
  lostReason,
  lostReasonNote,
  assignedToUserId,
  assignedToLabel,
  editHref,
  marketingUsers = [],
  canAssign = false,
}: LeadDetailActionsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Change status</CardTitle>
          <CardDescription>
            Move the lead through the pipeline. Moving backwards is allowed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadStatusForm
            leadId={leadId}
            leadCode={leadCode}
            status={status}
            lostReason={lostReason ?? ''}
            lostReasonNote={lostReasonNote ?? ''}
            variant="panel"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead actions</CardTitle>
          <CardDescription>
            {canAssign
              ? 'Assign, reassign or return this lead to the unassigned pool.'
              : 'Update the details of this lead.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Link href={editHref} className={labelButtonClasses}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit lead
          </Link>
          {canAssign && (
            <LeadAssignmentDialog
              leadId={leadId}
              leadCode={leadCode}
              currentAssigneeId={assignedToUserId ?? ''}
              currentAssigneeLabel={assignedToLabel}
              marketingUsers={marketingUsers}
              variant="panel"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}