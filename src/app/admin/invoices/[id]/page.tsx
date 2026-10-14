import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import { InvoiceDetailView } from '@/components/billing/invoice-detail';
import { requireRole } from '@/lib/auth/authorization';
import { getInvoiceById } from '@/lib/queries/invoices';
import { USER_ROLES } from '@/types/auth';

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: InvoiceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) return { title: 'Invoice Not Found' };
  return {
    title: `Invoice ${invoice.invoiceNumber || invoice.invoiceCode}`,
  };
}

export default async function AdminInvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await params;

  const invoice = await getInvoiceById(id);
  if (!invoice) {
    notFound();
  }

  const displayCode = invoice.invoiceNumber || invoice.invoiceCode;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Invoice ${displayCode}`}
        description={`Commercial invoice issued for ${invoice.customerSnapshot?.clientName || 'Client'}.`}
        action={
          <Link
            href="/admin/invoices"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </Link>
        }
      />

      <InvoiceDetailView invoice={invoice} isAdmin={true} />
    </div>
  );
}
