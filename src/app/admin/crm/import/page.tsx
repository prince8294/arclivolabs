import type { Metadata } from 'next';

import CrmTabs from '@/components/crm/crm-tabs';
import LeadImportWizard from '@/components/crm/lead-import-wizard';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { ROUTES } from '@/lib/constants/routes';
import { listAssignableMarketingUsers } from '@/lib/queries/leads';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Import Leads',
  description: 'Import leads from a CSV file.',
};

/**
 * /admin/crm/import
 *
 * Server wrapper around the import wizard. The wizard holds
 * the file text in component state and talks to the preview
 * and commit server actions directly; this page only supplies
 * the assignable marketing users (validated against the
 * database) and the CRM section tabs.
 */
export default async function LeadImportPage() {
  await requireRole(USER_ROLES.ADMIN);

  const marketingUsers = await listAssignableMarketingUsers();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Import Leads"
        description="Import leads from a CSV file — map columns, review every row, then import."
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

      <LeadImportWizard marketingUsers={marketingUsers} />
    </div>
  );
}
