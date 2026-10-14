import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ProposalDetailView from '@/components/proposals/proposal-detail';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { getProposalDetail } from '@/lib/queries/proposals';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Proposal Details' };

export default async function MarketingProposalDetailPage(props: PageProps<'/marketing/proposals/[id]'>) {
  const user = await requireRole(USER_ROLES.MARKETING);
  const { id } = await props.params;
  const proposal = await getProposalDetail(id, { kind: 'marketing', userId: user.id });
  if (!proposal) notFound();
  return <div className="flex flex-col gap-6"><PageHeader title={`${proposal.proposalCode} · ${proposal.title}`} description="Approved commercial information for your assigned customer." /><ProposalDetailView proposal={proposal} backHref="/marketing/proposals" leadHref="/marketing/leads" /></div>;
}
