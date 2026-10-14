'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/button';
import { formatFileSize } from '@/lib/utils/file-format';
import { FILE_CATEGORIES, FILE_VISIBILITIES, FILE_CATEGORY_LABELS, FILE_VISIBILITY_LABELS } from '@/lib/constants/enums';

interface ProjectOption {
  _id: string;
  projectCode: string;
  title: string;
}

interface FileUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
  projectId?: string;
  projects?: ProjectOption[];
  parentFileId?: string;
  parentFileName?: string;
  taskId?: string;
  milestoneId?: string;
  requirementId?: string;
  defaultCategory?: string;
  onSuccess?: () => void;
}

export default function FileUploadDialog({
  isOpen,
  onClose,
  userRole,
  projectId: initialProjectId,
  projects = [],
  parentFileId,
  parentFileName,
  taskId,
  milestoneId,
  requirementId,
  defaultCategory = FILE_CATEGORIES.DOCUMENT,
  onSuccess,
}: FileUploadDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState<string>(initialProjectId || (projects[0]?._id || ''));
  const [displayName, setDisplayName] = useState<string>('');
  const [category, setCategory] = useState<string>(defaultCategory);
  const [visibility, setVisibility] = useState<string>(
    userRole === 'ADMIN' ? FILE_VISIBILITIES.ADMIN_ONLY : FILE_VISIBILITIES.INTERNAL_TEAM
  );
  const [description, setDescription] = useState<string>('');
  const [changeSummary, setChangeSummary] = useState<string>('');

  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!displayName && !parentFileId) {
        setDisplayName(file.name.replace(/\.[^/.]+$/, ''));
      }
      setErrorMessage('');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (!displayName && !parentFileId) {
        setDisplayName(file.name.replace(/\.[^/.]+$/, ''));
      }
      setErrorMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload.');
      return;
    }
    const targetProjId = initialProjectId || projectId;
    if (!targetProjId) {
      setErrorMessage('Please select a project.');
      return;
    }

    try {
      setStatus('uploading');
      setErrorMessage('');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('projectId', targetProjId);
      formData.append('category', category);
      if (userRole === 'ADMIN') {
        formData.append('visibility', visibility);
      }
      if (displayName) {
        formData.append('displayName', displayName);
      }
      if (description) {
        formData.append('description', description);
      }
      if (changeSummary) {
        formData.append('changeSummary', changeSummary);
      }
      if (parentFileId) {
        formData.append('parentFileId', parentFileId);
      }
      if (taskId) {
        formData.append('taskId', taskId);
      }
      if (milestoneId) {
        formData.append('milestoneId', milestoneId);
      }
      if (requirementId) {
        formData.append('requirementId', requirementId);
      }

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload file.');
      }

      setStatus('success');
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      }, 1000);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {parentFileId ? `Upload New Version: ${parentFileName}` : 'Upload Document or Asset'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Securely stored in Cloudinary with encrypted metadata & permission gates.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={status === 'uploading'}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dropzone */}
        {!selectedFile ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/80 bg-muted/20 p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">
              Click to select or drag and drop a file
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX, XLSX, CSV, Images, Videos, ZIP (up to 50MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div className="space-y-0.5 overflow-hidden">
              <p className="text-xs font-semibold text-foreground truncate">{selectedFile.name}</p>
              <p className="text-[11px] text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              disabled={status === 'uploading'}
              onClick={() => setSelectedFile(null)}
              className="text-xs text-destructive hover:underline ml-3 shrink-0"
            >
              Change
            </button>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Project selector if not fixed */}
          {!initialProjectId && projects.length > 0 && (
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={status === 'uploading'}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    [{p.projectCode}] {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!parentFileId && (
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Display Title</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Homepage Wireframe V1"
                disabled={status === 'uploading'}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {!parentFileId && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={status === 'uploading'}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(FILE_CATEGORY_LABELS).map(([catKey, catLabel]) => (
                  <option key={catKey} value={catKey}>
                    {catLabel}
                  </option>
                ))}
              </select>
            </div>

            {userRole === 'ADMIN' && (
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  disabled={status === 'uploading'}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(FILE_VISIBILITY_LABELS).map(([visKey, visLabel]) => (
                    <option key={visKey} value={visKey}>
                      {visLabel}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>}

          {parentFileId ? (
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Change Summary</label>
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="What changes were made in this version?"
                disabled={status === 'uploading'}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Notes or instructions about this document..."
                disabled={status === 'uploading'}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* Feedback */}
          {status === 'error' && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-2.5 text-xs text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>File uploaded and recorded successfully!</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={status === 'uploading'}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!selectedFile || status === 'uploading'}
            >
              {status === 'uploading' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {status === 'uploading' ? 'Uploading...' : parentFileId ? 'Upload New Version' : 'Upload File'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
