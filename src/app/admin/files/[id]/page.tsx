import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, History, Shield, Calendar, User, FolderKanban, Briefcase } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import FileTypeIcon from '@/components/files/file-type-icon';
import FileStatusBadge from '@/components/files/file-status-badge';
import FileVisibilityBadge from '@/components/files/file-visibility-badge';
import FileVersionHistoryModal from '@/components/files/file-version-history-modal';
import { requireRole } from '@/lib/auth/authorization';
import { getFileById } from '@/lib/queries/files';
import { formatFileSize } from '@/lib/utils/file-format';
import { formatDate } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';

interface AdminFileDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata(props: AdminFileDetailPageProps): Promise<Metadata> {
  const { id } = await props.params;
  return {
    title: `File Details — Arclivo Labs`,
  };
}

export default async function AdminFileDetailPage(props: AdminFileDetailPageProps) {
  const user = await requireRole(USER_ROLES.ADMIN);
  const { id } = await props.params;

  const result = await getFileById(id, user);
  if (!result) {
    notFound();
  }

  const { file, versions } = result;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/files"
          className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to files
        </Link>
      </div>

      {/* Header Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="rounded-xl bg-muted p-3 mt-1">
              <FileTypeIcon format={file.format} resourceType={file.resourceType} className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">{file.fileCode}</span>
                <FileStatusBadge status={file.status} />
                <FileVisibilityBadge visibility={file.visibility} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {file.displayName}
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                {file.originalName} · {formatFileSize(file.sizeBytes)} · {file.mimeType}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/files/${file._id}/download`}
              download
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Download Latest (V{file.currentVersionNumber})
            </a>
          </div>
        </div>

        {file.description && (
          <p className="pt-4 border-t border-border text-xs text-muted-foreground leading-relaxed">
            {file.description}
          </p>
        )}
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-3 text-xs">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2 border-b border-border pb-2">
            <FolderKanban className="h-4 w-4 text-primary" />
            Project & Association
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Project:</span>
              <span className="font-medium text-foreground">
                {file.project ? `[${file.project.projectCode}] ${file.project.title}` : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Client:</span>
              <span className="font-medium text-foreground">
                {file.client ? `${file.client.name} (${file.client.clientCode})` : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Category:</span>
              <span className="font-medium text-foreground">{file.category}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Delivery Method:</span>
              <span className="font-mono text-foreground">{file.deliveryType}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-3 text-xs">
          <h2 className="font-semibold text-foreground text-sm flex items-center gap-2 border-b border-border pb-2">
            <Shield className="h-4 w-4 text-primary" />
            Audit & Ownership
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Uploaded By:</span>
              <span className="font-medium text-foreground">{file.uploadedBy.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Upload Date:</span>
              <span className="font-medium text-foreground">{formatDate(file.createdAt)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Reviewed By:</span>
              <span className="font-medium text-foreground">{file.reviewedBy?.name || 'Pending Review'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Total Versions:</span>
              <span className="font-bold text-foreground">{versions.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Version History Table */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
        <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Version History & Review Decisions
        </h2>

        <div className="divide-y divide-border rounded-lg border border-border">
          {versions.map((ver) => (
            <div key={ver._id} className="p-4 flex items-center justify-between text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[11px]">
                    Version {ver.versionNumber}
                  </span>
                  <FileStatusBadge status={ver.status} />
                  <span className="text-muted-foreground">{formatFileSize(ver.sizeBytes)}</span>
                </div>
                <p className="font-medium text-foreground">{ver.originalName}</p>
                {ver.changeSummary && (
                  <p className="text-muted-foreground text-[11px] italic">“{ver.changeSummary}”</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  By {ver.uploadedBy.name} on {formatDate(ver.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/files/${file._id}/versions/${ver.versionNumber}/download`}
                  download
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download V{ver.versionNumber}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
