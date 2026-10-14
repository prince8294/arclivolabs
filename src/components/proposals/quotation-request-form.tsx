'use client';

import { useActionState, useState } from 'react';

import Button from '@/components/ui/button';
import { createQuotationRequest } from '@/lib/actions/proposal-form-actions';
import { CURRENCIES } from '@/lib/constants/enums';
import { REQUEST_PRIORITIES, REQUEST_PRIORITY_LABELS } from '@/lib/constants/proposals';
import { INITIAL_PROPOSAL_STATE } from '@/lib/validations/proposal';
import type { ProposalPartyOption } from '@/types/proposals';

const input = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export default function QuotationRequestForm({ parties, services }: { parties: ProposalPartyOption[]; services: string[] }) {
  const [state, action, pending] = useActionState(createQuotationRequest, INITIAL_PROPOSAL_STATE);
  const [kind, setKind] = useState<'lead' | 'client'>('lead');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const options = parties.filter((item) => item.kind === kind);
  return <form action={action} className="space-y-5 rounded-lg border border-border bg-card p-6">
    <input type="hidden" name="requestedServicesJson" value={JSON.stringify(selectedServices)} />
    {state.error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}
    {state.ok && state.message && <p role="status" className="rounded-md bg-success/10 p-3 text-sm text-success">{state.message}</p>}
    <div className="grid gap-4 md:grid-cols-2"><label className="space-y-1 text-sm font-medium">Request for<select className={input} value={kind} onChange={(event) => setKind(event.target.value as 'lead' | 'client')}><option value="lead">Lead</option><option value="client">Client</option></select></label><label className="space-y-1 text-sm font-medium">Customer<select className={input} name={kind === 'lead' ? 'leadId' : 'clientId'} required defaultValue=""><option value="" disabled>Select customer</option>{options.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label></div>
    <fieldset><legend className="mb-2 text-sm font-medium">Requested services</legend><div className="grid gap-2 sm:grid-cols-2">{services.map((service) => <label key={service} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"><input type="checkbox" checked={selectedServices.includes(service)} onChange={(event) => setSelectedServices((current) => event.target.checked ? [...current, service] : current.filter((item) => item !== service))} />{service}</label>)}</div></fieldset>
    <label className="block space-y-1 text-sm font-medium">Requirements<textarea name="requirements" required rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></label>
    <div className="grid gap-4 md:grid-cols-3"><label className="space-y-1 text-sm font-medium">Expected budget<input name="expectedBudget" type="number" min="0" step="0.01" className={input} /></label><label className="space-y-1 text-sm font-medium">Currency<select name="currency" defaultValue="INR" className={input}>{CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label><label className="space-y-1 text-sm font-medium">Priority<select name="priority" defaultValue={REQUEST_PRIORITIES.MEDIUM} className={input}>{Object.values(REQUEST_PRIORITIES).map((priority) => <option key={priority} value={priority}>{REQUEST_PRIORITY_LABELS[priority]}</option>)}</select></label></div>
    <label className="block space-y-1 text-sm font-medium">Expected timeline<input name="expectedTimeline" className={input} placeholder="e.g. 6 weeks" /></label>
    <label className="block space-y-1 text-sm font-medium">Customer notes<textarea name="customerNotes" rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></label>
    <Button type="submit" disabled={pending || selectedServices.length === 0}>{pending ? 'Submitting…' : 'Submit quotation request'}</Button>
  </form>;
}
