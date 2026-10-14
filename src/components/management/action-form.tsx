'use client';
import { useActionState } from 'react';
import Button from '@/components/ui/button';

export interface BasicActionState { ok: boolean; error?: string; message?: string; id?: string; }
export default function ActionForm({ action, children, submitLabel = 'Save', className = 'space-y-4' }: { action: (previous: BasicActionState, formData: FormData) => Promise<BasicActionState>; children: React.ReactNode; submitLabel?: string; className?: string; }) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  return <form action={formAction} className={className}>{children}{state.error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}{state.ok && state.message && <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">{state.message}</p>}<Button type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button></form>;
}
