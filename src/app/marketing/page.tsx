import type { Metadata } from 'next';
import { CalendarClock, CheckCircle2, Clock, FileText, Sparkles, TrendingUp, UserPlus } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import PageHeader from '@/components/ui/page-header';
import RoleBadge from '@/components/shared/role-badge';
import StatCard from '@/components/dashboard/stat-card';
import ActivityFeed from '@/components/crm/activity-feed';
import { requireRole } from '@/lib/auth/authorization';
import { LEAD_STATUSES } from '@/lib/constants/enums';
import { ROUTES } from '@/lib/constants/routes';
import { getLeadCounts } from '@/lib/queries/leads';
import { listRecentLeadActivity } from '@/lib/queries/communications';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Marketing Dashboard',
  description: 'Your assigned leads, follow-ups and pipeline progress.',
};

/**
 * /marketing
 *
 * Every figure is a real count for the signed-in marketing user's own
 * leads — the queries are scoped to `assignedTo = currentUser`, so no
 * company-wide totals are exposed here. Commission and revenue figures
 * are intentionally absent until those modules exist.
 */
export default async function MarketingDashboardPage() {
  // Per-request authorization: layouts are cached across client-side
  // navigations, so the page re-checks on every navigation as well.
  const user = await requireRole(USER_ROLES.MARKETING);

  const [leads, activity] = await Promise.all([
    getLeadCounts({
      kind: 'marketing',
      userId: user.id,
    }),
    listRecentLeadActivity({ ownerUserId: user.id, limit: 10 }),
  ]);

  const followUpsDue = leads.followUps.overdue + leads.followUps.dueToday;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`Your assigned leads, follow-ups and pipeline progress.`}
        action={<RoleBadge role={USER_ROLES.MARKETING} />}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="My Leads"
          value={leads.total}
          description="Assigned to you"
          icon={UserPlus}
        />
        <StatCard
          title="New"
          value={leads.byStatus[LEAD_STATUSES.NEW]}
          description="Not contacted yet"
          icon={Sparkles}
        />
        <StatCard
          title="Follow-ups Due"
          value={followUpsDue}
          description={`${leads.followUps.overdue} overdue · ${leads.followUps.dueToday} today`}
          icon={CalendarClock}
        />
        <StatCard
          title="Interested"
          value={leads.byStatus[LEAD_STATUSES.INTERESTED]}
          description="Engaged prospects"
          icon={TrendingUp}
        />
        <StatCard
          title="Proposal Sent"
          value={leads.byStatus[LEAD_STATUSES.PROPOSAL_SENT]}
          description="Awaiting a decision"
          icon={FileText}
        />
        <StatCard
          title="Won"
          value={leads.byStatus[LEAD_STATUSES.WON]}
          description="Ready for client conversion"
          icon={CheckCircle2}
        />
        <StatCard
          title="Upcoming Follow-ups"
          value={leads.followUps.upcoming}
          description="Scheduled from tomorrow"
          icon={Clock}
        />
        <StatCard
          title="Lost"
          value={leads.byStatus[LEAD_STATUSES.LOST]}
          description="Closed without a deal"
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Latest calls, emails, notes and meetings on your leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityFeed items={activity} basePath={ROUTES.MARKETING.LEADS} />
        </CardContent>
      </Card>
    </div>
  );
}
