'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import Button from '@/components/ui/button';
import Card, { CardContent } from '@/components/ui/card';
import { updateClientProfile } from '@/lib/actions/client-profile';
import { INITIAL_CLIENT_STATE, type ClientActionState } from '@/lib/validations/client';
import { cn } from '@/lib/utils/cn';

export interface ClientProfileFormValues {
  name: string;
  phone: string;
  alternatePhone: string;
  website: string;
}

export interface ClientProfileFormProps {
  initialValues: ClientProfileFormValues;
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

export default function ClientProfileForm({ initialValues }: ClientProfileFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ClientActionState,
    FormData
  >(updateClientProfile, INITIAL_CLIENT_STATE);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      {state.ok && (
        <div
          role="status"
          className="rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success"
        >
          {state.message ?? 'Profile updated successfully.'}
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="name" label="Name" required error={errors.name}>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              defaultValue={initialValues.name}
              disabled={pending}
              aria-invalid={errors.name ? true : undefined}
              className={cn(inputClasses, errors.name && 'border-destructive/60')}
            />
          </Field>

          <Field id="phone" label="Phone" error={errors.phone}>
            <input
              id="phone"
              name="phone"
              type="tel"
              maxLength={20}
              defaultValue={initialValues.phone}
              disabled={pending}
              aria-invalid={errors.phone ? true : undefined}
              className={cn(inputClasses, errors.phone && 'border-destructive/60')}
            />
          </Field>

          <Field id="alternatePhone" label="Alternate phone" error={errors.alternatePhone}>
            <input
              id="alternatePhone"
              name="alternatePhone"
              type="tel"
              maxLength={20}
              defaultValue={initialValues.alternatePhone}
              disabled={pending}
              aria-invalid={errors.alternatePhone ? true : undefined}
              className={cn(inputClasses, errors.alternatePhone && 'border-destructive/60')}
            />
          </Field>

          <Field id="website" label="Website" error={errors.website}>
            <input
              id="website"
              name="website"
              type="text"
              maxLength={200}
              defaultValue={initialValues.website}
              disabled={pending}
              aria-invalid={errors.website ? true : undefined}
              className={cn(inputClasses, errors.website && 'border-destructive/60')}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </form>
  );
}
