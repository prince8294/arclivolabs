import type { Metadata } from 'next';

import ProposalForm from '@/components/proposals/proposal-form';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { listProposalPartyOptions, listServiceCatalogOptions } from '@/lib/queries/proposals';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'New Proposal' };

export default async function NewProposalPage(props: PageProps<'/admin/proposals/new'>) {
  await requireRole(USER_ROLES.ADMIN);
  const search = await props.searchParams;
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const [partyOptions, services] = await Promise.all([listProposalPartyOptions({ limit: 200 }), listServiceCatalogOptions()]);
  return <div className="flex flex-col gap-6"><PageHeader title="Create Proposal" description="Build a draft quotation. Pricing is recalculated and validated on the server." /><ProposalForm mode="create" services={services} partyOptions={partyOptions} initialLeadId={one(search.leadId)} initialClientId={one(search.clientId)} sourceRequestId={one(search.requestId)} sourceRequestCode={one(search.requestCode)} backHref="/admin/proposals" /></div>;
}
