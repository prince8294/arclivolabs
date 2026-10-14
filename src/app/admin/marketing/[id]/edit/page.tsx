import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

import PageHeader from '@/components/ui/page-header';
import MarketingForm, {
  type MarketingFormValues,
} from '@/components/admin/marketing-form';
import { getMarketingDetail } from '@/lib/queries/admin-users';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Edit Marketing User',
  description: 'Update a marketing user account and profile.',
};

/**
 * /admin/marketing/[id]/edit
 *
 * Pre-fills from the existing records. Email changes are normalized
 * and re-checked for global uniqueness server-side. Role cannot be
 * changed from this screen.
 */
export default async function EditMarketingPage(
  props: PageProps<'/admin/marketing/[id]/edit'>
) {
  await requireRole(USER_ROLES.ADMIN);

  const { id } = await props.params;
  const detail = await getMarketingDetail(id);

  if (!detail) {
    notFound();
  }

  const initialValues: MarketingFormValues = {
    name: detail.name,
    email: detail.email,
    phone: detail.phone ?? '',
    designation: detail.designation,
    joiningDate: detail.joiningDate.toISOString().slice(0, 10),
    commissionType: detail.commissionType,
    commissionValue: String(detail.commissionValue),
    target: detail.target !== null ? String(detail.target) : '',
    notes: detail.notes ?? '',
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Edit Marketing User"
        description={`Changes apply immediately. ${detail.marketingCode} · ${detail.name}`}
        action={
          <Link
            href={`/admin/marketing/${detail.userId}`}
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to details
          </Link>
        }
      />
      <MarketingForm
        mode="edit"
        userId={detail.userId}
        initialValues={initialValues}
      />
    </div>
  );
}
