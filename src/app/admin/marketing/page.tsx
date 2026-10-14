import type { Metadata } from 'next';
import Link from 'next/link';
import { Megaphone, UserPlus } from 'lucide-react';

import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/admin/status-badge';
import ListFilters from '@/components/admin/list-filters';
import Pagination from '@/components/admin/pagination';
import UserRowActions from '@/components/admin/user-row-actions';
import {
  COMMISSION_TYPE_LABELS,
  USER_STATUS_LABELS,
} from '@/lib/constants/enums';
import {
  listMarketing,
  parseMarketingListParams,
} from '@/lib/queries/admin-users';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Marketing Team',
  description: 'Manage marketing user accounts and profiles.',
};

/**
 * /admin/marketing
 *
 * Server-rendered list with server-side search, filtering and
 * pagination. Search and filters live in the URL.
 */
export default async function MarketingPage(
  props: PageProps<'/admin/marketing'>
) {
  await requireRole(USER_ROLES.ADMIN);

  const rawParams = await props.searchParams;
  const params = parseMarketingListParams(rawParams);
  const { items, total } = await listMarketing(params);

  const hasActiveFilters = Boolean(params.search || params.status || params.commissionType);

  const statusOptions = Object.entries(USER_STATUS_LABELS).map(
    ([value, label]) => ({ value, label })
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Marketing Team"
        description="Create, review and manage marketing user accounts and profiles."
        action={
          <ButtonLink href="/admin/marketing/new">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add Marketing User
          </ButtonLink>
        }
      />

      <ListFilters
        endpoint="/admin/marketing"
        searchPlaceholder="Search by name, email, phone, code or designation…"
        current={{
          search: params.search,
          status: params.status,
          extra: {
            commissionType: params.commissionType,
          },
        }}
        statusOptions={statusOptions}
        extraFilters={[
          {
            name: 'commissionType',
            label: 'Commission type',
            allLabel: 'All commission types',
            options: Object.entries(COMMISSION_TYPE_LABELS).map(
              ([value, label]) => ({ value, label })
            ),
          },
        ]}
      />

      {total === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No marketing team members match your filters"
            description="Try a different search term or clear the filters."
            action={
              <ButtonLink href="/admin/marketing" variant="outline" size="sm">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No marketing team members found."
            description="Add your first marketing user to get started."
            icon={<Megaphone className="h-8 w-8" aria-hidden="true" />}
            action={
              <ButtonLink href="/admin/marketing/new" size="sm">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Add Marketing User
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
                  <th scope="col" className="px-4 py-3">Email</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Phone</th>
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">Designation</th>
                  <th scope="col" className="px-4 py-3">Commission</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Target</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Joined</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr
                    key={item.profileId}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {item.marketingCode}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                      <Link
                        href={`/admin/marketing/${item.userId}`}
                        className="hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="max-w-56 truncate px-4 py-3 text-muted-foreground">
                      {item.email}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                      {item.phone || '—'}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                      {item.designation}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {COMMISSION_TYPE_LABELS[item.commissionType]}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                      {item.target !== null
                        ? formatMoney(item.target, 'INR')
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                      {formatDate(item.joiningDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <UserRowActions
                        userId={item.userId}
                        name={item.name}
                        status={item.status}
                        kind="marketing"
                        detailHref={`/admin/marketing/${item.userId}`}
                        editHref={`/admin/marketing/${item.userId}/edit`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            baseUrl="/admin/marketing"
            page={params.page}
            limit={params.limit}
            total={total}
            filters={{
              search: params.search,
              status: params.status,
              commissionType: params.commissionType,
              limit: String(params.limit),
            }}
          />
        </>
      )}
    </div>
  );
}
