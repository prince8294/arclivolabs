import 'server-only';

import type { ClientSession } from 'mongoose';

import connectDB from './mongoose';

/**
 * Multi-document writes (complete a meeting + move the lead status +
 * schedule the next follow-up + write timeline entries) should run inside
 * one MongoDB transaction so a partial failure can never leave the CRM in
 * an inconsistent state.
 *
 * Transactions require a replica set (or Atlas / mongos). A standalone
 * `mongod` does not support them, and the probe below is cached per
 * process so the (cheap) capability check runs at most once.
 */
let transactionsSupported: boolean | undefined;

export async function areTransactionsSupported(): Promise<boolean> {
  if (transactionsSupported !== undefined) {
    return transactionsSupported;
  }

  const db = await connectDB();
  const session = await db.startSession();
  try {
    await session.withTransaction(async () => {
      // Any write inside the transaction exercises the same capability;
      // the probe document is upserted, so it is safe and idempotent.
      await db.connection.db
        ?.collection('system_probe')
        ?.updateOne({ key: 'transactions' }, { $set: { at: new Date() } }, {
          upsert: true,
        });
    });
    transactionsSupported = true;
  } catch {
    transactionsSupported = false;
  } finally {
    await session.endSession();
  }

  return transactionsSupported;
}

/**
 * Run a multi-document write, inside a MongoDB transaction when the
 * deployment supports one and as a plain sequence when it does not.
 *
 * Callers must pass `session` down to every write (the Mongoose helpers in
 * this project all accept one) and must compensate manually in the
 * fallback branch: when `session` is `undefined` the work is *not*
 * atomic, so the callback has to be able to undo its own partial writes
 * before surfacing an error.
 */
export async function withOptionalTransaction<T>(
  work: (session?: ClientSession) => Promise<T>
): Promise<T> {
  if (!(await areTransactionsSupported())) {
    return work(undefined);
  }

  const db = await connectDB();
  const session = await db.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}
