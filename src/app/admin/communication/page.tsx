import type { Metadata } from 'next';

import CommunicationFeed from '@/components/crm/communication-feed';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import {
  listCommunicationFeed,
  parseCommunicationFeedParams,
} from '@/lib/queries/communications';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Communication' };

export default async function AdminCommunicationPage(
  props: PageProps<'/admin/communication'>
) {
  await requireRole(USER_ROLES.ADMIN);
  const params = parseCommunicationFeedParams(await props.searchParams);
  const feed = await listCommunicationFeed(params);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Communication"
        description="Company-wide CRM calls, messages, meetings, follow-ups and system activity."
      />
      <CommunicationFeed
        {...feed}
        params={params}
        baseUrl="/admin/communication"
        leadBasePath="/admin/crm/leads"
      />
    </div>
  );
}
