import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FolderOpen, Package } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ButtonLink from '@/components/ui/button-link';
import FileListTable from '@/components/files/file-list-table';
import { requireRole } from '@/lib/auth/authorization';
import { getProjectById } from '@/lib/queries/projects';
import { listFiles } from '@/lib/queries/files';
import { USER_ROLES } from '@/types/auth';

interface ProjectFilesPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    category?: string;
    search?: string;
  }>;
}

export async function generateMetadata(props: ProjectFilesPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const project = await getProjectById(id);
  if (!project) return { title: 'Project Not Found' };
  return {
    title: `${project.projectCode} Files — Arclivo Labs`,
  };
}

export default async function AdminProjectFilesPage(props: ProjectFilesPageProps) {
  const user = await requireRole(USER_ROLES.ADMIN);
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const project = await getProjectById(id);
  if (!project) {
    notFound();
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
          href={`/admin/projects/${id}`}
          className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {project.projectCode}
        </Link>

        <div className="flex items-center gap-2">
          <ButtonLink href={`/admin/projects/${id}/deliverables`} variant="outline" size="sm">
            <Package className="h-4 w-4 mr-1 text-primary" />
            Final Deliverables
          </ButtonLink>
        </div>
      </div>

      <PageHeader
        title={`Project Documents & Files — ${project.projectCode}`}
        description={`Secure file repository for ${project.title}. Track design assets, requirements, task submissions and deliverables.`}
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
