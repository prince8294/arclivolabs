import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import { InvoiceDetailView } from '@/components/billing/invoice-detail';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { getClientInvoiceDetail } from '@/lib/queries/invoices';
import { listPaymentsPage } from '@/lib/queries/payments';
import SimpleTable from '@/components/management/simple-table';
import ButtonLink from '@/components/ui/button-link';
import { formatMinor } from '@/lib/utils/money';
import { formatDate } from '@/lib/utils/format';

interface ClientInvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ClientInvoiceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Invoice Details`,
  };
}

export default async function ClientInvoiceDetailPage({ params }: ClientInvoiceDetailPageProps) {
  const clientProfile = await requireClientProfile();
  const { id } = await params;

  const invoice = await getClientInvoiceDetail(id, clientProfile.id);
  if (!invoice) {
    notFound();
  }

  const displayCode = invoice.invoiceNumber || invoice.invoiceCode;
  const payments = await listPaymentsPage({ clientId: clientProfile.id, invoiceId: id, limit: 100 });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Invoice ${displayCode}`}
        description={`Issued billing document for ${clientProfile.name}.`}
        action={
          <><Link
            href="/client/invoices"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </Link>{invoice.amountDueMinor > 0 && invoice.status === 'ISSUED' && <ButtonLink href={`/client/payments/new?invoiceId=${id}`}>Submit payment</ButtonLink>}</>
        }
      />

      <InvoiceDetailView invoice={invoice} isAdmin={false} />
      <div className="space-y-3 rounded-xl border bg-card p-6"><h2 className="text-base font-semibold">Payment history</h2><p className="text-sm text-muted-foreground">Only verified payments affect the paid and outstanding totals above.</p><SimpleTable hrefBase="/client/payments" columns={[{ key: 'code', label: 'Payment' }, { key: 'amount', label: 'Amount' }, { key: 'reference', label: 'Reference' }, { key: 'status', label: 'Status' }, { key: 'date', label: 'Submitted' }]} rows={payments.items.map((row) => ({ id: row.id, code: row.paymentCode, amount: formatMinor(row.amountMinor, row.currency), reference: row.reference, status: row.status, date: formatDate(row.submittedAt) }))} /></div>
    </div>
  );
}
