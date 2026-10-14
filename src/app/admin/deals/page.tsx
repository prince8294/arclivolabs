import type { Metadata } from 'next';
import Link from 'next/link';
import { Handshake, FilePlus, ArrowRight, Calendar } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ButtonLink from '@/components/ui/button-link';
import Badge from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/authorization';
import connectDB from '@/lib/db/mongoose';
import { Deal } from '@/models/Deal';
import { formatDate } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Deals & Commercial Agreements',
  description: 'Finalized client commercial agreements and billing milestones.',
};

export default async function AdminDealsListPage() {
  await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  const deals = await Deal.find()
    .populate('clientId', 'name companyName clientCode')
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Commercial Deals"
        description="Finalized agreements accepted by clients, serving as the commercial basis for invoicing."
      />

      <Card>
        <CardContent className="p-0">
          {deals.length === 0 ? (
            <div className="text-center py-12 px-4 text-muted-foreground text-sm">
              <Handshake className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-semibold text-foreground">No finalized deals found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Deals are automatically created when a client accepts a proposal or quotation.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <th className="p-3">Deal Code</th>
                    <th className="p-3">Title / Scope</th>
                    <th className="p-3">Client</th>
                    <th className="p-3 text-right">Agreed Value</th>
                    <th className="p-3">Milestones</th>
                    <th className="p-3">Finalized Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deals.map((deal: any) => {
                    const client = deal.clientId;
                    const milestoneCount = deal.paymentPlanSnapshot?.length || 0;

                    return (
                      <tr key={deal._id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3 font-mono font-semibold">
                          <Link
                            href={`/admin/deals/${deal._id}`}
                            className="text-primary hover:underline"
                          >
                            {deal.dealCode}
                          </Link>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-foreground">{deal.title}</p>
                          <span className="text-xs text-muted-foreground">
                            v{deal.acceptedVersion} accepted
                          </span>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-foreground">{client?.name || '—'}</p>
                          {client?.companyName && (
                            <span className="text-xs text-muted-foreground">{client.companyName}</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-foreground">
                          {formatMinor(deal.agreedAmountMinor, deal.currency)}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {milestoneCount} payment {milestoneCount === 1 ? 'milestone' : 'milestones'}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {formatDate(deal.finalizedAt)}
                        </td>
                        <td className="p-3">
                          <Badge variant="success">{deal.status}</Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <ButtonLink
                              href={`/admin/invoices/new?dealId=${deal._id}&clientId=${client?._id}`}
                              variant="outline"
                              size="sm"
                            >
                              <FilePlus className="h-3.5 w-3.5 mr-1" />
                              Invoice
                            </ButtonLink>
                            <Link
                              href={`/admin/deals/${deal._id}`}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              View
                            </Link>
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
