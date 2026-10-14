import type { Metadata } from 'next';
import { CalendarClock, FileCheck, Target, Trophy } from 'lucide-react';

import StatCard from '@/components/dashboard/stat-card';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { LEAD_STATUSES } from '@/lib/constants/enums';
import { PROPOSAL_STATUSES } from '@/lib/constants/proposals';
import { getLeadCounts } from '@/lib/queries/leads';
import { countAgendaMeetings } from '@/lib/queries/meetings';
import { getProposalCounts } from '@/lib/queries/proposals';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Performance' };
export default async function MarketingPerformancePage() {
  const user = await requireRole(USER_ROLES.MARKETING); const [leads, proposals, meetings] = await Promise.all([getLeadCounts({ kind: 'marketing', userId: user.id }), getProposalCounts({ kind: 'marketing', userId: user.id }), countAgendaMeetings(user.id)]); const conversion = leads.total ? Math.round((leads.byStatus[LEAD_STATUSES.WON] / leads.total) * 1000) / 10 : 0;
  return <div className="flex flex-col gap-6"><PageHeader title="Performance" description="Live results calculated from your assigned leads, quotations and meetings." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Lead conversion" value={`${conversion}%`} description={`${leads.byStatus[LEAD_STATUSES.WON]} won of ${leads.total}`} icon={Trophy} /><StatCard title="Proposals accepted" value={proposals.byStatus[PROPOSAL_STATUSES.ACCEPTED]} description={`${proposals.total} visible proposals`} icon={FileCheck} /><StatCard title="Follow-ups due" value={leads.followUps.overdue + leads.followUps.dueToday} description={`${leads.followUps.overdue} overdue`} icon={Target} /><StatCard title="Upcoming meetings" value={meetings.today + meetings.upcoming} description={`${meetings.today} today`} icon={CalendarClock} /></div></div>;
}
