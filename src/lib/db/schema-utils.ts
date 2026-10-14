/**
 * Mongoose schema output helpers.
 *
 * Transforms are applied to `toObject()` / `toJSON()` results so that
 * internal fields (version key, sensitive values) never leak into API
 * responses or client-facing payloads by accident.
 */

export type SchemaOutputTransform = (
  _doc: unknown,
  ret: Record<string, unknown>
) => Record<string, unknown>;

/** Removes the Mongoose `__v` version key from plain output objects. */
export const stripVersionKey: SchemaOutputTransform = (_doc, ret) => {
  delete ret.__v;
  return ret;
};
