'use client';

import React, { useState } from 'react';
import {
  Download,
  Eye,
  History,
  Upload,
  Search,
  FileQuestion,
} from 'lucide-react';
import Button from '@/components/ui/button';
import FileTypeIcon from './file-type-icon';
import FileStatusBadge from './file-status-badge';
import FileVisibilityBadge from './file-visibility-badge';
import FileVersionHistoryModal from './file-version-history-modal';
import FileUploadDialog from './file-upload-dialog';
import { formatFileSize } from '@/lib/utils/file-format';
import { formatDate } from '@/lib/utils/format';
import type { SerializedFileAsset, SerializedFileVersion } from '@/lib/queries/files';
import { FILE_CATEGORY_LABELS } from '@/lib/constants/enums';

interface FileListTableProps {
  files: SerializedFileAsset[];
  userRole: string;
  projectId?: string;
  canUpload?: boolean;
  /** Legacy page prop; project metadata is already embedded in each file. */
  projects?: unknown;
}

export default function FileListTable({
  files,
  userRole,
  projectId,
  canUpload = true,
}: FileListTableProps) {
  const [selectedFileForVersions, setSelectedFileForVersions] = useState<SerializedFileAsset | null>(null);
  const [versionsList, setVersionsList] = useState<SerializedFileVersion[]>([]);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [parentFileForNewVersion, setParentFileForNewVersion] = useState<SerializedFileAsset | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const filteredFiles = files.filter((f) => {
    if (categoryFilter !== 'ALL' && f.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        f.displayName.toLowerCase().includes(q) ||
        f.originalName.toLowerCase().includes(q) ||
        f.fileCode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const canUploadVersion = (file: SerializedFileAsset) =>
    canUpload && (userRole !== 'CLIENT' || file.visibility === 'CLIENT_UPLOADED');

  const handleOpenVersions = async (file: SerializedFileAsset) => {
    setLoadingFileId(file._id);
    setVersionError(null);
    try {
      const res = await fetch(`/api/files/${file._id}`);
      if (!res.ok) throw new Error('Version history could not be loaded.');
      const data = (await res.json()) as { versions?: SerializedFileVersion[] };
      setVersionsList(data.versions ?? []);
      setSelectedFileForVersions(file);
    } catch (error) {
      setVersionError(error instanceof Error ? error.message : 'Version history could not be loaded.');
    } finally {
      setLoadingFileId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search files by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {Object.entries(FILE_CATEGORY_LABELS).map(([catKey, catLabel]) => (
              <option key={catKey} value={catKey}>
                {catLabel}
              </option>
            ))}
          </select>

          {canUpload && (
            <Button
              size="sm"
              onClick={() => {
                setParentFileForNewVersion(null);
                setUploadModalOpen(true);
              }}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Upload File
            </Button>
          )}
        </div>
      </div>

      {/* Files Table */}
      {filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center bg-card">
          <FileQuestion className="h-10 w-10 text-muted-foreground mb-3" />
          <h4 className="text-sm font-semibold text-foreground">No files found</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {search || categoryFilter !== 'ALL'
              ? 'No files matching the active search or category filters.'
              : 'No documents or assets have been uploaded for this resource yet.'}
          </p>
          {canUpload && (
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => setUploadModalOpen(true)}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Upload File
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">File Name</th>
                  {userRole !== 'CLIENT' && <th className="py-3 px-4">Project</th>}
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Status</th>
                  {userRole === 'ADMIN' && <th className="py-3 px-4">Visibility</th>}
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFiles.map((file) => (
                  <tr key={file._id} className="hover:bg-muted/20 transition-colors">
                    {/* File Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded bg-muted p-1.5 shrink-0">
                          <FileTypeIcon format={file.format} resourceType={file.resourceType} className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <button type="button" className="font-semibold text-left text-foreground hover:underline" onClick={() => handleOpenVersions(file)} disabled={loadingFileId === file._id}>
                              {file.displayName}
                            </button>
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground block">
                            {file.fileCode} · {file.originalName}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Project */}
                    {userRole !== 'CLIENT' && (
                      <td className="py-3 px-4">
                        {file.project ? (
                          <span className="font-mono text-[11px] text-primary block">
                            [{file.project.projectCode}] {file.project.title}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="inline-block rounded bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
                        {FILE_CATEGORY_LABELS[file.category as keyof typeof FILE_CATEGORY_LABELS] || file.category}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {formatFileSize(file.sizeBytes)}
                    </td>

                    {/* Version */}
                    <td className="py-3 px-4 font-mono">
                      <button
                        type="button"
                        onClick={() => handleOpenVersions(file)}
                        disabled={loadingFileId === file._id}
                        className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary hover:bg-primary/20 text-[11px] font-bold"
                      >
                        <History className="h-3 w-3" />
                        V{file.currentVersionNumber}
                      </button>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <FileStatusBadge status={file.status} />
                    </td>

                    {/* Visibility */}
                    {userRole === 'ADMIN' && (
                      <td className="py-3 px-4">
                        <FileVisibilityBadge visibility={file.visibility} />
                      </td>
                    )}

                    {/* Uploaded */}
                    <td className="py-3 px-4 text-muted-foreground">
                      <span className="block">{formatDate(file.createdAt)}</span>
                      <span className="text-[10px] text-muted-foreground block">
                        by {file.uploadedBy.name}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/api/files/${file._id}/download`}
                          download
                          title="Download authorized file"
                          className="rounded-md border border-border p-1.5 text-foreground hover:bg-muted hover:text-primary transition-colors inline-flex items-center justify-center"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleOpenVersions(file)}
                          disabled={loadingFileId === file._id}
                          title="View version history & details"
                          className="rounded-md border border-border p-1.5 text-foreground hover:bg-muted hover:text-primary transition-colors inline-flex items-center justify-center"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {canUploadVersion(file) && (
                          <button
                            type="button"
                            onClick={() => {
                              setParentFileForNewVersion(file);
                              setUploadModalOpen(true);
                            }}
                            title="Upload new version"
                            className="rounded-md border border-border p-1.5 text-foreground hover:bg-muted hover:text-primary transition-colors inline-flex items-center justify-center"
                          >
                            <Upload className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {versionError && <p role="alert" className="text-sm text-destructive">{versionError}</p>}

      {/* Version History Modal */}
      {selectedFileForVersions && (
        <FileVersionHistoryModal
          file={selectedFileForVersions}
          versions={versionsList}
          userRole={userRole}
          isOpen={Boolean(selectedFileForVersions)}
          onClose={() => setSelectedFileForVersions(null)}
          onUploadNewVersion={canUploadVersion(selectedFileForVersions) ? () => {
              setParentFileForNewVersion(selectedFileForVersions);
              setSelectedFileForVersions(null);
              setUploadModalOpen(true);
            } : undefined}
        />
      )}

      {/* Upload Dialog */}
      {uploadModalOpen && (
        <FileUploadDialog
          isOpen={uploadModalOpen}
          onClose={() => {
            setUploadModalOpen(false);
            setParentFileForNewVersion(null);
          }}
          userRole={userRole}
          projectId={projectId || (parentFileForNewVersion?.projectId)}
          parentFileId={parentFileForNewVersion?._id}
          parentFileName={parentFileForNewVersion?.displayName}
          defaultCategory={parentFileForNewVersion?.category}
        />
      )}
    </div>
  );
}
