'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  CheckCircle2,
  Download,
  Send,
  Calendar,
  FileCheck,
  ShieldCheck,
  Loader2,
  Clock,
} from 'lucide-react';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import FileTypeIcon from './file-type-icon';
import { formatFileSize } from '@/lib/utils/file-format';
import { formatDate } from '@/lib/utils/format';
import {
  publishDeliverableAction,
  acknowledgeDeliverableAction,
} from '@/lib/actions/deliverables';
import type { SerializedDeliverable } from '@/lib/queries/deliverables';
import { DELIVERABLE_STATUS_LABELS, type DeliverableStatus } from '@/lib/constants/enums';

interface DeliverableListProps {
  deliverables: SerializedDeliverable[];
  userRole: string;
}

export default function DeliverableList({ deliverables, userRole }: DeliverableListProps) {
  const router = useRouter();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handlePublish = async (id: string) => {
    if (!confirm('Publish this deliverable package to the client? The client will be able to access and download all included files.')) return;
    try {
      setSubmittingId(id);
      const res = await publishDeliverableAction(id);
      if (!res.success) {
        alert(res.error || 'Failed to publish');
        return;
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Publish failed');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleAcknowledge = async (id: string) => {
    if (!confirm('Confirm receipt of these final project deliverables?')) return;
    try {
      setSubmittingId(id);
      const res = await acknowledgeDeliverableAction(id);
      if (!res.success) {
        alert(res.error || 'Failed to acknowledge');
        return;
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Acknowledgement failed');
    } finally {
      setSubmittingId(null);
    }
  };

  if (deliverables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-12 text-center">
        <Package className="h-10 w-10 text-muted-foreground mb-3" />
        <h4 className="text-sm font-semibold text-foreground">No final deliverables</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          {userRole === 'CLIENT'
            ? 'No deliverables have been published for your project yet. Once your project deliverables are approved, they will appear here.'
            : 'No deliverable packages have been assembled for this project.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deliverables.map((dlv) => {
        const statusLabel =
          DELIVERABLE_STATUS_LABELS[dlv.status as DeliverableStatus] || dlv.status;

        return (
          <div
            key={dlv._id}
            className="rounded-xl border border-border bg-card shadow-xs overflow-hidden transition-all"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border p-5 bg-muted/15">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{dlv.deliverableCode}</span>
                  <Badge
                    variant={
                      dlv.status === 'ACKNOWLEDGED'
                        ? 'success'
                        : dlv.status === 'PUBLISHED'
                        ? 'info'
                        : 'outline'
                    }
                  >
                    {statusLabel}
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-foreground">{dlv.title}</h3>
                {dlv.project && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Project: [{dlv.project.projectCode}] {dlv.project.title}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {userRole === 'ADMIN' && dlv.status === 'DRAFT' && (
                  <Button
                    size="sm"
                    disabled={submittingId === dlv._id}
                    onClick={() => handlePublish(dlv._id)}
                  >
                    {submittingId === dlv._id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1" />
                    )}
                    Publish to Client
                  </Button>
                )}

                {userRole === 'CLIENT' && dlv.status === 'PUBLISHED' && (
                  <Button
                    size="sm"
                    disabled={submittingId === dlv._id}
                    onClick={() => handleAcknowledge(dlv._id)}
                  >
                    {submittingId === dlv._id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <FileCheck className="h-3.5 w-3.5 mr-1" />
                    )}
                    Acknowledge Receipt
                  </Button>
                )}

                {dlv.status === 'ACKNOWLEDGED' && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-success font-medium bg-success/10 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="h-4 w-4" />
                    Receipt Acknowledged
                  </span>
                )}
              </div>
            </div>

            {/* Description & Delivery Notes */}
            <div className="p-5 space-y-4 text-xs">
              {dlv.description && (
                <div>
                  <span className="font-semibold text-foreground block mb-0.5">Summary</span>
                  <p className="text-muted-foreground leading-relaxed">{dlv.description}</p>
                </div>
              )}

              {dlv.deliveryNotes && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                  <span className="font-semibold text-foreground block">Handover Instructions</span>
                  <p className="text-muted-foreground leading-relaxed">{dlv.deliveryNotes}</p>
                </div>
              )}

              {/* Included Files */}
              <div className="space-y-2 pt-2">
                <span className="font-bold text-foreground text-xs block">
                  Included Files ({dlv.files.length})
                </span>

                <div className="divide-y divide-border rounded-lg border border-border bg-background">
                  {dlv.files.map((f) => (
                    <div key={f._id} className="flex items-center justify-between p-3 hover:bg-muted/20">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded bg-muted p-1.5 shrink-0">
                          <FileTypeIcon format={f.format} className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">{f.displayName}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {f.originalName} · V{f.versionNumber} · {formatFileSize(f.sizeBytes)}
                          </span>
                        </div>
                      </div>

                      <a
                        href={`/api/files/${f.fileAssetId}/versions/${f.versionNumber}/download`}
                        download
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footnote */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Assembled by: {dlv.createdBy.name} on {formatDate(dlv.createdAt)}</span>
                </div>
                {dlv.publishedAt && (
                  <div>
                    Published on {formatDate(dlv.publishedAt)}
                    {dlv.publishedBy && ` by ${dlv.publishedBy.name}`}
                  </div>
                )}
                {dlv.clientAcknowledgedAt && (
                  <div className="text-success font-medium">
                    Acknowledged on {formatDate(dlv.clientAcknowledgedAt)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
