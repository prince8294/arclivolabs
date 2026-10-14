import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import MarketingForm from '@/components/admin/marketing-form';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Add Marketing User',
  description: 'Create a marketing user account and profile.',
};

const EMPTY_MARKETING: Parameters<typeof MarketingForm>[0]['initialValues'] = {
  name: '',
  email: '',
  phone: '',
  designation: '',
  joiningDate: new Date().toISOString().slice(0, 10),
  commissionType: 'NONE',
  commissionValue: '0',
  target: '',
  notes: '',
};

/**
 * /admin/marketing/new
 *
 * One workflow creates both the User account (role MARKETING, active,
 * mustChangePassword) and the MarketingProfile, atomically. After
 * success the admin lands on the new marketing user's detail page.
 */
export default async function NewMarketingPage() {
  await requireRole(USER_ROLES.ADMIN);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Add Marketing User"
        description="Creates the login account and the marketing profile together."
        action={
          <Link
            href="/admin/marketing"
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to marketing team
          </Link>
        }
      />
      <MarketingForm mode="create" initialValues={EMPTY_MARKETING} />
    </div>
  );
}
