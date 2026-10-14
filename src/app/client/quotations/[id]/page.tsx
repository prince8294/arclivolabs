import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ProposalDetailView from '@/components/proposals/proposal-detail';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { getProposalDetail } from '@/lib/queries/proposals';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Quotation Details' };

export default async function ClientQuotationDetailPage(props: PageProps<'/client/quotations/[id]'>) {
  const user = await requireRole(USER_ROLES.CLIENT);
  const { id } = await props.params;
  const proposal = await getProposalDetail(id, { kind: 'client', userId: user.id });
  if (!proposal) notFound();
  return <div className="flex flex-col gap-6"><PageHeader title={`${proposal.proposalCode} · ${proposal.title}`} description="Quotation and version history shared with your account." /><ProposalDetailView proposal={proposal} backHref="/client/quotations" /></div>;
}
