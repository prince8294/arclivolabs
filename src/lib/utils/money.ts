/**
 * Decimal-safe money helpers.
 *
 * Money is never manipulated as a floating point decimal. Every
 * commercial calculation (Proposal, ProposalVersion, Deal and, later,
 * Invoice/Receipt) converts an entered amount into integer MINOR UNITS
 * (paise, cents) first, does all arithmetic in integers, and converts
 * back only for display.
 *
 * This is the single source of truth for the money representation used by
 * Part 9, so Proposal, Deal and future billing modules cannot drift apart:
 * persisted amounts are always integers in minor units and the currency
 * code travels next to them.
 *
 * Pure module: no server-only import, so client components can format
 * values for optimistic previews. Server actions NEVER trust a total that
 * came from the browser - they re-run `computePricing` on the stored
 * inputs (see `src/lib/proposals/pricing.ts`).
 */

/** Decimal places used by each supported currency (ISO-4217 exponent). */
export const CURRENCY_DECIMALS: Record<string, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  SGD: 2,
  AUD: 2,
  CAD: 2,
};

/** Fallback exponent for a currency code outside the table above. */
const DEFAULT_CURRENCY_DECIMALS = 2;

/** Number of minor units in one major unit, e.g. 100 for INR. */
export function minorUnitFactor(currency: string): number {
  const decimals =
    CURRENCY_DECIMALS[currency?.toUpperCase?.()] ?? DEFAULT_CURRENCY_DECIMALS;
  return 10 ** decimals;
}

/**
 * Convert a human-entered major-unit amount into integer minor units.
 *
 * Rejects non-finite values and amounts beyond 100 million major units
 * (far beyond any real agency engagement, and it keeps the integer
 * arithmetic comfortably inside the safe-integer range).
 */
export function toMinorUnits(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }
  const factor = minorUnitFactor(currency);
  const rounded = Math.round(amount * factor);
  // `Math.round` on a negative .5 rounds toward +Infinity; make the
  // behaviour symmetric so a discount never silently gains a unit.
  const corrected =
    amount < 0 && rounded > amount * factor ? rounded - 1 : rounded;
  return corrected;
}

/** Convert integer minor units back to a major-unit decimal. */
export function fromMinorUnits(minor: number, currency: string): number {
  if (!Number.isFinite(minor)) {
    return 0;
  }
  return minor / minorUnitFactor(currency);
}

/**
 * Parse a value that arrived from the browser.
 *
 * Form inputs are strings; anything unparseable becomes 0 so a garbage
 * value can never poison a total. Callers that need "this must be a real
 * number" semantics validate with the Zod schemas first.
 */
export function parseAmount(value: FormDataEntryValue | null): number {
  if (typeof value !== 'string') {
    return 0;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Format integer minor units for display using the project's shared
 * `formatMoney` (Indian digit grouping for INR). Returns an em dash when
 * the value is missing so tables stay aligned.
 */
export function formatMinor(minor: number | null | undefined, currency: string): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) {
    return '—';
  }
  return formatMoneyInternal(fromMinorUnits(minor, currency), currency);
}

/**
 * Local copy of the display formatter.
 *
 * `formatMoney` in `@/lib/utils/format` is the canonical helper, but
 * importing it here would create a cycle risk for the future Invoice
 * module (format -> money -> format). The behaviour is identical and the
 * two are asserted to agree by the smoke script in `scripts/`.
 */
function formatMoneyInternal(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/**
 * Round a percentage to minor units, half-up.
 * `applyPercentage(minor, 18)` -> 18% of `minor`, in minor units.
 */
export function applyPercentage(minor: number, percentage: number): number {
  if (!Number.isFinite(minor) || !Number.isFinite(percentage)) {
    return 0;
  }
  return Math.round((minor * percentage) / 100);
}