import type { Metadata } from 'next';

import ProposalList from '@/components/proposals/proposal-list';
import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { listProposals, parseProposalListParams } from '@/lib/queries/proposals';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'My Proposals' };

export default async function MarketingProposalsPage(props: PageProps<'/marketing/proposals'>) {
  const user = await requireRole(USER_ROLES.MARKETING);
  const params = parseProposalListParams(await props.searchParams);
  const result = await listProposals(params, { kind: 'marketing', userId: user.id });
  return <div className="flex flex-col gap-6"><PageHeader title="My Proposals" description="Approved and issued quotations for your leads and clients." action={<ButtonLink href="/marketing/proposals/requests">Quotation Requests</ButtonLink>} /><ProposalList {...result} params={params} baseUrl="/marketing/proposals" /></div>;
}
