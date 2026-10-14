import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FolderOpen, Package } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import DeliverablesPageClient from '@/components/files/deliverables-page-client';
import { requireRole } from '@/lib/auth/authorization';
import { getProjectById } from '@/lib/queries/projects';
import { listDeliverables } from '@/lib/queries/deliverables';
import { listFiles } from '@/lib/queries/files';
import { FileVersion } from '@/models/FileVersion';
import connectDB from '@/lib/db/mongoose';
import { USER_ROLES } from '@/types/auth';

interface ProjectDeliverablesPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata(props: ProjectDeliverablesPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const project = await getProjectById(id);
  if (!project) return { title: 'Project Not Found' };
  return {
    title: `${project.projectCode} Deliverables — Arclivo Labs`,
  };
}

export default async function AdminProjectDeliverablesPage(props: ProjectDeliverablesPageProps) {
  const user = await requireRole(USER_ROLES.ADMIN);
  const { id } = await props.params;

  const project = await getProjectById(id);
  if (!project) {
    notFound();
  }

  await connectDB();
  const deliverables = await listDeliverables(id, user);

  // Fetch available files for this project to assemble into deliverables
  const filesResult = await listFiles({ projectId: id, pageSize: 100 }, user);
  const fileIds = filesResult.files.map((f) => f._id);

  const versionsDoc = await FileVersion.find({
    fileAssetId: { $in: fileIds },
  })
    .populate('fileAssetId', 'displayName')
    .sort({ versionNumber: -1 })
    .lean();

  const availableVersions = versionsDoc.map((v: any) => ({
    _id: v._id.toString(),
    displayName: v.fileAssetId?.displayName || v.originalName,
    originalName: v.originalName,
    versionNumber: v.versionNumber,
    sizeBytes: v.sizeBytes,
    status: v.status,
  }));

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

        <Link
          href={`/admin/projects/${id}/files`}
          className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <FolderOpen className="h-4 w-4" aria-hidden="true" />
          View Project Files
        </Link>
      </div>

      <PageHeader
        title={`Final Deliverables — ${project.projectCode}`}
        description={`Assemble, review and publish final approved delivery packages for ${project.title}.`}
      />

      <DeliverablesPageClient
        projectId={id}
        deliverables={deliverables}
        availableVersions={availableVersions}
        userRole={user.role}
      />
    </div>
  );
}
