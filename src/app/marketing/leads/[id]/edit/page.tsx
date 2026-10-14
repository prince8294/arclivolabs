import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

import LeadForm, { type LeadFormValues } from '@/components/crm/lead-form';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { ROUTES } from '@/lib/constants/routes';
import { toDateTimeLocalValue } from '@/lib/utils/follow-up';
import {
  getAssignedLeadDetail,
  listActiveServices,
} from '@/lib/queries/leads';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Edit Lead',
  description: 'Update the details of a lead assigned to you.',
};

/**
 * /marketing/leads/[id]/edit
 *
 * Ownership is enforced in the query, so the page is unavailable the
 * moment an admin reassigns or unassigns the lead. `assignedTo`,
 * `createdBy`, `leadCode` and `source` are not part of the marketing
 * payload, so they cannot be changed from here.
 */
export default async function EditMarketingLeadPage(
  props: PageProps<'/marketing/leads/[id]/edit'>
) {
  const user = await requireRole(USER_ROLES.MARKETING);

  const { id } = await props.params;
  const lead = await getAssignedLeadDetail(id, user.id);

  if (!lead) {
    notFound();
  }

  const services = await listActiveServices();

  const initialValues: LeadFormValues = {
    name: lead.name,
    companyName: lead.companyName ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    alternatePhone: lead.alternatePhone ?? '',
    website: lead.website ?? '',
    source: lead.source,
    serviceInterest: lead.serviceInterest.map((service) => service.id),
    estimatedBudget:
      lead.estimatedBudget !== null ? String(lead.estimatedBudget) : '',
    currency: lead.currency,
    status: lead.status,
    assignedTo: lead.assignedTo?.userId ?? '',
    nextFollowUpAt: toDateTimeLocalValue(lead.nextFollowUpAt),
    notes: lead.notes ?? '',
    lostReason: lead.lostReason ?? '',
    lostReasonNote: lead.lostReasonNote ?? '',
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Edit Lead"
        description={`${lead.leadCode} · ${lead.name}`}
        action={
          <Link
            href={`${ROUTES.MARKETING.LEADS}/${lead.id}`}
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to details
          </Link>
        }
      />

      <LeadForm
        mode="edit"
        portal="marketing"
        leadId={lead.id}
        initialValues={initialValues}
        services={services}
      />
    </div>
  );
}