import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import LeadForm, { type LeadFormValues } from '@/components/crm/lead-form';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { DEFAULT_CURRENCY, LEAD_SOURCES } from '@/lib/constants/enums';
import { ROUTES } from '@/lib/constants/routes';
import { listActiveServices } from '@/lib/queries/leads';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'New Lead',
  description: 'Capture a new enquiry. It will be assigned to you.',
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
  // Shown read-only in the form; the server action forces NEW.
  status: 'NEW',
  assignedTo: '',
  nextFollowUpAt: '',
  notes: '',
  lostReason: '',
  lostReasonNote: '',
};

/**
 * /marketing/leads/new
 *
 * Marketing capture form. There is deliberately no assignment control:
 * `createLead` forces `assignedTo = createdBy = currentUser` and
 * `status = NEW`, so a marketing user cannot create work for a colleague
 * even by posting a crafted request.
 */
export default async function NewMarketingLeadPage() {
  await requireRole(USER_ROLES.MARKETING);

  const services = await listActiveServices();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="New Lead"
        description="This enquiry will be assigned to you automatically."
        action={
          <Link
            href={ROUTES.MARKETING.LEADS}
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to my leads
          </Link>
        }
      />

      <LeadForm
        mode="create"
        portal="marketing"
        initialValues={EMPTY_LEAD}
        services={services}
      />
    </div>
  );
}