'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';

import Button from '@/components/ui/button';
import { issueInvoiceAction } from '@/lib/actions/invoices';

interface IssueInvoiceDialogProps {
  invoiceId: string;
  invoiceCode: string;
  isOpen: boolean;
  onClose: () => void;
}

export function IssueInvoiceDialog({
  invoiceId,
  invoiceCode,
  isOpen,
  onClose,
}: IssueInvoiceDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleConfirm() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await issueInvoiceAction(invoiceId);
      if (!res.success) {
        setError(res.error || 'Failed to issue invoice.');
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
      <div className="relative w-full max-w-md rounded-xl border border-primary/20 bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3 text-primary mb-3">
          <div className="rounded-full bg-primary/10 p-2">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Issue Invoice</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Issuing draft invoice <span className="font-semibold text-foreground">{invoiceCode}</span> will:
        </p>

        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1 mb-4">
          <li>Allocate a unique, annual sequential invoice number (e.g. INV-2026-XXXX).</li>
          <li>Freeze the current client and seller billing snapshots into immutable historical records.</li>
          <li>Make the official invoice PDF downloadable and visible to the client portal.</li>
          <li>Mark any linked payment milestone as billed.</li>
        </ul>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

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
            type="button"
            variant="primary"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Issuing...
              </>
            ) : (
              'Confirm & Issue'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
