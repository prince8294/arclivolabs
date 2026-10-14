import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ProjectForm, {
  type ProjectFormInitialValues,
} from '@/components/projects/project-form';
import { requireRole } from '@/lib/auth/authorization';
import {
  getDealProjectPrefill,
  listClientOptions,
  listAssignableEmployees,
  listProjectableDeals,
} from '@/lib/queries/projects';
import { PROJECT_HEALTHS, PROJECT_TYPES, TASK_PRIORITIES } from '@/lib/constants/enums';
import { DEAL_STATUSES } from '@/lib/constants/proposals';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'New Project',
  description: 'Create a project from a finalized deal or manually for an existing client.',
};

interface NewProjectPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const firstValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export default async function NewProjectPage(props: NewProjectPageProps) {
  await requireRole(USER_ROLES.ADMIN);

  const dealId = firstValue((await props.searchParams).dealId);

  const [clients, staff, deals, prefill] = await Promise.all([
    listClientOptions(),
    listAssignableEmployees(),
    listProjectableDeals(),
    dealId ? getDealProjectPrefill(dealId) : Promise.resolve(null),
  ]);

  const dealEligible =
    prefill !== null &&
    (prefill.status === DEAL_STATUSES.FINALIZED ||
      prefill.status === DEAL_STATUSES.READY_FOR_PROJECT) &&
    prefill.clientId.length > 0 &&
    prefill.existingProjectId === null;

  // Non-null alias so the JSX below can rely on narrowing.
  const activeDeal = dealEligible ? prefill : null;

  const initialValues: ProjectFormInitialValues = activeDeal
    ? {
        title: activeDeal.title,
        description: activeDeal.description ?? '',
        clientId: activeDeal.clientId,
        dealId: activeDeal.dealId,
        managerId: '',
        projectType: PROJECT_TYPES.OTHER,
        priority: TASK_PRIORITIES.MEDIUM,
        health: PROJECT_HEALTHS.ON_TRACK,
        startDate: activeDeal.expectedStartDate
          ? activeDeal.expectedStartDate.slice(0, 10)
          : '',
        expectedEndDate: '',
        scopeSummary: activeDeal.overview ?? '',
        includedFeatures: activeDeal.includedFeatures.join('\n'),
        deliverables: activeDeal.deliverables.join('\n'),
        dependencies: '',
        customerResponsibilities: '',
        outOfScope: activeDeal.excludedFeatures.join('\n'),
      }
    : {
        title: '',
        description: '',
        clientId: '',
        dealId: '',
        managerId: '',
        projectType: PROJECT_TYPES.OTHER,
        priority: TASK_PRIORITIES.MEDIUM,
        health: PROJECT_HEALTHS.ON_TRACK,
        startDate: '',
        expectedEndDate: '',
        scopeSummary: '',
        includedFeatures: '',
        deliverables: '',
        dependencies: '',
        customerResponsibilities: '',
        outOfScope: '',
      };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Create project"
        description={
          activeDeal
            ? `Prefilled from finalized deal ${activeDeal.dealCode}. Commercial terms stay owned by the deal.`
            : 'Link a finalized deal to prefill scope, or create a manual project for an existing client.'
        }
        action={
          <Link
            href="/admin/projects"
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to projects
          </Link>
        }
      />

      {prefill?.existingProjectId ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          A project already exists for deal {prefill.dealCode}:{' '}
          <Link
            href={`/admin/projects/${prefill.existingProjectId}`}
            className="font-semibold underline"
          >
            {prefill.existingProjectCode}
          </Link>
        </div>
      ) : null}

      {prefill && !prefill.clientId ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          This deal is awaiting client conversion. Create the client record first, then
          come back to start the project.
        </div>
      ) : null}

      <ProjectForm
        mode="create"
        clients={clients}
        staff={staff.map((s) => ({
          _id: s._id,
          name: s.name,
          employeeCode: s.employeeCode,
          designation: s.designation,
          department: s.department,
        }))}
        deals={deals.map((d) => ({
          _id: d._id,
          dealCode: d.dealCode,
          title: d.title,
          clientName: d.clientName,
        }))}
        initialValues={initialValues}
        lockedClientId={activeDeal?.clientId}
      />
    </div>
  );
}
