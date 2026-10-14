import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Package, FolderOpen } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ButtonLink from '@/components/ui/button-link';
import FileListTable from '@/components/files/file-list-table';
import { requireRole } from '@/lib/auth/authorization';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { getProjectById } from '@/lib/queries/projects';
import { listFiles } from '@/lib/queries/files';
import { USER_ROLES } from '@/types/auth';

interface ClientProjectFilesPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    category?: string;
    search?: string;
  }>;
}

export async function generateMetadata(props: ClientProjectFilesPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const project = await getProjectById(id);
  if (!project) return { title: 'Project Not Found' };
  return {
    title: `${project.projectCode} Files — Arclivo Labs`,
  };
}

export default async function ClientProjectFilesPage(props: ClientProjectFilesPageProps) {
  const user = await requireRole(USER_ROLES.CLIENT);
  const profile = await requireClientProfile();
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const project = await getProjectById(id);
  if (!project) {
    notFound();
  }

  // Verify client ownership
  if (!project.client || project.client._id.toString() !== profile.id) {
    redirect('/client/files');
  }

  const filesResult = await listFiles(
    {
      projectId: id,
      category: searchParams.category,
      search: searchParams.search,
      pageSize: 50,
    },
    user
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/client/projects`}
          className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to projects
        </Link>

        <div className="flex items-center gap-2">
          <ButtonLink href={`/client/projects/${id}/deliverables`} variant="outline" size="sm">
            <Package className="h-4 w-4 mr-1 text-primary" />
            Final Deliverables
          </ButtonLink>
        </div>
      </div>

      <PageHeader
        title={`Project Files & Assets — [${project.projectCode}] ${project.title}`}
        description="Upload requirement documents, brand assets and download shared project deliverables."
      />

      <FileListTable
        files={filesResult.files}
        userRole={user.role}
        projectId={id}
        canUpload={true}
      />
    </div>
  );
}
