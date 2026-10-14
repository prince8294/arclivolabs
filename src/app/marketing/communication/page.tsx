import type { Metadata } from 'next';

import CommunicationFeed from '@/components/crm/communication-feed';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import {
  listCommunicationFeed,
  parseCommunicationFeedParams,
} from '@/lib/queries/communications';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'My Communication' };

export default async function MarketingCommunicationPage(
  props: PageProps<'/marketing/communication'>
) {
  const user = await requireRole(USER_ROLES.MARKETING);
  const params = parseCommunicationFeedParams(await props.searchParams);
  const feed = await listCommunicationFeed(params, { ownerUserId: user.id });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Communication"
        description="Activity recorded against the leads assigned to you."
      />
      <CommunicationFeed
        {...feed}
        params={params}
        baseUrl="/marketing/communication"
        leadBasePath="/marketing/leads"
      />
    </div>
  );
}
