import type { Metadata } from 'next';

import FollowUpList from '@/components/crm/follow-up-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { listFollowUpLeads } from '@/lib/queries/leads';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Follow-ups' };
export default async function MarketingFollowUpsPage() {
  const user = await requireRole(USER_ROLES.MARKETING); const scope = { kind: 'marketing' as const, userId: user.id }; const [today, overdue] = await Promise.all([listFollowUpLeads(scope, 'TODAY', 50), listFollowUpLeads(scope, 'OVERDUE', 50)]);
  return <div className="flex flex-col gap-6"><PageHeader title="Follow-ups" description="Today’s and overdue follow-ups across your assigned leads." /><div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>Due today ({today.length})</CardTitle></CardHeader><CardContent><FollowUpList items={today} basePath="/marketing/leads" variant="today" /></CardContent></Card><Card><CardHeader><CardTitle>Overdue ({overdue.length})</CardTitle></CardHeader><CardContent><FollowUpList items={overdue} basePath="/marketing/leads" variant="overdue" /></CardContent></Card></div></div>;
}
