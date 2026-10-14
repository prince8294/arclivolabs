import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import Badge from '@/components/ui/badge';
import DetailList from '@/components/admin/detail-list';
import ProjectNoteForm from '@/components/projects/project-note-form';
import EmployeeMilestoneActions from '@/components/projects/milestone-employee-actions';
import { ProjectStatusBadge } from '@/components/projects/project-badges';
import {
  MilestoneDeadlineBadge,
  MilestoneStatusBadge,
  ProjectProgressBar,
} from '@/components/projects/project-panels';
import { requireRole } from '@/lib/auth/authorization';
import {
  getActiveProjectMembers,
  getProjectById,
  getProjectMilestones,
  hasActiveProjectMembership,
} from '@/lib/queries/projects';
import { formatDate } from '@/lib/utils/format';
import {
  PROJECT_MEMBER_ROLE_LABELS,
  type ProjectMemberRole,
} from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Project',
  description: 'Project overview, milestones and your responsibilities.',
};

interface EmployeeProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeProjectDetailPage(
  props: EmployeeProjectDetailPageProps
) {
  const user = await requireRole(USER_ROLES.EMPLOYEE);
  const { id } = await props.params;

  // Authorisation is server-side and membership-based: an employee cannot reach
  // a project they are not assigned to by editing the URL (§39).
  const isMember = await hasActiveProjectMembership(user.id, id);
  if (!isMember) notFound();

  const [project, milestones, members] = await Promise.all([
    getProjectById(id),
    getProjectMilestones(id),
    getActiveProjectMembers(id),
  ]);

  if (!project) notFound();

  const isManager = project.manager?._id === user.id;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.title}
        description={`${project.projectCode} · ${project.client?.name ?? 'Internal project'}`}
        action={
          <Link
            href="/employee/projects"
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            My projects
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={project.status} />
        {project.isOverdue ? (
          <Badge variant="error">Overdue by {project.daysOverdue}d</Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6 shadow-xs lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">Overview</h2>
          <ProjectProgressBar className="mt-4" value={project.progressPercentage} />

          <div className="mt-6">
            <DetailList
              items={[
                { label: 'Client', value: project.client?.name ?? 'Internal project' },
                { label: 'Project manager', value: project.manager?.name ?? 'Unassigned' },
                {
                  label: 'Start date',
                  value: project.startDate ? formatDate(new Date(project.startDate)) : 'Not started',
                },
                {
                  label: 'Expected completion',
                  value: project.expectedEndDate
                    ? formatDate(new Date(project.expectedEndDate))
                    : 'Not set',
                },
                { label: 'My role', value: isManager ? 'Project manager' : 'Team member' },
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
          <h2 className="text-base font-semibold text-foreground">Assigned team</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5"
              >
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {member.name}
                    {member.userId === user.id ? ' (you)' : ''}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.responsibility || member.designation || member.email}
                  </span>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {PROJECT_MEMBER_ROLE_LABELS[member.role as ProjectMemberRole] ??
                    member.role}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Scope */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Scope of work</h2>

        {project.scopeSnapshot.summary ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {project.scopeSnapshot.summary}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {project.scopeSnapshot.deliverables.length > 0 ? (
            <ScopeList title="Deliverables" items={project.scopeSnapshot.deliverables} />
          ) : null}
          {project.scopeSnapshot.dependencies.length > 0 ? (
            <ScopeList title="Dependencies" items={project.scopeSnapshot.dependencies} />
          ) : null}
          {project.scopeSnapshot.customerResponsibilities.length > 0 ? (
            <ScopeList
              title="Customer responsibilities"
              items={project.scopeSnapshot.customerResponsibilities}
            />
          ) : null}
          {project.scopeSnapshot.excludedFeatures.length > 0 ? (
            <ScopeList title="Out of scope" items={project.scopeSnapshot.excludedFeatures} />
          ) : null}
        </div>
      </div>

      {/* Milestones */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Milestones</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Update progress on milestones assigned to you and submit them for review.
        </p>

        {milestones.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No milestones have been defined yet.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {milestones.map((milestone) => {
              const mine = milestone.assignee?._id === user.id;
              return (
                <li key={milestone._id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">
                          {milestone.milestoneCode}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {milestone.title}
                        </span>
                        {mine ? <Badge variant="info">Assigned to you</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {milestone.assignee ? milestone.assignee.name : 'Unassigned'} ·{' '}
                        {milestone.dueDate
                          ? `Due ${formatDate(new Date(milestone.dueDate))}`
                          : 'No deadline'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <MilestoneStatusBadge status={milestone.status} />
                      <MilestoneDeadlineBadge
                        state={milestone.deadlineState}
                        daysUntilDue={milestone.daysUntilDue}
                      />
                    </div>
                  </div>

                  {milestone.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {milestone.description}
                    </p>
                  ) : null}

                  <ProjectProgressBar
                    className="mt-3"
                    label="Progress"
                    value={milestone.progressPercentage}
                  />

                  {milestone.review.reviewNotes ? (
                    <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                      Reviewer note: {milestone.review.reviewNotes}
                    </p>
                  ) : null}

                  <EmployeeMilestoneActions
                    projectId={project._id}
                    milestoneId={milestone._id}
                    milestoneCode={milestone.milestoneCode}
                    status={milestone.status}
                    progressPercentage={milestone.progressPercentage}
                    canUpdate={mine || isManager}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Internal work notes */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Internal work notes</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Work-related notes for this project. Commercial and payroll information is never
          shown here.
        </p>

        {project.internalNotes.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {[...project.internalNotes].reverse().map((note) => (
              <li key={note._id} className="rounded-md border border-border p-3">
                <p className="text-sm text-foreground">{note.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {note.authorName} · {note.authorRole}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <ProjectNoteForm projectId={project._id} />
        </div>
      </div>

      <p className="flex items-start gap-x-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        You are seeing the operational view only. Client payment information, profit and
        salary data are never exposed on this page.
      </p>
    </div>
  );
}

function ScopeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-1.5 list-inside list-disc text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
