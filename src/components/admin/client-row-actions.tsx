'use client';

import Link from 'next/link';
import { Eye, Pencil } from 'lucide-react';

export interface ClientRowActionsProps {
  clientId: string;
  clientCode: string;
  name: string;
  status: string;
  hasPortalAccess: boolean;
  detailHref: string;
  editHref: string;
}

const iconButtonClasses =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function ClientRowActions({
  clientId,
  clientCode,
  name,
  detailHref,
  editHref,
}: ClientRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={detailHref}
        className={iconButtonClasses}
        aria-label={`View ${name}`}
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Link>
      <Link
        href={editHref}
        className={iconButtonClasses}
        aria-label={`Edit ${name}`}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}