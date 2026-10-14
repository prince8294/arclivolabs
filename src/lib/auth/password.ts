import 'server-only';

import bcrypt from 'bcryptjs';

import { BCRYPT_ROUNDS, DUMMY_PASSWORD_HASH } from './config';

/** Hash a plaintext password. Never call this with an already hashed value. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Constant-time comparison via bcrypt.compare. Returns false instead of
 * throwing when the stored hash is malformed (e.g. legacy data).
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export { BCRYPT_ROUNDS, DUMMY_PASSWORD_HASH };
