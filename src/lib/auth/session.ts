import { SignJWT, jwtVerify } from 'jose';

import type { UserRole } from '@/types/auth';

import { getAuthSecret, SESSION_MAX_AGE_MS } from './config';
import { USER_ROLES } from '@/types/auth';

/**
 * Session token helpers (stateless, signed JWT).
 *
 * This module is deliberately dependency-light (no next/headers, no
 * `server-only`) so it can also run inside the proxy, where it performs
 * fast optimistic checks on every request. Authoritative checks
 * (account status, current role) always re-read the database — see
 * `current-user.ts` / `authorization.ts`.
 */

// Deliberately a type alias (not an interface): jose's JWTPayload has a
// string index signature, which only object-literal *types* satisfy.
export type SessionPayload = {
  userId: string;
  role: UserRole;
};

const VALID_ROLES = new Set<string>(Object.values(USER_ROLES));

function isValidRole(value: unknown): value is UserRole {
  return typeof value === 'string' && VALID_ROLES.has(value);
}

function getSessionKey(): Uint8Array {
  return new TextEncoder().encode(getAuthSecret());
}

/**
 * Sign a session token. The exp claim is enforced by jwtVerify on every
 * read, so expired tokens are rejected server-side, not just dropped by
 * the browser.
 */
export async function signSession(payload: SessionPayload): Promise<string> {
  const now = Date.now();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor((now + SESSION_MAX_AGE_MS) / 1000))
    .sign(getSessionKey());
}

let warnedAboutSecret = false;

/**
 * Verify and decode a session token. Returns null for any invalid,
 * expired, or tampered token — callers treat that as "not signed in".
 * Fails closed: if AUTH_SECRET is misconfigured, no session is ever
 * trusted and a single warning is logged.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionKey(), {
      algorithms: ['HS256'],
    });
    const userId =
      typeof payload.userId === 'string' && payload.userId.length > 0
        ? payload.userId
        : null;
    if (!userId || !isValidRole(payload.role)) {
      return null;
    }
    return { userId, role: payload.role };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('AUTH_SECRET') && !warnedAboutSecret) {
      warnedAboutSecret = true;
      console.warn(message);
    }
    return null;
  }
}
