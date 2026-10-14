import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import { BillingSettingsForm } from '@/components/billing/billing-settings-form';
import { requireRole } from '@/lib/auth/authorization';
import { getBillingSettings } from '@/lib/queries/invoices';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Billing Settings',
  description: 'Configure agency billing details, tax registrations, and default payment terms.',
};

export default async function AdminBillingSettingsPage() {
  await requireRole(USER_ROLES.ADMIN);

  const settings = await getBillingSettings();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Billing Settings"
        description="Company details, tax configurations, and payment terms copied to invoice documents."
        action={
          <Link
            href="/admin/billing"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Billing
          </Link>
        }
      />

      <BillingSettingsForm initialSettings={settings} />
    </div>
  );
}
