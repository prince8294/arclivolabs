'use client';

import { useActionState } from 'react';

import Button from '@/components/ui/button';
import { createClientRequirement, type ClientPortalActionState } from '@/lib/actions/client-portal';

const initial: ClientPortalActionState = { ok: false };
export default function RequirementForm({ projects }: { projects: Array<{ id: string; projectCode: string; title: string }> }) {
  const [state, action, pending] = useActionState(createClientRequirement, initial);
  return <form action={action} className="space-y-4 rounded-lg border border-border bg-card p-5"><h2 className="font-semibold">Submit a requirement</h2>{state.error && <p className="text-sm text-destructive">{state.error}</p>}{state.ok && <p className="text-sm text-success">{state.message}</p>}<select name="projectId" required defaultValue="" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="" disabled>Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.projectCode} — {project.title}</option>)}</select><input name="title" required minLength={3} maxLength={200} placeholder="Requirement title" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" /><textarea name="description" required minLength={10} maxLength={5000} rows={5} placeholder="Describe the requirement, expected outcome and important details" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><Button type="submit" disabled={pending || projects.length === 0}>{pending ? 'Submitting…' : 'Submit requirement'}</Button></form>;
}
