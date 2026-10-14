import type { Metadata } from 'next';

import CrmTabs from '@/components/crm/crm-tabs';
import LeadDistributionPanel from '@/components/crm/lead-distribution-panel';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { ROUTES } from '@/lib/constants/routes';
import {
  listActiveServices,
  listImportBatchOptions,
} from '@/lib/queries/leads';
import {
  countInactiveOwnerLeads,
  listActiveMarketingUsers,
  listRecentLeadDistributions,
} from '@/lib/queries/lead-distribution';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Lead Distribution',
  description: 'Assign and distribute leads across the marketing team.',
};

/**
 * /admin/crm/distribution
 *
 * Server wrapper around the distribution workspace. Supplies
 * the assignable marketing users (with their current lead
 * load), the service + import-batch filter options, the
 * suspended/inactive-owner lead count, and the recent
 * distribution history.
 */
export default async function LeadDistributionPage() {
  await requireRole(USER_ROLES.ADMIN);

  const [
    marketingUsers,
    services,
    importBatches,
    history,
    inactiveOwnerLeadCount,
  ] = await Promise.all([
    listActiveMarketingUsers(),
    listActiveServices(),
    listImportBatchOptions(50),
    listRecentLeadDistributions(20),
    countInactiveOwnerLeads(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lead Distribution"
        description="Assign and distribute leads across the marketing team."
      />

      <CrmTabs
        basePath={ROUTES.ADMIN.CRM}
        items={[
          { title: 'Overview', href: ROUTES.ADMIN.CRM },
          { title: 'Leads', href: `${ROUTES.ADMIN.CRM}/leads` },
          { title: 'Import', href: ROUTES.ADMIN.CRM_IMPORT },
          {
            title: 'Distribution',
            href: ROUTES.ADMIN.CRM_DISTRIBUTION,
          },
        ]}
      />

      <LeadDistributionPanel
        marketingUsers={marketingUsers}
        services={services}
        importBatches={importBatches}
        history={history}
        inactiveOwnerLeadCount={inactiveOwnerLeadCount}
      />
    </div>
  );
}
