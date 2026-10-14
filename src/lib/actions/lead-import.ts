'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Types } from 'mongoose';

import { requireRole } from '@/lib/auth/authorization';
import { createLeadSystemActivity } from '@/lib/activities/lead-activity';
import {
  DEFAULT_CURRENCY,
  LEAD_ACTIVITY_EVENTS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  type LeadStatus,
} from '@/lib/constants/enums';
import {
  LEAD_BULK_ACTIVITY_LIMIT,
  LEAD_DISTRIBUTION_MODES,
  LEAD_DUPLICATE_POLICIES,
  LEAD_IMPORT_FIELDS,
  LEAD_IMPORT_INSERT_BATCH_SIZE,
  LEAD_IMPORT_MAX_FILE_BYTES,
  LEAD_IMPORT_PREVIEW_ROW_LIMIT,
  LEAD_IMPORT_STATUSES,
  type LeadDistributionMode,
  type LeadDuplicatePolicy,
  type LeadImportField,
} from '@/lib/constants/lead-import';
import { distributeRoundRobin } from '@/lib/distribution/lead-distribution';
import {
  formatSequentialCode,
  generateSequentialCode,
  reserveSequenceRange,
} from '@/lib/db/generate-code';
import {
  resolveAssignableMarketingUser,
  resolveAssignableMarketingUsers,
} from '@/lib/leads/assignees';
import { fetchActiveServiceMap, processImportFile } from '@/lib/import/process';
import { normalizeServiceInterest } from '@/lib/validations/lead-import';
import { Lead } from '@/models/Lead';
import { LeadImport } from '@/models/LeadImport';
import { User } from '@/models/User';
import { USER_ROLES } from '@/types/auth';
import type {
  ColumnMapping,
  LeadImportPreviewResult,
  LeadImportPreviewRow,
  LeadImportSummary,
} from '@/types/lead-import';

/**
 * CSV lead import (admin only).
 *
 * Two actions, both re-validating everything from the raw file
 * text — the client never sends pre-validated rows, only the CSV
 * text and the column mapping, so a tampered preview can never
 * cause a bad write:
 *   - `previewLeadImport`  → parse, map, validate, de-duplicate.
 *   - `commitLeadImport`   → re-run the exact same pipeline, then
 *     insert only the importable rows.
 *
 * Lead codes are reserved in one atomic Counter range
 * (`reserveSequenceRange`), so a bulk import can never collide
 * with a concurrent single-lead creation.
 *
 * Idempotency: the wizard generates a `requestId` once per file
 * (stored on the batch with a unique index). A replay — a
 * double-click or a retry after a network error — redirects to
 * the stored batch instead of importing twice.
 *
 * `commitLeadImport` returns `{ error }` for validation failures
 * (so the wizard can show them inline) and redirects to the new
 * batch detail page on success.
 */

const GENERIC_ERROR = 'Unable to process the CSV file. Please try again.';
const EMPTY_CSV_ERROR = 'The CSV file is empty.';
const OVERSIZED_ERROR =
  'The CSV file is too large. Maximum allowed size is 5 MB.';
const NOT_ASSIGNABLE =
  'Selected marketing user is unavailable. Choose an active marketing user.';

/** Every field value the client may map onto, for validation. */
const KNOWN_FIELDS = new Set<string>(Object.values(LEAD_IMPORT_FIELDS));

/** Result shape returned by `commitLeadImport`. */
export interface LeadImportCommitState {
  /** Present when the import was rejected before any write. */
  error?: string;
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/**
 * Parse + structurally validate the JSON column mapping.
 * Unknown fields are dropped; invalid value types reject the
 * request.
 */
function parseMapping(raw: string): ColumnMapping | null {
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const mapping: ColumnMapping = {};
  for (const [key, value] of Object.entries(
    parsed as Record<string, unknown>
  )) {
    if (!KNOWN_FIELDS.has(key)) {
      continue;
    }
    if (value === null || typeof value === 'string') {
      mapping[key as LeadImportField] = value;
      continue;
    }
    return null;
  }
  return mapping;
}

/** Policy-aware summary for the preview + commit responses. */
function buildSummary(
  base: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    invalidRows: number;
    duplicateRows: number;
    rowsWithBothDuplicates: number;
  },
  policy: LeadDuplicatePolicy
): LeadImportSummary {
  const importable = base.validRows + base.warningRows;
  const skippedDuplicateRows =
    policy === LEAD_DUPLICATE_POLICIES.SKIP ? base.duplicateRows : 0;
  return {
    ...base,
    skippedDuplicateRows,
    willImport: Math.max(importable - skippedDuplicateRows, 0),
  };
}

/** Map a processed row to the client-facing preview row. */
function toPreviewRow(row: {
  rowNumber: number;
  name: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  serviceInterestText: string | null;
  estimatedBudget: number | null;
  currency: string | null;
  status: string;
  errors: string[];
  warnings: string[];
  duplicateLevel: string;
  duplicateMatches: Array<{ leadCode: string; matchType: 'email' | 'phone' }>;
}): LeadImportPreviewRow {
  return {
    rowNumber: row.rowNumber,
    name: row.name ?? '',
    companyName: row.companyName ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    serviceInterestText: row.serviceInterestText ?? '',
    estimatedBudget: row.estimatedBudget,
    currency: row.currency ?? '',
    status: row.status as LeadImportPreviewRow['status'],
    errors: row.errors,
    warnings: row.warnings,
    duplicateLevel: row.duplicateLevel as LeadImportPreviewRow['duplicateLevel'],
    duplicateMatches: row.duplicateMatches,
  };
}

/** Resolve display names for user ids in one query (no PII beyond names). */
async function resolveUserNames(
  userIds: Array<Types.ObjectId>
): Promise<Map<string, string>> {
  if (userIds.length === 0) {
    return new Map();
  }
  const users = await User.find({ _id: { $in: userIds } })
    .select('name')
    .lean();
  return new Map(users.map((user) => [user._id.toString(), user.name]));
}

/* ------------------------------------------------------------------ */
/* Preview                                                           */
/* ------------------------------------------------------------------ */

export interface LeadImportPreviewState extends LeadImportPreviewResult {
  /** Echoed so the wizard can show which file is being previewed. */
  fileName?: string;
}

/**
 * Parse + validate + de-duplicate an uploaded CSV (read-only).
 *
 * Called directly from the wizard (not via `useActionState`) so
 * the result can be held in component state. Only the first
 * `LEAD_IMPORT_PREVIEW_ROW_LIMIT` rows are returned — the
 * browser never receives thousands of rows.
 */
export async function previewLeadImport(
  formData: FormData
): Promise<LeadImportPreviewState> {
  await requireRole(USER_ROLES.ADMIN);

  const csvText = readString(formData, 'csvText');
  const fileName = readString(formData, 'fileName').slice(0, 255);
  const mapping = parseMapping(readString(formData, 'mapping'));

  if (!csvText.trim()) {
    return { ok: false, error: EMPTY_CSV_ERROR, fileName };
  }
  if (new TextEncoder().encode(csvText).length > LEAD_IMPORT_MAX_FILE_BYTES) {
    return { ok: false, error: OVERSIZED_ERROR, fileName };
  }
  if (!mapping) {
    return {
      ok: false,
      error: 'Invalid column mapping. Please re-upload the file.',
      fileName,
    };
  }

  const policy =
    readString(formData, 'duplicatePolicy') === LEAD_DUPLICATE_POLICIES.IMPORT
      ? LEAD_DUPLICATE_POLICIES.IMPORT
      : LEAD_DUPLICATE_POLICIES.SKIP;

  const result = await processImportFile(csvText, mapping);
  if (!result.ok) {
    return { ok: false, error: result.error, fileName };
  }

  return {
    ok: true,
    fileName,
    headers: result.headers,
    parseErrors: result.parseErrors,
    previewRows: result.rows
      .slice(0, LEAD_IMPORT_PREVIEW_ROW_LIMIT)
      .map(toPreviewRow),
    summary: buildSummary(result.summary, policy),
    rowIssues: result.rowIssues,
    duplicateRows: result.duplicateRows,
  };
}

/* ------------------------------------------------------------------ */
/* Commit                                                            */
/* ------------------------------------------------------------------ */

/**
 * Insert the importable rows of a previously previewed CSV.
 *
 * Re-runs the full server-side pipeline (the preview is never
 * trusted), resolves assignment targets against the database,
 * reserves a contiguous block of lead codes, and bulk-inserts in
 * chunks of `LEAD_IMPORT_INSERT_BATCH_SIZE`.
 *
 * Returns `{ error }` when the request is rejected before any
 * write; on success the caller is redirected to the new batch
 * detail page.
 */
export async function commitLeadImport(
  formData: FormData
): Promise<LeadImportCommitState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  const csvText = readString(formData, 'csvText');
  const fileName = readString(formData, 'fileName').slice(0, 255);
  const requestId = readString(formData, 'requestId').slice(0, 64);
  const mapping = parseMapping(readString(formData, 'mapping'));

  const defaultStatus = readString(formData, 'defaultStatus');
  const distributionMode = readString(
    formData,
    'distributionMode'
  ) as LeadDistributionMode;
  const assignedToUserId = readString(formData, 'assignedToUserId');
  const userIdsRaw = readString(formData, 'userIds');
  const duplicatePolicy =
    readString(formData, 'duplicatePolicy') === LEAD_DUPLICATE_POLICIES.IMPORT
      ? LEAD_DUPLICATE_POLICIES.IMPORT
      : LEAD_DUPLICATE_POLICIES.SKIP;

  if (!csvText.trim()) {
    return { error: EMPTY_CSV_ERROR };
  }
  if (!mapping) {
    return { error: 'Invalid column mapping. Please re-upload the file.' };
  }
  if (!requestId) {
    return {
      error: 'Missing import request id. Please start the import again.',
    };
  }
  if (!(defaultStatus in LEAD_STATUSES)) {
    return { error: 'Select a valid default lead status.' };
  }
  if (!Object.values(LEAD_DISTRIBUTION_MODES).includes(distributionMode)) {
    return { error: 'Select a valid assignment mode.' };
  }

  let userIds: string[] = [];
  if (userIdsRaw) {
    try {
      const parsed: unknown = JSON.parse(userIdsRaw);
      if (
        !Array.isArray(parsed) ||
        !parsed.every((id) => typeof id === 'string')
      ) {
        throw new Error('bad userIds');
      }
      userIds = parsed;
    } catch {
      return { error: 'Invalid marketing user selection.' };
    }
  }

  // Idempotency: check before the expensive pipeline. A replay of
  // the same requestId redirects to the stored batch.
  const existing = await LeadImport.findOne({ requestId })
    .select('_id')
    .lean();
  if (existing) {
    redirect(`/admin/crm/import/${existing._id.toString()}`);
  }

  // Re-run the authoritative pipeline.
  const processed = await processImportFile(csvText, mapping);
  if (!processed.ok) {
    return { error: processed.error ?? GENERIC_ERROR };
  }

  // Rows that survive validation. Duplicates are advisory: under
  // SKIP they are excluded from the write set and counted; under
  // IMPORT they are written.
  const importable = processed.rows.filter((row) => row.status !== 'INVALID');
  const toImport =
    duplicatePolicy === LEAD_DUPLICATE_POLICIES.SKIP
      ? importable.filter((row) => row.duplicateLevel === 'NO_DUPLICATE')
      : importable;

  if (toImport.length === 0) {
    return {
      error:
        'No rows to import. Every row failed validation or was skipped as a duplicate.',
    };
  }

  // Resolve assignment targets (validated against the database).
  let assigneeIds: Types.ObjectId[] = [];
  let assignments: Array<Types.ObjectId | null> = [];

  if (distributionMode === LEAD_DISTRIBUTION_MODES.SINGLE_USER) {
    const assignee = await resolveAssignableMarketingUser(assignedToUserId);
    if (!assignee) {
      return { error: NOT_ASSIGNABLE };
    }
    assigneeIds = [assignee];
    assignments = new Array(toImport.length).fill(assignee);
  } else if (distributionMode === LEAD_DISTRIBUTION_MODES.ROUND_ROBIN) {
    assigneeIds = await resolveAssignableMarketingUsers(userIds);
    if (assigneeIds.length === 0) {
      return {
        error: 'Select at least one active marketing user to distribute to.',
      };
    }
    const perRow = distributeRoundRobin(
      toImport.length,
      assigneeIds.map((id) => id.toString())
    );
    assignments = perRow.map((id) => new Types.ObjectId(id));
  } else {
    assignments = new Array(toImport.length).fill(null);
  }

  // Reserve the whole block of lead codes in one atomic operation,
  // and the batch's own import code from its own counter.
  const { start: leadStart } = await reserveSequenceRange(
    'lead',
    toImport.length
  );
  const importCode = await generateSequentialCode('import', 'IMP');

  const activeServices = await fetchActiveServiceMap();
  const actorId = new Types.ObjectId(actor.id);
  const now = new Date();

  // Create the batch record first so inserted rows can reference it.
  const batch = await LeadImport.create({
    importCode,
    requestId,
    fileName: fileName || 'import.csv',
    fileSizeBytes: new TextEncoder().encode(csvText).length,
    columnMapping: mapping,
    totalRows: processed.summary.totalRows,
    validRows: processed.summary.validRows,
    warningRows: processed.summary.warningRows,
    invalidRows: processed.summary.invalidRows,
    duplicateRows: processed.summary.duplicateRows,
    skippedDuplicateRows:
      duplicatePolicy === LEAD_DUPLICATE_POLICIES.SKIP
        ? processed.summary.duplicateRows
        : 0,
    importedRows: 0,
    status: LEAD_IMPORT_STATUSES.PROCESSING,
    defaultStatus,
    distributionMode,
    duplicatePolicy,
    defaultAssignedTo:
      distributionMode === LEAD_DISTRIBUTION_MODES.SINGLE_USER
        ? (assigneeIds[0] ?? null)
        : null,
    assignedUserIds: assigneeIds,
    createdBy: actorId,
  });

  // Build the insert documents.
  const documents = toImport.map((row, index) => {
    const { ids } = normalizeServiceInterest(
      row.serviceInterestText ?? '',
      activeServices
    );
    return {
      leadCode: formatSequentialCode('LEAD', leadStart + index),
      name: row.name,
      companyName: row.companyName,
      email: row.email,
      phone: row.phone,
      alternatePhone: row.alternatePhone,
      website: row.website,
      source: row.source ?? LEAD_SOURCES.CSV_IMPORT,
      serviceInterest: ids.map((id) => new Types.ObjectId(id)),
      estimatedBudget: row.estimatedBudget,
      currency: row.currency ?? DEFAULT_CURRENCY,
      status: defaultStatus as LeadStatus,
      assignedTo: assignments[index] ?? null,
      createdBy: actorId,
      updatedBy: actorId,
      statusChangedAt: now,
      notes: row.notes,
      importBatchId: batch._id,
    };
  });

  // Bulk insert in chunks, unordered so one unexpected failure
  // never aborts the rest (validation already ran).
  let importedCount = 0;
  for (
    let offset = 0;
    offset < documents.length;
    offset += LEAD_IMPORT_INSERT_BATCH_SIZE
  ) {
    const chunk = documents.slice(
      offset,
      offset + LEAD_IMPORT_INSERT_BATCH_SIZE
    );
    const ops = chunk.map((doc) => ({ insertOne: { document: doc } }));
    const result = await Lead.bulkWrite(ops, { ordered: false });
    importedCount += result.insertedCount;
  }

  const failedCount = toImport.length - importedCount;
  const finalStatus =
    failedCount === 0
      ? LEAD_IMPORT_STATUSES.COMPLETED
      : importedCount > 0
        ? LEAD_IMPORT_STATUSES.PARTIAL
        : LEAD_IMPORT_STATUSES.FAILED;

  await LeadImport.updateOne(
    { _id: batch._id },
    {
      $set: {
        importedRows: importedCount,
        status: finalStatus,
        completedAt: new Date(),
      },
    }
  );

  // Per-lead timeline entries for small imports only; larger
  // batches are covered by the LeadImport audit record itself.
  if (importedCount > 0 && importedCount <= LEAD_BULK_ACTIVITY_LIMIT) {
    const assigneeNames = await resolveUserNames(assigneeIds);
    for (const doc of documents) {
      // bulkWrite does not return the inserted _id; resolve the
      // lead by its (unique) code. Misses mean the insert failed.
      const created = await Lead.findOne({ leadCode: doc.leadCode })
        .select('_id')
        .lean();
      if (!created) {
        continue;
      }
      await createLeadSystemActivity({
        leadId: created._id,
        actorId,
        event: LEAD_ACTIVITY_EVENTS.LEAD_CREATED,
        summary: `Lead created by ${actor.name} via CSV import (${batch.importCode}).`,
        metadata: { leadCode: doc.leadCode, importCode: batch.importCode },
      });
      if (doc.assignedTo) {
        const assigneeName =
          assigneeNames.get(doc.assignedTo.toString()) ?? 'marketing user';
        await createLeadSystemActivity({
          leadId: created._id,
          actorId,
          event: LEAD_ACTIVITY_EVENTS.LEAD_ASSIGNED,
          summary: `Lead assigned to ${assigneeName} via CSV import.`,
          metadata: { importCode: batch.importCode },
        });
      }
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/crm');
  revalidatePath('/admin/crm/leads');
  revalidatePath('/admin/crm/import');

  redirect(`/admin/crm/import/${batch._id.toString()}`);
}
