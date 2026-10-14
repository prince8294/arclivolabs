import type { Metadata } from 'next';

import CommunicationFeed from '@/components/crm/communication-feed';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { getClientOriginLeadId } from '@/lib/queries/client-portal';
import { listCommunicationFeed, parseCommunicationFeedParams } from '@/lib/queries/communications';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Communication' };
export default async function ClientCommunicationPage(props: PageProps<'/client/communication'>) { await requireRole(USER_ROLES.CLIENT); const profile = await requireClientProfile(); const params = parseCommunicationFeedParams(await props.searchParams); const leadId = await getClientOriginLeadId(profile.id); const feed = await listCommunicationFeed(params, { leadIds: leadId ? [leadId] : [], clientVisibleOnly: true }); return <div className="flex flex-col gap-6"><PageHeader title="Communication" description="Customer-visible updates and communication history shared with your account." /><CommunicationFeed {...feed} params={params} baseUrl="/client/communication" /></div>; }
