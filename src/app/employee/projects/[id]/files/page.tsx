import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, FolderOpen } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import FileListTable from '@/components/files/file-list-table';
import { requireRole } from '@/lib/auth/authorization';
import { getProjectById } from '@/lib/queries/projects';
import { listFiles } from '@/lib/queries/files';
import { isActiveProjectMember } from '@/lib/auth/project-permissions';
import { USER_ROLES } from '@/types/auth';

interface EmployeeProjectFilesPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    category?: string;
    search?: string;
  }>;
}

export async function generateMetadata(props: EmployeeProjectFilesPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const project = await getProjectById(id);
  if (!project) return { title: 'Project Not Found' };
  return {
    title: `${project.projectCode} Files — Arclivo Labs`,
  };
}

export default async function EmployeeProjectFilesPage(props: EmployeeProjectFilesPageProps) {
  const user = await requireRole(USER_ROLES.EMPLOYEE);
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const project = await getProjectById(id);
  if (!project) {
    notFound();
  }

  const isMember = await isActiveProjectMember(user.id, id);
  if (!isMember) {
    redirect('/employee/files');
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
          href={`/employee/tasks?projectId=${id}`}
          className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to tasks
        </Link>
      </div>

      <PageHeader
        title={`Project Files — [${project.projectCode}] ${project.title}`}
        description="Submit your task exports, designs, documentation and review revisions."
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
