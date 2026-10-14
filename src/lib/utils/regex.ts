/** Escape a raw user-supplied string for safe use inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a case-insensitive MongoDB `$regex` filter value from user input.
 * The input is escaped first, so the query can never be influenced by
 * regex metacharacters in the search box.
 */
export function toMongoRegex(value: string): {
  $regex: string;
  $options: string;
} {
  return { $regex: escapeRegExp(value), $options: 'i' };
}
