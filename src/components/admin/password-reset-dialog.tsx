'use client';

import { useEffect, useActionState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';

import { resetInternalUserPassword } from '@/lib/actions/admin-users';
import {
  INITIAL_ADMIN_USER_STATE,
  type AdminUserActionState,
} from '@/lib/validations/admin-users';
import { cn } from '@/lib/utils/cn';

export interface PasswordResetDialogProps {
  /** Internal user id whose password is being reset. */
  userId: string;
  /** Noun used in the heading, e.g. "this employee". */
  subject: string;
  onClose: () => void;
  /** Called once after the action reports success. */
  onReset: () => void;
}

const inputClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Reset-password modal. Opens from the row actions / detail actions;
 * the mutation runs in the `resetInternalUserPassword` server action
 * (admin-only, validated, hashed via the shared utility). The entered
 * password is never shown again after submit.
 */
export default function PasswordResetDialog({
  userId,
  subject,
  onClose,
  onReset,
}: PasswordResetDialogProps) {
  const [state, formAction, pending] = useActionState<
    AdminUserActionState,
    FormData
  >(resetInternalUserPassword, INITIAL_ADMIN_USER_STATE);

  useEffect(() => {
    if (state?.ok) {
      onReset();
    }
  }, [state, onReset]);

  const passwordError = state.fieldErrors?.password;
  const confirmError = state.fieldErrors?.confirmPassword;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40"
        onClick={() => {
          if (!pending) {
            onClose();
          }
        }}
        aria-hidden="true"
      />
      <form
        action={formAction}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <div className="flex items-center gap-x-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <KeyRound className="h-5 w-5" />
          </span>
          <h2 id="reset-password-title" className="text-base font-semibold">
            Reset password for {subject}
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          The old password cannot be recovered. Choose a new temporary
          password to share with this user — they will be asked to set
          their own password on next sign-in.
        </p>

        <input type="hidden" name="id" value={userId} />

        {state.error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reset-password"
              className="text-sm font-medium text-foreground"
            >
              New password
            </label>
            <input
              id="reset-password"
              name="password"
              type="text"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              disabled={pending}
              aria-invalid={passwordError ? true : undefined}
              className={cn(inputClasses, passwordError && 'border-destructive/60')}
            />
            {passwordError && (
              <p className="text-xs text-destructive">{passwordError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reset-confirm-password"
              className="text-sm font-medium text-foreground"
            >
              Confirm new password
            </label>
            <input
              id="reset-confirm-password"
              name="confirmPassword"
              type="text"
              autoComplete="new-password"
              required
              disabled={pending}
              aria-invalid={confirmError ? true : undefined}
              className={cn(
                inputClasses,
                confirmError && 'border-destructive/60'
              )}
            />
            {confirmError && (
              <p className="text-xs text-destructive">{confirmError}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Updating…
              </>
            ) : (
              'Update password'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
