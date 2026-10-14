import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Handshake, FilePlus, Calendar, ExternalLink, Info } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ButtonLink from '@/components/ui/button-link';
import Badge from '@/components/ui/badge';
import DetailList from '@/components/admin/detail-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  InvoicePaymentStatusBadge,
  InvoiceStatusBadge,
  InvoiceTypeBadge,
} from '@/components/billing/invoice-badges';
import { requireRole } from '@/lib/auth/authorization';
import connectDB from '@/lib/db/mongoose';
import { getDealBillingSummary } from '@/lib/queries/invoices';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';
import { USER_ROLES } from '@/types/auth';

interface DealDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DealDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const summary = await getDealBillingSummary(id);
  if (!summary?.deal) return { title: 'Deal Not Found' };
  return {
    title: `${summary.deal.dealCode}: ${summary.deal.title}`,
  };
}

export default async function AdminDealDetailPage({ params }: DealDetailPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await params;

  const billingData = await getDealBillingSummary(id);
  if (!billingData?.deal) {
    notFound();
  }

  const {
    deal,
    invoices,
    totalInvoicedMinor,
    totalPaidMinor,
    totalDueMinor,
    remainingUnbilledMinor,
    billingSchedule,
  } = billingData;

  const client = deal.clientId ? (deal as any).clientId : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${deal.dealCode} · ${deal.title}`}
        description={`Commercial agreement finalized on ${formatDate(deal.finalizedAt)}.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink
              href={`/admin/invoices/new?dealId=${deal._id}&clientId=${deal.clientId}`}
              variant="primary"
              size="sm"
            >
              <FilePlus className="h-4 w-4 mr-1.5" />
              Create Invoice
            </ButtonLink>
            <Link
              href="/admin/deals"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ml-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Deals
            </Link>
          </div>
        }
      />

      {/* Deal Overview & Financial Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Agreed Deal Value</CardDescription>
            <CardTitle className="text-xl font-mono text-foreground">
              {formatMinor(deal.agreedAmountMinor, deal.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Immutable agreed terms
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Total Invoiced</CardDescription>
            <CardTitle className="text-xl font-mono text-primary">
              {formatMinor(totalInvoicedMinor, deal.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'} created
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Remaining Unbilled</CardDescription>
            <CardTitle className="text-xl font-mono text-foreground">
              {formatMinor(remainingUnbilledMinor, deal.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Available billable balance
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Outstanding Due</CardDescription>
            <CardTitle className="text-xl font-mono text-foreground">
              {formatMinor(totalDueMinor, deal.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Awaiting verified payment
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <p>
          <strong className="text-foreground">Critical Financial Distinction:</strong> An agreement being fully invoiced does not mean the client has paid. Payments are verified separately in payment reconciliation (Part 15).
        </p>
      </div>

      {/* Agreed Payment Milestones Schedule */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Agreed Payment Milestones Plan</CardTitle>
            <CardDescription>
              Commercial installment terms accepted by the client from proposal version {deal.acceptedVersion}.
            </CardDescription>
          </div>
          <ButtonLink
            href={`/admin/invoices/new?dealId=${deal._id}&clientId=${deal.clientId}`}
            variant="outline"
            size="sm"
          >
            Bill Milestone
          </ButtonLink>
        </CardHeader>
        <CardContent>
          {(!deal.paymentPlanSnapshot || deal.paymentPlanSnapshot.length === 0) ? (
            <p className="text-sm text-muted-foreground">No installment milestones specified in this agreement.</p>
          ) : (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground">
                    <th className="p-3 w-12">Seq</th>
                    <th className="p-3">Milestone Title & Condition</th>
                    <th className="p-3 text-right">Agreed Amount</th>
                    <th className="p-3">Planned Due Date</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deal.paymentPlanSnapshot.map((ms: any, idx: number) => {
                    const pct = deal.agreedAmountMinor > 0 ? Math.round((ms.amountMinor / deal.agreedAmountMinor) * 100) : 0;
                    return (
                      <tr key={idx} className="hover:bg-muted/10">
                        <td className="p-3 font-mono text-xs text-muted-foreground">#{ms.sequence}</td>
                        <td className="p-3">
                          <p className="font-semibold text-foreground">{ms.name}</p>
                          {ms.condition && <p className="text-xs text-muted-foreground mt-0.5">{ms.condition}</p>}
                        </td>
                        <td className="p-3 text-right font-mono font-medium">
                          {formatMinor(ms.amountMinor, deal.currency)}
                          <span className="text-xs text-muted-foreground ml-1">({pct}%)</span>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {ms.dueDate ? formatDate(new Date(ms.dueDate)) : '—'}
                        </td>
                        <td className="p-3 text-right">
                          <ButtonLink
                            href={`/admin/invoices/new?dealId=${deal._id}&clientId=${deal.clientId}`}
                            variant="outline"
                            size="sm"
                          >
                            Bill Milestone
                          </ButtonLink>
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

      {/* Issued Invoices for this Deal */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Invoices Issued for this Deal</CardTitle>
            <CardDescription>
              All active and draft billing documents created against this commercial agreement.
            </CardDescription>
          </div>
          <ButtonLink
            href={`/admin/invoices/new?dealId=${deal._id}&clientId=${deal.clientId}`}
            variant="outline"
            size="sm"
          >
            Create Invoice
          </ButtonLink>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No invoices generated for this agreement yet.
            </p>
          ) : (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground">
                    <th className="p-3">Invoice Number</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Issue Date</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv: any) => (
                    <tr key={inv._id} className="hover:bg-muted/10">
                      <td className="p-3 font-mono font-medium">
                        <Link href={`/admin/invoices/${inv._id}`} className="text-primary hover:underline">
                          {inv.invoiceNumber || inv.invoiceCode}
                        </Link>
                      </td>
                      <td className="p-3">
                        <InvoiceTypeBadge type={inv.invoiceType} />
                      </td>
                      <td className="p-3 text-right font-mono font-medium">
                        {formatMinor(inv.totalMinor, inv.currency)}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDate(inv.issueDate)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDate(inv.dueDate)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <InvoiceStatusBadge status={inv.status} />
                          <InvoicePaymentStatusBadge status={inv.paymentStatus} />
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/admin/invoices/${inv._id}`}
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
