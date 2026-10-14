import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import LeadForm, {
  type LeadFormValues,
} from '@/components/crm/lead-form';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { DEFAULT_CURRENCY, LEAD_SOURCES, LEAD_STATUSES } from '@/lib/constants/enums';
import { ROUTES } from '@/lib/constants/routes';
import {
  listActiveServices,
  listAssignableMarketingUsers,
} from '@/lib/queries/leads';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'New Lead',
  description: 'Capture a new lead into the sales pipeline.',
};

const EMPTY_LEAD: LeadFormValues = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  alternatePhone: '',
  website: '',
  source: LEAD_SOURCES.MANUAL,
  serviceInterest: [],
  estimatedBudget: '',
  currency: DEFAULT_CURRENCY,
  status: LEAD_STATUSES.NEW,
  assignedTo: '',
  nextFollowUpAt: '',
  notes: '',
  lostReason: '',
  lostReasonNote: '',
};

/**
 * /admin/crm/leads/new
 *
 * Admin capture form. The service list and the assignee list are loaded
 * from MongoDB (never hardcoded), and the lead code is allocated
 * atomically by the shared Counter on save.
 */
export default async function NewLeadPage() {
  await requireRole(USER_ROLES.ADMIN);

  const [marketingUsers, services] = await Promise.all([
    listAssignableMarketingUsers(),
    listActiveServices(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="New Lead"
        description="Captured leads receive a sequential code like LEAD-0001."
        action={
          <Link
            href={`${ROUTES.ADMIN.CRM}/leads`}
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to leads
          </Link>
        }
      />

      <LeadForm
        mode="create"
        portal="admin"
        initialValues={EMPTY_LEAD}
        marketingUsers={marketingUsers}
        services={services}
      />
    </div>
  );
}