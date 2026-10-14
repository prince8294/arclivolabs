import type { Metadata } from 'next';
import Link from 'next/link';

import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/admin/status-badge';
import ListFilters from '@/components/admin/list-filters';
import Pagination from '@/components/admin/pagination';
import ClientRowActions from '@/components/admin/client-row-actions';
import {
  CLIENT_STATUS_LABELS,
  CLIENT_TYPE_LABELS,
} from '@/lib/constants/enums';
import { getAssignedClientDetail, listClients, parseClientListParams } from '@/lib/queries/clients';
import { formatDate } from '@/lib/utils/format';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES, type AuthUser } from '@/types/auth';
import { getCurrentUser } from '@/lib/auth/current-user';

export const metadata: Metadata = {
  title: 'My Clients',
  description: 'Clients assigned to you.',
};

export default async function MarketingClientsPage(
  props: PageProps<'/marketing/clients'>
) {
  const authUser = await requireRole(USER_ROLES.MARKETING);
  const currentUser = authUser as AuthUser;

  const rawParams = await props.searchParams;
  const params = parseClientListParams(rawParams);
  const { items, total } = await listClients(
    { ...params, status: '', type: '', source: '', portalAccess: '', assignedTo: '', createdFrom: '', createdTo: '' },
    { kind: 'marketing', userId: currentUser.id }
  );

  const hasActiveFilters = Boolean(
    params.search
  );

  const statusOptions = Object.entries(CLIENT_STATUS_LABELS).map(
    ([value, label]) => ({ value, label })
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Clients"
        description="Clients assigned to you."
      />

      <ListFilters
        endpoint="/marketing/clients"
        searchPlaceholder="Search by code, name, company, email or phone…"
        current={{
          search: params.search,
          status: '',
          extra: {},
        }}
        statusOptions={statusOptions}
        extraFilters={[]}
      />

      {total === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No clients match your search"
            description="Try a different search term."
          />
        ) : (
          <EmptyState
            title="No assigned clients yet."
            description="Clients assigned to you will appear here."
          />
        )
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Company</th>
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">Email</th>
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">Phone</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Type</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Portal</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Created</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {item.clientCode}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                      <Link
                        href={`/marketing/clients/${item.id}`}
                        className="hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="hidden max-w-40 truncate px-4 py-3 text-muted-foreground lg:table-cell">
                      {item.companyName || '—'}
                    </td>
                    <td className="hidden max-w-40 truncate px-4 py-3 text-muted-foreground md:table-cell">
                      {item.email}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground md:table-cell">
                      {item.phone || '—'}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 lg:table-cell">
                      {CLIENT_TYPE_LABELS[item.type]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {item.hasPortalAccess ? 'Enabled' : 'Disabled'}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <ClientRowActions
                        clientId={item.id}
                        clientCode={item.clientCode}
                        name={item.name}
                        status={item.status}
                        hasPortalAccess={item.hasPortalAccess}
                        detailHref={`/marketing/clients/${item.id}`}
                        editHref={`/marketing/clients/${item.id}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            baseUrl="/marketing/clients"
            page={params.page}
            limit={params.limit}
            total={total}
            filters={{
              search: params.search,
              sort: params.sort,
              limit: String(params.limit),
            }}
          />
        </>
      )}
    </div>
  );
}