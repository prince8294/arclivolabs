import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';

import LeadFilters from '@/components/crm/lead-filters';
import LeadTable from '@/components/crm/lead-table';
import PipelineBoard from '@/components/crm/pipeline-board';
import Pagination from '@/components/admin/pagination';
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
import {
  getLeadCounts,
  getPipeline,
  hasLeadFilters,
  listActiveServices,
  listLeads,
  parseLeadListParams,
} from '@/lib/queries/leads';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'My Leads',
  description: 'Leads assigned to you and your personal sales pipeline.',
};

const BASE_PATH = ROUTES.MARKETING.LEADS;

/**
 * /marketing/leads
 *
 * Every query on this page is scoped to `assignedTo = currentUser` inside
 * MongoDB, so a marketing user can never see another user's leads or
 * company-wide totals — not even by editing the URL.
 */
export default async function MarketingLeadsPage(
  props: PageProps<'/marketing/leads'>
) {
  const user = await requireRole(USER_ROLES.MARKETING);

  const rawParams = await props.searchParams;
  const params = parseLeadListParams(rawParams);
  const now = new Date();

  // The scope comes from the authenticated session, never from a query
  // parameter.
  const scope = { kind: 'marketing', userId: user.id } as const;

  const [{ items, total }, services, counts, pipeline] = await Promise.all([
    listLeads(params, scope),
    listActiveServices(),
    getLeadCounts(scope),
    getPipeline(scope),
  ]);

  const filtered = hasLeadFilters(params);
  const followUpsDue = counts.followUps.overdue + counts.followUps.dueToday;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Leads"
        description="Every lead assigned to you, with your personal pipeline and follow-up load."
        action={
          <ButtonLink href={`${BASE_PATH}/new`}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            New Lead
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="My Leads"
          value={counts.total}
          description="Assigned to you"
        />
        <StatCard
          title="New"
          value={counts.byStatus[LEAD_STATUSES.NEW]}
          description="Not contacted yet"
        />
        <StatCard
          title="Interested"
          value={counts.byStatus[LEAD_STATUSES.INTERESTED]}
          description="Engaged prospects"
        />
        <StatCard
          title="Follow-ups Due"
          value={followUpsDue}
          description="Overdue plus due today"
        />
      </div>

      {counts.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>My pipeline</CardTitle>
            <CardDescription>Counts for your assigned leads only.</CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineBoard
              stages={pipeline}
              basePath={BASE_PATH}
              lostCount={counts.byStatus[LEAD_STATUSES.LOST]}
            />
          </CardContent>
        </Card>
      )}

      <LeadFilters
        endpoint={BASE_PATH}
        current={params}
        showAdminFilters={false}
        services={services}
      />

      {total === 0 ? (
        filtered ? (
          <EmptyState
            title="No leads match the selected filters."
            description="Try a different search term or clear the filters."
            action={
              <ButtonLink href={BASE_PATH} variant="outline" size="sm">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No leads are currently assigned to you."
            description="Capture a new enquiry or ask an admin to assign leads to you."
            icon={<UserPlus className="h-8 w-8" aria-hidden="true" />}
            action={
              <ButtonLink href={`${BASE_PATH}/new`} size="sm">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Create lead
              </ButtonLink>
            }
          />
        )
      ) : (
        <>
          <LeadTable
            items={items}
            basePath={BASE_PATH}
            variant="marketing"
            now={now}
          />

          <Pagination
            baseUrl={BASE_PATH}
            page={params.page}
            limit={params.limit}
            total={total}
            filters={{
              search: params.search,
              status: params.status,
              source: params.source,
              service: params.service,
              followUp: params.followUp,
              sort: params.sort,
              limit: String(params.limit),
            }}
          />

          <p className="text-xs text-muted-foreground">
            Showing {items.length} of {total} leads assigned to you.{' '}
            <Link
              href={ROUTES.MARKETING.DASHBOARD}
              className="hover:underline"
            >
              Back to dashboard
            </Link>
          </p>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Overdue follow-ups:{' '}
        <Link
          href={`${BASE_PATH}?followUp=OVERDUE&sort=FOLLOW_UP`}
          className="hover:underline"
        >
          {counts.followUps.overdue}
        </Link>{' '}
        · Due today:{' '}
        <Link
          href={`${BASE_PATH}?followUp=DUE_TODAY&sort=FOLLOW_UP`}
          className="hover:underline"
        >
          {counts.followUps.dueToday}
        </Link>{' '}
        · Upcoming:{' '}
        <Link
          href={`${BASE_PATH}?followUp=UPCOMING&sort=FOLLOW_UP`}
          className="hover:underline"
        >
          {counts.followUps.upcoming}
        </Link>
      </p>
    </div>
  );
}