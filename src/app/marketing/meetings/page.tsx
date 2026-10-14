import type { Metadata } from 'next';

import AgendaList from '@/components/crm/agenda-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { listAgendaMeetings } from '@/lib/queries/meetings';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Meetings' };
export default async function MarketingMeetingsPage() {
  const user = await requireRole(USER_ROLES.MARKETING); const [today, upcoming] = await Promise.all([listAgendaMeetings({ ownerUserId: user.id, limit: 50 }), listAgendaMeetings({ ownerUserId: user.id, upcoming: true, limit: 50 })]);
  return <div className="flex flex-col gap-6"><PageHeader title="Meetings" description="Scheduled meetings for your assigned leads." /><div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>Today ({today.length})</CardTitle></CardHeader><CardContent><AgendaList items={today} basePath="/marketing/leads" variant="today" showLead /></CardContent></Card><Card><CardHeader><CardTitle>Upcoming ({upcoming.length})</CardTitle></CardHeader><CardContent><AgendaList items={upcoming} basePath="/marketing/leads" variant="upcoming" showLead /></CardContent></Card></div></div>;
}
