import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FileText,
  Clock,
  AlertTriangle,
  Receipt,
  FilePlus,
  ArrowRight,
  TrendingUp,
  Calendar,
  Settings,
} from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ButtonLink from '@/components/ui/button-link';
import StatCard from '@/components/dashboard/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  InvoicePaymentStatusBadge,
  InvoiceStatusBadge,
  InvoiceTypeBadge,
} from '@/components/billing/invoice-badges';
import { requireRole } from '@/lib/auth/authorization';
import { getBillingOverviewStats, getInvoicesList } from '@/lib/queries/invoices';
import { formatDate } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Billing Overview',
  description: 'Manage professional invoices, billing schedules, and receivables.',
};

export default async function AdminBillingOverviewPage() {
  await requireRole(USER_ROLES.ADMIN);

  const [stats, recentResult] = await Promise.all([
    getBillingOverviewStats(),
    getInvoicesList({ page: 1, limit: 10 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Billing & Invoices"
        description="Monitor invoice issuance, billing installment schedules, and active agency receivables."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/admin/billing/schedules" variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-1.5" />
              Schedules
            </ButtonLink>
            <ButtonLink href="/admin/billing/settings" variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-1.5" />
              Settings
            </ButtonLink>
            <ButtonLink href="/admin/invoices/new" variant="primary" size="sm">
              <FilePlus className="h-4 w-4 mr-1.5" />
              Create Invoice
            </ButtonLink>
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Invoiced (INR)"
          value={formatMinor(stats.totalInvoicedMinor, 'INR')}
          subtitle={`${stats.totalIssuedCount} issued invoices`}
          icon={TrendingUp}
        />
        <StatCard
          title="Outstanding Receivables"
          value={formatMinor(stats.totalDueMinor, 'INR')}
          subtitle="Awaiting client payment"
          icon={Receipt}
        />
        <StatCard
          title="Overdue Invoices"
          value={stats.overdueCount}
          subtitle="Past agreed due date"
          icon={AlertTriangle}
        />
        <StatCard
          title="Draft Invoices"
          value={stats.draftCount}
          subtitle={`${stats.voidCount} voided`}
          icon={Clock}
        />
      </div>

      {/* Multi-currency breakdown if multiple currencies exist */}
      {stats.currencyBreakdowns.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">
              Invoiced by Currency
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.currencyBreakdowns.map((curr: any) => (
              <div key={curr._id} className="p-3 bg-muted/40 rounded-lg border border-border">
                <p className="text-xs font-semibold text-muted-foreground">{curr._id}</p>
                <p className="text-lg font-bold font-mono text-foreground">
                  {formatMinor(curr.totalAmountMinor, curr._id)}
                </p>
                <p className="text-xs text-muted-foreground">{curr.count} invoices</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Invoices Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Recently generated and issued billing documents.</CardDescription>
          </div>
          <Link
            href="/admin/invoices"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            View all {recentResult.total} invoices
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentResult.invoices.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p>No invoices have been created yet.</p>
              <Link href="/admin/invoices/new" className="text-primary hover:underline mt-2 inline-block">
                Create the first invoice
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
                    <th className="p-3">Invoice</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentResult.invoices.map((inv: any) => (
                    <tr key={inv._id} className="hover:bg-muted/10">
                      <td className="p-3">
                        <Link
                          href={`/admin/invoices/${inv._id}`}
                          className="font-mono font-semibold text-primary hover:underline"
                        >
                          {inv.invoiceNumber || inv.invoiceCode}
                        </Link>
                      </td>
                      <td className="p-3 font-medium text-foreground">{inv.clientName}</td>
                      <td className="p-3">
                        <InvoiceTypeBadge type={inv.invoiceType} />
                      </td>
                      <td className="p-3 text-right font-mono font-medium">
                        {formatMinor(inv.totalMinor, inv.currency)}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{formatDate(inv.dueDate)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
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
