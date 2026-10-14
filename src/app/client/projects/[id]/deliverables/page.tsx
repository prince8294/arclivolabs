import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, FolderOpen, Package } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import DeliverablesPageClient from '@/components/files/deliverables-page-client';
import { requireRole } from '@/lib/auth/authorization';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { getProjectById } from '@/lib/queries/projects';
import { listDeliverables } from '@/lib/queries/deliverables';
import { USER_ROLES } from '@/types/auth';

interface ClientProjectDeliverablesPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata(props: ClientProjectDeliverablesPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const project = await getProjectById(id);
  if (!project) return { title: 'Project Not Found' };
  return {
    title: `${project.projectCode} Final Deliverables — Arclivo Labs`,
  };
}

export default async function ClientProjectDeliverablesPage(props: ClientProjectDeliverablesPageProps) {
  const user = await requireRole(USER_ROLES.CLIENT);
  const profile = await requireClientProfile();
  const { id } = await props.params;

  const project = await getProjectById(id);
  if (!project) {
    notFound();
  }

  // Verify client ownership
  if (!project.client || project.client._id.toString() !== profile.id) {
    redirect('/client/files');
  }

  const deliverables = await listDeliverables(id, user);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/client/projects/${id}/files`}
          className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to project files
        </Link>
      </div>

      <PageHeader
        title={`Final Deliverables — [${project.projectCode}] ${project.title}`}
        description="Download your official handover deliverables, source packages and release notes."
      />

      <DeliverablesPageClient
        projectId={id}
        deliverables={deliverables}
        availableVersions={[]}
        userRole={user.role}
      />
    </div>
  );
}
