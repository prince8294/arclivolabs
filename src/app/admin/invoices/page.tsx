import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FileText,
  FilePlus,
  Download,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ButtonLink from '@/components/ui/button-link';
import { Card, CardContent } from '@/components/ui/card';
import {
  InvoicePaymentStatusBadge,
  InvoiceStatusBadge,
  InvoiceTypeBadge,
} from '@/components/billing/invoice-badges';
import { InvoiceFilters } from '@/components/billing/invoice-filters';
import { requireRole } from '@/lib/auth/authorization';
import { INVOICE_STATUSES } from '@/lib/constants/enums';
import { getInvoicesList } from '@/lib/queries/invoices';
import { formatDate } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'All Invoices',
  description: 'View, search, filter and manage agency invoices.',
};

interface AdminInvoicesPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    type?: string;
    overdue?: string;
  }>;
}

export default async function AdminInvoicesPage({ searchParams }: AdminInvoicesPageProps) {
  await requireRole(USER_ROLES.ADMIN);

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));

  const result = await getInvoicesList({
    page,
    limit: 20,
    search: params.search,
    status: params.status,
    invoiceType: params.type,
    overdue: params.overdue === 'true',
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices"
        description="Official billing documents, installment invoices, and drafts."
        action={
          <ButtonLink href="/admin/invoices/new" variant="primary" size="sm">
            <FilePlus className="h-4 w-4 mr-1.5" />
            Create Invoice
          </ButtonLink>
        }
      />

      <InvoiceFilters isAdmin={true} />

      <Card>
        <CardContent className="p-0">
          {result.invoices.length === 0 ? (
            <div className="text-center py-12 px-4 text-muted-foreground text-sm">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-semibold text-foreground">No invoices found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {params.search || params.status || params.type
                  ? 'Try clearing or modifying your search and filter criteria.'
                  : 'Get started by creating your first invoice.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <th className="p-3">Invoice No</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Deal / Project</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Issue Date</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.invoices.map((inv: any) => {
                    const isDraft = inv.status === INVOICE_STATUSES.DRAFT;
                    const isOverdue =
                      inv.status === INVOICE_STATUSES.ISSUED &&
                      new Date(inv.dueDate) < new Date() &&
                      inv.amountDueMinor > 0;

                    return (
                      <tr key={inv._id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3 font-mono font-semibold">
                          <Link
                            href={`/admin/invoices/${inv._id}`}
                            className="text-primary hover:underline"
                          >
                            {inv.invoiceNumber || inv.invoiceCode}
                          </Link>
                        </td>
                        <td className="p-3 font-medium text-foreground">
                          {inv.clientName}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {inv.dealCode && <span className="font-mono block">{inv.dealCode}</span>}
                          {inv.projectName && <span className="truncate block max-w-[160px]">{inv.projectName}</span>}
                          {!inv.dealCode && !inv.projectName && '—'}
                        </td>
                        <td className="p-3">
                          <InvoiceTypeBadge type={inv.invoiceType} />
                        </td>
                        <td className="p-3 text-right font-mono font-medium">
                          {formatMinor(inv.totalMinor, inv.currency)}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {formatDate(inv.issueDate)}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <InvoiceStatusBadge status={inv.status} />
                            <InvoicePaymentStatusBadge
                              status={inv.paymentStatus}
                              isOverdue={isOverdue}
                            />
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isDraft ? (
                              <Link
                                href={`/admin/invoices/${inv._id}/edit`}
                                title="Edit Draft"
                                className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            ) : null}

                            <Link
                              href={`/admin/invoices/${inv._id}/preview`}
                              title="Preview PDF"
                              className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>

                            <a
                              href={`/api/invoices/${inv._id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              title="Download PDF"
                              className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted transition-colors"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
          <div>
            Showing page {result.page} of {result.totalPages} ({result.total} total)
          </div>
          <div className="flex items-center gap-2">
            {result.page > 1 ? (
              <ButtonLink
                href={`/admin/invoices?page=${result.page - 1}`}
                variant="outline"
                size="sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </ButtonLink>
            ) : null}

            {result.page < result.totalPages ? (
              <ButtonLink
                href={`/admin/invoices?page=${result.page + 1}`}
                variant="outline"
                size="sm"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </ButtonLink>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
