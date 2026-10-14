import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar, Plus, FileText, CheckCircle2, Clock } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ButtonLink from '@/components/ui/button-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BillingMilestoneStatusBadge } from '@/components/billing/invoice-badges';
import { requireRole } from '@/lib/auth/authorization';
import { BILLING_MILESTONE_STATUSES } from '@/lib/constants/enums';
import { getBillingSchedulesList } from '@/lib/queries/invoices';
import { formatDate } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Billing Schedules',
  description: 'Track agreed installment milestones and billing operational states.',
};

export default async function AdminBillingSchedulesPage() {
  await requireRole(USER_ROLES.ADMIN);

  const schedules = await getBillingSchedulesList();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Billing Schedules"
        description="Agreed commercial installment schedules, payment conditions, and billing status."
        action={
          <ButtonLink href="/admin/invoices/new" variant="primary" size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Create Invoice
          </ButtonLink>
        }
      />

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-semibold text-foreground">No billing schedules found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Billing schedules are linked to finalized commercial Deals. When a Deal with payment milestones is accepted, its schedule will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {schedules.map((sched: any) => {
            const deal = sched.dealId;
            const client = sched.clientId;
            const project = sched.projectId;

            const billedCount = sched.milestones.filter(
              (m: any) => m.status === BILLING_MILESTONE_STATUSES.BILLED
            ).length;
            const totalCount = sched.milestones.length;

            return (
              <Card key={sched._id} className="overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4 border-b border-border">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm text-primary">
                          {deal?.dealCode || 'Deal'}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-semibold text-foreground text-sm">
                          {deal?.title || 'Agreement'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Client: <span className="font-medium text-foreground">{client?.name}</span>
                        {project ? ` · Project: [${project.projectCode}] ${project.title}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xs uppercase font-semibold text-muted-foreground block">
                          Agreed Value
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {formatMinor(sched.totalScheduledMinor, sched.currency)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs uppercase font-semibold text-muted-foreground block">
                          Billed Progress
                        </span>
                        <span className="text-xs font-semibold text-primary">
                          {billedCount} of {totalCount} billed
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/10 text-xs font-semibold text-muted-foreground">
                          <th className="p-3 w-16">Code</th>
                          <th className="p-3">Milestone Title & Condition</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3">Planned Due Date</th>
                          <th className="p-3">Linked Invoice</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sched.milestones.map((ms: any) => {
                          const isBilled = ms.status === BILLING_MILESTONE_STATUSES.BILLED;
                          const linkedInvoice = ms.linkedInvoiceId;

                          return (
                            <tr key={ms._id} className="hover:bg-muted/10 transition-colors">
                              <td className="p-3 font-mono text-xs font-medium text-muted-foreground">
                                {ms.milestoneCode}
                              </td>
                              <td className="p-3">
                                <p className="font-medium text-foreground">{ms.title}</p>
                                {ms.description && (
                                  <p className="text-xs text-muted-foreground">{ms.description}</p>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono font-medium">
                                {formatMinor(ms.amountMinor, sched.currency)}
                                {ms.percentage ? (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({ms.percentage}%)
                                  </span>
                                ) : null}
                              </td>
                              <td className="p-3 text-xs text-muted-foreground">
                                {ms.plannedDueDate ? formatDate(ms.plannedDueDate) : '—'}
                              </td>
                              <td className="p-3 text-xs">
                                {linkedInvoice ? (
                                  <Link
                                    href={`/admin/invoices/${linkedInvoice._id}`}
                                    className="font-mono font-semibold text-primary hover:underline"
                                  >
                                    {linkedInvoice.invoiceNumber || linkedInvoice.invoiceCode}
                                  </Link>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="p-3">
                                <BillingMilestoneStatusBadge status={ms.status} />
                              </td>
                              <td className="p-3 text-right">
                                {!isBilled ? (
                                  <ButtonLink
                                    href={`/admin/invoices/new?dealId=${deal?._id}&clientId=${client?._id}${project ? `&projectId=${project._id}` : ''}`}
                                    variant="outline"
                                    size="sm"
                                  >
                                    Bill Milestone
                                  </ButtonLink>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Billed</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
