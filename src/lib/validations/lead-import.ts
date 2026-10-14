import { z } from 'zod';

import {
  CURRENCIES,
  LEAD_SOURCES,
} from '@/lib/constants/enums';
import {
  LEAD_IMPORT_FIELDS,
  type LeadImportField,
  LEAD_DUPLICATE_POLICIES,
  LEAD_DISTRIBUTION_MODES,
} from '@/lib/constants/lead-import';
import {
  nameSchema,
  companyNameSchema,
  emailSchema,
  phoneSchema,
  websiteSchema,
  currencySchema,
  notesSchema,
} from './lead';

/**
 * Budget normalization for CSV import.
 *
 * The CSV may contain values like "25000", "25000.00", "₹25,000",
 * "25,000", "INR 25000". We attempt a safe normalization:
 * - Trim
 * - Remove known currency symbols (₹, $, €, £) and codes (INR, USD, EUR, GBP, AED, SGD, AUD, CAD)
 * - Remove spaces
 * - If commas are present, only accept them as thousand separators
 *   (pattern: 1,000 or 1,000,000 etc.)
 * - Otherwise reject ambiguous values like "25,000 INR approx"
 *
 * Returns { value: number | null, warning: string | null }.
 * Null value = blank/optional. Warning = non-fatal issue shown in preview.
 */
export function normalizeBudgetInput(raw: string): { value: number | null; warning: string | null } {
  if (!raw || !raw.trim()) {
    return { value: null, warning: null };
  }

  let v = raw.trim();

  // Remove known currency symbols
  v = v.replace(/^[€$£₹]\s*/, '');

  // Remove leading currency code (e.g., "INR 25000", "USD 100")
  const currencyCodes = CURRENCIES.join('|');
  const codeRegex = new RegExp(`^(${currencyCodes})\\s+`, 'i');
  v = v.replace(codeRegex, '');

  // Remove trailing currency code (e.g., "25000 INR")
  const trailingCodeRegex = new RegExp(`\\s+(${currencyCodes})$`, 'i');
  v = v.replace(trailingCodeRegex, '');

  // Remove remaining spaces
  v = v.replace(/\s+/g, '');

  if (!v) {
    return { value: null, warning: 'Currency-only value, budget left blank.' };
  }

  // Check for thousand separators
  const hasCommas = v.includes(',');
  if (hasCommas) {
    // Valid thousand grouping: 1,000 | 10,000 | 1,000,000 | 1,000.00 | etc.
    // Not valid: "1,2", "1,23", "1,,000", "1,000,"
    const validThousands = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(v);
    if (!validThousands) {
      return { value: null, warning: `Invalid budget format: "${raw}". Commas must be thousand separators.` };
    }
    v = v.replace(/,/g, '');
  }

  // Now must be a plain non-negative number
  const parsed = Number(v);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: null, warning: `Invalid budget: "${raw}".` };
  }

  // Accept up to 2 decimal places (currency convention)
  if (!/^\d+(\.\d{1,2})?$/.test(v)) {
    return { value: null, warning: `Budget has more than 2 decimal places: "${raw}".` };
  }

  return { value: parsed, warning: null };
}

/**
 * Normalize a service interest text from CSV into Service ObjectIds.
 *
 * The CSV cell may contain multiple services separated by ; | or newline.
 * Each part is matched case-insensitively against active Service names.
 * Unknown names produce a warning but don't block the row.
 */
export function normalizeServiceInterest(
  raw: string,
  activeServices: Map<string, string> // name (lowercased) → id
): { ids: string[]; warnings: string[] } {
  if (!raw || !raw.trim()) {
    return { ids: [], warnings: [] };
  }

  const warnings: string[] = [];
  const parts = raw.split(/[;|\n]+/).map((p) => p.trim()).filter(Boolean);
  const ids: string[] = [];

  for (const part of parts) {
    const match = activeServices.get(part.toLowerCase());
    if (match) {
      ids.push(match);
    } else {
      warnings.push(`Unknown service: "${part}" (not in active catalogue).`);
    }
  }

  return { ids, warnings };
}

/**
 * Build the CSV row validation schema.
 *
 * Unlike the form schemas, this operates on already-extracted string
 * values (not FormData). It produces a NormalizedLeadImportRow plus
 * errors/warnings.
 */
export const leadImportRowSchema = z.object({
  name: nameSchema,
  companyName: companyNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  alternatePhone: phoneSchema,
  website: websiteSchema,
  // source is validated against LEAD_SOURCES but falls back to CSV_IMPORT
  source: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v.toUpperCase()))
    .refine((v) => v === null || Object.values(LEAD_SOURCES).includes(v as (typeof LEAD_SOURCES)[keyof typeof LEAD_SOURCES]), {
      message: 'Invalid lead source.',
    })
    .optional()
    .nullable(),
  // serviceInterest as free text (resolved separately)
  serviceInterestText: z.string().trim().max(500).optional().nullable(),
  // budget with CSV-friendly normalization (handled manually)
  estimatedBudgetRaw: z.string().trim().optional().nullable(),
  currency: currencySchema.optional().nullable(),
  notes: notesSchema,
});

export type LeadImportRowInput = z.infer<typeof leadImportRowSchema>;

/**
 * Validate a single mapped CSV row.
 *
 * Returns a detailed result with status, errors, warnings, the normalized
 * value, and duplicate level (filled in later).
 */
export function validateLeadImportRow(
  raw: Record<LeadImportField, string>,
  rowNumber: number,
  activeServices: Map<string, string>
): {
  rowNumber: number;
  status: 'VALID' | 'WARNING' | 'INVALID';
  errors: string[];
  warnings: string[];
  value: {
    name: string | null;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    alternatePhone: string | null;
    website: string | null;
    source: string | null;
    serviceInterestText: string | null;
    estimatedBudget: number | null;
    currency: string | null;
    notes: string | null;
  } | null;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract using the template field order
  const get = (field: LeadImportField) => raw[field] ?? '';

  const name = get(LEAD_IMPORT_FIELDS.NAME);
  const companyName = get(LEAD_IMPORT_FIELDS.COMPANY_NAME);
  const email = get(LEAD_IMPORT_FIELDS.EMAIL);
  const phone = get(LEAD_IMPORT_FIELDS.PHONE);
  const alternatePhone = get(LEAD_IMPORT_FIELDS.ALTERNATE_PHONE);
  const website = get(LEAD_IMPORT_FIELDS.WEBSITE);
  const source = get(LEAD_IMPORT_FIELDS.SOURCE);
  const serviceInterestText = get(LEAD_IMPORT_FIELDS.SERVICE_INTEREST);
  const estimatedBudgetRaw = get(LEAD_IMPORT_FIELDS.ESTIMATED_BUDGET);
  const currency = get(LEAD_IMPORT_FIELDS.CURRENCY);
  const notes = get(LEAD_IMPORT_FIELDS.NOTES);

  // Required: name
  if (!name || !name.trim()) {
    errors.push('Contact name is required.');
  }

  // At least email or phone
  const hasEmail = email && email.trim() && emailSchema.safeParse(email).success;
  const hasPhone = phone && phone.trim() && phoneSchema.safeParse(phone).success;
  if (!hasEmail && !hasPhone) {
    errors.push('Provide at least an email address or phone number.');
  }

  // Validate each field using the shared schemas
  const parsedName = nameSchema.safeParse(name);
  if (!parsedName.success) {
    errors.push(parsedName.error.issues[0]?.message ?? 'Invalid name.');
  }

  const parsedCompany = companyNameSchema.safeParse(companyName);
  if (!parsedCompany.success) {
    errors.push(parsedCompany.error.issues[0]?.message ?? 'Invalid company name.');
  }

  const parsedEmail = emailSchema.safeParse(email);
  if (email && email.trim() && !parsedEmail.success) {
    errors.push(parsedEmail.error.issues[0]?.message ?? 'Invalid email.');
  }

  const parsedPhone = phoneSchema.safeParse(phone);
  if (phone && phone.trim() && !parsedPhone.success) {
    errors.push(parsedPhone.error.issues[0]?.message ?? 'Invalid phone.');
  }

  const parsedAltPhone = phoneSchema.safeParse(alternatePhone);
  if (alternatePhone && alternatePhone.trim() && !parsedAltPhone.success) {
    errors.push(parsedAltPhone.error.issues[0]?.message ?? 'Invalid alternate phone.');
  }

  const parsedWebsite = websiteSchema.safeParse(website);
  if (website && website.trim() && !parsedWebsite.success) {
    errors.push(parsedWebsite.error.issues[0]?.message ?? 'Invalid website.');
  }

  const parsedCurrency = currencySchema.safeParse(currency);
  if (currency && currency.trim() && !parsedCurrency.success) {
    // Unsupported currency: warning + default
    warnings.push(`Unsupported currency "${currency}" — defaulting to INR.`);
  }

  const parsedNotes = notesSchema.safeParse(notes);
  if (!parsedNotes.success) {
    errors.push(parsedNotes.error.issues[0]?.message ?? 'Invalid notes.');
  }

  // Budget: CSV-friendly normalization
  const { value: budgetValue, warning: budgetWarning } = normalizeBudgetInput(estimatedBudgetRaw);
  if (budgetWarning) {
    warnings.push(budgetWarning);
  }

  // Service interest: resolve against active services to
  // surface unknown names as warnings. The actual Service
  // references are resolved again at commit time against
  // the live catalogue.
  if (serviceInterestText && serviceInterestText.trim()) {
    const { warnings: svcWarnings } = normalizeServiceInterest(
      serviceInterestText,
      activeServices
    );
    warnings.push(...svcWarnings);
  }

  // Source: if not provided or invalid, default to CSV_IMPORT (warning)
  let finalSource: string | null = source?.trim().toUpperCase() ?? null;
  if (finalSource && !Object.values(LEAD_SOURCES).includes(finalSource as (typeof LEAD_SOURCES)[keyof typeof LEAD_SOURCES])) {
    warnings.push(`Unknown source "${source}" — defaulting to CSV_IMPORT.`);
    finalSource = null;
  }

  if (errors.length > 0) {
    return {
      rowNumber,
      status: 'INVALID',
      errors,
      warnings,
      value: null,
    };
  }

  const status = warnings.length > 0 ? 'WARNING' : 'VALID';

  return {
    rowNumber,
    status,
    errors,
    warnings,
    value: {
      name: parsedName.data ?? null,
      companyName: parsedCompany.data ?? null,
      email: parsedEmail.data ?? null,
      phone: parsedPhone.data ?? null,
      alternatePhone: parsedAltPhone.data ?? null,
      website: parsedWebsite.data ?? null,
      source: finalSource,
      serviceInterestText: serviceInterestText ?? null,
      estimatedBudget: budgetValue,
      currency: parsedCurrency.success ? parsedCurrency.data : 'INR',
      notes: parsedNotes.data ?? null,
    },
  };
}

/**
 * Schema for the commit request payload.
 */
export const leadImportCommitSchema = z.object({
  requestId: z.string().min(8).max(64),
  mapping: z.record(z.string(), z.string().nullable()),
  assignmentMode: z.enum([
    LEAD_DISTRIBUTION_MODES.UNASSIGNED,
    LEAD_DISTRIBUTION_MODES.SINGLE_USER,
    LEAD_DISTRIBUTION_MODES.ROUND_ROBIN,
  ]),
  assignedToUserId: z.string().optional().nullable(),
  userIds: z.array(z.string()).optional().nullable(),
  defaultStatus: z.enum([
    'NEW',
    'CONTACTED',
    'INTERESTED',
    'MEETING',
    'PROPOSAL_SENT',
    'NEGOTIATION',
    'WON',
    'LOST',
  ]).default('NEW'),
  duplicatePolicy: z.enum([
    LEAD_DUPLICATE_POLICIES.SKIP,
    LEAD_DUPLICATE_POLICIES.IMPORT,
  ]).default(LEAD_DUPLICATE_POLICIES.SKIP),
});

export type LeadImportCommitInput = z.infer<typeof leadImportCommitSchema>;
