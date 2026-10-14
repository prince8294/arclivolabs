import Link from 'next/link';

import Pagination from '@/components/admin/pagination';
import { ProposalStatusBadge } from '@/components/proposals/proposal-status-badge';
import EmptyState from '@/components/ui/empty-state';
import {
  PROPOSAL_SORT_LABELS,
  PROPOSAL_SORTS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUSES,
} from '@/lib/constants/proposals';
import type { ProposalListParams } from '@/lib/queries/proposals';
import { formatDate } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';
import type { ProposalListItem } from '@/types/proposals';

export default function ProposalList({
  items,
  total,
  params,
  baseUrl,
}: {
  items: ProposalListItem[];
  total: number;
  params: ProposalListParams;
  baseUrl: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <form className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-4">
        <input
          name="search"
          defaultValue={params.search}
          placeholder="Search code or title"
          className="h-10 min-w-52 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select name="status" defaultValue={params.status} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All statuses</option>
          {Object.values(PROPOSAL_STATUSES).map((status) => (
            <option key={status} value={status}>{PROPOSAL_STATUS_LABELS[status]}</option>
          ))}
        </select>
        <select name="sort" defaultValue={params.sort} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          {Object.values(PROPOSAL_SORTS).map((sort) => (
            <option key={sort} value={sort}>{PROPOSAL_SORT_LABELS[sort]}</option>
          ))}
        </select>
        <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button>
        {(params.search || params.status || params.sort !== PROPOSAL_SORTS.NEWEST) && (
          <Link href={baseUrl} className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm font-medium">Clear</Link>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState title="No proposals found" description="Create a proposal or adjust the selected filters." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr><th className="p-3">Proposal</th><th className="p-3">Party</th><th className="p-3">Status</th><th className="p-3">Version</th><th className="p-3 text-right">Value</th><th className="p-3">Valid until</th><th className="p-3 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="p-3"><Link href={`${baseUrl}/${item.id}`} className="font-mono font-semibold text-primary hover:underline">{item.proposalCode}</Link><p className="mt-1 max-w-72 truncate text-xs text-muted-foreground">{item.title}</p></td>
                  <td className="p-3">{item.partyLabel}</td>
                  <td className="p-3"><ProposalStatusBadge status={item.status} />{item.openRevisionRequestCount > 0 && <p className="mt-1 text-xs text-warning">{item.openRevisionRequestCount} revision request(s)</p>}</td>
                  <td className="p-3">v{item.currentVersion}</td>
                  <td className="p-3 text-right font-mono">{item.grandTotalMinor == null ? 'Hidden' : formatMinor(item.grandTotalMinor, item.currency)}</td>
                  <td className="p-3">{item.validUntil ? formatDate(item.validUntil) : '—'}</td>
                  <td className="p-3 text-right"><Link href={`${baseUrl}/${item.id}`} className="font-medium text-primary hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination baseUrl={baseUrl} page={params.page} limit={params.limit} total={total} filters={{ search: params.search, status: params.status, sort: params.sort }} />
    </div>
  );
}
