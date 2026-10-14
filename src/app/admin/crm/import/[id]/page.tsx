import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileUp } from 'lucide-react';

import CrmTabs from '@/components/crm/crm-tabs';
import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import {
  LEAD_DISTRIBUTION_MODE_LABELS,
  LEAD_DUPLICATE_POLICIES,
  LEAD_IMPORT_STATUS_LABELS,
  LEAD_IMPORT_STATUSES,
  type LeadImportStatus,
} from '@/lib/constants/lead-import';
import { LEAD_STATUS_LABELS } from '@/lib/constants/enums';
import { ROUTES } from '@/lib/constants/routes';
import {
  countLeadsByImportBatch,
  getLeadImportDetail,
} from '@/lib/queries/lead-import';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Import Batch',
  description: 'CSV import batch details.',
};

/** Human-readable file size (KB/MB, one decimal). */
function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTone(status: LeadImportStatus): string {
  switch (status) {
    case LEAD_IMPORT_STATUSES.COMPLETED:
      return 'bg-success/10 text-success';
    case LEAD_IMPORT_STATUSES.PARTIAL:
      return 'bg-warning/10 text-warning';
    case LEAD_IMPORT_STATUSES.FAILED:
      return 'bg-destructive/10 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/**
 * /admin/crm/import/[id]
 *
 * Read-only audit view of one CSV import batch. Invalid ids
 * and unknown batches both resolve to `notFound()`. The
 * "View imported leads" link opens the lead list pre-filtered
 * to this batch (`?importBatch=<id>`).
 */
export default async function LeadImportDetailPage(
  props: PageProps<'/admin/crm/import/[id]'>
) {
  await requireRole(USER_ROLES.ADMIN);

  const { id } = await props.params;
  const [detail, leadCount] = await Promise.all([
    getLeadImportDetail(id),
    countLeadsByImportBatch(id),
  ]);

  if (!detail) {
    notFound();
  }

  const mappingEntries = Object.entries(detail.columnMapping);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Import ${detail.importCode}`}
        description={`${detail.fileName} · imported by ${detail.createdBy}`}
        action={
          <ButtonLink
            href={ROUTES.ADMIN.CRM_IMPORT}
            variant="outline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            New import
          </ButtonLink>
        }
      />

      <CrmTabs
        basePath={ROUTES.ADMIN.CRM}
        items={[
          { title: 'Overview', href: ROUTES.ADMIN.CRM },
          { title: 'Leads', href: `${ROUTES.ADMIN.CRM}/leads` },
          { title: 'Import', href: ROUTES.ADMIN.CRM_IMPORT },
          {
            title: 'Distribution',
            href: ROUTES.ADMIN.CRM_DISTRIBUTION,
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
            statusTone(detail.status)
          )}
        >
          {LEAD_IMPORT_STATUS_LABELS[detail.status]}
        </span>
        <span className="text-sm text-muted-foreground">
          Started {formatDateTime(detail.createdAt)}
          {detail.completedAt
            ? ` · finished ${formatDateTime(detail.completedAt)}`
            : ''}
        </span>
      </div>

      {detail.errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {detail.errorMessage}
        </p>
      )}

      {/* Row accounting */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <Stat label="Total rows" value={detail.totalRows} />
        <Stat label="Valid" value={detail.validRows} />
        <Stat label="Warnings" value={detail.warningRows} />
        <Stat label="Invalid" value={detail.invalidRows} />
        <Stat label="Duplicates" value={detail.duplicateRows} />
        <Stat
          label="Skipped (dup.)"
          value={detail.skippedDuplicateRows}
        />
        <Stat label="Imported" value={detail.importedRows} />
        <Stat label="On leads" value={leadCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Import settings */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Import settings
          </h3>
          <dl className="mt-3 divide-y divide-border text-sm">
            <Row label="File" value={`${detail.fileName} (${formatBytes(detail.fileSizeBytes)})`} />
            <Row
              label="Default status"
              value={LEAD_STATUS_LABELS[detail.defaultStatus as keyof typeof LEAD_STATUS_LABELS] ?? detail.defaultStatus}
            />
            <Row
              label="Assignment"
              value={LEAD_DISTRIBUTION_MODE_LABELS[detail.assignmentMode as keyof typeof LEAD_DISTRIBUTION_MODE_LABELS] ?? detail.assignmentMode}
            />
            <Row
              label="Duplicate policy"
              value={
                detail.duplicatePolicy === LEAD_DUPLICATE_POLICIES.SKIP
                  ? 'Skip duplicates'
                  : 'Import duplicates'
              }
            />
            <Row label="Created by" value={detail.createdBy} />
            <Row label="Created at" value={formatDate(detail.createdAt)} />
          </dl>
        </div>

        {/* Column mapping */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Column mapping
          </h3>
          {mappingEntries.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No columns were mapped.
            </p>
          ) : (
            <dl className="mt-3 divide-y divide-border text-sm">
              {mappingEntries.map(([field, header]) => (
                <Row
                  key={field}
                  label={field}
                  value={header ?? 'Ignored'}
                />
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Imported leads
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {leadCount} lead{leadCount === 1 ? '' : 's'} were created
            by this batch.
          </p>
        </div>
        <ButtonLink
          href={`${ROUTES.ADMIN.CRM}/leads?importBatch=${detail.id}`}
          variant="outline"
        >
          <FileUp className="h-4 w-4" aria-hidden="true" />
          View imported leads
        </ButtonLink>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
