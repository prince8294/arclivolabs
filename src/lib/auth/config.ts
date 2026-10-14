/**
 * Authentication configuration.
 *
 * Pure module: no framework or server-only imports, so it can be shared
 * with the proxy (route guard) as well as server components and actions.
 */

/** HTTP-only cookie that carries the signed session token. */
export const SESSION_COOKIE_NAME = 'arclivo_session';

/** Session lifetime: 7 days. Kept as one consistent value (no remember-me). */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = Math.floor(
  SESSION_MAX_AGE_MS / 1000
);

/**
 * Minimum characters for AUTH_SECRET. Anything below is refused at
 * runtime so a misconfigured deployment fails loudly instead of
 * signing sessions with a weak key.
 */
export const AUTH_SECRET_MIN_LENGTH = 32;

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < AUTH_SECRET_MIN_LENGTH) {
    throw new Error(
      'AUTH_SECRET is missing or too short. Set AUTH_SECRET to a random string of at least ' +
        `${AUTH_SECRET_MIN_LENGTH} characters (e.g. \`openssl rand -base64 32\`) and restart the app.`
    );
  }
  return secret;
}

/**
 * Password policy.
 *
 * - MIN: reasonable baseline for all accounts created by the system.
 * - MAX: bcrypt only uses the first 72 bytes; capping input protects
 *   hashing resources and avoids silently truncating long passphrases.
 *
 * No composition rules (uppercase/symbols/digits) on purpose: long
 * passphrases should work.
 */
export const PASSWORD_POLICY = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 72,
} as const;

/**
 * bcrypt work factor. 10 rounds is a reasonable production baseline for
 * bcryptjs (pure JS): ~80ms per hash on commodity hardware, which is
 * comfortable for interactive logins and still slows brute force.
 */
export const BCRYPT_ROUNDS = 10;

/**
 * Pre-hashed decoy used to equalize response timing when a login attempt
 * uses an unknown email or an account without a password. Without it,
 * "user not found" answers visibly faster than "wrong password", which
 * enables account enumeration via timing.
 *
 * This is not a real credential; it exists purely to run one bcrypt
 * compare on the failure path.
 */
export const DUMMY_PASSWORD_HASH =
  '$2b$10$g04n4zeTyngKQ9HI5qghQOftnHp8dFoOdNEDJWOC2on7AjjEcpzbO';
