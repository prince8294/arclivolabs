'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';

import Button from '@/components/ui/button';
import { voidInvoiceAction } from '@/lib/actions/invoices';

interface VoidInvoiceDialogProps {
  invoiceId: string;
  invoiceCode: string;
  isOpen: boolean;
  onClose: () => void;
}

export function VoidInvoiceDialog({
  invoiceId,
  invoiceCode,
  isOpen,
  onClose,
}: VoidInvoiceDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (reason.trim().length < 5) {
      setError('Please provide a cancellation / void reason with at least 5 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await voidInvoiceAction({ invoiceId, reason });
      if (!res.success) {
        setError(res.error || 'Failed to void invoice.');
      } else {
        onClose();
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3 text-destructive mb-3">
          <div className="rounded-full bg-destructive/10 p-2">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Void Invoice</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to void invoice <span className="font-semibold text-foreground">{invoiceCode}</span>?
          This action preserves the record for auditing, marks the invoice as void, but cannot be undone.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Void Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Scope reduced by mutual agreement, replaced by new invoice, etc."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Voiding...
                </>
              ) : (
                'Confirm Void'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
