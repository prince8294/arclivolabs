import 'server-only';

import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import {
  type LeadDuplicatePolicy,
  type LeadImportStatus,
} from '@/lib/constants/lead-import';
import { LeadImport } from '@/models/LeadImport';
import { Lead } from '@/models/Lead';

export interface LeadImportHistoryItem {
  id: string;
  importCode: string;
  fileName: string;
  status: LeadImportStatus;
  totalRows: number;
  validRows: number;
  warningRows: number;
  importedRows: number;
  skippedDuplicateRows: number;
  invalidRows: number;
  duplicateRows: number;
  createdBy: string;
  createdAt: Date;
  completedAt: Date | null;
  assignmentMode: string;
  assignedUserIds: string[];
}

export interface LeadImportDetail extends LeadImportHistoryItem {
  requestId: string;
  fileSizeBytes: number;
  duplicatePolicy: LeadDuplicatePolicy;
  defaultStatus: string;
  columnMapping: Record<string, string | null>;
  errorMessage: string | null;
}

/** Shape of the populated `createdBy` reference. */
interface PopulatedCreator {
  name?: string;
}

function creatorName(doc: { createdBy: unknown }): string {
  const creator = doc.createdBy as PopulatedCreator | null;
  return creator?.name ?? 'Unknown';
}

/**
 * List recent import batches for the history table.
 */
export async function listRecentLeadImports(
  limit = 20
): Promise<LeadImportHistoryItem[]> {
  await connectDB();

  const docs = await LeadImport.find({})
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    importCode: doc.importCode,
    fileName: doc.fileName,
    status: doc.status,
    totalRows: doc.totalRows,
    validRows: doc.validRows,
    warningRows: doc.warningRows,
    importedRows: doc.importedRows,
    skippedDuplicateRows: doc.skippedDuplicateRows,
    invalidRows: doc.invalidRows,
    duplicateRows: doc.duplicateRows,
    createdBy: creatorName(doc),
    createdAt: doc.createdAt,
    completedAt: doc.completedAt ?? null,
    assignmentMode: doc.distributionMode,
    assignedUserIds: doc.assignedUserIds.map((id: Types.ObjectId) =>
      id.toString()
    ),
  }));
}

/**
 * Get a single import batch by ID.
 */
export async function getLeadImportDetail(
  id: string
): Promise<LeadImportDetail | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  await connectDB();

  const doc = await LeadImport.findById(id)
    .populate('createdBy', 'name')
    .lean();

  if (!doc) {
    return null;
  }

  return {
    id: doc._id.toString(),
    requestId: doc.requestId,
    importCode: doc.importCode,
    fileName: doc.fileName,
    fileSizeBytes: doc.fileSizeBytes,
    status: doc.status,
    totalRows: doc.totalRows,
    validRows: doc.validRows,
    warningRows: doc.warningRows,
    importedRows: doc.importedRows,
    skippedDuplicateRows: doc.skippedDuplicateRows,
    invalidRows: doc.invalidRows,
    duplicateRows: doc.duplicateRows,
    createdBy: creatorName(doc),
    createdAt: doc.createdAt,
    completedAt: doc.completedAt ?? null,
    assignmentMode: doc.distributionMode,
    duplicatePolicy: doc.duplicatePolicy,
    defaultStatus: doc.defaultStatus,
    columnMapping: (doc.columnMapping as Record<string, string | null>) ?? {},
    errorMessage: doc.errorMessage ?? null,
    assignedUserIds: doc.assignedUserIds.map((id: Types.ObjectId) =>
      id.toString()
    ),
  };
}

/**
 * Find existing leads matching the given emails/phones.
 * Returns maps for quick lookup: email → leadCode(s), phone → leadCode(s).
 *
 * Uses chunked `$in` queries so a large file costs a handful of
 * round trips instead of one per row.
 */
export async function findExistingLeadMatches(
  emails: string[],
  phones: string[]
): Promise<{
  emailMatches: Map<string, string[]>;
  phoneMatches: Map<string, string[]>;
}> {
  await connectDB();

  const emailMatches = new Map<string, string[]>();
  const phoneMatches = new Map<string, string[]>();

  const CHUNK_SIZE = 500;

  for (let offset = 0; offset < emails.length; offset += CHUNK_SIZE) {
    const chunk = emails.slice(offset, offset + CHUNK_SIZE);
    const leads = await Lead.find({ email: { $in: chunk } })
      .select('leadCode email')
      .lean();
    for (const lead of leads) {
      if (!lead.email) continue;
      const codes = emailMatches.get(lead.email) ?? [];
      codes.push(lead.leadCode);
      emailMatches.set(lead.email, codes);
    }
  }

  for (let offset = 0; offset < phones.length; offset += CHUNK_SIZE) {
    const chunk = phones.slice(offset, offset + CHUNK_SIZE);
    const leads = await Lead.find({ phone: { $in: chunk } })
      .select('leadCode phone')
      .lean();
    for (const lead of leads) {
      if (!lead.phone) continue;
      const codes = phoneMatches.get(lead.phone) ?? [];
      codes.push(lead.leadCode);
      phoneMatches.set(lead.phone, codes);
    }
  }

  return { emailMatches, phoneMatches };
}

/**
 * Count leads created by a given import batch.
 */
export async function countLeadsByImportBatch(
  importBatchId: string
): Promise<number> {
  if (!Types.ObjectId.isValid(importBatchId)) {
    return 0;
  }
  await connectDB();
  return Lead.countDocuments({ importBatchId: new Types.ObjectId(importBatchId) });
}

/**
 * Leads created by a CSV import since the start of the
 * current month (local time). Used by the CRM overview.
 */
export async function countImportedLeadsThisMonth(): Promise<number> {
  await connectDB();
  const now = new Date();
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );
  return Lead.countDocuments({
    importBatchId: { $ne: null },
    createdAt: { $gte: startOfMonth },
  });
}
