import type { Metadata } from 'next';
import Link from 'next/link';
import { FileUp, UserPlus, Users } from 'lucide-react';

import CrmTabs from '@/components/crm/crm-tabs';
import LeadFilters from '@/components/crm/lead-filters';
import LeadTable from '@/components/crm/lead-table';
import {
  LeadSelectionProvider,
} from '@/components/crm/lead-selection';
import LeadBulkBar from '@/components/crm/lead-bulk-bar';
import Pagination from '@/components/admin/pagination';
import ButtonLink from '@/components/ui/button-link';
import EmptyState from '@/components/ui/empty-state';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { ROUTES } from '@/lib/constants/routes';
import {
  hasLeadFilters,
  listActiveServices,
  listAssignableMarketingUsers,
  listImportBatchOptions,
  listLeads,
  parseLeadListParams,
} from '@/lib/queries/leads';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Leads',
  description: 'Search, filter, assign and manage every lead in the pipeline.',
};

const BASE_PATH = `${ROUTES.ADMIN.CRM}/leads`;

/**
 * /admin/crm/leads
 *
 * Agency-wide lead list. Search, filters, sorting and pagination all run
 * in MongoDB from whitelisted URL params; nothing is filtered in the
 * browser. Admins can check leads and act on them in bulk (assign,
 * unassign, change status, round-robin distribute) via the selection
 * provider + bulk bar.
 */
export default async function AdminLeadsPage(
  props: PageProps<'/admin/crm/leads'>
) {
  await requireRole(USER_ROLES.ADMIN);

  const rawParams = await props.searchParams;
  const params = parseLeadListParams(rawParams);
  const now = new Date();

  const [
    { items, total },
    marketingUsers,
    services,
    importBatches,
  ] = await Promise.all([
    listLeads(params, { kind: 'admin' }),
    listAssignableMarketingUsers(),
    listActiveServices(),
    listImportBatchOptions(50),
  ]);

  const filtered = hasLeadFilters(params);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leads"
        description="Search, filter, assign and move leads through the sales pipeline."
        action={
          <div className="flex items-center gap-2">
            <ButtonLink
              href={ROUTES.ADMIN.CRM_IMPORT}
              variant="outline"
            >
              <FileUp className="h-4 w-4" aria-hidden="true" />
              Import CSV
            </ButtonLink>
            <ButtonLink href={`${BASE_PATH}/new`}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              New Lead
            </ButtonLink>
          </div>
        }
      />

      <CrmTabs
        basePath={ROUTES.ADMIN.CRM}
        items={[
          { title: 'Overview', href: ROUTES.ADMIN.CRM },
          { title: 'Leads', href: BASE_PATH },
          { title: 'Import', href: ROUTES.ADMIN.CRM_IMPORT },
          {
            title: 'Distribution',
            href: ROUTES.ADMIN.CRM_DISTRIBUTION,
          },
        ]}
      />

      <LeadFilters
        endpoint={BASE_PATH}
        current={params}
        showAdminFilters
        marketingUsers={marketingUsers}
        services={services}
        importBatches={importBatches}
      />

      {total === 0 ? (
        filtered ? (
          <EmptyState
            title="No leads match the selected filters."
            description="Try a different search term or clear the filters."
            action={
              <ButtonLink href={BASE_PATH} variant="outline" size="sm">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No leads found."
            description="Create your first lead to start the sales pipeline."
            icon={<Users className="h-8 w-8" aria-hidden="true" />}
            action={
              <ButtonLink href={`${BASE_PATH}/new`} size="sm">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Create lead
              </ButtonLink>
            }
          />
        )
      ) : (
        <>
          <LeadSelectionProvider>
            <LeadTable
              items={items}
              basePath={BASE_PATH}
              variant="admin"
              now={now}
              marketingUsers={marketingUsers}
              selectable
            />

            <Pagination
              baseUrl={BASE_PATH}
              page={params.page}
              limit={params.limit}
              total={total}
              filters={{
                search: params.search,
                status: params.status,
                source: params.source,
                assignedTo: params.assignedTo,
                service: params.service,
                createdFrom: params.createdFrom,
                createdTo: params.createdTo,
                followUp: params.followUp,
                importBatch: params.importBatch,
                sort: params.sort,
                limit: String(params.limit),
              }}
            />

            <LeadBulkBar marketingUsers={marketingUsers} />
          </LeadSelectionProvider>

          <p className="text-xs text-muted-foreground">
            Showing {items.length} of {total} leads.{' '}
            <Link href={ROUTES.ADMIN.CRM} className="hover:underline">
              Back to CRM overview
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
