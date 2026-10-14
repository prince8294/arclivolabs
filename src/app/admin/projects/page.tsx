import type { Metadata } from 'next';
import Link from 'next/link';
import { FolderKanban, Plus } from 'lucide-react';

import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import Pagination from '@/components/admin/pagination';
import ListFilters from '@/components/admin/list-filters';
import StatCard from '@/components/dashboard/stat-card';
import Badge from '@/components/ui/badge';
import { ProjectHealthBadge, ProjectStatusBadge } from '@/components/projects/project-badges';
import { ProjectPriorityBadge, ProjectProgressBar } from '@/components/projects/project-panels';
import { requireRole } from '@/lib/auth/authorization';
import {
  getProjectStats,
  hasProjectFilters,
  listProjectClients,
  listProjectManagers,
  listProjects,
  parseProjectListParams,
} from '@/lib/queries/projects';
import { formatDate } from '@/lib/utils/format';
import {
  PROJECT_FILTER_PRESETS,
  PROJECT_FILTER_PRESET_LABELS,
  PROJECT_HEALTH_LABELS,
  PROJECT_ORIGINS,
  PROJECT_ORIGIN_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  type ProjectOrigin,
} from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Manage client deliverables, milestones and cross-functional teams.',
};

interface ProjectsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminProjectsPage(props: ProjectsPageProps) {
  await requireRole(USER_ROLES.ADMIN);

  const params = parseProjectListParams(await props.searchParams);

  const [list, stats, clients, managers] = await Promise.all([
    listProjects(params),
    getProjectStats(),
    listProjectClients(),
    listProjectManagers(),
  ]);

  const filtered = hasProjectFilters(params);

  const statusOptions = Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const currentFilters: Record<string, string> = {
    search: params.search ?? '',
    status: params.status ?? '',
    priority: params.priority ?? '',
    health: params.health ?? '',
    clientId: params.clientId ?? '',
    managerId: params.managerId ?? '',
    preset: params.preset ?? '',
    limit: String(params.limit),
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Oversee delivery, milestones and team assignment across every client engagement."
        action={
          <ButtonLink href="/admin/projects/new" size="sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New project
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Projects"
          value={stats.total}
          description="All projects in the system"
          icon={FolderKanban}
        />
        <StatCard
          title="Active"
          value={stats.active}
          description="Planning, queued or in progress"
          icon={FolderKanban}
        />
        <StatCard
          title="On Hold"
          value={stats.onHold}
          description="Paused awaiting a reason"
          icon={FolderKanban}
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          description="Marked complete internally"
          icon={FolderKanban}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="At Risk"
          value={stats.atRisk}
          description="Flagged by admin"
          icon={FolderKanban}
        />
        <StatCard
          title="Delayed"
          value={stats.delayed}
          description="Behind the agreed schedule"
          icon={FolderKanban}
        />
        <StatCard
          title="Overdue"
          value={stats.overdue}
          description="Past expected end date"
          icon={FolderKanban}
        />
      </div>

      {/* Named presets (§35) */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(PROJECT_FILTER_PRESETS).map(([value]) => {
          const isActive = params.preset === value;
          const href = isActive
            ? '/admin/projects'
            : `/admin/projects?preset=${encodeURIComponent(value)}`;
          return (
            <Link
              key={value}
              href={href}
              className={
                isActive
                  ? 'inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
                  : 'inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
              }
            >
              {PROJECT_FILTER_PRESET_LABELS[value as keyof typeof PROJECT_FILTER_PRESET_LABELS]}
            </Link>
          );
        })}
      </div>

      <ListFilters
        endpoint="/admin/projects"
        searchPlaceholder="Search code, name, client or description..."
        current={{
          search: params.search,
          status: params.status,
          extra: {
            priority: params.priority ?? '',
            health: params.health ?? '',
            clientId: params.clientId ?? '',
            managerId: params.managerId ?? '',
            preset: params.preset ?? '',
          },
        }}
        statusOptions={statusOptions}
        extraFilters={[
          {
            name: 'priority',
            label: 'Priority',
            allLabel: 'All priorities',
            options: Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          },
          {
            name: 'health',
            label: 'Health',
            allLabel: 'All health states',
            options: Object.entries(PROJECT_HEALTH_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          },
          {
            name: 'clientId',
            label: 'Client',
            allLabel: 'All clients',
            options: clients.map((c) => ({ value: c._id, label: c.name })),
          },
          {
            name: 'managerId',
            label: 'Project manager',
            allLabel: 'All managers',
            options: managers.map((m) => ({ value: m._id, label: m.name })),
          },
        ]}
      />

      {list.total === 0 ? (
        filtered ? (
          <EmptyState
            title="No projects match your filters"
            description="Try a different search term or clear the filters."
            action={
              <ButtonLink href="/admin/projects" variant="outline" size="sm">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No projects yet"
            description="Create your first project from a finalized deal."
            icon={<FolderKanban className="h-8 w-8 text-muted-foreground" aria-hidden="true" />}
            action={
              <ButtonLink href="/admin/projects/new" size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create project
              </ButtonLink>
            }
          />
        )
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Project</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Client</th>
                  <th scope="col" className="hidden px-4 py-3 xl:table-cell">Manager</th>
                  <th scope="col" className="px-4 py-3">State</th>
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">Priority</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Progress</th>
                  <th scope="col" className="px-4 py-3">Deadline</th>
                  <th scope="col" className="hidden px-4 py-3 xl:table-cell">Created</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.items.map((project) => (
                  <tr
                    key={project._id}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-primary">
                      {project.projectCode}
                    </td>

                    <td className="max-w-64 px-4 py-3">
                      <Link
                        href={`/admin/projects/${project._id}`}
                        className="block truncate font-medium text-foreground hover:underline"
                      >
                        {project.title}
                      </Link>
                      {project.origin === PROJECT_ORIGINS.MANUAL ? (
                        <Badge variant="secondary" className="mt-1">
                          {PROJECT_ORIGIN_LABELS[project.origin as ProjectOrigin]}
                        </Badge>
                      ) : null}
                    </td>

                    <td className="hidden max-w-48 truncate px-4 py-3 text-muted-foreground lg:table-cell">
                      {project.client?.name ?? '—'}
                    </td>

                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground xl:table-cell">
                      {project.manager?.name ?? 'Unassigned'}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <ProjectStatusBadge status={project.status} />
                        <ProjectHealthBadge health={project.health} />
                      </div>
                    </td>

                    <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                      <ProjectPriorityBadge priority={project.priority} />
                    </td>

                    <td className="hidden px-4 py-3 lg:table-cell">
                      <ProjectProgressBar
                        value={project.progressPercentage}
                        label="Progress"
                        className="min-w-28"
                      />
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
                        '—'
                      )}
                    </td>

                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground xl:table-cell">
                      {project.createdAt
                        ? formatDate(new Date(project.createdAt))
                        : '—'}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/admin/projects/${project._id}`}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          View
                        </Link>
                        <Link
                          href={`/admin/projects/${project._id}/edit`}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/admin/projects/${project._id}/team`}
                          className="hidden text-xs font-semibold text-primary hover:underline sm:inline"
                        >
                          Team
                        </Link>
                        <Link
                          href={`/admin/projects/${project._id}/milestones`}
                          className="hidden text-xs font-semibold text-primary hover:underline sm:inline"
                        >
                          Milestones
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            baseUrl="/admin/projects"
            page={list.page}
            limit={list.limit}
            total={list.total}
            filters={currentFilters}
          />
        </>
      )}
    </div>
  );
}
