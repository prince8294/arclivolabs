import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ProjectMilestoneManager from '@/components/projects/project-milestone-manager';
import ProjectSubNav from '@/components/projects/project-sub-nav';
import { ProjectHealthBadge, ProjectStatusBadge } from '@/components/projects/project-badges';
import { ProjectProgressBar } from '@/components/projects/project-panels';
import { requireRole } from '@/lib/auth/authorization';
import {
  getActiveProjectMembers,
  getProjectById,
  getProjectMilestones,
} from '@/lib/queries/projects';
import { PROJECT_MILESTONE_STATUSES } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Project Milestones',
  description: 'Define delivery milestones, assign owners and review submissions.',
};

interface ProjectMilestonesPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectMilestonesPage(props: ProjectMilestonesPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await props.params;

  const [project, milestones, members] = await Promise.all([
    getProjectById(id),
    getProjectMilestones(id),
    getActiveProjectMembers(id),
  ]);

  if (!project) notFound();

  const pendingReview = milestones.filter(
    (m) => m.status === PROJECT_MILESTONE_STATUSES.PENDING_REVIEW
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Milestones"
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
        <ProjectProgressBar
          className="mb-4"
          label="Project progress (average of milestones)"
          value={project.progressPercentage}
        />
        <ProjectMilestoneManager
          projectId={project._id}
          milestones={milestones}
          members={members}
        />
      </div>
    </div>
  );
}
