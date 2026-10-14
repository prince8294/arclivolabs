'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import {
  createEmployee,
  updateEmployee,
} from '@/lib/actions/admin-users';
import {
  INITIAL_ADMIN_USER_STATE,
  type AdminUserActionState,
} from '@/lib/validations/admin-users';
import {
  EMPLOYEE_DEPARTMENT_LABELS,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPES,
} from '@/lib/constants/enums';
import { cn } from '@/lib/utils/cn';

export interface EmployeeFormValues {
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  employmentType: string;
  joiningDate: string;
  paymentType: string;
  baseAmount: string;
  currency: string;
  skills: string;
  address: string;
  emergencyContact: string;
  notes: string;
}

export interface EmployeeFormProps {
  mode: 'create' | 'edit';
  /** Present in edit mode; submitted as a hidden field. */
  userId?: string;
  initialValues: EmployeeFormValues;
}

const inputClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

const labelClasses = 'text-sm font-medium text-foreground';

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClasses}>
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Create / edit form for an employee (account + profile in one
 * workflow). The submit handler is the matching server action; the
 * account password fields only appear in create mode — afterwards the
 * admin uses "Reset Password" instead.
 */
export default function EmployeeForm({
  mode,
  userId,
  initialValues,
}: EmployeeFormProps) {
  const action = mode === 'create' ? createEmployee : updateEmployee;
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
          <CardTitle>Employee profile</CardTitle>
          <CardDescription>
            Role-specific details. Base amount is confidential and only
            visible to admins.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="department"
            label="Department"
            required
            error={errors.department}
          >
            <select
              id="department"
              name="department"
              required
              defaultValue={v.department}
              disabled={pending}
              aria-invalid={errors.department ? true : undefined}
              className={cn(
                inputClasses,
                errors.department && 'border-destructive/60'
              )}
            >
              <option value="" disabled>
                Select a department
              </option>
              {Object.values(EMPLOYEE_DEPARTMENTS).map((value) => (
                <option key={value} value={value}>
                  {EMPLOYEE_DEPARTMENT_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

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
              placeholder="e.g. Senior Web Developer"
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
            id="employmentType"
            label="Employment type"
            required
            error={errors.employmentType}
          >
            <select
              id="employmentType"
              name="employmentType"
              required
              defaultValue={v.employmentType}
              disabled={pending}
              aria-invalid={errors.employmentType ? true : undefined}
              className={cn(
                inputClasses,
                errors.employmentType && 'border-destructive/60'
              )}
            >
              <option value="" disabled>
                Select a type
              </option>
              {Object.values(EMPLOYMENT_TYPES).map((value) => (
                <option key={value} value={value}>
                  {EMPLOYMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
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
            id="paymentType"
            label="Payment type"
            required
            error={errors.paymentType}
          >
            <select
              id="paymentType"
              name="paymentType"
              required
              defaultValue={v.paymentType}
              disabled={pending}
              aria-invalid={errors.paymentType ? true : undefined}
              className={cn(
                inputClasses,
                errors.paymentType && 'border-destructive/60'
              )}
            >
              <option value="" disabled>
                Select a payment type
              </option>
              {Object.values(PAYMENT_TYPES).map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              id="baseAmount"
              label="Base amount"
              error={errors.baseAmount}
            >
              <input
                id="baseAmount"
                name="baseAmount"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                defaultValue={v.baseAmount}
                disabled={pending}
                aria-invalid={errors.baseAmount ? true : undefined}
                className={cn(
                  inputClasses,
                  errors.baseAmount && 'border-destructive/60'
                )}
              />
            </Field>
            <Field id="currency" label="Currency" required error={errors.currency}>
              <input
                id="currency"
                name="currency"
                type="text"
                required
                maxLength={3}
                placeholder="INR"
                defaultValue={v.currency}
                disabled={pending}
                aria-invalid={errors.currency ? true : undefined}
                className={cn(
                  inputClasses,
                  'uppercase',
                  errors.currency && 'border-destructive/60'
                )}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              id="skills"
              label="Skills"
              error={errors.skills}
            >
              <input
                id="skills"
                name="skills"
                type="text"
                maxLength={500}
                placeholder="React, Node.js, PostgreSQL (comma separated)"
                defaultValue={v.skills}
                disabled={pending}
                aria-invalid={errors.skills ? true : undefined}
                className={cn(
                  inputClasses,
                  errors.skills && 'border-destructive/60'
                )}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field id="address" label="Address" error={errors.address}>
              <textarea
                id="address"
                name="address"
                rows={2}
                maxLength={500}
                defaultValue={v.address}
                disabled={pending}
                aria-invalid={errors.address ? true : undefined}
                className={cn(
                  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                  errors.address && 'border-destructive/60'
                )}
              />
            </Field>
          </div>

          <Field
            id="emergencyContact"
            label="Emergency contact"
            error={errors.emergencyContact}
          >
            <input
              id="emergencyContact"
              name="emergencyContact"
              type="tel"
              maxLength={20}
              placeholder="+91 90000 00000"
              defaultValue={v.emergencyContact}
              disabled={pending}
              aria-invalid={errors.emergencyContact ? true : undefined}
              className={cn(
                inputClasses,
                errors.emergencyContact && 'border-destructive/60'
              )}
            />
          </Field>

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
            'Create employee'
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </form>
  );
}
