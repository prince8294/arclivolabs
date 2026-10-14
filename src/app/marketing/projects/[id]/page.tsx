import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import DetailList from '@/components/admin/detail-list';
import { ProjectStatusBadge } from '@/components/projects/project-badges';
import {
  MilestoneStatusBadge,
  ProjectProgressBar,
} from '@/components/projects/project-panels';
import { requireRole } from '@/lib/auth/authorization';
import { getMarketingProjectDetail } from '@/lib/queries/projects';
import { formatDate } from '@/lib/utils/format';
import { PROJECT_TYPE_LABELS, type ProjectType } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Project Update',
  description: 'High-level delivery progress for one of your clients.',
};

interface MarketingProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MarketingProjectDetailPage(
  props: MarketingProjectDetailPageProps
) {
  const user = await requireRole(USER_ROLES.MARKETING);
  const { id } = await props.params;

  // The query itself enforces Client.assignedMarketingUserId === user.id and
  // returns null otherwise, so no ownership check can be bypassed (§40).
  const project = await getMarketingProjectDetail(id, user.id);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.title}
        description={`${project.projectCode} · ${project.clientName || 'Internal project'}`}
        action={
          <Link
            href="/marketing/projects"
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Client projects
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={project.status} />
        {project.isOverdue ? (
          <span className="text-sm font-medium text-destructive">
            Running {project.daysOverdue} day(s) behind the expected date
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6 shadow-xs lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">Delivery progress</h2>
          <ProjectProgressBar className="mt-4" value={project.progressPercentage} />

          <div className="mt-6">
            <DetailList
              items={[
                { label: 'Client', value: project.clientName || 'Internal project' },
                {
                  label: 'Service type',
                  value: PROJECT_TYPE_LABELS[project.projectType as ProjectType] ?? '—',
                },
                {
                  label: 'Start date',
                  value: project.startDate
                    ? formatDate(new Date(project.startDate))
                    : 'Not started',
                },
                {
                  label: 'Expected delivery',
                  value: project.expectedEndDate
                    ? formatDate(new Date(project.expectedEndDate))
                    : 'To be confirmed',
                },
              ]}
            />
          </div>

          {project.description ? (
            <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
              {project.description}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Milestones</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Client-visible delivery milestones.
          </p>

          {project.milestones.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No client-visible milestones yet.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {project.milestones.map((milestone) => (
                <li key={milestone._id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {milestone.sequence}. {milestone.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {milestone.dueDate
                          ? `Due ${formatDate(new Date(milestone.dueDate))}`
                          : 'No date set'}
                      </span>
                    </div>
                    <MilestoneStatusBadge status={milestone.status} />
                  </div>
                  <ProjectProgressBar
                    className="mt-2"
                    label="Progress"
                    value={milestone.progressPercentage}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="flex items-start gap-x-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        This is a read-only summary. Internal team notes, employee assignments and
        financial data are not visible here.
      </p>
    </div>
  );
}
