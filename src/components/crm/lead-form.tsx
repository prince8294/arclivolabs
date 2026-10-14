'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

import {
  createLead,
  updateLead,
  updateMyLead,
} from '@/lib/actions/leads';
import {
  CURRENCIES,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LOST_REASONS,
  LOST_REASON_LABELS,
} from '@/lib/constants/enums';
import { toDateTimeLocalValue } from '@/lib/utils/follow-up';
import type { AssignableMarketingUser, ServiceOption } from '@/lib/constants/leads';
import {
  INITIAL_LEAD_STATE,
  type LeadActionState,
} from '@/lib/validations/lead';
import { cn } from '@/lib/utils/cn';

const inputClasses =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const selectClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const labelClasses = 'text-sm font-medium text-foreground';

export interface LeadFormProps {
  mode: 'create' | 'edit';
  /** Admin may set source, status and assignee; marketing may not. */
  isAdmin?: boolean;
  /** Legacy page API retained while the CRM pages are migrated. */
  portal?: 'admin' | 'marketing';
  leadId?: string;
  initialValues?: LeadFormValues;
  /** Existing lead when editing. */
  initial?: {
    id: string;
    name: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    alternatePhone: string | null;
    website: string | null;
    source: string;
    serviceInterest: Array<{ id: string; name: string }>;
    estimatedBudget: number | null;
    currency: string;
    status: string;
    assignedToUserId: string | null;
    nextFollowUpAt: Date | null;
    notes: string | null;
    lostReason: string | null;
    lostReasonNote: string | null;
  };
  marketingUsers?: AssignableMarketingUser[];
  services: ServiceOption[];
  backHref?: string;
}

export interface LeadFormValues {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  alternatePhone: string;
  website: string;
  source: string;
  serviceInterest: string[];
  estimatedBudget: string;
  currency: string;
  status: string;
  assignedTo: string;
  nextFollowUpAt: string;
  notes: string;
  lostReason: string;
  lostReasonNote: string;
}

/**
 * Lead create / edit form.
 *
 * One form, two permission levels: admin sees the source,
 * status and assignee controls; marketing users create leads
 * for themselves and cannot change acquisition attribution or
 * ownership. The server re-enforces both rules — the form is
 * convenience, not the boundary.
 *
 * Advisory duplicate detection runs on create: a matching
 * email/phone shows a warning plus an explicit "create anyway"
 * path, never a hard block.
 */
export default function LeadForm({
  mode,
  isAdmin: explicitIsAdmin,
  portal,
  leadId,
  initial: modernInitial,
  initialValues,
  marketingUsers = [],
  services,
  backHref,
}: LeadFormProps) {
  const isAdmin = explicitIsAdmin ?? portal === 'admin';
  const initial = modernInitial ?? (initialValues ? {
    id: leadId ?? '',
    name: initialValues.name,
    companyName: initialValues.companyName || null,
    email: initialValues.email || null,
    phone: initialValues.phone || null,
    alternatePhone: initialValues.alternatePhone || null,
    website: initialValues.website || null,
    source: initialValues.source,
    serviceInterest: initialValues.serviceInterest.map((id) => ({ id, name: id })),
    estimatedBudget: initialValues.estimatedBudget === '' ? null : Number(initialValues.estimatedBudget),
    currency: initialValues.currency,
    status: initialValues.status,
    assignedToUserId: initialValues.assignedTo || null,
    nextFollowUpAt: initialValues.nextFollowUpAt ? new Date(initialValues.nextFollowUpAt) : null,
    notes: initialValues.notes || null,
    lostReason: initialValues.lostReason || null,
    lostReasonNote: initialValues.lostReasonNote || null,
  } : undefined);
  const resolvedBackHref = backHref ?? (portal === 'marketing' ? '/marketing/leads' : '/admin/crm/leads');
  const router = useRouter();
  const [state, action, pending] = useActionState<
    LeadActionState,
    FormData
  >(
    mode === 'create'
      ? createLead
      : isAdmin
        ? updateLead
        : updateMyLead,
    INITIAL_LEAD_STATE
  );

  const [selectedServices, setSelectedServices] = useState<
    string[]
  >(initial?.serviceInterest.map((service) => service.id) ?? []);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  const [acknowledged, setAcknowledged] =
    useState<typeof state | null>(null);
  if (state.ok && acknowledged !== state) {
    setAcknowledged(state);
  }

  const refreshed = useRef<typeof state | null>(null);
  useEffect(() => {
    if (state.ok && refreshed.current !== state) {
      refreshed.current = state;
      router.refresh();
    }
  }, [state, router]);

  const isLost =
    (initial?.status ?? '') === 'LOST' ||
    (state.fieldErrors && false);
  void isLost;

  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? (
      <p role="alert" className="text-xs text-destructive">
        {state.fieldErrors[name]}
      </p>
    ) : null;

  function toggleService(id: string, checked: boolean) {
    setSelectedServices((current) =>
      checked
        ? [...current, id]
        : current.filter((value) => value !== id)
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {confirmDuplicate && (
        <input
          type="hidden"
          name="confirmDuplicate"
          value="yes"
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-name" className={labelClasses}>
            Contact name
          </label>
          <input
            id="lead-name"
            name="name"
            type="text"
            required
            maxLength={100}
            defaultValue={initial?.name ?? ''}
            placeholder="Rahul Sharma"
            className={inputClasses}
          />
          {fieldError('name')}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="lead-companyName"
            className={labelClasses}
          >
            Company (optional)
          </label>
          <input
            id="lead-companyName"
            name="companyName"
            type="text"
            maxLength={200}
            defaultValue={initial?.companyName ?? ''}
            placeholder="ABC Restaurant"
            className={inputClasses}
          />
          {fieldError('companyName')}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-email" className={labelClasses}>
            Email
          </label>
          <input
            id="lead-email"
            name="email"
            type="email"
            maxLength={254}
            defaultValue={initial?.email ?? ''}
            placeholder="owner@abcrestaurant.com"
            className={inputClasses}
          />
          {fieldError('email')}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-phone" className={labelClasses}>
            Phone
          </label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            maxLength={20}
            defaultValue={initial?.phone ?? ''}
            placeholder="+91 98765 43210"
            className={inputClasses}
          />
          {fieldError('phone')}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="lead-alternatePhone"
            className={labelClasses}
          >
            Alternate phone (optional)
          </label>
          <input
            id="lead-alternatePhone"
            name="alternatePhone"
            type="tel"
            maxLength={20}
            defaultValue={initial?.alternatePhone ?? ''}
            className={inputClasses}
          />
          {fieldError('alternatePhone')}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-website" className={labelClasses}>
            Website (optional)
          </label>
          <input
            id="lead-website"
            name="website"
            type="text"
            maxLength={200}
            defaultValue={initial?.website ?? ''}
            placeholder="abcrestaurant.com"
            className={inputClasses}
          />
          {fieldError('website')}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {isAdmin && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lead-source" className={labelClasses}>
              Source
            </label>
            <select
              id="lead-source"
              name="source"
              defaultValue={initial?.source ?? LEAD_SOURCES.MANUAL}
              className={selectClasses}
            >
              {Object.values(LEAD_SOURCES).map((value) => (
                <option key={value} value={value}>
                  {LEAD_SOURCE_LABELS[value]}
                </option>
              ))}
            </select>
            {fieldError('source')}
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lead-status" className={labelClasses}>
              Pipeline status
            </label>
            <select
              id="lead-status"
              name="status"
              defaultValue={initial?.status ?? LEAD_STATUSES.NEW}
              className={selectClasses}
            >
              {Object.values(LEAD_STATUSES).map((value) => (
                <option key={value} value={value}>
                  {LEAD_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            {fieldError('status')}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="lead-estimatedBudget"
            className={labelClasses}
          >
            Estimated budget (optional)
          </label>
          <input
            id="lead-estimatedBudget"
            name="estimatedBudget"
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              initial?.estimatedBudget !== null &&
              initial?.estimatedBudget !== undefined
                ? initial.estimatedBudget
                : ''
            }
            placeholder="0"
            className={inputClasses}
          />
          {fieldError('estimatedBudget')}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-currency" className={labelClasses}>
            Currency
          </label>
          <select
            id="lead-currency"
            name="currency"
            defaultValue={initial?.currency ?? 'INR'}
            className={selectClasses}
          >
            {CURRENCIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {fieldError('currency')}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="lead-nextFollowUpAt"
            className={labelClasses}
          >
            Next follow-up (optional)
          </label>
          <input
            id="lead-nextFollowUpAt"
            name="nextFollowUpAt"
            type="datetime-local"
            defaultValue={toDateTimeLocalValue(
              initial?.nextFollowUpAt
            )}
            className={inputClasses}
          />
          {fieldError('nextFollowUpAt')}
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="lead-assignedTo"
              className={labelClasses}
            >
              Assigned marketing user
            </label>
            <select
              id="lead-assignedTo"
              name="assignedTo"
              defaultValue={initial?.assignedToUserId ?? ''}
              className={selectClasses}
            >
              <option value="">Unassigned</option>
              {marketingUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                  {user.marketingCode
                    ? ` — ${user.marketingCode}`
                    : ''}
                </option>
              ))}
            </select>
            {fieldError('assignedTo')}
          </div>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClasses}>Service interest</legend>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active services to select.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {services.map((service) => {
              const checked = selectedServices.includes(
                service.id
              );
              return (
                <label
                  key={service.id}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-x-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                    checked
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input bg-background text-muted-foreground hover:bg-accent'
                  )}
                >
                  <input
                    type="checkbox"
                    name="serviceInterest"
                    value={service.id}
                    checked={checked}
                    onChange={(event) =>
                      toggleService(
                        service.id,
                        event.target.checked
                      )
                    }
                    className="h-4 w-4"
                  />
                  {service.name}
                </label>
              );
            })}
          </div>
        )}
        {fieldError('serviceInterest')}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lead-notes" className={labelClasses}>
          General notes (optional)
        </label>
        <textarea
          id="lead-notes"
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={initial?.notes ?? ''}
          placeholder="High-level context. Calls, emails and meetings belong in the timeline."
          className={inputClasses}
        />
        {fieldError('notes')}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="lead-lostReason"
              className={labelClasses}
            >
              Lost reason (only when the lead is lost)
            </label>
            <select
              id="lead-lostReason"
              name="lostReason"
              defaultValue={initial?.lostReason ?? ''}
              className={selectClasses}
            >
              <option value="">Not specified</option>
              {Object.values(LOST_REASONS).map((value) => (
                <option key={value} value={value}>
                  {LOST_REASON_LABELS[value]}
                </option>
              ))}
            </select>
            {fieldError('lostReason')}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="lead-lostReasonNote"
              className={labelClasses}
            >
              Lost reason detail (optional)
            </label>
            <input
              id="lead-lostReasonNote"
              name="lostReasonNote"
              type="text"
              maxLength={500}
              defaultValue={initial?.lostReasonNote ?? ''}
              className={inputClasses}
            />
            {fieldError('lostReasonNote')}
          </div>
        </div>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}
      {state.warning && (
        <div
          role="alert"
          className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"
        >
          <p>{state.warning}</p>
          {state.duplicates && state.duplicates.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {state.duplicates.map((duplicate) => (
                <li key={duplicate.leadCode}>
                  <span className="font-mono text-xs">
                    {duplicate.leadCode}
                  </span>{' '}
                  — {duplicate.name}
                  {duplicate.companyName
                    ? ` (${duplicate.companyName})`
                    : ''}
                </li>
              ))}
            </ul>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-3 inline-flex h-9 items-center gap-x-2 rounded-lg border border-warning/40 bg-warning/10 px-3 text-sm font-medium text-warning transition-colors hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Create lead anyway
          </button>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={resolvedBackHref}
          className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
        >
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {pending ? 'Saving…' : mode === 'create' ? 'Create lead' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
