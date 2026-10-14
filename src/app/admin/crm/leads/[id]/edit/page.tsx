import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

import CrmTabs from '@/components/crm/crm-tabs';
import LeadForm, { type LeadFormValues } from '@/components/crm/lead-form';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { ROUTES } from '@/lib/constants/routes';
import { toDateTimeLocalValue } from '@/lib/utils/follow-up';
import {
  getLeadDetail,
  listActiveServices,
  listAssignableMarketingUsers,
} from '@/lib/queries/leads';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Edit Lead',
  description: 'Update lead contact details, pipeline stage and follow-up.',
};

/**
 * /admin/crm/leads/[id]/edit
 *
 * Pre-filled from the stored lead. `leadCode` and `createdBy` are not part
 * of the payload at all, so they cannot be changed from this screen.
 */
export default async function EditLeadPage(
  props: PageProps<'/admin/crm/leads/[id]/edit'>
) {
  await requireRole(USER_ROLES.ADMIN);

  const { id } = await props.params;
  const lead = await getLeadDetail(id);

  if (!lead) {
    notFound();
  }

  const [marketingUsers, services] = await Promise.all([
    listAssignableMarketingUsers(),
    listActiveServices(),
  ]);

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
            href={`${ROUTES.ADMIN.CRM}/leads/${lead.id}`}
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to details
          </Link>
        }
      />

      <CrmTabs
        basePath={ROUTES.ADMIN.CRM}
        items={[
          { title: 'Overview', href: ROUTES.ADMIN.CRM },
          { title: 'Leads', href: `${ROUTES.ADMIN.CRM}/leads` },
        ]}
      />

      <LeadForm
        mode="edit"
        portal="admin"
        leadId={lead.id}
        initialValues={initialValues}
        marketingUsers={marketingUsers}
        services={services}
      />
    </div>
  );
}