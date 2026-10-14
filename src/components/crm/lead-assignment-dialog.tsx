'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Loader2, UserCog } from 'lucide-react';

import ConfirmDialog from '@/components/admin/confirm-dialog';
import { assignLead } from '@/lib/actions/leads';
import {
  INITIAL_LEAD_STATE,
  type LeadActionState,
} from '@/lib/validations/lead';
import type { AssignableMarketingUser } from '@/lib/constants/leads';

export interface LeadAssignmentDialogProps {
  leadId: string;
  leadCode: string;
  /** Currently assigned user id, or '' when unassigned. */
  currentAssigneeId: string;
  currentAssigneeLabel: string | null;
  marketingUsers: AssignableMarketingUser[];
  /** `row` = compact icon button; `panel` = labeled button. */
  variant?: 'row' | 'panel';
}

const iconButtonClasses =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

const labelButtonClasses =
  'inline-flex h-9 items-center gap-x-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

/**
 * Assign / reassign / unassign a lead.
 *
 * The option list only ever contains active marketing users with a valid
 * MarketingProfile, but that is a convenience, not the security boundary:
 * `assignLead` re-validates role, account status and the profile against
 * the database before writing, and refuses an empty assignee as
 * "unassign" only.
 *
 * The dialog closes as soon as the action succeeds (render-phase state
 * adjustment, so no effect writes state) and the page is refreshed so the
 * new owner and counts render from the database.
 */
export default function LeadAssignmentDialog({
  leadId,
  leadCode,
  currentAssigneeId,
  currentAssigneeLabel,
  marketingUsers,
  variant = 'row',
}: LeadAssignmentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<LeadActionState, FormData>(
    assignLead,
    INITIAL_LEAD_STATE
  );

  // Success closes the dialog immediately; the refresh below happens in an
  // effect because it is an external call.
  const [acknowledged, setAcknowledged] = useState<LeadActionState | null>(
    null
  );
  if (state.ok && acknowledged !== state) {
    setAcknowledged(state);
    setOpen(false);
  }

  const refreshed = useRef<LeadActionState | null>(null);
  useEffect(() => {
    if (state.ok && refreshed.current !== state) {
      refreshed.current = state;
      router.refresh();
    }
  }, [state, router]);

  const [selected, setSelected] = useState(currentAssigneeId);
  const [selectedWhenOpened, setSelectedWhenOpened] = useState(
    currentAssigneeId
  );

  function showDialog() {
    setSelected(currentAssigneeId);
    setSelectedWhenOpened(currentAssigneeId);
    setOpen(true);
  }

  const description = currentAssigneeLabel
    ? `Currently assigned to ${currentAssigneeLabel}. Choose a different active marketing user, or leave it unassigned.`
    : 'This lead is unassigned. Choose an active marketing user to take ownership.';

  const form = (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={leadId} />
      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-sm font-medium text-foreground">
          Assigned marketing user
        </span>
        <select
          name="assignedTo"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Unassigned</option>
          {marketingUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
              {user.marketingCode ? ` — ${user.marketingCode}` : ''}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
      >
        {pending && (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {pending ? 'Saving…' : 'Save assignment'}
      </button>
      {selected === selectedWhenOpened && !pending && (
        <p className="text-xs text-muted-foreground">
          Pick a different user (or &ldquo;Unassigned&rdquo;) to save a change.
        </p>
      )}
    </form>
  );

  if (variant === 'row') {
    return (
      <>
        <button
          type="button"
          className={iconButtonClasses}
          onClick={showDialog}
          aria-label={`Assign ${leadCode}`}
          title="Assign / reassign"
        >
          <UserCog className="h-4 w-4" aria-hidden="true" />
        </button>
        {open && (
          <ConfirmDialog
            title={`Assign ${leadCode}`}
            description={description}
            tone="primary"
            pending={pending}
            error={state.error}
            onClose={() => setOpen(false)}
          >
            {form}
          </ConfirmDialog>
        )}
      </>
    );
  }

  return (
    <>
      <button type="button" className={labelButtonClasses} onClick={showDialog}>
        <UserCog className="h-4 w-4" aria-hidden="true" />
        {currentAssigneeId ? 'Reassign' : 'Assign'}
      </button>
      {open && (
        <ConfirmDialog
          title={`Assign ${leadCode}`}
          description={description}
          tone="primary"
          pending={pending}
          error={state.error}
          onClose={() => setOpen(false)}
        >
          {form}
        </ConfirmDialog>
      )}
    </>
  );
}