import 'server-only';

import type { ClientSession } from 'mongoose';

import { Counter } from '@/models/Counter';
import connectDB from './mongoose';

/**
 * Allocate the next sequential, human-readable code for a key, e.g.
 * `generateSequentialCode('employee', 'EMP')` → `EMP-0001`, `EMP-0002`, ...
 *
 * The increment is a single atomic `findOneAndUpdate($inc)` upsert on the
 * Counter collection, so concurrent requests can never receive the same
 * number. Pass a `ClientSession` to use it as part of a transaction.
 *
 * Never use `countDocuments() + 1` for this — it races under concurrency.
 */
export async function generateSequentialCode(
  key: string,
  prefix: string,
  session?: ClientSession
): Promise<string> {
  const { end } = await reserveSequenceRange(key, 1, session);
  return formatSequentialCode(prefix, end);
}

/**
 * Reserve a contiguous range of sequence numbers atomically.
 *
 * Example: `reserveSequenceRange('lead', 500)` → `{ start: 1001, end: 1500 }`.
 *
 * The new codes are `formatSequentialCode('LEAD', n)` for n in [start, end].
 * This is far more efficient than calling `generateSequentialCode` N times
 * under load, and it guarantees no gaps or collisions between bulk and
 * single-row creation because they share the same counter document.
 *
 * Uses the same atomic `findOneAndUpdate($inc)` upsert, so it is safe under
 * concurrent requests even without a transaction. Pass a session to join one.
 */
export async function reserveSequenceRange(
  key: string,
  count: number,
  session?: ClientSession
): Promise<{ start: number; end: number }> {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count must be a positive integer');
  }
  await connectDB();

  const doc = await Counter.findOneAndUpdate(
    { key: key.toLowerCase().trim() },
    { $inc: { sequence: count } },
    {
      upsert: true,
      new: true,
      ...(session ? { session } : {}),
    }
  );

  if (!doc || typeof doc.sequence !== 'number') {
    throw new Error(`Failed to reserve a sequence range for "${key}".`);
  }

  const end = doc.sequence;
  const start = end - count + 1;
  return { start, end };
}

/**
 * Format a sequence number with the standard 4-digit zero-padded suffix.
 * Shared by all code generators so the format stays identical everywhere.
 */
export function formatSequentialCode(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Push a counter forward so it is at least `sequence`, without consuming a
 * number.
 *
 * Needed when a caller supplies an explicit sequence (e.g. an Admin pins a
 * milestone to position 5). Bumping the shared counter with `$max` keeps the
 * *next* auto-allocated number above every explicit one, so a later automatic
 * allocation can never collide with it. `$max` is atomic and idempotent.
 */
export async function ensureSequenceAtLeast(
  key: string,
  sequence: number,
  session?: ClientSession
): Promise<void> {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('sequence must be a positive integer');
  }
  await connectDB();

  await Counter.findOneAndUpdate(
    { key: key.toLowerCase().trim() },
    { $max: { sequence } },
    {
      upsert: true,
      new: true,
      ...(session ? { session } : {}),
    }
  );
}
