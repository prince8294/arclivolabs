'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { login } from '@/lib/actions/auth';
import {
  INITIAL_LOGIN_STATE,
  type LoginState,
} from '@/lib/validations/auth';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';

const inputClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Interactive part of the login page only (form + password visibility).
 * The page and layout stay server components; the credential check,
 * session creation and redirect all happen in the `login` server action.
 */
export default function LoginForm() {
  const [state, formAction, pending] = useActionState<
    LoginState,
    FormData
  >(login, INITIAL_LOGIN_STATE);
  const [showPassword, setShowPassword] = useState(false);

  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Sign in to your account
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the credentials provided by Arclivo Labs administration.
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
          htmlFor="email"
          className="text-sm font-medium text-foreground"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'email-error' : undefined}
          className={cn(inputClasses, emailError && 'border-destructive/60')}
          placeholder="you@company.com"
        />
        {emailError && (
          <p id="email-error" className="text-xs text-destructive">
            {emailError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Password
          </label>
          <Link
            href={ROUTES.FORGOT_PASSWORD}
            className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            disabled={pending}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? 'password-error' : undefined}
            className={cn(
              inputClasses,
              'pr-11',
              passwordError && 'border-destructive/60'
            )}
            placeholder="Your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            disabled={pending}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {passwordError && (
          <p id="password-error" className="text-xs text-destructive">
            {passwordError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  );
}
