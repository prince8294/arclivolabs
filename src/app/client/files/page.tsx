import type { Metadata } from 'next';
import { FolderOpen, Package, UploadCloud, FileCheck } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/dashboard/stat-card';
import FileListTable from '@/components/files/file-list-table';
import { requireRole } from '@/lib/auth/authorization';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { listFiles } from '@/lib/queries/files';
import { listDeliverables } from '@/lib/queries/deliverables';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Client Documents & Deliverables — Arclivo Labs',
  description: 'Access your project documents, uploaded requirement assets and final deliverables.',
};

interface ClientFilesPageProps {
  searchParams: Promise<{
    category?: string;
    search?: string;
  }>;
}

export default async function ClientFilesPage(props: ClientFilesPageProps) {
  const user = await requireRole(USER_ROLES.CLIENT);
  const profile = await requireClientProfile();
  const searchParams = await props.searchParams;

  const [filesResult, deliverables] = await Promise.all([
    listFiles(
      {
        category: searchParams.category,
        search: searchParams.search,
        pageSize: 50,
      },
      user
    ),
    listDeliverables(undefined, user),
  ]);

  const myUploadsCount = filesResult.files.filter((f) => f.visibility === 'CLIENT_UPLOADED').length;
  const sharedDocsCount = filesResult.files.filter((f) => f.visibility === 'CLIENT_VISIBLE').length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Files & Deliverables"
        description="Download final project deliverables, shared documents, and review assets."
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Shared Documents"
          value={sharedDocsCount}
          description="Documents published by Arclivo Labs team"
          icon={FileCheck}
        />
        <StatCard
          title="Final Deliverables"
          value={deliverables.length}
          description="Approved delivery packages ready for download"
          icon={Package}
        />
        <StatCard
          title="My Uploads"
          value={myUploadsCount}
          description="Requirement assets submitted by you"
          icon={UploadCloud}
        />
      </div>

      <FileListTable
        files={filesResult.files}
        userRole={user.role}
        canUpload={false} // In client root files, upload is done inside specific project
      />
    </div>
  );
}
