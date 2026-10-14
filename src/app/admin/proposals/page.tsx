import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

import ProposalList from '@/components/proposals/proposal-list';
import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { listProposals, parseProposalListParams } from '@/lib/queries/proposals';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Proposals & Quotations' };

export default async function AdminProposalsPage(props: PageProps<'/admin/proposals'>) {
  await requireRole(USER_ROLES.ADMIN);
  const params = parseProposalListParams(await props.searchParams);
  const result = await listProposals(params, { kind: 'admin' });
  return <div className="flex flex-col gap-6"><PageHeader title="Proposals & Quotations" description="Create, approve, issue and track commercial proposals." action={<ButtonLink href="/admin/proposals/new"><Plus className="h-4 w-4" />New Proposal</ButtonLink>} /><ProposalList {...result} params={params} baseUrl="/admin/proposals" /></div>;
}
