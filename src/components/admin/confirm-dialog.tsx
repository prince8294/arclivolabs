'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ConfirmDialogProps {
  title: string;
  description: string;
  /** Visual tone of the confirm button (default: danger). */
  tone?: 'danger' | 'primary';
  pending: boolean;
  /** Safe error text from the action state, if the mutation failed. */
  error?: string;
  onClose: () => void;
  /**
   * The submitting form (with its hidden inputs + submit button).
   * ConfirmDialog provides the modal chrome; the form owns the action.
   */
  children: React.ReactNode;
}

/**
 * Reusable confirmation modal (replaces browser `confirm()`).
 *
 * - Escape / overlay click / Cancel closes it (never while pending).
 * - The confirm button is the one inside `children`, so the actual
 *   request goes through the app's server action, not a client call.
 */
export default function ConfirmDialog({
  title,
  description,
  tone = 'danger',
  pending,
  error,
  onClose,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pending, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40"
        onClick={() => {
          if (!pending) {
            onClose();
          }
        }}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <div className="flex items-start gap-x-4">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              tone === 'danger'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary'
            )}
            aria-hidden="true"
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold text-foreground"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}
