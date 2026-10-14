import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { notFound } from 'next/navigation';

import CrmTabs from '@/components/crm/crm-tabs';
import CommunicationTimeline from '@/components/crm/communication-timeline';
import FollowUpActions from '@/components/crm/follow-up-actions';
import LeadDetailActions from '@/components/crm/lead-detail-actions';
import LeadDetailView from '@/components/crm/lead-detail-view';
import LeadSectionTabs from '@/components/crm/lead-section-tabs';
import LeadStatusBadge from '@/components/crm/lead-status-badge';
import ConvertToClientButton from '@/components/crm/convert-to-client-button';
import {
  MeetingLifecycleActions,
  ScheduleMeetingDialog,
} from '@/components/crm/meeting-actions';
import MeetingList from '@/components/crm/meeting-list';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { ROUTES } from '@/lib/constants/routes';
import { LEAD_STATUSES, type LeadStatus } from '@/lib/constants/enums';
import {
  getLeadDetail,
  listAssignableMarketingUsers,
} from '@/lib/queries/leads';
import {
  listLeadCommunications,
  parseCommunicationTimelineParams,
} from '@/lib/queries/communications';
import { listLeadMeetings } from '@/lib/queries/meetings';
import {
  parseLeadDetailTab,
  type LeadDetailTab,
} from '@/components/crm/lead-section-tabs';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Lead',
  description: 'Lead details, pipeline stage, ownership and follow-up.',
};

/**
 * /admin/crm/leads/[id]
 *
 * Admin view of any lead. Invalid ids and unknown leads both resolve to
 * `notFound()` rather than leaking a database error.
 */
export default async function AdminLeadDetailPage(
  props: PageProps<'/admin/crm/leads/[id]'>
) {
  await requireRole(USER_ROLES.ADMIN);

  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const { notice, tab } = searchParams;
  const activeTab = parseLeadDetailTab(tab);

  const [lead, marketingUsers] = await Promise.all([
    getLeadDetail(id),
    listAssignableMarketingUsers(),
  ]);

  if (!lead) {
    notFound();
  }

  const assignedLabel = lead.assignedTo
    ? `${lead.assignedTo.name}${
        lead.assignedTo.marketingCode
          ? ` · ${lead.assignedTo.marketingCode}`
          : ''
      }`
    : null;

  const [timeline, meetings] = await Promise.all([
    activeTab === 'communication'
      ? listLeadCommunications(
          lead.id,
          parseCommunicationTimelineParams(searchParams)
        )
      : null,
    activeTab === 'meetings' ? listLeadMeetings(lead.id) : null,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={lead.name}
        description={`${lead.leadCode}${lead.companyName ? ` · ${lead.companyName}` : ''}`}
        action={
          <>
            <LeadStatusBadge status={lead.status} />
            <Link
              href={`${ROUTES.ADMIN.CRM}/leads`}
              className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to leads
            </Link>
          </>
        }
      />

      <CrmTabs
        basePath={ROUTES.ADMIN.CRM}
        items={[
          { title: 'Overview', href: ROUTES.ADMIN.CRM },
          { title: 'Leads', href: `${ROUTES.ADMIN.CRM}/leads` },
        ]}
      />

      <LeadSectionTabs
        basePath={`${ROUTES.ADMIN.CRM}/leads/${lead.id}`}
        active={activeTab}
      />

      {notice === 'created' && (
        <div className="flex items-start gap-x-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Lead created successfully with code{' '}
            <span className="font-mono">{lead.leadCode}</span>. It will appear
            in the assigned marketing user&rsquo;s portal once they sign in.
          </p>
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          <LeadDetailView lead={lead} now={new Date()} showAssignment />
          <ConvertToClientButton
            leadId={lead.id}
            leadCode={lead.leadCode}
            isWon={lead.status === LEAD_STATUSES.WON}
            convertedClientId={lead.convertedClientId}
            convertedClientCode={lead.convertedClientId}
          />
          <LeadDetailActions
            leadId={lead.id}
            leadCode={lead.leadCode}
            status={lead.status}
            lostReason={lead.lostReason}
            lostReasonNote={lead.lostReasonNote}
            assignedToUserId={lead.assignedTo?.userId ?? null}
            assignedToLabel={assignedLabel}
            editHref={`${ROUTES.ADMIN.CRM}/leads/${lead.id}/edit`}
            marketingUsers={marketingUsers}
            canAssign
          />
        </>
      )}

      {activeTab === 'communication' && timeline && (
        <CommunicationTimeline
          leadId={lead.id}
          leadCode={lead.leadCode}
          leadName={lead.name}
          searchParams={searchParams}
          timeline={timeline}
        />
      )}

      {activeTab === 'followups' && (
        <FollowUpActions
          leadId={lead.id}
          leadCode={lead.leadCode}
          leadName={lead.name}
          currentStatus={lead.status as LeadStatus}
          nextFollowUpAt={lead.nextFollowUpAt}
        />
      )}

      {activeTab === 'meetings' && meetings && (
        <MeetingList
          upcoming={meetings.upcoming}
          past={meetings.past}
          scheduleAction={
            <ScheduleMeetingDialog
              leadId={lead.id}
              leadCode={lead.leadCode}
              leadName={lead.name}
              currentStatus={lead.status as LeadStatus}
              defaultAssigneeName={assignedLabel}
            />
          }
          meetingActions={(meeting) => (
            <MeetingLifecycleActions
              meetingId={meeting.id}
              meetingTitle={meeting.title}
              leadId={lead.id}
              leadCode={lead.leadCode}
              leadName={lead.name}
              currentStatus={lead.status as LeadStatus}
            />
          )}
          leadHref={`${ROUTES.ADMIN.CRM}/leads/${lead.id}`}
          leadCode={lead.leadCode}
          leadName={lead.name}
        />
      )}
    </div>
  );
}
