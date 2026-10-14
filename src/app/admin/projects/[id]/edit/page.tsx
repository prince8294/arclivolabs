import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ProjectForm, {
  type ProjectFormInitialValues,
} from '@/components/projects/project-form';
import { requireRole } from '@/lib/auth/authorization';
import {
  getProjectById,
  listAssignableEmployees,
  listClientOptions,
} from '@/lib/queries/projects';
import type { ProjectType } from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Edit Project',
  description: 'Update project scope, schedule, priority and project manager.',
};

interface EditProjectPageProps {
  params: Promise<{ id: string }>;
}

const toDateInput = (value: string | null): string =>
  value ? value.slice(0, 10) : '';

export default async function EditProjectPage(props: EditProjectPageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await props.params;

  const [project, clients, staff] = await Promise.all([
    getProjectById(id),
    listClientOptions(),
    listAssignableEmployees(),
  ]);

  if (!project) notFound();

  const initialValues: ProjectFormInitialValues = {
    _id: project._id,
    title: project.title,
    description: project.description ?? '',
    clientId: project.client?._id ?? '',
    dealId: project.dealId ?? '',
    managerId: project.manager?._id ?? '',
    projectType: project.projectType as ProjectType,
    priority: project.priority,
    health: project.health,
    startDate: toDateInput(project.startDate),
    expectedEndDate: toDateInput(project.expectedEndDate),
    scopeSummary: project.scopeSnapshot.summary ?? '',
    includedFeatures: project.scopeSnapshot.includedFeatures.join('\n'),
    deliverables: project.scopeSnapshot.deliverables.join('\n'),
    dependencies: project.scopeSnapshot.dependencies.join('\n'),
    customerResponsibilities: project.scopeSnapshot.customerResponsibilities.join('\n'),
    outOfScope: project.scopeSnapshot.excludedFeatures.join('\n'),
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title={`Edit ${project.projectCode}`}
        description="Operational details only. Agreed deal terms are not editable here."
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

      <ProjectForm
        mode="edit"
        clients={clients}
        staff={staff.map((s) => ({
          _id: s._id,
          name: s.name,
          employeeCode: s.employeeCode,
          designation: s.designation,
          department: s.department,
        }))}
        initialValues={initialValues}
      />
    </div>
  );
}
