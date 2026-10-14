'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  FileCheck,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Button from '@/components/ui/button';
import FileTypeIcon from './file-type-icon';
import FileStatusBadge from './file-status-badge';
import FileVisibilityBadge from './file-visibility-badge';
import { formatFileSize } from '@/lib/utils/file-format';
import { formatDate } from '@/lib/utils/format';
import {
  reviewFileVersionAction,
  createClientApprovalForFileAction,
  archiveFileAction,
} from '@/lib/actions/files';
import type { SerializedFileAsset, SerializedFileVersion } from '@/lib/queries/files';

interface FileVersionHistoryModalProps {
  file: SerializedFileAsset;
  versions: SerializedFileVersion[];
  userRole: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadNewVersion?: () => void;
}

export default function FileVersionHistoryModal({
  file,
  versions,
  userRole,
  isOpen,
  onClose,
  onUploadNewVersion,
}: FileVersionHistoryModalProps) {
  const router = useRouter();

  const [reviewingVersion, setReviewingVersion] = useState<number | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [approvalModalVersion, setApprovalModalVersion] = useState<number | null>(null);
  const [approvalTitle, setApprovalTitle] = useState<string>(`Review: ${file.displayName}`);
  const [approvalDesc, setApprovalDesc] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleReviewSubmit = async (versionNumber: number) => {
    try {
      setSubmitting(true);
      setFeedback(null);
      const res = await reviewFileVersionAction(file._id, versionNumber, reviewDecision, reviewNotes);
      if (!res.success) {
        throw new Error(res.error || 'Failed to review version');
      }
      setFeedback({ type: 'success', message: `Version ${versionNumber} ${reviewDecision === 'APPROVE' ? 'approved' : 'marked changes requested'}!` });
      setReviewingVersion(null);
      setReviewNotes('');
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Review failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovalSubmit = async (versionNumber: number) => {
    try {
      setSubmitting(true);
      setFeedback(null);
      const res = await createClientApprovalForFileAction(file._id, versionNumber, approvalTitle, approvalDesc);
      if (!res.success) {
        throw new Error(res.error || 'Failed to create approval request');
      }
      setFeedback({ type: 'success', message: `Client Approval requested (${res.approvalCode}) for Version ${versionNumber}!` });
      setApprovalModalVersion(null);
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Approval creation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this file? It will be hidden from active lists.')) return;
    try {
      setSubmitting(true);
      const res = await archiveFileAction(file._id);
      if (res.success) {
        onClose();
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to archive');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-5 bg-muted/10">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2 mt-0.5">
              <FileTypeIcon format={file.format} resourceType={file.resourceType} className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">{file.fileCode}</span>
                <FileStatusBadge status={file.status} />
                <FileVisibilityBadge visibility={file.visibility} />
              </div>
              <h2 className="text-base font-bold text-foreground mt-1">{file.displayName}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {file.originalName} · {formatFileSize(file.sizeBytes)} · {file.category}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* Feedback banner */}
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 ${
                feedback.type === 'success'
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Description & metadata summary */}
          {file.description && (
            <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-1">
              <span className="font-semibold text-foreground">File Description</span>
              <p className="text-muted-foreground leading-relaxed">{file.description}</p>
            </div>
          )}

          {/* Versions List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Version History ({versions.length})
              </h3>
              {onUploadNewVersion && (
                <Button size="sm" variant="outline" onClick={onUploadNewVersion}>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Upload New Version
                </Button>
              )}
            </div>

            <div className="space-y-3 divide-y divide-border rounded-lg border border-border">
              {versions.map((ver) => (
                <div key={ver._id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[11px]">
                          V{ver.versionNumber}
                        </span>
                        <FileStatusBadge status={ver.status} />
                        <span className="text-muted-foreground">{formatFileSize(ver.sizeBytes)}</span>
                      </div>
                      <p className="font-medium text-foreground mt-1.5">{ver.originalName}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Uploaded by <span className="font-medium text-foreground">{ver.uploadedBy.name}</span> on{' '}
                        {formatDate(ver.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/files/${file._id}/versions/${ver.versionNumber}/download`}
                        download
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>

                      {userRole === 'ADMIN' && ver.status === 'PENDING_REVIEW' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReviewingVersion(ver.versionNumber);
                            setApprovalModalVersion(null);
                          }}
                        >
                          Review
                        </Button>
                      )}

                      {userRole === 'ADMIN' && ver.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setApprovalModalVersion(ver.versionNumber);
                            setReviewingVersion(null);
                          }}
                        >
                          <FileCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                          Publish to Client Approval
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Change summary */}
                  {ver.changeSummary && (
                    <div className="rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Change note: </span>
                      {ver.changeSummary}
                    </div>
                  )}

                  {/* Review Notes */}
                  {ver.reviewNotes && (
                    <div className="rounded bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] text-amber-900 dark:text-amber-200">
                      <span className="font-semibold">Review feedback ({ver.reviewedBy?.name || 'Admin'}): </span>
                      {ver.reviewNotes}
                    </div>
                  )}

                  {/* Inline Review Form */}
                  {reviewingVersion === ver.versionNumber && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 mt-2">
                      <span className="font-semibold text-foreground block">
                        Admin Review for Version {ver.versionNumber}
                      </span>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="decision"
                            value="APPROVE"
                            checked={reviewDecision === 'APPROVE'}
                            onChange={() => setReviewDecision('APPROVE')}
                          />
                          <span className="text-success font-medium">Approve Version</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="decision"
                            value="REJECT"
                            checked={reviewDecision === 'REJECT'}
                            onChange={() => setReviewDecision('REJECT')}
                          />
                          <span className="text-destructive font-medium">Request Changes / Reject</span>
                        </label>
                      </div>
                      <textarea
                        rows={2}
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Review feedback or change instructions for employee..."
                        className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={submitting}
                          onClick={() => setReviewingVersion(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={submitting}
                          onClick={() => handleReviewSubmit(ver.versionNumber)}
                        >
                          {submitting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          Confirm Decision
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Inline Client Approval Request Form (§31) */}
                  {approvalModalVersion === ver.versionNumber && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 mt-2">
                      <span className="font-semibold text-foreground block">
                        Publish V{ver.versionNumber} as Client Approval Request
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        This creates an official Client Approval record referencing Version {ver.versionNumber} and exposes it to the Client portal.
                      </p>
                      <input
                        type="text"
                        value={approvalTitle}
                        onChange={(e) => setApprovalTitle(e.target.value)}
                        placeholder="Approval Request Title"
                        className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground focus:outline-none"
                      />
                      <textarea
                        rows={2}
                        value={approvalDesc}
                        onChange={(e) => setApprovalDesc(e.target.value)}
                        placeholder="Instructions or notes for client review..."
                        className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={submitting}
                          onClick={() => setApprovalModalVersion(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={submitting}
                          onClick={() => handleApprovalSubmit(ver.versionNumber)}
                        >
                          {submitting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          Publish Request to Client
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border p-4 bg-muted/10">
          <div>
            {userRole === 'ADMIN' && file.status !== 'ARCHIVED' && (
              <Button size="sm" variant="danger" onClick={handleArchive} disabled={submitting}>
                Archive Document
              </Button>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
