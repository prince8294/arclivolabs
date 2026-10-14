/**
 * Display-only formatting helpers. Pure functions, safe in server and
 * client components.
 */

const DATE_FORMAT = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
const DATETIME_FORMAT = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** "14 Jan 2026" — or "—" when the value is missing. */
export function formatDate(value?: Date | string | number | null): string {
  if (!value) {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return DATE_FORMAT.format(date);
}

/** "14 Jan 2026, 3:42 pm" — or "—" when the value is missing. */
export function formatDateTime(value?: Date | string | number | null): string {
  if (!value) {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return DATETIME_FORMAT.format(date);
}

/**
 * "₹45,000" style formatting for a non-negative amount in the given
 * ISO-4217 currency. Falls back to a plain "INR 45,000" when the
 * runtime does not know the currency.
 */
export function formatMoney(amount: number, currency: string): string {
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
