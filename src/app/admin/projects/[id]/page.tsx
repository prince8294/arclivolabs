import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Info, Pencil } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ButtonLink from '@/components/ui/button-link';
import Badge from '@/components/ui/badge';
import DetailList from '@/components/admin/detail-list';
import StatCard from '@/components/dashboard/stat-card';
import ProjectNoteForm from '@/components/projects/project-note-form';
import ProjectStatusManager from '@/components/projects/project-status-manager';
import ProjectSubNav from '@/components/projects/project-sub-nav';
import { ProjectHealthBadge, ProjectStatusBadge } from '@/components/projects/project-badges';
import {
  MilestoneDeadlineBadge,
  MilestoneStatusBadge,
  ProjectPriorityBadge,
  ProjectProgressBar,
} from '@/components/projects/project-panels';
import { requireRole } from '@/lib/auth/authorization';
import {
  getActiveProjectMembers,
  getProjectById,
  getProjectMilestones,
  getProjectTaskSummary,
} from '@/lib/queries/projects';
import { getProjectBillingSummary } from '@/lib/queries/invoices';
import { InvoiceStatusBadge, InvoicePaymentStatusBadge } from '@/components/billing/invoice-badges';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';
import {
  PROJECT_MEMBER_ROLE_LABELS,
  PROJECT_MILESTONE_STATUSES,
  PROJECT_ORIGINS,
  PROJECT_ORIGIN_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  type ProjectMemberRole,
  type ProjectOrigin,
  type ProjectType,
} from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(props: ProjectDetailPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const project = await getProjectById(id);
  if (!project) return { title: 'Project Not Found' };
  return {
    title: `${project.projectCode}: ${project.title}`,
    description: project.description || 'Project scope, milestones, team and progress.',
  };
}

export default async function AdminProjectDetailPage(props: ProjectDetailPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await props.params;

  const [project, members, milestones, taskSummary, billingSummary] = await Promise.all([
    getProjectById(id),
    getActiveProjectMembers(id),
    getProjectMilestones(id),
    getProjectTaskSummary(id),
    getProjectBillingSummary(id),
  ]);

  if (!project) notFound();

  const completedMilestones = milestones.filter(
    (m) => m.status === PROJECT_MILESTONE_STATUSES.COMPLETED
  ).length;
  const pendingReview = milestones.filter(
    (m) => m.status === PROJECT_MILESTONE_STATUSES.PENDING_REVIEW
  ).length;
  const openMilestones = milestones.filter(
    (m) =>
      m.status !== PROJECT_MILESTONE_STATUSES.COMPLETED &&
      m.status !== PROJECT_MILESTONE_STATUSES.CANCELLED
  ).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.title}
        description={`${project.projectCode} · ${project.client?.name ?? 'Client'} · ${PROJECT_TYPE_LABELS[project.projectType as ProjectType] ?? project.projectType}`}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ButtonLink
              href={`/admin/invoices/new?projectId=${project._id}&clientId=${project.client?._id ?? ''}${project.dealId ? `&dealId=${project.dealId}` : ''}`}
              variant="primary"
              size="sm"
            >
              Create Invoice
            </ButtonLink>
            <ButtonLink
              href={`/admin/projects/${project._id}/edit`}
              variant="outline"
              size="sm"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </ButtonLink>
            <Link
              href="/admin/projects"
              className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={project.status} />
        <ProjectHealthBadge health={project.health} />
        <ProjectPriorityBadge priority={project.priority} />
        <Badge variant={project.origin === PROJECT_ORIGINS.MANUAL ? 'warning' : 'secondary'}>
          {PROJECT_ORIGIN_LABELS[project.origin as ProjectOrigin] ?? project.origin}
        </Badge>
        {project.isOverdue ? (
          <Badge variant="error">Overdue by {project.daysOverdue}d</Badge>
        ) : null}
      </div>

      <ProjectSubNav
        projectId={project._id}
        milestoneCount={milestones.length}
        pendingReviewCount={pendingReview}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Overall Progress"
          value={`${project.progressPercentage}%`}
          description="Server-calculated from milestones"
        />
        <StatCard
          title="Team Size"
          value={project.teamSize}
          description="Active project members"
        />
        <StatCard
          title="Milestones"
          value={`${completedMilestones}/${project.milestoneCount}`}
          description="Completed milestones"
        />
        <StatCard
          title="Tasks"
          value={taskSummary.total}
          description={`${taskSummary.completed} completed`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Summary */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-xs lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">Summary</h2>
          <ProjectProgressBar className="mt-4" value={project.progressPercentage} />

          <div className="mt-6">
            <DetailList
              items={[
                { label: 'Client', value: project.client?.name ?? '—' },
                {
                  label: 'Project manager',
                  value: project.manager?.name ?? 'Unassigned',
                },
                {
                  label: 'Start date',
                  value: project.startDate
                    ? formatDate(new Date(project.startDate))
                    : 'Not started',
                },
                {
                  label: 'Expected completion',
                  value: project.expectedEndDate
                    ? formatDate(new Date(project.expectedEndDate))
                    : 'Not set',
                },
                {
                  label: 'Actual completion',
                  value: project.actualEndDate
                    ? formatDate(new Date(project.actualEndDate))
                    : '—',
                },
                {
                  label: 'Type',
                  value: PROJECT_TYPE_LABELS[project.projectType as ProjectType] ?? '—',
                },
              ]}
            />
          </div>

          {project.description ? (
            <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
              {project.description}
            </p>
          ) : null}

          {project.holdReason ? (
            <p className="mt-4 rounded-md bg-warning/10 p-3 text-sm text-warning">
              On hold: {project.holdReason}
            </p>
          ) : null}

          {project.cancellationReason ? (
            <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Cancelled: {project.cancellationReason}
            </p>
          ) : null}
        </div>

        {/* Status control */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Status management</h2>
          <p className="mt-0.5 mb-4 text-xs text-muted-foreground">
            Only admin can move a project. Transitions are validated server-side.
          </p>
          <ProjectStatusManager
            projectId={project._id}
            currentStatus={project.status}
            currentHealth={project.health}
          />
        </div>
      </div>

      {/* Related deal */}
      {project.dealId ? (
        <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Related deal</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Commercial terms stay owned by the deal. Project progress never rewrites them.
          </p>
          <div className="mt-4">
            <DetailList
              items={[
                { label: 'Deal', value: project.dealCode ?? project.dealId },
                {
                  label: 'Accepted proposal version',
                  value: project.acceptedProposalVersionId ?? '—',
                },
                {
                  label: 'Agreed amount (snapshot)',
                  value:
                    project.agreedAmountSnapshot !== null
                      ? formatMinor(project.agreedAmountSnapshot, project.currency)
                      : '—',
                },
                {
                  label: 'Agreement reference',
                  value: 'See the deal record',
                },
              ]}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-x-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            This is a manual project with no linked deal, so no agreed commercial value is
            recorded.
          </p>
        </div>
      )}

      {/* Project Billing Summary Section (§53) */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Billing & Invoices</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Commercial invoicing status, unbilled commitments, and receivables for this project.
            </p>
          </div>
          <ButtonLink
            href={`/admin/invoices/new?projectId=${project._id}&clientId=${project.client?._id ?? ''}${project.dealId ? `&dealId=${project.dealId}` : ''}`}
            variant="outline"
            size="sm"
          >
            Create Invoice
          </ButtonLink>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="p-3 bg-muted/40 rounded-lg border border-border">
            <span className="text-xs uppercase font-semibold text-muted-foreground block">
              Agreed Value
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-foreground">
              {billingSummary?.agreedAmountMinor !== null && billingSummary?.agreedAmountMinor !== undefined
                ? formatMinor(billingSummary.agreedAmountMinor, project.currency)
                : 'Manual Project'}
            </span>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg border border-border">
            <span className="text-xs uppercase font-semibold text-muted-foreground block">
              Invoiced Amount
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-primary">
              {formatMinor(billingSummary?.totalInvoicedMinor ?? 0, project.currency)}
            </span>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg border border-border">
            <span className="text-xs uppercase font-semibold text-muted-foreground block">
              Remaining Unbilled
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-foreground">
              {billingSummary?.remainingUnbilledMinor !== null && billingSummary?.remainingUnbilledMinor !== undefined
                ? formatMinor(billingSummary.remainingUnbilledMinor, project.currency)
                : '—'}
            </span>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg border border-border">
            <span className="text-xs uppercase font-semibold text-muted-foreground block">
              Outstanding Due
            </span>
            <span className="text-base sm:text-lg font-bold font-mono text-foreground">
              {formatMinor(billingSummary?.totalDueMinor ?? 0, project.currency)}
            </span>
          </div>
        </div>

        {billingSummary?.invoices && billingSummary.invoices.length > 0 ? (
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <th className="p-2.5">Invoice</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5 text-right">Amount</th>
                  <th className="p-2.5">Due Date</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {billingSummary.invoices.map((inv: any) => (
                  <tr key={inv._id} className="hover:bg-muted/20">
                    <td className="p-2.5 font-mono font-medium">
                      <Link href={`/admin/invoices/${inv._id}`} className="text-primary hover:underline">
                        {inv.invoiceNumber || inv.invoiceCode}
                      </Link>
                    </td>
                    <td className="p-2.5">{inv.invoiceType}</td>
                    <td className="p-2.5 text-right font-mono font-medium">
                      {formatMinor(inv.totalMinor, inv.currency)}
                    </td>
                    <td className="p-2.5 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1">
                        <InvoiceStatusBadge status={inv.status} />
                        <InvoicePaymentStatusBadge status={inv.paymentStatus} />
                      </div>
                    </td>
                    <td className="p-2.5 text-right">
                      <Link href={`/admin/invoices/${inv._id}`} className="text-primary hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No invoices issued for this project yet.</p>
        )}
      </div>


      {/* Milestones snapshot */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Milestones</h2>
          <ButtonLink href={`/admin/projects/${project._id}/milestones`} variant="outline" size="sm">
            Manage milestones
          </ButtonLink>
        </div>

        {openMilestones.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {milestones.length === 0
              ? 'No milestones defined yet.'
              : 'All milestones are complete or cancelled.'}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {openMilestones.map((milestone) => (
              <li key={milestone._id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-primary">
                      {milestone.milestoneCode}
                    </span>{' '}
                    <span className="text-sm font-medium text-foreground">
                      {milestone.title}
                    </span>
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

      {/* Team snapshot */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Team</h2>
          <ButtonLink href={`/admin/projects/${project._id}/team`} variant="outline" size="sm">
            Manage team
          </ButtonLink>
        </div>

        {members.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No team assigned yet. Employees need an active assignment to access this project.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {member.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.responsibility ||
                      member.designation ||
                      member.email}
                  </span>
                </div>
                <Badge variant="secondary" className="ml-2 shrink-0">
                  {PROJECT_MEMBER_ROLE_LABELS[member.role as ProjectMemberRole] ??
                    member.role}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Internal notes */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Internal notes</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Internal only. Never shown in the client portal or the marketing portal.
        </p>

        {project.internalNotes.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No internal notes yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {[...project.internalNotes].reverse().map((note) => (
              <li key={note._id} className="rounded-md border border-border p-3">
                <p className="text-sm text-foreground">{note.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {note.authorName} · {note.authorRole} ·{' '}
                  {note.createdAt ? formatDateTime(new Date(note.createdAt)) : '—'}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <ProjectNoteForm projectId={project._id} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Created by {project.creator.name || 'system'} on{' '}
        {project.createdAt ? formatDateTime(new Date(project.createdAt)) : '—'}. Status{' '}
        {PROJECT_STATUS_LABELS[project.status] ?? project.status}.
      </p>
    </div>
  );
}
