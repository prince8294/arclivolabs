import type { Metadata } from 'next';
import { FolderOpen, Clock, ShieldCheck, FileCheck, Upload } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/dashboard/stat-card';
import FileListTable from '@/components/files/file-list-table';
import { requireRole } from '@/lib/auth/authorization';
import { listFiles, getFileStats } from '@/lib/queries/files';
import { getProjects } from '@/lib/queries/projects';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'File Manager — Arclivo Labs',
  description: 'Manage company project assets, deliverables, version histories and review approvals.',
};

interface AdminFilesPageProps {
  searchParams: Promise<{
    projectId?: string;
    category?: string;
    visibility?: string;
    status?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function AdminFilesPage(props: AdminFilesPageProps) {
  const user = await requireRole(USER_ROLES.ADMIN);
  const searchParams = await props.searchParams;

  const [filesResult, stats, projectsResult] = await Promise.all([
    listFiles(
      {
        projectId: searchParams.projectId,
        category: searchParams.category,
        visibility: searchParams.visibility,
        status: searchParams.status,
        search: searchParams.search,
        page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
      },
      user
    ),
    getFileStats(user),
    getProjects({ limit: 100 }),
  ]);

  const projects = (projectsResult?.projects || []).map((p: any) => ({
    _id: p._id.toString(),
    projectCode: p.projectCode,
    title: p.title,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="File & Document Manager"
        description="Unified storage for project deliverables, client requirements, designs and task assets."
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Awaiting Review"
          value={stats.awaitingReview || 0}
          description="Employee work files pending approval"
          icon={Clock}
        />
        <StatCard
          title="Recent Uploads"
          value={stats.recentUploads || 0}
          description="Uploaded within the last 7 days"
          icon={FolderOpen}
        />
        <StatCard
          title="Active Documents"
          value={stats.totalActive || 0}
          description="Total active project files"
          icon={ShieldCheck}
        />
      </div>

      {/* Main Files Table */}
      <FileListTable
        files={filesResult.files}
        userRole={user.role}
        projects={projects as any}
        canUpload={true}
      />
    </div>
  );
}
