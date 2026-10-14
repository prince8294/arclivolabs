'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { changeOwnPassword } from '@/lib/actions/auth';
import {
  INITIAL_CHANGE_PASSWORD_STATE,
  type ChangePasswordState,
} from '@/lib/validations/auth';
import { cn } from '@/lib/utils/cn';

const inputClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Form for the forced first-login password change.
 *
 * The user is already authenticated with the admin-assigned temporary
 * credential, and the server verifies it again before accepting the
 * new password (possession proof). On success the action clears
 * `mustChangePassword` and redirects to the user's dashboard.
 */
export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<
    ChangePasswordState,
    FormData
  >(changeOwnPassword, INITIAL_CHANGE_PASSWORD_STATE);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const currentError = state.fieldErrors?.currentPassword;
  const newError = state.fieldErrors?.password;
  const confirmError = state.fieldErrors?.confirmPassword;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Set your own password
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account was created with a temporary password. Choose the
          password you will use going forward.
        </p>
      </div>

      {state.message && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {state.message}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="currentPassword"
          className="text-sm font-medium text-foreground"
        >
          Current (temporary) password
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            name="currentPassword"
            type={showCurrent ? 'text' : 'password'}
            autoComplete="current-password"
            required
            disabled={pending}
            aria-invalid={currentError ? true : undefined}
            aria-describedby={currentError ? 'current-password-error' : undefined}
            className={cn(inputClasses, 'pr-11', currentError && 'border-destructive/60')}
            placeholder="Temporary password you were given"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((value) => !value)}
            disabled={pending}
            aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {showCurrent ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {currentError && (
          <p id="current-password-error" className="text-xs text-destructive">
            {currentError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-sm font-medium text-foreground"
        >
          New password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            disabled={pending}
            aria-invalid={newError ? true : undefined}
            aria-describedby={newError ? 'new-password-error' : undefined}
            className={cn(inputClasses, 'pr-11', newError && 'border-destructive/60')}
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowNew((value) => !value)}
            disabled={pending}
            aria-label={showNew ? 'Hide new password' : 'Show new password'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {showNew ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {newError && (
          <p id="new-password-error" className="text-xs text-destructive">
            {newError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-foreground"
        >
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
          aria-invalid={confirmError ? true : undefined}
          aria-describedby={confirmError ? 'confirm-password-error' : undefined}
          className={cn(inputClasses, confirmError && 'border-destructive/60')}
          placeholder="Repeat the new password"
        />
        {confirmError && (
          <p id="confirm-password-error" className="text-xs text-destructive">
            {confirmError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Setting password…
          </>
        ) : (
          'Set new password'
        )}
      </button>
    </form>
  );
}
