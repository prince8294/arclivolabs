'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import Button from '@/components/ui/button';
import DeliverablePackageModal from './deliverable-package-modal';
import DeliverableList from './deliverable-list';
import type { SerializedDeliverable } from '@/lib/queries/deliverables';

interface DeliverablesPageClientProps {
  projectId: string;
  deliverables: SerializedDeliverable[];
  availableVersions: Array<{
    _id: string;
    displayName: string;
    originalName: string;
    versionNumber: number;
    sizeBytes: number;
    status: string;
  }>;
  userRole: string;
}

export default function DeliverablesPageClient({
  projectId,
  deliverables,
  availableVersions,
  userRole,
}: DeliverablesPageClientProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {userRole === 'ADMIN' && (
        <div className="flex justify-end">
          <Button onClick={() => setModalOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Create Deliverable Package
          </Button>
        </div>
      )}

      <DeliverableList deliverables={deliverables} userRole={userRole} />

      {modalOpen && (
        <DeliverablePackageModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          projectId={projectId}
          availableVersions={availableVersions}
        />
      )}
    </div>
  );
}
