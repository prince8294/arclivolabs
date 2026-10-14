import type { LeadDuplicateLevel } from '@/lib/constants/lead-import';
import type { NormalizedLeadImportRow } from '@/types/lead-import';

/**
 * Strip everything except digits from a phone string.
 * Leading '+' is removed so "+91 99999 99999" and "919999999999" match.
 */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Normalise email for duplicate matching: lowercase + trim.
 */
function normEmail(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return v || null;
}

/**
 * Normalise phone for duplicate matching: digits only, minimum 7 digits
 * to avoid false positives on very short numbers.
 */
function normPhone(value: string | null): string | null {
  if (!value) return null;
  const d = digitsOnly(value);
  return d.length >= 7 ? d : null;
}

/**
 * Detect duplicate rows *within the same file*.
 *
 * Returns a Map of rowNumber (1-based) → LeadDuplicateLevel. A row can
 * be flagged for matching both an email and a phone; it gets the higher
 * level (EXISTING_LEAD > DUPLICATE_IN_FILE > NO_DUPLICATE).
 *
 * Only VALID/WARNING rows are checked — INVALID rows don't participate.
 */
export function findInFileDuplicateLevels(
  rows: NormalizedLeadImportRow[]
): Map<number, LeadDuplicateLevel> {
  const levels = new Map<number, LeadDuplicateLevel>();
  const emailIndex = new Map<string, number[]>(); // email → rowNumbers
  const phoneIndex = new Map<string, number[]>(); // phone digits → rowNumbers

  // First pass: index
  for (const row of rows) {
    const e = normEmail(row.email);
    const p = normPhone(row.phone);

    if (e) {
      const arr = emailIndex.get(e) ?? [];
      arr.push(row.rowNumber);
      emailIndex.set(e, arr);
    }
    if (p) {
      const arr = phoneIndex.get(p) ?? [];
      arr.push(row.rowNumber);
      phoneIndex.set(p, arr);
    }
  }

  // Second pass: flag
  for (const row of rows) {
    let level: LeadDuplicateLevel = 'NO_DUPLICATE';

    const e = normEmail(row.email);
    const p = normPhone(row.phone);

    if (e) {
      const matches = emailIndex.get(e) ?? [];
      if (matches.length > 1) {
        level = 'DUPLICATE_IN_FILE';
      }
    }
    if (p) {
      const matches = phoneIndex.get(p) ?? [];
      if (matches.length > 1) {
        level = 'DUPLICATE_IN_FILE';
      }
    }

    levels.set(row.rowNumber, level);
  }

  return levels;
}

/**
 * Given the in-file duplicate levels + a map of existing DB matches
 * (email → leadCode, phone → leadCode), compute the final duplicate
 * level and the match details for each row.
 */
export function combineDuplicateLevels(
  rows: NormalizedLeadImportRow[],
  inFileLevels: Map<number, LeadDuplicateLevel>,
  existingEmailMatches: Map<string, string[]>,
  existingPhoneMatches: Map<string, string[]>
): Map<number, { level: LeadDuplicateLevel; matches: { leadCode: string; matchType: 'email' | 'phone' }[] }> {
  const result = new Map<number, { level: LeadDuplicateLevel; matches: { leadCode: string; matchType: 'email' | 'phone' }[] }>();

  for (const row of rows) {
    const matches: { leadCode: string; matchType: 'email' | 'phone' }[] = [];
    let finalLevel: LeadDuplicateLevel = 'NO_DUPLICATE';

    const inFileLevel = inFileLevels.get(row.rowNumber) ?? 'NO_DUPLICATE';

    const e = normEmail(row.email);
    const p = normPhone(row.phone);

    if (e) {
      const dbMatches = existingEmailMatches.get(e) ?? [];
      for (const leadCode of dbMatches) {
        matches.push({ leadCode, matchType: 'email' });
      }
      if (dbMatches.length > 0) {
        finalLevel = 'EXISTING_LEAD';
      }
    }
    if (p) {
      const dbMatches = existingPhoneMatches.get(p) ?? [];
      for (const leadCode of dbMatches) {
        matches.push({ leadCode, matchType: 'phone' });
      }
      if (dbMatches.length > 0 && finalLevel !== 'EXISTING_LEAD') {
        finalLevel = 'EXISTING_LEAD';
      }
    }

    if (inFileLevel === 'DUPLICATE_IN_FILE' && finalLevel === 'NO_DUPLICATE') {
      finalLevel = 'DUPLICATE_IN_FILE';
    }
    // If both EXISTING_LEAD and DUPLICATE_IN_FILE, EXISTING_LEAD wins.

    result.set(row.rowNumber, { level: finalLevel, matches });
  }

  return result;
}