import Link from 'next/link';
import { Download, Handshake } from 'lucide-react';

import { ProposalStatusBadge } from '@/components/proposals/proposal-status-badge';
import ButtonLink from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';
import type { ProposalDetail } from '@/types/proposals';

export default function ProposalDetailView({
  proposal,
  backHref,
  leadHref,
}: {
  proposal: ProposalDetail;
  backHref: string;
  leadHref?: string;
}) {
  const version = proposal.currentVersionDetail;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><ProposalStatusBadge status={proposal.status} /><span className="text-sm text-muted-foreground">Current version: {proposal.currentVersion}</span></div>
        <div className="flex flex-wrap gap-2">
          {version && <ButtonLink href={`/api/proposals/${proposal.id}/versions/${version.id}/pdf`} variant="outline"><Download className="h-4 w-4" />View PDF</ButtonLink>}
          {proposal.deal && <ButtonLink href={`/admin/deals/${proposal.deal.id}`} variant="outline"><Handshake className="h-4 w-4" />{proposal.deal.dealCode}</ButtonLink>}
          <ButtonLink href={backHref} variant="outline">Back</ButtonLink>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Customer</CardTitle></CardHeader><CardContent className="space-y-1 text-sm"><p className="font-medium">{proposal.clientName ?? proposal.leadName ?? '—'}</p><p className="text-muted-foreground">{proposal.clientCompany ?? proposal.leadCompany ?? ''}</p>{leadHref && proposal.leadId && <Link href={`${leadHref}/${proposal.leadId}`} className="text-primary hover:underline">Open lead</Link>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Commercial value</CardTitle></CardHeader><CardContent><p className="text-xl font-semibold">{version ? formatMinor(version.grandTotalMinor, version.currency) : '—'}</p><p className="mt-1 text-xs text-muted-foreground">Valid until {version?.validUntil ? formatDate(version.validUntil) : 'not set'}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Ownership</CardTitle></CardHeader><CardContent className="space-y-1 text-sm"><p>Created by {proposal.createdByName ?? '—'}</p><p className="text-muted-foreground">Marketing: {proposal.assignedMarketingName ?? 'Unassigned'}</p></CardContent></Card>
      </div>

      {version && <Card><CardHeader><CardTitle>Scope & pricing</CardTitle></CardHeader><CardContent className="space-y-5"><div><h3 className="text-sm font-semibold">Overview</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{version.overview ?? version.description ?? 'No overview supplied.'}</p></div><div className="overflow-x-auto rounded-md border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-3">Service</th><th className="p-3">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-border">{version.lineItems.map((line, index) => <tr key={`${line.serviceName}-${index}`}><td className="p-3"><p className="font-medium">{line.serviceName}</p>{line.description && <p className="text-xs text-muted-foreground">{line.description}</p>}</td><td className="p-3">{line.quantity} {line.unit}</td><td className="p-3 text-right font-mono">{formatMinor(line.unitPriceMinor, version.currency)}</td><td className="p-3 text-right font-mono">{formatMinor(line.lineTotalMinor, version.currency)}</td></tr>)}</tbody><tfoot><tr className="border-t border-border font-semibold"><td className="p-3" colSpan={3}>Grand total</td><td className="p-3 text-right font-mono">{formatMinor(version.grandTotalMinor, version.currency)}</td></tr></tfoot></table></div></CardContent></Card>}

      <Card><CardHeader><CardTitle>Version history</CardTitle></CardHeader><CardContent><ol className="divide-y divide-border">{proposal.versions.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">Version {item.version}</p><p className="text-xs text-muted-foreground">Created {formatDateTime(item.createdAt)} by {item.createdByName ?? '—'}</p></div><div className="flex items-center gap-3"><ProposalStatusBadge status={item.status} /><span className="font-mono text-sm">{formatMinor(item.grandTotalMinor, item.currency)}</span><Link className="text-sm text-primary hover:underline" href={`/api/proposals/${proposal.id}/versions/${item.id}/pdf`}>PDF</Link></div></li>)}</ol></CardContent></Card>
    </div>
  );
}
