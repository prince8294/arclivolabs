import React from 'react';
import Badge from '@/components/ui/badge';
import { FILE_VISIBILITY_LABELS, type FileVisibility } from '@/lib/constants/enums';

interface FileVisibilityBadgeProps {
  visibility: string;
}

export default function FileVisibilityBadge({ visibility }: FileVisibilityBadgeProps) {
  const label = FILE_VISIBILITY_LABELS[visibility as FileVisibility] || visibility;

  switch (visibility) {
    case 'CLIENT_VISIBLE':
      return <Badge variant="success">{label}</Badge>;
    case 'CLIENT_UPLOADED':
      return <Badge variant="info">{label}</Badge>;
    case 'INTERNAL_TEAM':
      return <Badge variant="warning">{label}</Badge>;
    case 'ADMIN_ONLY':
      return <Badge variant="danger">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}
