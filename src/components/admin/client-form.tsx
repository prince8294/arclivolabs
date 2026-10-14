'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import {
  createClient,
  updateClient,
} from '@/lib/actions/clients';
import {
  INITIAL_CLIENT_STATE,
  type ClientActionState,
  type ClientCreateInput,
} from '@/lib/validations/client';
import {
  CLIENT_SOURCE_LABELS,
  CLIENT_SOURCE_LABELS as SOURCE_LABELS,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_LABELS as STATUS_LABELS,
  CLIENT_TYPE_LABELS,
} from '@/lib/constants/enums';
import { cn } from '@/lib/utils/cn';

export interface ClientFormValues {
  type: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  alternatePhone: string;
  website: string;
  billingLine1: string;
  billingLine2: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: string;
  shippingLine1: string;
  shippingLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  taxId: string;
  assignedMarketingUserId: string;
  notes: string;
  status: string;
  source: string;
}

export interface ClientFormProps {
  mode: 'create' | 'edit';
  /** Present in edit mode; submitted as a hidden field. */
  clientId?: string;
  initialValues: ClientFormValues;
  marketingUsers?: Array<{ id: string; name: string; email: string; marketingCode: string | null }>;
}

const inputClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

const textareaClasses =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

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

export default function ClientForm({
  mode,
  clientId,
  initialValues,
  marketingUsers = [],
}: ClientFormProps) {
  const action = mode === 'create' ? createClient : updateClient;
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    ClientActionState,
    FormData
  >(action, INITIAL_CLIENT_STATE);

  const errors = state.fieldErrors ?? {};
  const v = initialValues;

  const marketingOptions = [
    { value: '', label: 'Unassigned' },
    ...marketingUsers.map((user) => ({
      value: user.id,
      label: `${user.name}${user.marketingCode ? ` · ${user.marketingCode}` : ''}`,
    })),
  ];

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      {mode === 'edit' && clientId && (
        <input type="hidden" name="id" value={clientId} />
      )}

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
          {state.message ?? 'Changes saved successfully.'}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Client details</CardTitle>
          <CardDescription>
            {mode === 'create'
              ? 'Create a new client record. Portal access can be enabled later.'
              : 'Update client details. Client code and origin cannot be changed here.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mode === 'edit' && (
            <Field id="status" label="Status" required error={errors.status}>
              <select
                id="status"
                name="status"
                required
                defaultValue={v.status}
                disabled={pending}
                aria-invalid={errors.status ? true : undefined}
                className={cn(inputClasses, errors.status && 'border-destructive/60')}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field id="type" label="Client type" required error={errors.type}>
            <select
              id="type"
              name="type"
              required
              defaultValue={v.type}
              disabled={pending}
              aria-invalid={errors.type ? true : undefined}
              className={cn(inputClasses, errors.type && 'border-destructive/60')}
            >
              {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          {mode === 'create' && (
            <Field id="source" label="Source" required error={errors.source}>
              <select
                id="source"
                name="source"
                required
                defaultValue={v.source}
                disabled={pending}
                aria-invalid={errors.source ? true : undefined}
                className={cn(inputClasses, errors.source && 'border-destructive/60')}
              >
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field id="name" label="Name" required error={errors.name}>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              defaultValue={v.name}
              disabled={pending}
              aria-invalid={errors.name ? true : undefined}
              className={cn(inputClasses, errors.name && 'border-destructive/60')}
            />
          </Field>

          <Field id="companyName" label="Company name" error={errors.companyName}>
            <input
              id="companyName"
              name="companyName"
              type="text"
              maxLength={200}
              defaultValue={v.companyName}
              disabled={pending}
              aria-invalid={errors.companyName ? true : undefined}
              className={cn(inputClasses, errors.companyName && 'border-destructive/60')}
            />
          </Field>

          <Field id="email" label="Email" required error={errors.email}>
            <input
              id="email"
              name="email"
              type="email"
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
              maxLength={20}
              defaultValue={v.phone}
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
              defaultValue={v.alternatePhone}
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
              defaultValue={v.website}
              disabled={pending}
              aria-invalid={errors.website ? true : undefined}
              className={cn(inputClasses, errors.website && 'border-destructive/60')}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field id="taxId" label="Tax ID / GSTIN" error={errors.taxId}>
              <input
                id="taxId"
                name="taxId"
                type="text"
                maxLength={50}
                defaultValue={v.taxId}
                disabled={pending}
                aria-invalid={errors.taxId ? true : undefined}
                className={cn(inputClasses, errors.taxId && 'border-destructive/60')}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field id="assignedMarketingUserId" label="Assigned marketing" error={errors.assignedMarketingUserId}>
              <select
                id="assignedMarketingUserId"
                name="assignedMarketingUserId"
                defaultValue={v.assignedMarketingUserId}
                disabled={pending}
                aria-invalid={errors.assignedMarketingUserId ? true : undefined}
                className={cn(inputClasses, errors.assignedMarketingUserId && 'border-destructive/60')}
              >
                {marketingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>Used for future invoices.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="billingLine1" label="Billing address line 1" error={errors.billingAddress}>
              <input
                id="billingLine1"
                name="billingLine1"
                type="text"
                maxLength={200}
                defaultValue={v.billingLine1}
                disabled={pending}
                className={cn(inputClasses, errors.billingAddress && 'border-destructive/60')}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="billingLine2" label="Billing address line 2" error={errors.billingAddress}>
              <input
                id="billingLine2"
                name="billingLine2"
                type="text"
                maxLength={200}
                defaultValue={v.billingLine2}
                disabled={pending}
                className={cn(inputClasses, errors.billingAddress && 'border-destructive/60')}
              />
            </Field>
          </div>
          <Field id="billingCity" label="Billing city" error={errors.billingAddress}>
            <input
              id="billingCity"
              name="billingCity"
              type="text"
              maxLength={100}
              defaultValue={v.billingCity}
              disabled={pending}
              className={cn(inputClasses, errors.billingAddress && 'border-destructive/60')}
            />
          </Field>
          <Field id="billingState" label="Billing state" error={errors.billingAddress}>
            <input
              id="billingState"
              name="billingState"
              type="text"
              maxLength={100}
              defaultValue={v.billingState}
              disabled={pending}
              className={cn(inputClasses, errors.billingAddress && 'border-destructive/60')}
            />
          </Field>
          <Field id="billingPostalCode" label="Billing postal code" error={errors.billingAddress}>
            <input
              id="billingPostalCode"
              name="billingPostalCode"
              type="text"
              maxLength={20}
              defaultValue={v.billingPostalCode}
              disabled={pending}
              className={cn(inputClasses, errors.billingAddress && 'border-destructive/60')}
            />
          </Field>
          <Field id="billingCountry" label="Billing country" error={errors.billingAddress}>
            <input
              id="billingCountry"
              name="billingCountry"
              type="text"
              maxLength={100}
              defaultValue={v.billingCountry}
              disabled={pending}
              className={cn(inputClasses, errors.billingAddress && 'border-destructive/60')}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping</CardTitle>
          <CardDescription>Optional. Leave blank if the same as billing.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="shippingLine1" label="Shipping address line 1" error={errors.shippingAddress}>
              <input
                id="shippingLine1"
                name="shippingLine1"
                type="text"
                maxLength={200}
                defaultValue={v.shippingLine1}
                disabled={pending}
                className={cn(inputClasses, errors.shippingAddress && 'border-destructive/60')}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="shippingLine2" label="Shipping address line 2" error={errors.shippingAddress}>
              <input
                id="shippingLine2"
                name="shippingLine2"
                type="text"
                maxLength={200}
                defaultValue={v.shippingLine2}
                disabled={pending}
                className={cn(inputClasses, errors.shippingAddress && 'border-destructive/60')}
              />
            </Field>
          </div>
          <Field id="shippingCity" label="Shipping city" error={errors.shippingAddress}>
            <input
              id="shippingCity"
              name="shippingCity"
              type="text"
              maxLength={100}
              defaultValue={v.shippingCity}
              disabled={pending}
              className={cn(inputClasses, errors.shippingAddress && 'border-destructive/60')}
            />
          </Field>
          <Field id="shippingState" label="Shipping state" error={errors.shippingAddress}>
            <input
              id="shippingState"
              name="shippingState"
              type="text"
              maxLength={100}
              defaultValue={v.shippingState}
              disabled={pending}
              className={cn(inputClasses, errors.shippingAddress && 'border-destructive/60')}
            />
          </Field>
          <Field id="shippingPostalCode" label="Shipping postal code" error={errors.shippingAddress}>
            <input
              id="shippingPostalCode"
              name="shippingPostalCode"
              type="text"
              maxLength={20}
              defaultValue={v.shippingPostalCode}
              disabled={pending}
              className={cn(inputClasses, errors.shippingAddress && 'border-destructive/60')}
            />
          </Field>
          <Field id="shippingCountry" label="Shipping country" error={errors.shippingAddress}>
            <input
              id="shippingCountry"
              name="shippingCountry"
              type="text"
              maxLength={100}
              defaultValue={v.shippingCountry}
              disabled={pending}
              className={cn(inputClasses, errors.shippingAddress && 'border-destructive/60')}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Internal notes only. Not visible to the client.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field id="notes" label="Notes" error={errors.notes}>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={v.notes}
              disabled={pending}
              aria-invalid={errors.notes ? true : undefined}
              className={cn(textareaClasses, errors.notes && 'border-destructive/60')}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
        >
          Cancel
        </button>
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
            'Create Client'
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </form>
  );
}