import type { Metadata } from 'next';
import Link from 'next/link';
import { FolderKanban } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import Badge from '@/components/ui/badge';
import { ProjectStatusBadge } from '@/components/projects/project-badges';
import { ProjectProgressBar } from '@/components/projects/project-panels';
import { requireRole } from '@/lib/auth/authorization';
import { listMarketingProjects } from '@/lib/queries/projects';
import { formatDate } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Client Projects',
  description: 'High-level delivery progress for the clients you own.',
};

export default async function MarketingProjectsPage() {
  const user = await requireRole(USER_ROLES.MARKETING);

  // Ownership is resolved from the session and enforced in the query.
  const projects = await listMarketingProjects(user.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Client projects"
        description="Delivery status for the clients assigned to you."
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects for your clients yet"
          description="Projects appear here once an admin creates one for a client you own."
          icon={<FolderKanban className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3">Code</th>
                <th scope="col" className="px-4 py-3">Project</th>
                <th scope="col" className="hidden px-4 py-3 lg:table-cell">Client</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Progress</th>
                <th scope="col" className="hidden px-4 py-3 lg:table-cell">Milestones</th>
                <th scope="col" className="px-4 py-3">Expected delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.map((project) => (
                <tr key={project._id} className="transition-colors hover:bg-muted/20">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-primary">
                    {project.projectCode}
                  </td>
                  <td className="max-w-64 px-4 py-3">
                    <Link
                      href={`/marketing/projects/${project._id}`}
                      className="block truncate font-medium text-foreground hover:underline"
                    >
                      {project.title}
                    </Link>
                  </td>
                  <td className="hidden max-w-48 truncate px-4 py-3 text-muted-foreground lg:table-cell">
                    {project.clientName || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <ProjectStatusBadge status={project.status} />
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <ProjectProgressBar
                      value={project.progressPercentage}
                      label="Progress"
                      className="min-w-28"
                    />
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                    {project.completedMilestones}/{project.totalMilestones}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {project.expectedEndDate ? (
                      <div>
                        <span className="text-xs">
                          {formatDate(new Date(project.expectedEndDate))}
                        </span>
                        {project.isOverdue ? (
                          <span className="mt-0.5 block text-xs font-medium text-destructive">
                            Overdue by {project.daysOverdue}d
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <Badge variant="secondary">Not scheduled</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
