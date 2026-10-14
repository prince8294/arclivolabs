import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  FileUp,
  Handshake,
  Sparkles,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react';

import CrmTabs from '@/components/crm/crm-tabs';
import ActivityFeed from '@/components/crm/activity-feed';
import PipelineBoard from '@/components/crm/pipeline-board';
import ButtonLink from '@/components/ui/button-link';
import EmptyState from '@/components/ui/empty-state';
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/dashboard/stat-card';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireRole } from '@/lib/auth/authorization';
import { LEAD_STATUSES } from '@/lib/constants/enums';
import { ROUTES } from '@/lib/constants/routes';
import { getLeadCounts, getPipeline } from '@/lib/queries/leads';
import { listRecentLeadActivity } from '@/lib/queries/communications';
import { countImportedLeadsThisMonth } from '@/lib/queries/lead-import';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'CRM Overview',
  description: 'Sales pipeline overview, lead statistics and follow-ups.',
};

/**
 * /admin/crm
 *
 * Agency-wide CRM overview. Every number comes from a MongoDB aggregation
 * scoped to all leads — no placeholder or sampled data. Revenue and
 * commission analytics are deliberately absent in this phase.
 */
export default async function CrmOverviewPage() {
  await requireRole(USER_ROLES.ADMIN);

  const [counts, pipeline, activity, importedThisMonth] = await Promise.all([
    getLeadCounts({ kind: 'admin' }),
    getPipeline({ kind: 'admin' }),
    listRecentLeadActivity({ limit: 10 }),
    countImportedLeadsThisMonth(),
  ]);

  const followUpsDue = counts.followUps.overdue + counts.followUps.dueToday;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="CRM Overview"
        description="Live lead statistics, pipeline stages and follow-up load."
        action={
          <ButtonLink href={`${ROUTES.ADMIN.CRM}/leads/new`}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            New Lead
          </ButtonLink>
        }
      />

      <CrmTabs
        basePath={ROUTES.ADMIN.CRM}
        items={[
          { title: 'Overview', href: ROUTES.ADMIN.CRM },
          { title: 'Leads', href: `${ROUTES.ADMIN.CRM}/leads` },
          { title: 'Import', href: ROUTES.ADMIN.CRM_IMPORT },
          {
            title: 'Distribution',
            href: ROUTES.ADMIN.CRM_DISTRIBUTION,
          },
        ]}
      />

      {counts.total === 0 ? (
        <EmptyState
          title="No leads found."
          description="Create your first lead to start the sales pipeline."
          icon={<Users className="h-8 w-8" aria-hidden="true" />}
          action={
            <ButtonLink href={`${ROUTES.ADMIN.CRM}/leads/new`} size="sm">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Create lead
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Leads"
              value={counts.total}
              description="All leads ever captured"
              icon={Users}
            />
            <StatCard
              title="New Leads"
              value={counts.byStatus[LEAD_STATUSES.NEW]}
              description="Not contacted yet"
              icon={Sparkles}
            />
            <StatCard
              title="Interested"
              value={counts.byStatus[LEAD_STATUSES.INTERESTED]}
              description="Engaged prospects"
              icon={Handshake}
            />
            <StatCard
              title="Proposal Sent"
              value={counts.byStatus[LEAD_STATUSES.PROPOSAL_SENT]}
              description="Awaiting a decision"
              icon={FileText}
            />
            <StatCard
              title="Won"
              value={counts.byStatus[LEAD_STATUSES.WON]}
              description="Ready for client conversion"
              icon={CheckCircle2}
            />
            <StatCard
              title="Lost"
              value={counts.byStatus[LEAD_STATUSES.LOST]}
              description="Closed without a deal"
              icon={UserX}
            />
            <StatCard
              title="Unassigned"
              value={counts.unassigned}
              description="In the shared lead pool"
              icon={UserX}
            />
            <StatCard
              title="Imported This Month"
              value={importedThisMonth}
              description="Via CSV import"
              icon={FileUp}
            />
            <StatCard
              title="Follow-ups Due"
              value={followUpsDue}
              description="Overdue plus due today"
              icon={CalendarClock}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sales pipeline</CardTitle>
              <CardDescription>
                Real counts per stage. Select a stage to open the matching
                filtered list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PipelineBoard
                stages={pipeline}
                basePath={`${ROUTES.ADMIN.CRM}/leads`}
                lostCount={counts.byStatus[LEAD_STATUSES.LOST]}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Overdue follow-ups</CardTitle>
                <CardDescription>
                  Scheduled before today and still open.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <span className="text-3xl font-semibold tracking-tight text-destructive">
                  {counts.followUps.overdue}
                </span>
                <Link
                  href={`${ROUTES.ADMIN.CRM}/leads?followUp=OVERDUE&sort=FOLLOW_UP`}
                  className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Review
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Due today</CardTitle>
                <CardDescription>
                  Scheduled for today and still open.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <span className="text-3xl font-semibold tracking-tight text-warning">
                  {counts.followUps.dueToday}
                </span>
                <Link
                  href={`${ROUTES.ADMIN.CRM}/leads?followUp=DUE_TODAY&sort=FOLLOW_UP`}
                  className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Review
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming</CardTitle>
                <CardDescription>
                  Scheduled from tomorrow onwards.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <span className="text-3xl font-semibold tracking-tight text-foreground">
                  {counts.followUps.upcoming}
                </span>
                <Link
                  href={`${ROUTES.ADMIN.CRM}/leads?followUp=UPCOMING&sort=FOLLOW_UP`}
                  className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Review
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                Latest calls, emails, notes and meetings across all leads.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityFeed
                items={activity}
                basePath={`${ROUTES.ADMIN.CRM}/leads`}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
