import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import RoleBadge from '@/components/shared/role-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DetailList from '@/components/admin/detail-list';
import StatusBadge from '@/components/admin/status-badge';
import UserRowActions from '@/components/admin/user-row-actions';
import {
  EMPLOYEE_DEPARTMENT_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  PAYMENT_TYPE_LABELS,
} from '@/lib/constants/enums';
import { getEmployeeDetail } from '@/lib/queries/admin-users';
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils/format';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';
import { notFound } from 'next/navigation';
import SimpleTable from '@/components/management/simple-table';
import ButtonLink from '@/components/ui/button-link';
import { listAttendancePage, listLeavesPage, listWorkReportsPage } from '@/lib/queries/workforce';

export const metadata: Metadata = {
  title: 'Employee',
  description: 'Employee account and profile details.',
};

export default async function EmployeeDetailPage(
  props: PageProps<'/admin/employees/[id]'>
) {
  await requireRole(USER_ROLES.ADMIN);

  const { id } = await props.params;
  const notice = await props.searchParams;
  const detail = await getEmployeeDetail(id);

  if (!detail) {
    notFound();
  }

  const [attendance, leaves, reports] = await Promise.all([
    listAttendancePage({ userId: detail.userId, limit: 5 }),
    listLeavesPage({ userId: detail.userId, limit: 5 }),
    listWorkReportsPage({ userId: detail.userId, limit: 5 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={detail.name}
        description={`${detail.employeeCode} · ${detail.designation} · ${EMPLOYEE_DEPARTMENT_LABELS[detail.department]}`}
        action={
          <>
            <StatusBadge status={detail.status} />
            <Link
              href="/admin/employees"
              className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to employees
            </Link>
          </>
        }
      />

      {notice.notice === 'created' && (
        <div className="flex items-start gap-x-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Account created successfully. Share the email and temporary
            password with {detail.name} through a secure channel — on
            first sign-in they will be asked to set their own password.
          </p>
        </div>
      )}

      <div>
        <UserRowActions
          userId={detail.userId}
          name={detail.name}
          status={detail.status}
          kind="employee"
          variant="panel"
          detailHref={`/admin/employees/${detail.userId}`}
          editHref={`/admin/employees/${detail.userId}/edit`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account information</CardTitle>
            <CardDescription>Sign-in identity and account state.</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: 'Name', value: detail.name },
                { label: 'Email', value: detail.email },
                { label: 'Phone', value: detail.phone || '—' },
                { label: 'Account status', value: <StatusBadge status={detail.status} /> },
                { label: 'Role', value: <RoleBadge role="EMPLOYEE" /> },
                {
                  label: 'Password',
                  value: detail.mustChangePassword ? (
                    <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning">
                      Must set on next sign-in
                    </span>
                  ) : (
                    'Managed'
                  ),
                },
                { label: 'Last login', value: formatDateTime(detail.lastLoginAt) },
                { label: 'Created at', value: formatDateTime(detail.createdAt) },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employee information</CardTitle>
            <CardDescription>
              Role-specific profile. Base amount is confidential.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: 'Employee code', value: <span className="font-mono text-xs">{detail.employeeCode}</span> },
                { label: 'Department', value: EMPLOYEE_DEPARTMENT_LABELS[detail.department] },
                { label: 'Designation', value: detail.designation },
                { label: 'Employment type', value: EMPLOYMENT_TYPE_LABELS[detail.employmentType] },
                {
                  label: 'Skills',
                  value: detail.skills.length > 0 ? detail.skills.join(', ') : '—',
                },
                { label: 'Joining date', value: formatDate(detail.joiningDate) },
                { label: 'Payment type', value: PAYMENT_TYPE_LABELS[detail.paymentType] },
                {
                  label: 'Base amount',
                  value:
                    detail.baseAmount !== null
                      ? formatMoney(detail.baseAmount, detail.currency)
                      : '—',
                },
                { label: 'Currency', value: detail.currency },
                {
                  label: 'Manager',
                  value: detail.manager
                    ? `${detail.manager.employeeCode} · ${detail.manager.designation}`
                    : '—',
                },
                { label: 'Address', value: detail.address || '—' },
                { label: 'Emergency contact', value: detail.emergencyContact || '—' },
                { label: 'Notes', value: detail.notes || '—' },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card><CardHeader><CardTitle>Recent attendance</CardTitle><CardDescription>{attendance.total} recorded day(s)</CardDescription></CardHeader><CardContent className="space-y-3"><SimpleTable columns={[{ key: 'date', label: 'Date' }, { key: 'worked', label: 'Worked' }, { key: 'status', label: 'Status' }]} rows={attendance.items.map((row) => ({ id: row.id, date: row.workDate, worked: `${row.totalWorkedMinutes} min`, status: row.status }))} /><ButtonLink href={`/admin/attendance/${attendance.items[0]?.employeeProfileId ?? ''}`} variant="outline">Attendance history</ButtonLink></CardContent></Card>
        <Card><CardHeader><CardTitle>Leave requests</CardTitle><CardDescription>{leaves.total} request(s)</CardDescription></CardHeader><CardContent><SimpleTable hrefBase="/admin/leaves" columns={[{ key: 'code', label: 'Code' }, { key: 'days', label: 'Days' }, { key: 'status', label: 'Status' }]} rows={leaves.items.map((row) => ({ id: row.id, code: row.leaveCode, days: row.requestedDays, status: row.status }))} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Daily reports</CardTitle><CardDescription>{reports.total} report(s)</CardDescription></CardHeader><CardContent><SimpleTable hrefBase="/admin/work-reports" columns={[{ key: 'code', label: 'Code' }, { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }]} rows={reports.items.map((row) => ({ id: row.id, code: row.reportCode, date: row.workDate, status: row.status }))} /></CardContent></Card>
      </div>
    </div>
  );
}
