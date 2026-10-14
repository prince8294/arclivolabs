import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';
import { notFound } from 'next/navigation';

import CommunicationTimeline from '@/components/crm/communication-timeline';
import FollowUpActions from '@/components/crm/follow-up-actions';
import LeadDetailActions from '@/components/crm/lead-detail-actions';
import LeadDetailView from '@/components/crm/lead-detail-view';
import LeadSectionTabs from '@/components/crm/lead-section-tabs';
import LeadStatusBadge from '@/components/crm/lead-status-badge';
import {
  MeetingLifecycleActions,
  ScheduleMeetingDialog,
} from '@/components/crm/meeting-actions';
import MeetingList from '@/components/crm/meeting-list';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { ROUTES } from '@/lib/constants/routes';
import { LEAD_STATUSES, type LeadStatus } from '@/lib/constants/enums';
import { getAssignedLeadDetail } from '@/lib/queries/leads';
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
  description: 'Lead details, pipeline stage and follow-up.',
};

/**
 * /marketing/leads/[id]
 *
 * The query is scoped to `assignedTo = currentUser`. A lead owned by
 * another marketing user (or unassigned) returns null and the page
 * answers `notFound()` — identical to a lead that does not exist, so
 * ownership is never disclosed.
 */
export default async function MarketingLeadDetailPage(
  props: PageProps<'/marketing/leads/[id]'>
) {
  const user = await requireRole(USER_ROLES.MARKETING);

  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const { notice, tab } = searchParams;
  const activeTab = parseLeadDetailTab(tab);

  const lead = await getAssignedLeadDetail(id, user.id);

  if (!lead) {
    notFound();
  }

  const [timeline, meetings] = await Promise.all([
    activeTab === 'communication'
      ? listLeadCommunications(
          lead.id,
          parseCommunicationTimelineParams(searchParams),
          user.id
        )
      : null,
    activeTab === 'meetings' ? listLeadMeetings(lead.id, user.id) : null,
  ]);

  const assignedLabel = lead.assignedTo
    ? `${lead.assignedTo.name}${
        lead.assignedTo.marketingCode
          ? ` · ${lead.assignedTo.marketingCode}`
          : ''
      }`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={lead.name}
        description={`${lead.leadCode}${lead.companyName ? ` · ${lead.companyName}` : ''}`}
        action={
          <>
            <LeadStatusBadge status={lead.status} />
            <Link
              href={ROUTES.MARKETING.LEADS}
              className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to my leads
            </Link>
          </>
        }
      />

      <LeadSectionTabs
        basePath={`${ROUTES.MARKETING.LEADS}/${lead.id}`}
        active={activeTab}
      />

      {notice === 'created' && (
        <div className="flex items-start gap-x-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Lead created and assigned to you with code{' '}
            <span className="font-mono">{lead.leadCode}</span>. Set a follow-up
            date so it does not get lost.
          </p>
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          <LeadDetailView lead={lead} now={new Date()} showAssignment />
          <LeadDetailActions
            leadId={lead.id}
            leadCode={lead.leadCode}
            status={lead.status}
            lostReason={lead.lostReason}
            lostReasonNote={lead.lostReasonNote}
            assignedToUserId={lead.assignedTo?.userId ?? null}
            assignedToLabel={assignedLabel}
            editHref={`${ROUTES.MARKETING.LEADS}/${lead.id}/edit`}
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
          leadHref={`${ROUTES.MARKETING.LEADS}/${lead.id}`}
          leadCode={lead.leadCode}
          leadName={lead.name}
        />
      )}
    </div>
  );
}
