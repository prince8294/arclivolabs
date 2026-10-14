import type { Metadata } from 'next';

import QuotationRequestForm from '@/components/proposals/quotation-request-form';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { listRequestedServiceNames } from '@/lib/queries/proposal-requests';
import { listProposalPartyOptions } from '@/lib/queries/proposals';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'New Quotation Request' };
export default async function NewQuotationRequestPage() { const user = await requireRole(USER_ROLES.MARKETING); const [parties, services] = await Promise.all([listProposalPartyOptions({ assignedToUserId: user.id, limit: 200 }), listRequestedServiceNames()]); return <div className="mx-auto flex w-full max-w-4xl flex-col gap-6"><PageHeader title="New Quotation Request" description="Send customer requirements to Admin. This does not create or approve pricing." /><QuotationRequestForm parties={parties} services={services} /></div>; }
