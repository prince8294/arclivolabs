'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import {
  createMarketing,
  updateMarketing,
} from '@/lib/actions/admin-users';
import {
  INITIAL_ADMIN_USER_STATE,
  type AdminUserActionState,
} from '@/lib/validations/admin-users';
import {
  COMMISSION_TYPE_LABELS,
  COMMISSION_TYPES,
} from '@/lib/constants/enums';
import { cn } from '@/lib/utils/cn';

export interface MarketingFormValues {
  name: string;
  email: string;
  phone: string;
  designation: string;
  joiningDate: string;
  commissionType: string;
  commissionValue: string;
  target: string;
  notes: string;
}

export interface MarketingFormProps {
  mode: 'create' | 'edit';
  /** Present in edit mode; submitted as a hidden field. */
  userId?: string;
  initialValues: MarketingFormValues;
}

const inputClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Create / edit form for a marketing user (account + profile in one
 * workflow). Temporary password fields appear only in create mode.
 */
export default function MarketingForm({
  mode,
  userId,
  initialValues,
}: MarketingFormProps) {
  const action = mode === 'create' ? createMarketing : updateMarketing;
  const [state, formAction, pending] = useActionState<
    AdminUserActionState,
    FormData
  >(action, INITIAL_ADMIN_USER_STATE);

  const errors = state.fieldErrors ?? {};
  const v = initialValues;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      {mode === 'edit' && userId && (
        <input type="hidden" name="id" value={userId} />
      )}

      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Sign-in identity. The email is unique across the whole
            system and is the login identifier.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="name" label="Full name" required error={errors.name}>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={v.name}
              disabled={pending}
              aria-invalid={errors.name ? true : undefined}
              className={cn(inputClasses, errors.name && 'border-destructive/60')}
            />
          </Field>

          <Field id="email" label="Email" required error={errors.email}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              defaultValue={v.email}
              disabled={pending}
              aria-invalid={errors.email ? true : undefined}
              className={cn(inputClasses, errors.email && 'border-destructive/60')}
            />
          </Field>

          <Field id="phone" label="Phone" error={errors.phone}>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={20}
              placeholder="+91 90000 00000"
              defaultValue={v.phone}
              disabled={pending}
              aria-invalid={errors.phone ? true : undefined}
              className={cn(inputClasses, errors.phone && 'border-destructive/60')}
            />
          </Field>

          {mode === 'create' && (
            <>
              <Field
                id="password"
                label="Temporary password"
                required
                error={errors.password}
              >
                <input
                  id="password"
                  name="password"
                  type="text"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                  disabled={pending}
                  aria-invalid={errors.password ? true : undefined}
                  className={cn(
                    inputClasses,
                    errors.password && 'border-destructive/60'
                  )}
                />
              </Field>
              <Field
                id="confirmPassword"
                label="Confirm password"
                required
                error={errors.confirmPassword}
              >
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="text"
                  autoComplete="new-password"
                  required
                  disabled={pending}
                  aria-invalid={errors.confirmPassword ? true : undefined}
                  className={cn(
                    inputClasses,
                    errors.confirmPassword && 'border-destructive/60'
                  )}
                />
              </Field>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marketing profile</CardTitle>
          <CardDescription>
            Commission rules are stored only; actual commission payouts
            are calculated in a later phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="designation"
            label="Designation"
            required
            error={errors.designation}
          >
            <input
              id="designation"
              name="designation"
              type="text"
              required
              maxLength={100}
              placeholder="e.g. Lead Generator"
              defaultValue={v.designation}
              disabled={pending}
              aria-invalid={errors.designation ? true : undefined}
              className={cn(
                inputClasses,
                errors.designation && 'border-destructive/60'
              )}
            />
          </Field>

          <Field
            id="joiningDate"
            label="Joining date"
            required
            error={errors.joiningDate}
          >
            <input
              id="joiningDate"
              name="joiningDate"
              type="date"
              required
              defaultValue={v.joiningDate}
              disabled={pending}
              aria-invalid={errors.joiningDate ? true : undefined}
              className={cn(
                inputClasses,
                errors.joiningDate && 'border-destructive/60'
              )}
            />
          </Field>

          <Field
            id="commissionType"
            label="Commission type"
            required
            error={errors.commissionType}
          >
            <select
              id="commissionType"
              name="commissionType"
              required
              defaultValue={v.commissionType}
              disabled={pending}
              aria-invalid={errors.commissionType ? true : undefined}
              className={cn(
                inputClasses,
                errors.commissionType && 'border-destructive/60'
              )}
            >
              {Object.values(COMMISSION_TYPES).map((value) => (
                <option key={value} value={value}>
                  {COMMISSION_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              id="commissionValue"
              label="Commission value"
              required
              error={errors.commissionValue}
              hint="0–100 for percentage, any non-negative amount for fixed."
            >
              <input
                id="commissionValue"
                name="commissionValue"
                type="number"
                min={0}
                step="0.01"
                required
                placeholder="0"
                defaultValue={v.commissionValue}
                disabled={pending}
                aria-invalid={errors.commissionValue ? true : undefined}
                className={cn(
                  inputClasses,
                  errors.commissionValue && 'border-destructive/60'
                )}
              />
            </Field>
            <Field
              id="target"
              label="Target"
              error={errors.target}
              hint="Optional period target amount."
            >
              <input
                id="target"
                name="target"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                defaultValue={v.target}
                disabled={pending}
                aria-invalid={errors.target ? true : undefined}
                className={cn(
                  inputClasses,
                  errors.target && 'border-destructive/60'
                )}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field id="notes" label="Notes" error={errors.notes}>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={2000}
                defaultValue={v.notes}
                disabled={pending}
                aria-invalid={errors.notes ? true : undefined}
                className={cn(
                  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                  errors.notes && 'border-destructive/60'
                )}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {mode === 'create' ? 'Creating…' : 'Saving…'}
            </>
          ) : mode === 'create' ? (
            'Create marketing user'
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </form>
  );
}
