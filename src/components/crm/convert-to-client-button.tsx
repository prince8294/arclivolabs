'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Award, Loader2 } from 'lucide-react';

import { convertLeadToClient } from '@/lib/actions/clients';
import { INITIAL_CLIENT_STATE, type ClientActionState } from '@/lib/validations/client';
import { CLIENT_TYPE_LABELS } from '@/lib/constants/enums';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils/cn';

export interface ConvertToClientButtonProps {
  leadId: string;
  leadCode: string;
  isWon: boolean;
  convertedClientId: string | null;
  convertedClientCode?: string | null;
}

const labelButtonClasses =
  'inline-flex h-9 items-center gap-x-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';

export default function ConvertToClientButton({
  leadId,
  leadCode,
  isWon,
  convertedClientId,
  convertedClientCode,
}: ConvertToClientButtonProps) {
  const [state, formAction, pending] = useActionState<
    ClientActionState,
    FormData
  >(convertLeadToClient, INITIAL_CLIENT_STATE);

  if (convertedClientId) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
        <Award className="h-4 w-4" aria-hidden="true" />
        <span>
          Converted to <span className="font-mono font-semibold">{convertedClientCode ?? 'Client'}</span>.
        </span>
        <a
          href={`${ROUTES.ADMIN.CLIENTS}/${convertedClientId}`}
          className="ml-auto inline-flex items-center gap-x-1 text-sm font-medium underline"
        >
          View Client
        </a>
      </div>
    );
  }

  if (!isWon) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <Award className="h-4 w-4" aria-hidden="true" />
        <span>
          Lead must be marked <span className="font-medium text-foreground">Won</span> before it can be converted to a client.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Convert to Client</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Review the lead information and convert it to a confirmed client record.
        </p>
      </div>
      <form action={formAction} className="p-4">
        <input type="hidden" name="leadId" value={leadId} />
        {state.error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="type" className="text-xs font-medium text-muted-foreground">
              Client type <span className="text-destructive">*</span>
            </label>
            <select
              id="type"
              name="type"
              required
              disabled={pending}
              defaultValue="PERSON"
              className={cn(
                'h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                state.fieldErrors?.type && 'border-destructive/60'
              )}
            >
              {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {state.fieldErrors?.type && <p className="text-xs text-destructive">{state.fieldErrors.type}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-medium text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              disabled={pending}
              defaultValue=""
              placeholder="From lead"
              className={cn(
                'h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                state.fieldErrors?.name && 'border-destructive/60'
              )}
            />
            {state.fieldErrors?.name && <p className="text-xs text-destructive">{state.fieldErrors.name}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Email <span className="text-destructive">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={254}
              disabled={pending}
              defaultValue=""
              placeholder="From lead"
              className={cn(
                'h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                state.fieldErrors?.email && 'border-destructive/60'
              )}
            />
            {state.fieldErrors?.email && <p className="text-xs text-destructive">{state.fieldErrors.email}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-xs font-medium text-muted-foreground">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              maxLength={20}
              disabled={pending}
              defaultValue=""
              placeholder="From lead"
              className={cn(
                'h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                state.fieldErrors?.phone && 'border-destructive/60'
              )}
            />
            {state.fieldErrors?.phone && <p className="text-xs text-destructive">{state.fieldErrors.phone}</p>}
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className={cn(
              'inline-flex h-9 items-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              pending && 'pointer-events-none opacity-60'
            )}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Converting…
              </>
            ) : (
              <>
                <Award className="h-4 w-4" aria-hidden="true" />
                Convert {leadCode} to Client
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}