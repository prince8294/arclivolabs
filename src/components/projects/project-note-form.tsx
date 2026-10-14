'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, MessageSquarePlus } from 'lucide-react';

import Button from '@/components/ui/button';
import { addProjectNote } from '@/lib/actions/projects';

const textareaClasses =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Internal project note composer (§44).
 *
 * Notes are internal-only by construction - they live on the project document
 * and are never read by the Client Portal or the Marketing portal.
 */
export default function ProjectNoteForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await addProjectNote(projectId, { note });
      if (result.success) {
        setNote('');
        setSuccess(result.message ?? 'Note added.');
        router.refresh();
        return;
      }
      setError(result.message ?? 'Unable to add the note.');
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {success}
        </p>
      ) : null}

      <div>
        <label htmlFor="project-note" className="text-sm font-medium text-foreground">
          Add an internal note
        </label>
        <textarea
          id="project-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className={`${textareaClasses} mt-1.5`}
          placeholder="e.g. Awaiting content from the customer."
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Internal only. Never visible to the client or the marketing team.
        </p>
      </div>

      <div>
        <Button type="submit" size="sm" disabled={isPending || note.trim().length === 0}>
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          {isPending ? 'Saving...' : 'Add note'}
        </Button>
      </div>
    </form>
  );
}
