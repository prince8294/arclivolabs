import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import { stripVersionKey } from '@/lib/db/schema-utils';

/**
 * Atomic, reusable sequence counter.
 *
 * One document per key (e.g. `employee`, `marketing`, later
 * `client`, `lead`, `invoice`, `receipt`). Numbers are allocated with
 * `findOneAndUpdate({ $inc: 1 }, { upsert: true, new: true })`, which is
 * atomic on a single document — safe under concurrent requests, unlike
 * `countDocuments() + 1`.
 *
 * Server-only: never expose this collection to clients.
 */
export interface ICounter {
  _id: Types.ObjectId;
  key: string;
  sequence: number;
}

export type CounterDocument = HydratedDocument<ICounter>;
export type CounterModel = Model<ICounter>;

export const CounterSchema = new Schema<ICounter>(
  {
    key: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 50,
      unique: true,
    },
    sequence: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    collection: 'counters',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

export const Counter = (models.Counter as Model<ICounter>) || model<ICounter>('Counter', CounterSchema);
