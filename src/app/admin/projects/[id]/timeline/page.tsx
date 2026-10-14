import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import Pagination from '@/components/admin/pagination';
import ProjectTimeline from '@/components/projects/project-timeline';
import ProjectSubNav from '@/components/projects/project-sub-nav';
import { ProjectHealthBadge, ProjectStatusBadge } from '@/components/projects/project-badges';
import { requireRole } from '@/lib/auth/authorization';
import {
  getProjectActivity,
  getProjectById,
  getProjectMilestones,
} from '@/lib/queries/projects';
import { PROJECT_MILESTONE_STATUSES } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Project Timeline',
  description: 'Chronological history of status changes, assignments and milestone reviews.',
};

interface ProjectTimelinePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectTimelinePage(props: ProjectTimelinePageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await props.params;

  const rawPage = Number((await props.searchParams).page ?? '1');
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const [project, milestones, activity] = await Promise.all([
    getProjectById(id),
    getProjectMilestones(id),
    getProjectActivity(id, { page, limit: 20 }),
  ]);

  if (!project) notFound();

  const pendingReview = milestones.filter(
    (m) => m.status === PROJECT_MILESTONE_STATUSES.PENDING_REVIEW
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Activity timeline"
        description={`${project.projectCode} · ${project.title}`}
        action={
          <Link
            href={`/admin/projects/${project._id}`}
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to project
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={project.status} />
        <ProjectHealthBadge health={project.health} />
      </div>

      <ProjectSubNav
        projectId={project._id}
        milestoneCount={milestones.length}
        pendingReviewCount={pendingReview}
      />

      <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <ProjectTimeline activities={activity.items} />
      </div>

      <Pagination
        baseUrl={`/admin/projects/${project._id}/timeline`}
        page={activity.page}
        limit={20}
        total={activity.total}
        filters={{}}
      />
    </div>
  );
}
