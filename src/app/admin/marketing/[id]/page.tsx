import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { notFound } from 'next/navigation';

import PageHeader from '@/components/ui/page-header';
import RoleBadge from '@/components/shared/role-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DetailList from '@/components/admin/detail-list';
import StatusBadge from '@/components/admin/status-badge';
import UserRowActions from '@/components/admin/user-row-actions';
import {
  COMMISSION_TYPES,
  COMMISSION_TYPE_LABELS,
} from '@/lib/constants/enums';
import { DEFAULT_CURRENCY } from '@/lib/constants/enums';
import { getMarketingDetail } from '@/lib/queries/admin-users';
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils/format';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Marketing User',
  description: 'Marketing user account and profile details.',
};

function commissionValueDisplay(
  type: (typeof COMMISSION_TYPES)[keyof typeof COMMISSION_TYPES],
  value: number
): string {
  if (type === COMMISSION_TYPES.NONE) {
    return '—';
  }
  if (type === COMMISSION_TYPES.PERCENTAGE) {
    return `${value}%`;
  }
  return formatMoney(value, DEFAULT_CURRENCY);
}

export default async function MarketingDetailPage(
  props: PageProps<'/admin/marketing/[id]'>
) {
  await requireRole(USER_ROLES.ADMIN);

  const { id } = await props.params;
  const notice = await props.searchParams;
  const detail = await getMarketingDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={detail.name}
        description={`${detail.marketingCode} · ${detail.designation}`}
        action={
          <>
            <StatusBadge status={detail.status} />
            <Link
              href="/admin/marketing"
              className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to marketing team
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

      {detail.assignedLeadCount > 0 && (
        <div
          role="status"
          className="flex items-start gap-x-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            This user currently has {detail.assignedLeadCount} assigned
            lead{detail.assignedLeadCount === 1 ? '' : 's'}. Suspending or
            deactivating the account leaves those leads owned by an
            inactive user — reassign them from the CRM distribution
            workspace first.
          </p>
        </div>
      )}

      <div>
        <UserRowActions
          userId={detail.userId}
          name={detail.name}
          status={detail.status}
          kind="marketing"
          variant="panel"
          detailHref={`/admin/marketing/${detail.userId}`}
          editHref={`/admin/marketing/${detail.userId}/edit`}
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
                { label: 'Role', value: <RoleBadge role="MARKETING" /> },
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
            <CardTitle>Marketing information</CardTitle>
            <CardDescription>
              Commission rules only. Payouts are calculated in a later
              phase; no CRM figures are shown here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: 'Marketing code', value: <span className="font-mono text-xs">{detail.marketingCode}</span> },
                { label: 'Designation', value: detail.designation },
                { label: 'Joining date', value: formatDate(detail.joiningDate) },
                { label: 'Commission type', value: COMMISSION_TYPE_LABELS[detail.commissionType] },
                {
                  label: 'Commission value',
                  value: commissionValueDisplay(
                    detail.commissionType,
                    detail.commissionValue
                  ),
                },
                {
                  label: 'Target',
                  value:
                    detail.target !== null
                      ? formatMoney(detail.target, DEFAULT_CURRENCY)
                      : '—',
                },
                { label: 'Notes', value: detail.notes || '—' },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
