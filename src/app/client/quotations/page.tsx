import type { Metadata } from 'next';

import ProposalList from '@/components/proposals/proposal-list';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { listProposals, parseProposalListParams } from '@/lib/queries/proposals';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Quotations' };

export default async function ClientQuotationsPage(props: PageProps<'/client/quotations'>) {
  const user = await requireRole(USER_ROLES.CLIENT);
  const params = parseProposalListParams(await props.searchParams);
  const result = await listProposals(params, { kind: 'client', userId: user.id });
  return <div className="flex flex-col gap-6"><PageHeader title="Quotations" description="Issued quotations shared with your account." /><ProposalList {...result} params={params} baseUrl="/client/quotations" /></div>;
}
