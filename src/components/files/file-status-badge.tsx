import React from 'react';
import Badge from '@/components/ui/badge';
import { FILE_STATUS_LABELS, type FileStatus } from '@/lib/constants/enums';

interface FileStatusBadgeProps {
  status: string;
}

export default function FileStatusBadge({ status }: FileStatusBadgeProps) {
  const label = FILE_STATUS_LABELS[status as FileStatus] || status;

  switch (status) {
    case 'APPROVED':
      return <Badge variant="success">{label}</Badge>;
    case 'PENDING_REVIEW':
      return <Badge variant="warning">{label}</Badge>;
    case 'REJECTED':
      return <Badge variant="danger">{label}</Badge>;
    case 'READY':
      return <Badge variant="info">{label}</Badge>;
    case 'ARCHIVED':
      return <Badge variant="secondary">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}
