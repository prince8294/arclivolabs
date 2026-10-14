import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';

import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/admin/status-badge';
import ListFilters from '@/components/admin/list-filters';
import Pagination from '@/components/admin/pagination';
import UserRowActions from '@/components/admin/user-row-actions';
import {
  EMPLOYEE_DEPARTMENT_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  USER_STATUS_LABELS,
} from '@/lib/constants/enums';
import {
  listEmployees,
  parseEmployeeListParams,
} from '@/lib/queries/admin-users';
import { formatDate } from '@/lib/utils/format';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Employees',
  description: 'Manage employee accounts and profiles.',
};

/**
 * /admin/employees
 *
 * Server-rendered list with server-side search, filtering and
 * pagination. Search/filters live in the URL so any view is shareable
 * and refresh-safe.
 */
export default async function EmployeesPage(
  props: PageProps<'/admin/employees'>
) {
  await requireRole(USER_ROLES.ADMIN);

  const rawParams = await props.searchParams;
  const params = parseEmployeeListParams(rawParams);
  const { items, total } = await listEmployees(params);

  const hasActiveFilters = Boolean(
    params.search || params.status || params.department || params.employmentType
  );

  const statusOptions = Object.entries(USER_STATUS_LABELS).map(
    ([value, label]) => ({ value, label })
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employees"
        description="Create, review and manage employee accounts and profiles."
        action={
          <ButtonLink href="/admin/employees/new">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add Employee
          </ButtonLink>
        }
      />

      <ListFilters
        endpoint="/admin/employees"
        searchPlaceholder="Search by name, email, phone, code or designation…"
        current={{
          search: params.search,
          status: params.status,
          extra: {
            department: params.department,
            employmentType: params.employmentType,
          },
        }}
        statusOptions={statusOptions}
        extraFilters={[
          {
            name: 'department',
            label: 'Department',
            allLabel: 'All departments',
            options: Object.entries(EMPLOYEE_DEPARTMENT_LABELS).map(
              ([value, label]) => ({ value, label })
            ),
          },
          {
            name: 'employmentType',
            label: 'Employment type',
            allLabel: 'All types',
            options: Object.entries(EMPLOYMENT_TYPE_LABELS).map(
              ([value, label]) => ({ value, label })
            ),
          },
        ]}
      />

      {total === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No employees match your filters"
            description="Try a different search term or clear the filters."
            action={
              <ButtonLink
                href="/admin/employees"
                variant="outline"
                size="sm"
              >
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No employees found."
            description="Add your first employee to get started."
            icon={<UserPlus className="h-8 w-8" aria-hidden="true" />}
            action={
              <ButtonLink href="/admin/employees/new" size="sm">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Add Employee
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
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">Department</th>
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">Designation</th>
                  <th scope="col" className="hidden px-4 py-3 xl:table-cell">Type</th>
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
                      {item.employeeCode}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                      <Link
                        href={`/admin/employees/${item.userId}`}
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
                      {EMPLOYEE_DEPARTMENT_LABELS[item.department]}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                      {item.designation}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 xl:table-cell">
                      {EMPLOYMENT_TYPE_LABELS[item.employmentType]}
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
                        kind="employee"
                        detailHref={`/admin/employees/${item.userId}`}
                        editHref={`/admin/employees/${item.userId}/edit`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            baseUrl="/admin/employees"
            page={params.page}
            limit={params.limit}
            total={total}
            filters={{
              search: params.search,
              status: params.status,
              department: params.department,
              employmentType: params.employmentType,
              limit: String(params.limit),
            }}
          />
        </>
      )}
    </div>
  );
}
