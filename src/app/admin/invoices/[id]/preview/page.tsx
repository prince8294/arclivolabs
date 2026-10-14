import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { getInvoiceById } from '@/lib/queries/invoices';
import { USER_ROLES } from '@/types/auth';

interface InvoicePreviewPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: InvoicePreviewPageProps): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) return { title: 'Invoice Not Found' };
  return {
    title: `Preview: ${invoice.invoiceNumber || invoice.invoiceCode}`,
  };
}

export default async function AdminInvoicePreviewPage({ params }: InvoicePreviewPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await params;

  const invoice = await getInvoiceById(id);
  if (!invoice) {
    notFound();
  }

  const displayCode = invoice.invoiceNumber || invoice.invoiceCode;

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-140px)]">
      <PageHeader
        title={`PDF Preview: ${displayCode}`}
        description="Official branded PDF render preview."
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/invoices/${id}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <a
              href={`/api/invoices/${id}/pdf`}
              download={`${displayCode}.pdf`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </div>
        }
      />

      <div className="flex-1 rounded-xl border border-border overflow-hidden bg-muted/40 shadow-xs">
        <iframe
          src={`/api/invoices/${id}/pdf`}
          className="w-full h-full border-0"
          title={`Invoice ${displayCode} PDF Preview`}
        />
      </div>
    </div>
  );
}
