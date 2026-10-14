import 'server-only';

import { cookies } from 'next/headers';

import type { UserRole } from '@/types/auth';

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  SESSION_MAX_AGE_SECONDS,
} from './config';
import {
  signSession,
  verifySessionToken,
  type SessionPayload,
} from './session';

/**
 * Cookie-based session store. All write access happens in server
 * functions/actions so the signed token is only ever created by the
 * server; the browser holds an HTTP-only cookie it cannot read or forge.
 */

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/' as const,
  };
}

/** Create a session for the given user and set the HTTP-only cookie. */
export async function createSession(
  userId: string,
  role: UserRole
): Promise<void> {
  const token = await signSession({ userId, role });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions(),
    expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Destroy the current session by expiring the auth cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    ...sessionCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
}

/**
 * Read and verify the current session from the request cookie.
 * Returns null when no valid, unexpired session exists.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}
