/**
 * Deterministic avatar initials for the user menu (AA for "Ada Adams").
 * Falls back to "?" when the name is empty.
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  const first = words[0]?.[0];
  const last = words.length > 1 ? words[words.length - 1]?.[0] : undefined;
  return `${first}${last ?? ''}`.toUpperCase();
}
