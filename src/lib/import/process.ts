import 'server-only';

import {
  LEAD_IMPORT_MAX_FILE_BYTES,
  LEAD_IMPORT_MAX_ROWS,
  LEAD_IMPORT_FIELD_ORDER,
  LEAD_IMPORT_REQUIRED_FIELDS,
  LEAD_IMPORT_CONTACT_FIELDS,
  type LeadImportField,
  type LeadImportRowStatus,
  type LeadDuplicateLevel,
} from '@/lib/constants/lead-import';
import { parseCsvText, validateColumnMapping } from './csv';
import {
  findInFileDuplicateLevels,
  combineDuplicateLevels,
} from './duplicates';
import {
  validateLeadImportRow,
  normalizeServiceInterest,
} from '@/lib/validations/lead-import';
import { findExistingLeadMatches } from '@/lib/queries/lead-import';
import { Service } from '@/models/Service';
import type { NormalizedLeadImportRow } from '@/types/lead-import';

export interface ProcessedImportRow extends NormalizedLeadImportRow {
  status: LeadImportRowStatus;
  errors: string[];
  warnings: string[];
  duplicateLevel: LeadDuplicateLevel;
  duplicateMatches: Array<{
    leadCode: string;
    matchType: 'email' | 'phone';
  }>;
}

export interface ImportProcessingResult {
  ok: boolean;
  error?: string;
  headers: string[];
  parseErrors: string[];
  rows: ProcessedImportRow[];
  summary: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    invalidRows: number;
    duplicateRows: number;
    rowsWithBothDuplicates: number;
  };
  /** Row number → error messages (invalid rows only). */
  rowIssues: Record<number, string[]>;
  /** Row number → duplicate info. */
  duplicateRows: Record<
    number,
    {
      level: LeadDuplicateLevel;
      matches: Array<{ leadCode: string; matchType: 'email' | 'phone' }>;
    }
  >;
}

/**
 * Fetch active services as a name(lowercase) → ObjectId map.
 */
export async function fetchActiveServiceMap(): Promise<Map<string, string>> {
  const services = await Service.find({ isActive: true })
    .select('_id name')
    .lean();

  const map = new Map<string, string>();
  for (const service of services) {
    map.set(service.name.toLowerCase(), service._id.toString());
  }
  return map;
}

/**
 * Build a Record<LeadImportField, string> from a parsed CSV row
 * using the validated mapping.
 */
function extractRowFields(
  cells: string[],
  headerIndex: Map<string, number>,
  mapping: Record<string, string | null>
): Record<LeadImportField, string> {
  const out = {} as Record<LeadImportField, string>;

  for (const field of LEAD_IMPORT_FIELD_ORDER) {
    const header = mapping[field];
    if (!header) {
      out[field] = '';
      continue;
    }
    const index = headerIndex.get(header);
    out[field] = index === undefined ? '' : String(cells[index] ?? '').trim();
  }

  return out;
}

/**
 * Parse, map, validate and de-duplicate an uploaded CSV.
 *
 * This is the single authoritative pipeline used by both the
 * preview and the commit actions — the client never supplies
 * pre-validated rows, it only supplies the raw file text and
 * the column mapping.
 */
export async function processImportFile(
  csvText: string,
  mapping: Record<string, string | null>
): Promise<ImportProcessingResult> {
  // File size guard (bytes, UTF-8 approximate).
  const byteLength = new TextEncoder().encode(csvText).length;
  if (byteLength > LEAD_IMPORT_MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `File is too large. Maximum allowed size is 5 MB.`,
      headers: [],
      parseErrors: [],
      rows: [],
      summary: {
        totalRows: 0,
        validRows: 0,
        warningRows: 0,
        invalidRows: 0,
        duplicateRows: 0,
        rowsWithBothDuplicates: 0,
      },
      rowIssues: {},
      duplicateRows: {},
    };
  }

  const parsed = parseCsvText(csvText);

  if (parsed.rowCount === 0) {
    return {
      ok: false,
      error: 'The CSV file contains no data rows.',
      headers: parsed.headers,
      parseErrors: parsed.parseErrors,
      rows: [],
      summary: {
        totalRows: 0,
        validRows: 0,
        warningRows: 0,
        invalidRows: 0,
        duplicateRows: 0,
        rowsWithBothDuplicates: 0,
      },
      rowIssues: {},
      duplicateRows: {},
    };
  }

  if (parsed.rowCount > LEAD_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `The CSV file contains ${parsed.rowCount} rows. The maximum per import is ${LEAD_IMPORT_MAX_ROWS.toLocaleString()} rows. Please split the file into smaller batches.`,
      headers: parsed.headers,
      parseErrors: parsed.parseErrors,
      rows: [],
      summary: {
        totalRows: parsed.rowCount,
        validRows: 0,
        warningRows: 0,
        invalidRows: 0,
        duplicateRows: 0,
        rowsWithBothDuplicates: 0,
      },
      rowIssues: {},
      duplicateRows: {},
    };
  }

  // Validate the mapping itself.
  const mappingCheck = validateColumnMapping(
    parsed.headers,
    mapping,
    LEAD_IMPORT_REQUIRED_FIELDS,
    LEAD_IMPORT_CONTACT_FIELDS
  );
  if (!mappingCheck.ok) {
    return {
      ok: false,
      error: mappingCheck.errors.join(' '),
      headers: parsed.headers,
      parseErrors: parsed.parseErrors,
      rows: [],
      summary: {
        totalRows: parsed.rowCount,
        validRows: 0,
        warningRows: 0,
        invalidRows: 0,
        duplicateRows: 0,
        rowsWithBothDuplicates: 0,
      },
      rowIssues: {},
      duplicateRows: {},
    };
  }

  const activeServices = await fetchActiveServiceMap();

  // Header → column index lookup.
  const headerIndex = new Map<string, number>();
  parsed.headers.forEach((header, index) => {
    headerIndex.set(header, index);
  });

  // Validate every row.
  const rows: ProcessedImportRow[] = [];
  const normalizedRows: NormalizedLeadImportRow[] = [];
  const rowIssues: Record<number, string[]> = {};

  for (let i = 0; i < parsed.rows.length; i++) {
    const cells = parsed.rows[i];
    const rowNumber = i + 1; // 1-based

    const rawFields = extractRowFields(cells, headerIndex, mappingCheck.mapping);

    const result = validateLeadImportRow(rawFields, rowNumber, activeServices);

    const originalCells = LEAD_IMPORT_FIELD_ORDER.map(
      (field) => rawFields[field] ?? ''
    );

    if (result.status === 'INVALID') {
      rowIssues[rowNumber] = result.errors;
    }

    const normalized: NormalizedLeadImportRow = {
      rowNumber,
      name: result.value?.name ?? null,
      companyName: result.value?.companyName ?? null,
      email: result.value?.email ?? null,
      phone: result.value?.phone ?? null,
      alternatePhone: result.value?.alternatePhone ?? null,
      website: result.value?.website ?? null,
      source: result.value?.source ?? null,
      serviceInterestText: result.value?.serviceInterestText ?? null,
      estimatedBudget: result.value?.estimatedBudget ?? null,
      currency: result.value?.currency ?? null,
      notes: result.value?.notes ?? null,
      originalCells,
    };

    normalizedRows.push(normalized);

    rows.push({
      ...normalized,
      status: result.status,
      errors: result.errors,
      warnings: result.warnings,
      duplicateLevel: 'NO_DUPLICATE', // filled below
      duplicateMatches: [],
    });
  }

  // In-file duplicate detection — only rows that can actually be
  // imported participate, so the counts line up with the policy.
  const importableRowNumbers = new Set(
    rows.filter((row) => row.status !== 'INVALID').map((row) => row.rowNumber)
  );
  const importableNormalized = normalizedRows.filter((row) =>
    importableRowNumbers.has(row.rowNumber)
  );

  const inFileLevels = findInFileDuplicateLevels(importableNormalized);

  // Existing-lead duplicate detection (advisory).
  const emails = [
    ...new Set(
      importableNormalized
        .map((r) => r.email)
        .filter((e): e is string => Boolean(e))
    ),
  ];
  const phones = [
    ...new Set(
      importableNormalized
        .map((r) => r.phone)
        .filter((p): p is string => Boolean(p))
    ),
  ];
  const { emailMatches, phoneMatches } = await findExistingLeadMatches(
    emails,
    phones
  );

  // Combine duplicate levels.
  const combined = combineDuplicateLevels(
    importableNormalized,
    inFileLevels,
    emailMatches,
    phoneMatches
  );

  const duplicateRows: ImportProcessingResult['duplicateRows'] = {};
  let duplicateCount = 0;
  let bothDuplicates = 0;

  for (const row of rows) {
    const info = combined.get(row.rowNumber) ?? {
      level: 'NO_DUPLICATE' as LeadDuplicateLevel,
      matches: [],
    };
    row.duplicateLevel = info.level;
    row.duplicateMatches = info.matches;

    if (info.level !== 'NO_DUPLICATE') {
      duplicateRows[row.rowNumber] = {
        level: info.level,
        matches: info.matches,
      };
      duplicateCount++;
    }
    if (
      info.level === 'EXISTING_LEAD' &&
      inFileLevels.get(row.rowNumber) === 'DUPLICATE_IN_FILE'
    ) {
      bothDuplicates++;
    }
  }

  // Summary counts.
  let validRows = 0;
  let warningRows = 0;
  let invalidRows = 0;
  for (const row of rows) {
    if (row.status === 'VALID') validRows++;
    else if (row.status === 'WARNING') warningRows++;
    else invalidRows++;
  }

  return {
    ok: true,
    headers: parsed.headers,
    parseErrors: parsed.parseErrors,
    rows,
    summary: {
      totalRows: rows.length,
      validRows,
      warningRows,
      invalidRows,
      duplicateRows: duplicateCount,
      rowsWithBothDuplicates: bothDuplicates,
    },
    rowIssues,
    duplicateRows,
  };
}

/**
 * Resolve service interest text into Service ObjectIds.
 * Re-exported for the commit action.
 */
export { normalizeServiceInterest };