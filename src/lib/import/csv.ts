import Papa from 'papaparse';

import {
  LEAD_IMPORT_FIELDS,
  LEAD_IMPORT_HEADER_ALIASES,
  LEAD_IMPORT_TEMPLATE_HEADERS,
  type LeadImportField,
} from '@/lib/constants/lead-import';
import type { CsvParseResult } from '@/types/lead-import';

/**
 * CSV parsing + column mapping helpers.
 *
 * Pure and isomorphic: papaparse runs in both Node and the
 * browser, so the same module backs the server-side import
 * pipeline (authoritative) and the client-side mapping UI.
 * Never mark this 'use client' or 'server-only'.
 */

/**
 * Normalize a CSV header for matching:
 * - trim, lowercase
 * - remove spaces, hyphens, underscores
 */
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s\-_]+/g, '');
}

/**
 * Parse a CSV text into headers + rows.
 *
 * Uses PapaParse with skipEmptyLines: 'greedy' so completely blank
 * lines are dropped. Returns the raw cells (strings) — no type
 * coercion.
 *
 * The first row is treated as the header. Duplicate/empty header
 * names are sanitised: empties become `__empty_N`, duplicates get
 * a `_N` suffix. This guarantees every column has a unique,
 * non-empty key for mapping.
 */
export function parseCsvText(text: string): CsvParseResult {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    // Preserve raw strings; we normalise later.
    dynamicTyping: false,
  });

  const parseErrors = result.errors.map(
    (error) => `Line ${error.row}: ${error.message}`
  );

  if (result.data.length === 0) {
    return {
      headers: [],
      rows: [],
      parseErrors,
      rowCount: 0,
    };
  }

  // First row = headers
  const rawHeaders = result.data[0];
  const seen = new Map<string, number>();
  const headers: string[] = [];

  for (const header of rawHeaders) {
    const base = String(header ?? '').trim();
    if (!base) {
      const index = (seen.get('__empty') ?? 0) + 1;
      seen.set('__empty', index);
      headers.push(`__empty_${index}`);
      continue;
    }
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    headers.push(count === 1 ? base : `${base}_${count}`);
  }

  // Data rows (skip header)
  const rows = result.data.slice(1);

  return {
    headers,
    rows,
    parseErrors,
    rowCount: rows.length,
  };
}

/**
 * Auto-map CSV headers to Arclivo lead fields.
 *
 * Returns a mapping object with every field present (null = ignore).
 * Matching is case/space/hyphen/underscore-insensitive against the
 * official template headers and the explicit aliases list.
 */
export function autoMapColumns(
  headers: string[]
): Record<LeadImportField, string | null> {
  const mapping = {} as Record<LeadImportField, string | null>;
  const fieldKeys = Object.values(LEAD_IMPORT_FIELDS);

  // Initialize with null
  for (const field of fieldKeys) {
    mapping[field] = null;
  }

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let matchedField: LeadImportField | null = null;

    // 1. Exact template header
    for (const field of fieldKeys) {
      if (normalizeHeader(LEAD_IMPORT_TEMPLATE_HEADERS[field]) === normalized) {
        matchedField = field;
        break;
      }
    }

    // 2. Explicit aliases
    if (!matchedField && LEAD_IMPORT_HEADER_ALIASES[normalized]) {
      matchedField = LEAD_IMPORT_HEADER_ALIASES[normalized];
    }

    if (matchedField && mapping[matchedField] === null) {
      mapping[matchedField] = header;
    }
    // If already mapped, leave the first match (template has priority).
  }

  return mapping;
}

/**
 * Validate a user-provided mapping before running validation.
 * Returns { ok, mapping, errors }.
 */
export function validateColumnMapping(
  headers: string[],
  mapping: Record<string, string | null>,
  requiredFields: readonly string[],
  contactFields: readonly string[]
): { ok: boolean; mapping: Record<string, string | null>; errors: string[] } {
  const errors: string[] = [];

  // Check that all mapped headers exist in the CSV
  for (const [field, header] of Object.entries(mapping)) {
    if (header !== null && !headers.includes(header)) {
      errors.push(`Field "${field}" maps to missing CSV column "${header}".`);
    }
  }

  // Required fields must be mapped
  for (const field of requiredFields) {
    if (!mapping[field]) {
      errors.push(`Required field "${field}" is not mapped.`);
    }
  }

  // At least one contact field must be mapped
  const contactMapped = contactFields.some((field) => mapping[field]);
  if (!contactMapped) {
    errors.push('At least one of email or phone must be mapped.');
  }

  return {
    ok: errors.length === 0,
    mapping,
    errors,
  };
}
