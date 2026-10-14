import type { Metadata } from 'next';
import { FolderOpen, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/dashboard/stat-card';
import FileListTable from '@/components/files/file-list-table';
import { requireRole } from '@/lib/auth/authorization';
import { listFiles, getFileStats } from '@/lib/queries/files';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'My Project Files — Arclivo Labs',
  description: 'View and upload files for your assigned client projects.',
};

interface EmployeeFilesPageProps {
  searchParams: Promise<{
    projectId?: string;
    category?: string;
    search?: string;
  }>;
}

export default async function EmployeeFilesPage(props: EmployeeFilesPageProps) {
  const user = await requireRole(USER_ROLES.EMPLOYEE);
  const searchParams = await props.searchParams;

  const [filesResult, stats] = await Promise.all([
    listFiles(
      {
        projectId: searchParams.projectId,
        category: searchParams.category,
        search: searchParams.search,
        pageSize: 50,
      },
      user
    ),
    getFileStats(user),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Project Files & Work"
        description="Documents, source code and task assets for projects you are assigned to."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="My Uploads"
          value={stats.myUploads || 0}
          description="Total files uploaded by you"
          icon={FolderOpen}
        />
        <StatCard
          title="Awaiting Review"
          value={stats.myAwaitingReview || 0}
          description="Work files submitted for admin review"
          icon={Clock}
        />
        <StatCard
          title="Changes Requested"
          value={stats.myRejected || 0}
          description="Files requiring revised versions"
          icon={AlertTriangle}
        />
      </div>

      <FileListTable
        files={filesResult.files}
        userRole={user.role}
        canUpload={true}
      />
    </div>
  );
}
