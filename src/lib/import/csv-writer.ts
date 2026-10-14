/**
 * CSV writing helpers with spreadsheet formula-injection
 * protection.
 *
 * `buildCsv` and `escapeFormula` are pure and run on both the
 * server (template/invalid-row generation) and the client
 * (invalid-row download). `downloadCsv` touches `document` and
 * is only ever called from a client component.
 */

/**
 * Build a CSV string from rows with formula-injection protection.
 *
 * Spreadsheet applications (Excel, Google Sheets, LibreOffice) execute
 * formulas when a cell starts with `=`, `+`, `-`, or `@`. A malicious or
 * accidental value like `=cmd|'/C calc'!A0` or `@SUM(A1:A10)` can run
 * arbitrary code or leak data when the CSV is opened.
 *
 * This function prefixes any such cell with a single quote (`'`) so it is
 * treated as literal text by all major spreadsheet apps. The quote is
 * stripped on import by those apps, so the visible value is unchanged.
 *
 * The escaping is applied to EVERY cell value (not just headers) to be
 * safe. This is a small overhead but eliminates the attack surface.
 */
export function escapeFormula(value: string): string {
  if (!value) return value;
  const first = value.charAt(0);
  if (first === '=' || first === '+' || first === '-' || first === '@') {
    return `'` + value;
  }
  return value;
}

/**
 * Convert an array of objects to CSV with RFC 4180 quoting.
 *
 * - Fields containing commas, double quotes, or newlines are wrapped in
 *   double quotes and internal double quotes are doubled.
 * - Formula injection protection is applied to every cell.
 * - Headers are taken from the `headers` array in order.
 */
export function buildCsv(
  rows: Record<string, unknown>[],
  headers: string[]
): string {
  const lines: string[] = [];

  // Header row
  lines.push(
    headers
      .map((h) => escapeFormula(String(h)))
      .map((v) => (v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v))
      .join(',')
  );

  for (const row of rows) {
    const cells = headers.map((h) => {
      const raw = row[h] ?? '';
      const str = escapeFormula(String(raw));
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(cells.join(','));
  }

  return lines.join('\r\n');
}

/**
 * Download a CSV blob in the browser.
 */
export function downloadCsv(
  rows: Record<string, unknown>[],
  headers: string[],
  filename: string
): void {
  const csv = buildCsv(rows, headers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}