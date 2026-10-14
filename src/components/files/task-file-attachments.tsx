'use client';

import React, { useState } from 'react';
import { Paperclip, Download, Plus, History } from 'lucide-react';
import Button from '@/components/ui/button';
import FileTypeIcon from './file-type-icon';
import FileUploadDialog from './file-upload-dialog';
import FileVersionHistoryModal from './file-version-history-modal';
import { formatFileSize } from '@/lib/utils/file-format';
import type { SerializedFileAsset, SerializedFileVersion } from '@/lib/queries/files';

interface TaskFileAttachmentsProps {
  taskId: string;
  projectId: string;
  files: SerializedFileAsset[];
  userRole: string;
  canAttach?: boolean;
}

export default function TaskFileAttachments({
  taskId,
  projectId,
  files,
  userRole,
  canAttach = true,
}: TaskFileAttachmentsProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFileForVersions, setSelectedFileForVersions] = useState<SerializedFileAsset | null>(null);
  const [versions, setVersions] = useState<SerializedFileVersion[]>([]);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  const openVersionHistory = async (file: SerializedFileAsset) => {
    setLoadingFileId(file._id);
    setVersionError(null);
    try {
      const response = await fetch(`/api/files/${file._id}`);
      if (!response.ok) throw new Error('Version history could not be loaded.');
      const data = (await response.json()) as { versions?: SerializedFileVersion[] };
      setVersions(data.versions ?? []);
      setSelectedFileForVersions(file);
    } catch (error) {
      setVersionError(error instanceof Error ? error.message : 'Version history could not be loaded.');
    } finally {
      setLoadingFileId(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Paperclip className="h-4 w-4 text-primary" aria-hidden="true" />
          Task File Attachments ({files.length})
        </h3>

        {canAttach && (
          <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Attach File
          </Button>
        )}
      </div>

      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          No files or assets attached to this task yet.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-background">
          {files.map((f) => (
            <div key={f._id} className="flex items-center justify-between p-3 text-xs hover:bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="rounded bg-muted p-1.5 shrink-0">
                  <FileTypeIcon format={f.format} className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-semibold text-foreground block">{f.displayName}</span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {f.originalName} · V{f.currentVersionNumber} · {formatFileSize(f.sizeBytes)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openVersionHistory(f)}
                  disabled={loadingFileId === f._id}
                  aria-label={`View version history for ${f.displayName}`}
                >
                  <History className="h-3.5 w-3.5" />
                  {loadingFileId === f._id ? 'Loading…' : 'History'}
                </Button>
                <a
                  href={`/api/files/${f._id}/download`}
                  download
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {versionError && <p role="alert" className="text-sm text-destructive">{versionError}</p>}

      {selectedFileForVersions && (
        <FileVersionHistoryModal
          file={selectedFileForVersions}
          versions={versions}
          userRole={userRole}
          isOpen
          onClose={() => setSelectedFileForVersions(null)}
          onUploadNewVersion={canAttach ? () => {
            setSelectedFileForVersions(null);
            setUploadOpen(true);
          } : undefined}
        />
      )}

      {uploadOpen && (
        <FileUploadDialog
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
          userRole={userRole}
          projectId={projectId}
          taskId={taskId}
          defaultCategory="TASK_ATTACHMENT"
        />
      )}
    </div>
  );
}
