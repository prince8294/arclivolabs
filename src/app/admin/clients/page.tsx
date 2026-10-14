import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';

import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/admin/status-badge';
import ListFilters from '@/components/admin/list-filters';
import Pagination from '@/components/admin/pagination';
import ClientRowActions from '@/components/admin/client-row-actions';
import {
  CLIENT_SOURCE_LABELS,
  CLIENT_STATUS_LABELS,
  CLIENT_TYPE_LABELS,
} from '@/lib/constants/enums';
import {
  hasClientFilters,
  listClients,
  parseClientListParams,
  PORTAL_FILTER_DISABLED,
  PORTAL_FILTER_ENABLED,
} from '@/lib/queries/clients';
import { formatDate } from '@/lib/utils/format';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Clients',
  description: 'Manage client records and portal access.',
};

export default async function AdminClientsPage(
  props: PageProps<'/admin/clients'>
) {
  await requireRole(USER_ROLES.ADMIN);

  const rawParams = await props.searchParams;
  const params = parseClientListParams(rawParams);
  const { items, total } = await listClients(params, { kind: 'admin' });

  const hasActiveFilters = hasClientFilters(params);

  const statusOptions = Object.entries(CLIENT_STATUS_LABELS).map(
    ([value, label]) => ({ value, label })
  );

  const typeOptions = Object.entries(CLIENT_TYPE_LABELS).map(
    ([value, label]) => ({ value, label })
  );

  const sourceOptions = Object.entries(CLIENT_SOURCE_LABELS).map(
    ([value, label]) => ({ value, label })
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="Create, review and manage client records and portal access."
        action={
          <ButtonLink href="/admin/clients/new">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add Client
          </ButtonLink>
        }
      />

      <ListFilters
        endpoint="/admin/clients"
        searchPlaceholder="Search by code, name, company, email, phone or website…"
        current={{
          search: params.search,
          status: params.status,
          extra: {
            type: params.type,
            source: params.source,
            portalAccess: params.portalAccess,
          },
        }}
        statusOptions={statusOptions}
        extraFilters={[
          {
            name: 'type',
            label: 'Type',
            allLabel: 'All types',
            options: typeOptions,
          },
          {
            name: 'source',
            label: 'Source',
            allLabel: 'All sources',
            options: sourceOptions,
          },
          {
            name: 'portalAccess',
            label: 'Portal access',
            allLabel: 'All',
            options: [
              { value: PORTAL_FILTER_ENABLED, label: 'Enabled' },
              { value: PORTAL_FILTER_DISABLED, label: 'Not enabled' },
            ],
          },
        ]}
      />

      {total === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No clients match your filters"
            description="Try a different search term or clear the filters."
            action={
              <ButtonLink
                href="/admin/clients"
                variant="outline"
                size="sm"
              >
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No clients found."
            description="Add your first client to get started."
            action={
              <ButtonLink href="/admin/clients/new" size="sm">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Add Client
              </ButtonLink>
            }
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
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">Assigned Marketing</th>
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
                        href={`/admin/clients/${item.id}`}
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
                    <td className="hidden max-w-40 truncate whitespace-nowrap px-4 py-3 text-muted-foreground md:table-cell">
                      {item.assignedMarketingName || '—'}
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
                        detailHref={`/admin/clients/${item.id}`}
                        editHref={`/admin/clients/${item.id}/edit`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            baseUrl="/admin/clients"
            page={params.page}
            limit={params.limit}
            total={total}
            filters={{
              search: params.search,
              status: params.status,
              type: params.type,
              source: params.source,
              portalAccess: params.portalAccess,
              assignedTo: params.assignedTo,
              createdFrom: params.createdFrom,
              createdTo: params.createdTo,
              sort: params.sort,
              limit: String(params.limit),
            }}
          />
        </>
      )}
    </div>
  );
}