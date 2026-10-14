'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ListFilter,
  Loader2,
  UserCog,
  UserMinus,
  X,
} from 'lucide-react';

import ConfirmDialog from '@/components/admin/confirm-dialog';
import {
  bulkAssignLeads,
  bulkDistributeLeads,
  bulkUnassignLeads,
  bulkUpdateLeadStatus,
} from '@/lib/actions/lead-distribution';
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LOST_REASONS,
  LOST_REASON_LABELS,
} from '@/lib/constants/enums';
import {
  LEAD_DISTRIBUTION_MODES,
} from '@/lib/constants/lead-import';
import type { AssignableMarketingUser } from '@/lib/constants/leads';
import type { BulkActionResult } from '@/types/lead-import';
import { useLeadSelection } from '@/components/crm/lead-selection';
import { cn } from '@/lib/utils/cn';

/**
 * Floating bulk action bar for the admin lead list.
 *
 * Appears whenever leads are checked. Every mutation is a
 * server action that re-authorizes and re-validates on the
 * server — these buttons are convenience, not the security
 * boundary. Per-lead timeline entries are written for
 * selections up to `LEAD_BULK_ACTIVITY_LIMIT`.
 */

const EMPTY_STATE: BulkActionResult = { ok: false };
const assignReducer = (_state: BulkActionResult, formData: FormData) => bulkAssignLeads(formData);
const unassignReducer = (_state: BulkActionResult, formData: FormData) => bulkUnassignLeads(formData);
const statusReducer = (_state: BulkActionResult, formData: FormData) => bulkUpdateLeadStatus(formData);
const distributeReducer = (_state: BulkActionResult, formData: FormData) => bulkDistributeLeads(formData);

const barButtonClasses =
  'inline-flex h-9 items-center gap-x-2 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

const fieldClasses =
  'h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface BulkBarProps {
  /** Admin-only assignee options. */
  marketingUsers: AssignableMarketingUser[];
}

export default function LeadBulkBar({ marketingUsers }: BulkBarProps) {
  const router = useRouter();
  const { selectedIds, count, clear } = useLeadSelection();
  const [dialog, setDialog] = useState<
    'assign' | 'unassign' | 'status' | 'distribute' | null
  >(null);

  const [assignState, assignAction, assignPending] = useActionState<
    BulkActionResult,
    FormData
  >(assignReducer, EMPTY_STATE);
  const [unassignState, unassignAction, unassignPending] = useActionState<
    BulkActionResult,
    FormData
  >(unassignReducer, EMPTY_STATE);
  const [statusState, statusAction, statusPending] = useActionState<
    BulkActionResult,
    FormData
  >(statusReducer, EMPTY_STATE);
  const [distributeState, distributeAction, distributePending] = useActionState<
    BulkActionResult,
    FormData
  >(distributeReducer, EMPTY_STATE);

  // Success closes the dialog and refreshes the server-rendered
  // list so the new owner / status renders from the database.
  const refreshed = useRef(false);
  const lastOk =
    assignState.ok || unassignState.ok || statusState.ok || distributeState.ok;
  useEffect(() => {
    if (lastOk && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
    if (!lastOk) {
      refreshed.current = false;
    }
  }, [lastOk, router]);

  const leadIds = [...selectedIds];
  const leadIdsJson = JSON.stringify(leadIds);
  const close = () => setDialog(null);

  if (count === 0) {
    return null;
  }

  const message =
    assignState.message ??
    unassignState.message ??
    statusState.message ??
    distributeState.message;

  return (
    <>
      <div className="sticky bottom-4 z-30 flex items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
          {count}
        </span>
        <span className="text-sm font-medium text-foreground">
          lead{count === 1 ? '' : 's'} selected
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={barButtonClasses}
            onClick={() => setDialog('assign')}
          >
            <UserCog className="h-4 w-4" aria-hidden="true" />
            Assign
          </button>
          <button
            type="button"
            className={barButtonClasses}
            onClick={() => setDialog('distribute')}
          >
            <ListFilter className="h-4 w-4" aria-hidden="true" />
            Distribute
          </button>
          <button
            type="button"
            className={barButtonClasses}
            onClick={() => setDialog('status')}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Change status
          </button>
          <button
            type="button"
            className={cn(barButtonClasses, 'text-destructive hover:bg-destructive/10')}
            onClick={() => setDialog('unassign')}
          >
            <UserMinus className="h-4 w-4" aria-hidden="true" />
            Unassign
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            onClick={clear}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Assign to one user */}
      {dialog === 'assign' && (
        <ConfirmDialog
          title={`Assign ${count} lead(s)`}
          description="Choose an active marketing user to own the selected leads. Leads currently assigned to someone else will be reassigned."
          tone="primary"
          pending={assignPending}
          error={dialog === 'assign' ? assignState.error : undefined}
          onClose={close}
        >
          <form action={assignAction} className="flex flex-col gap-3">
            <input type="hidden" name="leadIds" value={leadIdsJson} />
            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-sm font-medium text-foreground">
                Assigned marketing user
              </span>
              <select
                name="assignedToUserId"
                required
                className={fieldClasses}
                defaultValue=""
              >
                <option value="" disabled>
                  Select a marketing user
                </option>
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
              disabled={assignPending}
              className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {assignPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {assignPending ? 'Assigning…' : `Assign ${count} lead(s)`}
            </button>
          </form>
        </ConfirmDialog>
      )}

      {/* Unassign (return to pool) */}
      {dialog === 'unassign' && (
        <ConfirmDialog
          title={`Unassign ${count} lead(s)?`}
          description="The selected leads return to the shared unassigned pool and become invisible to the marketing users who owned them."
          tone="danger"
          pending={unassignPending}
          error={dialog === 'unassign' ? unassignState.error : undefined}
          onClose={close}
        >
          <form action={unassignAction} className="flex flex-col gap-3">
            <input type="hidden" name="leadIds" value={leadIdsJson} />
            <button
              type="submit"
              disabled={unassignPending}
              className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-60"
            >
              {unassignPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {unassignPending ? 'Unassigning…' : `Unassign ${count} lead(s)`}
            </button>
          </form>
        </ConfirmDialog>
      )}

      {/* Change status */}
      {dialog === 'status' && (
        <StatusDialog
          leadIdsJson={leadIdsJson}
          count={count}
          pending={statusPending}
          state={statusState}
          action={statusAction}
          onClose={close}
        />
      )}

      {/* Round-robin distribute */}
      {dialog === 'distribute' && (
        <DistributeDialog
          leadIdsJson={leadIdsJson}
          count={count}
          marketingUsers={marketingUsers}
          pending={distributePending}
          state={distributeState}
          action={distributeAction}
          onClose={close}
        />
      )}

      {message && (
        <p
          role="status"
          className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm font-medium text-success shadow-lg"
        >
          {message}
        </p>
      )}
    </>
  );
}

/** Change-status dialog with an explicit confirm for WON / LOST. */
function StatusDialog({
  leadIdsJson,
  count,
  pending,
  state,
  action,
  onClose,
}: {
  leadIdsJson: string;
  count: number;
  pending: boolean;
  state: BulkActionResult;
  action: (formData: FormData) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<string>('');
  const isTerminal = status === LEAD_STATUSES.WON || status === LEAD_STATUSES.LOST;
  const needsConfirm = isTerminal;
  const [confirmed, setConfirmed] = useState(false);

  return (
    <ConfirmDialog
      title={`Change status of ${count} lead(s)`}
      description={
        needsConfirm
          ? 'Moving leads to WON or LOST is a significant pipeline transition and will be recorded on each lead.'
          : 'Choose the new pipeline stage for the selected leads.'
      }
      tone={needsConfirm ? 'danger' : 'primary'}
      pending={pending}
      error={state.error}
      onClose={onClose}
    >
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="leadIds" value={leadIdsJson} />
        <label className="flex flex-col gap-1.5 text-left">
          <span className="text-sm font-medium text-foreground">
            New status
          </span>
          <select
            name="status"
            required
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setConfirmed(false);
            }}
            className={fieldClasses}
          >
            <option value="" disabled>
              Select a status
            </option>
            {Object.values(LEAD_STATUSES).map((value) => (
              <option key={value} value={value}>
                {LEAD_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        {status === LEAD_STATUSES.LOST && (
          <label className="flex flex-col gap-1.5 text-left">
            <span className="text-sm font-medium text-foreground">
              Loss reason (optional)
            </span>
            <select name="lostReason" className={fieldClasses} defaultValue="">
              <option value="">Not specified</option>
              {Object.values(LOST_REASONS).map((value) => (
                <option key={value} value={value}>
                  {LOST_REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        )}

        {needsConfirm && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            I understand this changes {count} lead(s) to{' '}
            {LEAD_STATUS_LABELS[status as keyof typeof LEAD_STATUS_LABELS]}.
          </label>
        )}

        <button
          type="submit"
          disabled={pending || (needsConfirm && !confirmed)}
          className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? 'Saving…' : `Update ${count} lead(s)`}
        </button>
      </form>
    </ConfirmDialog>
  );
}

/** Round-robin distribution dialog with a user multi-select. */
function DistributeDialog({
  leadIdsJson,
  count,
  marketingUsers,
  pending,
  state,
  action,
  onClose,
}: {
  leadIdsJson: string;
  count: number;
  marketingUsers: AssignableMarketingUser[];
  pending: boolean;
  state: BulkActionResult;
  action: (formData: FormData) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function toggleUser(id: string) {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const base = Math.floor(count / Math.max(picked.size, 1));
  const remainder = count % Math.max(picked.size, 1);

  return (
    <ConfirmDialog
      title={`Distribute ${count} lead(s)`}
      description="Split the selected leads evenly across the chosen marketing users (round robin, oldest leads first). Each user receives a roughly equal share."
      tone="primary"
      pending={pending}
      error={state.error}
      onClose={onClose}
    >
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="leadIds" value={leadIdsJson} />
        <input
          type="hidden"
          name="mode"
          value={LEAD_DISTRIBUTION_MODES.ROUND_ROBIN}
        />
        <input type="hidden" name="userIds" value={JSON.stringify([...picked])} />

        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
          {marketingUsers.map((user) => {
            const checked = picked.has(user.id);
            return (
              <label
                key={user.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  checked ? 'bg-primary/10' : 'hover:bg-accent'
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleUser(user.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-foreground">{user.name}</span>
                {user.marketingCode && (
                  <span className="text-xs text-muted-foreground">
                    {user.marketingCode}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {picked.size > 0 && (
          <p className="text-xs text-muted-foreground">
            {picked.size} user(s) · about {base} lead(s) each
            {remainder > 0 ? `, ${remainder} user(s) get ${base + 1}` : ''}.
          </p>
        )}

        <button
          type="submit"
          disabled={pending || picked.size === 0}
          className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? 'Distributing…' : `Distribute ${count} lead(s)`}
        </button>
      </form>
    </ConfirmDialog>
  );
}
