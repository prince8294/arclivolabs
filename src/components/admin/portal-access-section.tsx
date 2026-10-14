'use client';

import { useState, useActionState } from 'react';
import { Loader2, UserPlus, KeyRound, UserX, UserCheck } from 'lucide-react';

import { createClientPortal, resetClientPortalPassword, suspendClientPortal, reactivateClientPortal } from '@/lib/actions/clients';
import { INITIAL_CLIENT_STATE, type ClientActionState } from '@/lib/validations/client';
import ConfirmDialog from '@/components/admin/confirm-dialog';
import { cn } from '@/lib/utils/cn';

export interface PortalAccessSectionProps {
  clientId: string;
  hasPortalAccess: boolean;
  portalEmail: string | null;
  portalStatus: string | null;
}

const iconButtonClasses =
  'inline-flex h-9 items-center gap-x-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

export default function PortalAccessSection({
  clientId,
  hasPortalAccess,
  portalEmail,
  portalStatus,
}: PortalAccessSectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);

  const [createState, createAction, createPending] = useActionState<
    ClientActionState,
    FormData
  >(createClientPortal, INITIAL_CLIENT_STATE);

  const [resetState, resetAction, resetPending] = useActionState<
    ClientActionState,
    FormData
  >(resetClientPortalPassword, INITIAL_CLIENT_STATE);

  const [suspendState, suspendAction, suspendPending] = useActionState<
    ClientActionState,
    FormData
  >(suspendClientPortal, INITIAL_CLIENT_STATE);

  const [reactivateState, reactivateAction, reactivatePending] = useActionState<
    ClientActionState,
    FormData
  >(reactivateClientPortal, INITIAL_CLIENT_STATE);

  if (hasPortalAccess) {
    const isSuspended = portalStatus === 'SUSPENDED';
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Portal access is <span className="font-medium text-foreground">{isSuspended ? 'suspended' : 'enabled'}</span> for <span className="font-mono text-xs">{portalEmail}</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          {!isSuspended ? (
            <button
              type="button"
              onClick={() => setShowSuspendConfirm(true)}
              className={cn(iconButtonClasses, 'text-destructive')}
            >
              <UserX className="h-4 w-4" aria-hidden="true" />
              Suspend Portal
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowReactivateConfirm(true)}
              className={cn(iconButtonClasses, 'text-success')}
            >
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              Reactivate Portal
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowResetForm(true)}
            className={iconButtonClasses}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Reset Password
          </button>
        </div>

        {showSuspendConfirm && (
          <ConfirmDialog
            title="Suspend portal access?"
            description="The client will no longer be able to sign in. Their business record and portal account are preserved."
            pending={suspendPending}
            error={suspendState.error}
            onClose={() => setShowSuspendConfirm(false)}
          >
            <form action={suspendAction}>
              <input type="hidden" name="clientId" value={clientId} />
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

        {showReactivateConfirm && (
          <ConfirmDialog
            title="Reactivate portal access?"
            description="The client will be able to sign in again using their existing password."
            tone="primary"
            pending={reactivatePending}
            error={reactivateState.error}
            onClose={() => setShowReactivateConfirm(false)}
          >
            <form action={reactivateAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <button
                type="submit"
                disabled={reactivatePending}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
              >
                {reactivatePending ? 'Reactivating…' : 'Reactivate'}
              </button>
            </form>
          </ConfirmDialog>
        )}

        {showResetForm && (
          <ResetPasswordForm
            clientId={clientId}
            state={resetState}
            action={resetAction}
            pending={resetPending}
            onClose={() => setShowResetForm(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        No portal account exists yet. Create one to let the client sign in.
      </p>
      <button
        type="button"
        onClick={() => setShowCreateForm(true)}
        className={cn(iconButtonClasses, 'text-success')}
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Enable Client Portal
      </button>

      {showCreateForm && (
        <CreatePortalForm
          clientId={clientId}
          state={createState}
          action={createAction}
          pending={createPending}
          onClose={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}

function CreatePortalForm({
  clientId,
  state,
  action,
  pending,
  onClose,
}: {
  clientId: string;
  state: ClientActionState;
  action: (formData: FormData) => void;
  pending: boolean;
  onClose: () => void;
}) {
  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
      <input type="hidden" name="clientId" value={clientId} />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="loginName" className="text-sm font-medium">Login name</label>
          <input
            id="loginName"
            name="loginName"
            type="text"
            required
            disabled={pending}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {state.fieldErrors?.loginName && <p className="text-xs text-destructive">{state.fieldErrors.loginName}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="loginEmail" className="text-sm font-medium">Login email</label>
          <input
            id="loginEmail"
            name="loginEmail"
            type="email"
            required
            disabled={pending}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {state.fieldErrors?.loginEmail && <p className="text-xs text-destructive">{state.fieldErrors.loginEmail}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">Temporary password</label>
          <input
            id="password"
            name="password"
            type="text"
            required
            minLength={8}
            disabled={pending}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {state.fieldErrors?.password && <p className="text-xs text-destructive">{state.fieldErrors.password}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="text"
            required
            disabled={pending}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {state.fieldErrors?.confirmPassword && <p className="text-xs text-destructive">{state.fieldErrors.confirmPassword}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : 'Enable Portal'}
        </button>
      </div>
    </form>
  );
}

function ResetPasswordForm({
  clientId,
  state,
  action,
  pending,
  onClose,
}: {
  clientId: string;
  state: ClientActionState;
  action: (formData: FormData) => void;
  pending: boolean;
  onClose: () => void;
}) {
  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4">
      <input type="hidden" name="clientId" value={clientId} />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">New password</label>
          <input
            id="password"
            name="password"
            type="text"
            required
            minLength={8}
            disabled={pending}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {state.fieldErrors?.password && <p className="text-xs text-destructive">{state.fieldErrors.password}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="text"
            required
            disabled={pending}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {state.fieldErrors?.confirmPassword && <p className="text-xs text-destructive">{state.fieldErrors.confirmPassword}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Resetting…</> : 'Reset Password'}
        </button>
      </div>
    </form>
  );
}
