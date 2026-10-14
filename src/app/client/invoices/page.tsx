import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, Eye, FileText, Receipt } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  InvoicePaymentStatusBadge,
  InvoiceStatusBadge,
  InvoiceTypeBadge,
} from '@/components/billing/invoice-badges';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { getClientInvoices } from '@/lib/queries/invoices';
import { formatDate } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';

export const metadata: Metadata = {
  title: 'My Invoices',
  description: 'View and download invoices and track billing status.',
};

export default async function ClientInvoicesPage() {
  const clientProfile = await requireClientProfile();

  const invoices = await getClientInvoices(clientProfile.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices & Payments"
        description="View your formal billing documents, agreed installment invoices, and payment statuses."
      />

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="text-center py-12 px-4 text-muted-foreground text-sm">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-semibold text-foreground">You have no invoices at the moment.</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Invoices issued for your project milestones and services will appear here for review and download.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <th className="p-3">Invoice No</th>
                    <th className="p-3">Project / Description</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Issue Date</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Payment Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv: any) => {
                    const isOverdue =
                      new Date(inv.dueDate) < new Date() && (inv.amountDueMinor ?? inv.totalMinor) > 0;

                    return (
                      <tr key={inv._id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3 font-mono font-semibold">
                          <Link
                            href={`/client/invoices/${inv._id}`}
                            className="text-primary hover:underline"
                          >
                            {inv.invoiceNumber || inv.invoiceCode}
                          </Link>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-foreground">
                            {inv.projectId?.title || inv.description || 'Service Delivery'}
                          </p>
                          {inv.projectId?.projectCode && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {inv.projectId.projectCode}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <InvoiceTypeBadge type={inv.invoiceType} />
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-foreground">
                          {formatMinor(inv.totalMinor, inv.currency)}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {formatDate(inv.issueDate)}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="p-3">
                          <InvoicePaymentStatusBadge
                            status={inv.paymentStatus}
                            isOverdue={isOverdue}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/client/invoices/${inv._id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Link>
                            <a
                              href={`/api/invoices/${inv._id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium rounded border border-border px-2 py-1 hover:bg-muted transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                              PDF
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
    </div>
  );
}
