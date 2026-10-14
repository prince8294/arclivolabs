import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ProposalDetailView from '@/components/proposals/proposal-detail';
import ProposalLifecycleActions from '@/components/proposals/proposal-lifecycle-actions';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { getProposalDetail } from '@/lib/queries/proposals';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Proposal Details' };

export default async function AdminProposalDetailPage(props: PageProps<'/admin/proposals/[id]'>) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await props.params;
  const proposal = await getProposalDetail(id, { kind: 'admin' });
  if (!proposal) notFound();
  return <div className="flex flex-col gap-6"><PageHeader title={`${proposal.proposalCode} · ${proposal.title}`} description="Commercial proposal, pricing and immutable version history." action={proposal.currentVersionDetail ? <ProposalLifecycleActions proposalId={proposal.id} versionId={proposal.currentVersionDetail.id} status={proposal.currentVersionDetail.status} /> : undefined} /><ProposalDetailView proposal={proposal} backHref="/admin/proposals" leadHref="/admin/crm/leads" /></div>;
}
