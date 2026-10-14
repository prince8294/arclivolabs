'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Package, Check, AlertCircle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/button';
import { formatFileSize } from '@/lib/utils/file-format';
import { createDeliverableAction } from '@/lib/actions/deliverables';

interface FileVersionOption {
  _id: string; // FileVersion ID
  displayName: string;
  originalName: string;
  versionNumber: number;
  sizeBytes: number;
  status: string;
}

interface DeliverablePackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  availableVersions: FileVersionOption[];
}

export default function DeliverablePackageModal({
  isOpen,
  onClose,
  projectId,
  availableVersions,
}: DeliverablePackageModalProps) {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedVersionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (selectedVersionIds.length === 0) {
      setError('Please select at least one approved file version.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await createDeliverableAction({
        projectId,
        title: title.trim(),
        description: description.trim() || null,
        deliveryNotes: deliveryNotes.trim() || null,
        fileVersionIds: selectedVersionIds,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to create deliverable');
      }

      onClose();
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Creation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl border border-border bg-card p-6 shadow-2xl overflow-hidden space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Create Final Deliverable Package</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Deliverable Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Website Source Code & Launch Documents"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of final assets included in this package..."
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Delivery / Handover Notes (Optional)</label>
            <textarea
              rows={2}
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Deployment notes, access credentials instructions, or handover comments..."
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Select Approved Files */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">
                Select Files to Include ({selectedVersionIds.length} selected)
              </label>
              <span className="text-[11px] text-muted-foreground">
                Files must be verified before client delivery
              </span>
            </div>

            {availableVersions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3">
                No files found for this project. Please upload work files first.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-border border border-border rounded-md p-1">
                {availableVersions.map((v) => {
                  const isChecked = selectedVersionIds.includes(v._id);
                  return (
                    <div
                      key={v._id}
                      onClick={() => toggleSelect(v._id)}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                        isChecked ? 'bg-primary/10' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            isChecked
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-border bg-background'
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                        </div>
                        <div>
                          <span className="font-medium text-foreground block">{v.displayName}</span>
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            {v.originalName} · V{v.versionNumber} · {formatFileSize(v.sizeBytes)}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted">
                        {v.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting || selectedVersionIds.length === 0}>
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Create Deliverable Package
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
