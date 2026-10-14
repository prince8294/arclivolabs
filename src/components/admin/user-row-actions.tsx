'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  useActionState,
} from 'react';
import {
  Archive,
  Eye,
  KeyRound,
  Pencil,
  UserCheck,
  UserX,
} from 'lucide-react';

import { updateInternalUserStatus } from '@/lib/actions/admin-users';
import {
  INITIAL_ADMIN_USER_STATE,
  type AdminUserActionState,
} from '@/lib/validations/admin-users';
import { USER_STATUS, type UserStatus } from '@/lib/constants/enums';
import ConfirmDialog from './confirm-dialog';
import PasswordResetDialog from './password-reset-dialog';
import { cn } from '@/lib/utils/cn';

export interface UserRowActionsProps {
  userId: string;
  name: string;
  status: UserStatus;
  detailHref: string;
  editHref: string;
  /** Drives the confirmation copy ("this employee" vs "this marketing user"). */
  kind: 'employee' | 'marketing';
  /** `row` = compact icon buttons inside a table cell; `panel` = labeled buttons. */
  variant?: 'row' | 'panel';
}

type Dialog = 'suspend' | 'inactive' | 'reset' | null;

const iconButtonClasses =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const labelButtonClasses =
  'inline-flex h-9 items-center gap-x-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

/**
 * View / Edit / Suspend / Activate / Mark Inactive / Reset Password
 * for an internal user. Every mutation goes through the
 * `updateInternalUserStatus` server action (admin-only, re-validated);
 * suspension and inactivation ask for confirmation in a real dialog
 * (never browser `confirm()`).
 *
 * Success detection without effects-into-setState:
 * - the page is revalidated once per successful action (effect that
 *   only calls `router.refresh()`);
 * - open dialogs are closed when the server-side `status` prop changes
 *   after that refresh (state adjustment during render).
 */
export default function UserRowActions({
  userId,
  name,
  status,
  detailHref,
  editHref,
  kind,
  variant = 'row',
}: UserRowActionsProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);

  const [suspendState, suspendAction, suspendPending] = useActionState<
    AdminUserActionState,
    FormData
  >(updateInternalUserStatus, INITIAL_ADMIN_USER_STATE);
  const [activateState, activateAction, activatePending] = useActionState<
    AdminUserActionState,
    FormData
  >(updateInternalUserStatus, INITIAL_ADMIN_USER_STATE);
  const [inactiveState, inactiveAction, inactivePending] = useActionState<
    AdminUserActionState,
    FormData
  >(updateInternalUserStatus, INITIAL_ADMIN_USER_STATE);

  // A successful status action re-renders the page with a new `status`;
  // close any open dialog when that happens (render-phase adjustment).
  const [lastStatus, setLastStatus] = useState(status);
  if (lastStatus !== status) {
    setLastStatus(status);
    setDialog(null);
  }

  // Refresh once per successful action. Each success yields a new state
  // object, so identity comparison makes this exactly-once.
  const lastProcessed = useRef<AdminUserActionState | null>(null);
  useEffect(() => {
    const succeeded = [suspendState, activateState, inactiveState].find(
      (state) => state?.ok
    );
    if (succeeded && lastProcessed.current !== succeeded) {
      lastProcessed.current = succeeded;
      router.refresh();
    }
  }, [suspendState, activateState, inactiveState, router]);

  const subject =
    kind === 'employee' ? 'this employee' : 'this marketing user';
  const isRow = variant === 'row';

  return (
    <>
      {isRow ? (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={detailHref}
            className={iconButtonClasses}
            aria-label={`View ${name}`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={editHref}
            className={iconButtonClasses}
            aria-label={`Edit ${name}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Link>
          {status === USER_STATUS.ACTIVE && (
            <button
              type="button"
              className={iconButtonClasses}
              onClick={() => setDialog('suspend')}
              aria-label={`Suspend ${name}`}
            >
              <UserX className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {status !== USER_STATUS.INACTIVE && (
            <button
              type="button"
              className={iconButtonClasses}
              onClick={() => setDialog('inactive')}
              aria-label={`Mark ${name} inactive`}
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {status !== USER_STATUS.ACTIVE && (
            <form action={activateAction} className="inline-flex">
              <input type="hidden" name="id" value={userId} />
              <input type="hidden" name="status" value={USER_STATUS.ACTIVE} />
              <button
                type="submit"
                disabled={activatePending}
                className={cn(iconButtonClasses, 'text-success')}
                aria-label={`Activate ${name}`}
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          )}
          <button
            type="button"
            className={iconButtonClasses}
            onClick={() => setDialog('reset')}
            aria-label={`Reset password for ${name}`}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={editHref} className={labelButtonClasses}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
          {status === USER_STATUS.ACTIVE && (
            <button
              type="button"
              onClick={() => setDialog('suspend')}
              className={labelButtonClasses}
            >
              <UserX className="h-4 w-4 text-destructive" aria-hidden="true" />
              Suspend
            </button>
          )}
          {status !== USER_STATUS.INACTIVE && (
            <button
              type="button"
              onClick={() => setDialog('inactive')}
              className={labelButtonClasses}
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              Mark Inactive
            </button>
          )}
          {status !== USER_STATUS.ACTIVE && (
            <form action={activateAction} className="inline-flex">
              <input type="hidden" name="id" value={userId} />
              <input type="hidden" name="status" value={USER_STATUS.ACTIVE} />
              <button
                type="submit"
                disabled={activatePending}
                className={labelButtonClasses}
              >
                <UserCheck className="h-4 w-4 text-success" aria-hidden="true" />
                Activate
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={() => setDialog('reset')}
            className={labelButtonClasses}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Reset Password
          </button>
        </div>
      )}

      {dialog === 'suspend' && (
        <ConfirmDialog
          title={`Suspend ${subject}?`}
          description="They will no longer be able to sign in until the account is reactivated. Their records stay in place."
          pending={suspendPending}
          error={suspendState.error}
          onClose={() => setDialog(null)}
        >
          <form action={suspendAction}>
            <input type="hidden" name="id" value={userId} />
            <input
              type="hidden"
              name="status"
              value={USER_STATUS.SUSPENDED}
            />
            <button
              type="submit"
              disabled={suspendPending}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-destructive px-4 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:pointer-events-none disabled:opacity-60"
            >
              {suspendPending ? 'Suspending…' : 'Suspend'}
            </button>
          </form>
        </ConfirmDialog>
      )}

      {dialog === 'inactive' && (
        <ConfirmDialog
          title={`Mark ${subject} as inactive?`}
          description="Use this when the person has left the company or the contract has ended. Their account and historical records are kept, and they will no longer be able to sign in."
          pending={inactivePending}
          error={inactiveState.error}
          onClose={() => setDialog(null)}
        >
          <form action={inactiveAction}>
            <input type="hidden" name="id" value={userId} />
            <input
              type="hidden"
              name="status"
              value={USER_STATUS.INACTIVE}
            />
            <button
              type="submit"
              disabled={inactivePending}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-destructive px-4 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:pointer-events-none disabled:opacity-60"
            >
              {inactivePending ? 'Saving…' : 'Mark inactive'}
            </button>
          </form>
        </ConfirmDialog>
      )}

      {dialog === 'reset' && (
        <PasswordResetDialog
          userId={userId}
          subject={subject}
          onClose={() => setDialog(null)}
          onReset={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
