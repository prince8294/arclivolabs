import { z } from 'zod';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Deliberately country-agnostic: allows an optional leading "+" plus digits
// and common separators (spaces, hyphens, dots, parentheses) so that clients
// and staff from any region can be stored without reformatting.
const PHONE_PATTERN = /^\+?[0-9\s\-().]{5,19}$/;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function isPhone(value: string): boolean {
  return value.length <= 20 && PHONE_PATTERN.test(value);
}

export function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a user-typed website to a canonical absolute http(s) URL.
 *
 * Accepts a bare host like `example.com` (very common in a CRM form) and
 * returns '' when the input cannot be a web address — so the caller only
 * ever stores a value that will render as a working link. Kept in one
 * place so every form normalizes identically.
 */
export function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  // Only add a scheme when the input has none; reject other schemes
  // (javascript:, data:, ...) outright.
  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    return url.toString();
  } catch {
    return '';
  }
}

export function hasLength(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

/**
 * Extract the first error message per named top-level field from a zod
 * failure. Used by server actions to feed inline field errors back to
 * forms without leaking raw schema internals.
 */
export function zodFieldErrors(
  error: { issues: Array<{ path: PropertyKey[]; message: string }> },
  fields: readonly string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const issue = error.issues.find((item) => item.path[0] === field);
    if (issue) {
      out[field] = issue.message;
    }
  }
  return out;
}

/**
 * Narrow a submitted string to one of the values of a domain const object.
 *
 * Mongoose enums and browser inputs must never diverge, so every payload
 * that carries a domain value goes through this instead of `z.enum()` on a
 * hand-written string union.
 */
export function enumField<T extends Record<string, string>>(
  values: T,
  message: string
): z.ZodType<T[keyof T]>;
export function enumField<T extends readonly string[]>(
  values: T,
  message: string
): z.ZodType<T[number]>;
export function enumField(
  values: Record<string, string> | readonly string[],
  message: string
): z.ZodType<string> {
  const allowed = Object.values(values) as string[];
  return z
    .string()
    .refine((value) => allowed.includes(value), { message }) as unknown as z.ZodType<string>;
}
