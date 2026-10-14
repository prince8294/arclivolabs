import type { Metadata } from 'next';
import Link from 'next/link';
import { FolderKanban } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import Badge from '@/components/ui/badge';
import { ProjectStatusBadge } from '@/components/projects/project-badges';
import { ProjectPriorityBadge, ProjectProgressBar } from '@/components/projects/project-panels';
import { requireRole } from '@/lib/auth/authorization';
import { listEmployeeProjects } from '@/lib/queries/projects';
import { formatDate } from '@/lib/utils/format';
import { PROJECT_MEMBER_ROLE_LABELS, type ProjectMemberRole } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'My Projects',
  description: 'Projects you are actively assigned to.',
};

export default async function EmployeeProjectsPage() {
  const user = await requireRole(USER_ROLES.EMPLOYEE);

  // Membership comes from the session, never from a URL parameter.
  const projects = await listEmployeeProjects(user.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My projects"
        description="Only projects you have an active assignment on are shown."
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects assigned to you"
          description="When an admin assigns you to a project it will appear here with your milestones and deadlines."
          icon={<FolderKanban className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <article
              key={project._id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-mono text-xs font-semibold text-primary">
                    {project.projectCode}
                  </span>
                  <h2 className="mt-0.5 truncate text-base font-semibold text-foreground">
                    <Link
                      href={`/employee/projects/${project._id}`}
                      className="hover:underline"
                    >
                      {project.title}
                    </Link>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {project.clientName || 'Internal project'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <ProjectStatusBadge status={project.status} />
                  <ProjectPriorityBadge priority={project.priority} />
                </div>
              </div>

              <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">My responsibility: </span>
                {project.responsibility ||
                  PROJECT_MEMBER_ROLE_LABELS[project.role as ProjectMemberRole] ||
                  'Team member'}
              </div>

              <ProjectProgressBar value={project.progressPercentage} />

              <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt className="font-medium text-foreground">Deadline</dt>
                  <dd>
                    {project.expectedEndDate
                      ? formatDate(new Date(project.expectedEndDate))
                      : 'Not set'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">My milestones</dt>
                  <dd>{project.assignedMilestoneCount}</dd>
                </div>
              </dl>

              {project.isOverdue ? (
                <Badge variant="error">Overdue by {project.daysOverdue}d</Badge>
              ) : null}

              {project.nextDueDate ? (
                <p className="text-xs text-muted-foreground">
                  Next milestone due {formatDate(new Date(project.nextDueDate))}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
