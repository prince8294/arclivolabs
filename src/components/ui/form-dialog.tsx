'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

export interface FormDialogProps {
  title: string;
  description?: string;
  pending: boolean;
  /** Safe error text from the action state. */
  error?: string;
  onClose: () => void;
  /** The submitting form, owned by the caller. */
  children: React.ReactNode;
  /** `md` fits short forms, `lg` the longer activity forms. */
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * Reusable modal shell for form dialogs.
 *
 * Deliberately hand-built (the project ships no dialog primitive):
 * - Escape and overlay click close it, never while a mutation is pending.
 * - Focus moves to the first form control on open and the dialog is
 *   labelled by its heading, so keyboard and screen-reader users land in
 *   the right place.
 * - The page behind is scroll-locked while the dialog is open.
 * - The caller owns the `<form action={...}>`, so every mutation still
 *   goes through a server action.
 */
export default function FormDialog({
  title,
  description,
  pending,
  error,
  onClose,
  children,
  size = 'md',
  className,
}: FormDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) {
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pending, onClose]);

  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const focusable = panel.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button'
    );
    focusable?.focus();
  }, []);

  const titleId = 'form-dialog-title';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
      <div
        className="fixed inset-0 bg-foreground/40"
        onClick={() => {
          if (!pending) {
            onClose();
          }
        }}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative w-full rounded-t-xl border border-border bg-card p-5 shadow-lg sm:rounded-xl sm:p-6',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-base font-semibold text-foreground"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
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

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
