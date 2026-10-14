import type { Metadata } from 'next';
import Link from 'next/link';

import Pagination from '@/components/admin/pagination';
import Badge from '@/components/ui/badge';
import ButtonLink from '@/components/ui/button-link';
import EmptyState from '@/components/ui/empty-state';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { PROPOSAL_REQUEST_STATUS_LABELS, PROPOSAL_REQUEST_STATUS_VARIANTS, REQUEST_PRIORITY_LABELS } from '@/lib/constants/proposals';
import { listProposalRequests, parseProposalRequestListParams } from '@/lib/queries/proposal-requests';
import { formatDate } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Quotation Requests' };
export default async function ProposalRequestsPage(props: PageProps<'/marketing/proposals/requests'>) {
  const user = await requireRole(USER_ROLES.MARKETING); const params = parseProposalRequestListParams(await props.searchParams, 'marketing'); const result = await listProposalRequests(params, { kind: 'marketing', userId: user.id });
  return <div className="flex flex-col gap-6"><PageHeader title="Quotation Requests" description="Requests sent to Admin for pricing and approval." action={<ButtonLink href="/marketing/proposals/requests/new">New Request</ButtonLink>} />{result.items.length === 0 ? <EmptyState title="No quotation requests" description="Submit a request when a lead or client needs a formal quotation." /> : <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/40 text-xs"><tr><th className="p-3">Request</th><th className="p-3">Customer</th><th className="p-3">Services</th><th className="p-3">Budget</th><th className="p-3">Priority</th><th className="p-3">Status</th><th className="p-3">Created</th></tr></thead><tbody className="divide-y">{result.items.map((item) => <tr key={item.id}><td className="p-3 font-mono font-semibold">{item.requestCode}{item.proposalId && <Link href={`/marketing/proposals/${item.proposalId}`} className="ml-2 text-primary hover:underline">{item.proposalCode}</Link>}</td><td className="p-3">{item.partyLabel}</td><td className="p-3">{item.requestedServices.join(', ') || '—'}</td><td className="p-3 font-mono">{formatMinor(item.expectedBudgetMinor, item.currency)}</td><td className="p-3">{REQUEST_PRIORITY_LABELS[item.priority]}</td><td className="p-3"><Badge variant={PROPOSAL_REQUEST_STATUS_VARIANTS[item.status]}>{PROPOSAL_REQUEST_STATUS_LABELS[item.status]}</Badge></td><td className="p-3">{formatDate(item.createdAt)}</td></tr>)}</tbody></table></div>}<Pagination baseUrl="/marketing/proposals/requests" page={params.page} limit={params.limit} total={result.total} filters={{ search: params.search, status: params.status, priority: params.priority }} /></div>;
}
