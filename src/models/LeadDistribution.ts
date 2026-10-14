import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  LEAD_DISTRIBUTION_MODES,
  LEAD_DISTRIBUTION_STATUSES,
  type LeadDistributionMode,
  type LeadDistributionStatus,
} from '@/lib/constants/lead-import';
import { stripVersionKey } from '@/lib/db/schema-utils';
import { enumValues } from '@/lib/constants/enums';

/** Readable distribution batch code format, e.g. `DIST-0001`. */
export const DISTRIBUTION_CODE_PATTERN = /^DIST-\d{4,}$/;

/**
 * One bulk lead distribution — records which filters selected the lead pool,
 * which marketing users participated, the mode, and how many leads each
 * received. This is an audit record; it does NOT store the full lead IDs
 * (which could be thousands) or any PII.
 */
export interface ILeadDistribution {
  _id: Types.ObjectId;
  distributionCode: string;
  /** Distribution mode used. */
  mode: LeadDistributionMode;
  /** Total leads that matched the filter at the time of distribution. */
  leadCount: number;
  /** Per-user assignment count snapshot. */
  marketingUsers: {
    userId: Types.ObjectId;
    name: string;
    marketingCode: string | null;
    assigned: number;
  }[];
  /** Whitelisted filter key/values that defined the pool. No free text. */
  filtersSnapshot: {
    label: string;
    value: string;
  }[];
  status: LeadDistributionStatus;
  /** Human-readable error when status = FAILED. */
  errorMessage?: string | null;
  createdBy: Types.ObjectId;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LeadDistributionDocument = HydratedDocument<ILeadDistribution>;
export type LeadDistributionModel = Model<ILeadDistribution>;

export const LeadDistributionSchema = new Schema<ILeadDistribution>(
  {
    distributionCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => DISTRIBUTION_CODE_PATTERN.test(value.toUpperCase()),
        message: 'distributionCode must follow the DIST-0000 format (e.g. DIST-0001)',
      },
    },
    mode: {
      type: String,
      required: true,
      enum: enumValues(LEAD_DISTRIBUTION_MODES),
    },
    leadCount: {
      type: Number,
      required: true,
      min: 0,
    },
    marketingUsers: {
      type: [
        {
          userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          name: { type: String, required: true, trim: true, maxlength: 100 },
          marketingCode: { type: String, trim: true, maxlength: 20 },
          assigned: { type: Number, required: true, min: 0 },
        },
      ],
      required: true,
      default: [],
    },
    filtersSnapshot: {
      type: [
        {
          label: { type: String, required: true, trim: true, maxlength: 50 },
          value: { type: String, required: true, trim: true, maxlength: 100 },
        },
      ],
      required: true,
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(LEAD_DISTRIBUTION_STATUSES),
      default: LEAD_DISTRIBUTION_STATUSES.COMPLETED,
    },
    errorMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'lead_distributions',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

LeadDistributionSchema.index({ distributionCode: 1 }, { unique: true });
LeadDistributionSchema.index({ createdBy: 1, createdAt: -1 });
LeadDistributionSchema.index({ createdAt: -1 });

export const LeadDistribution = (models.LeadDistribution as Model<ILeadDistribution>) || model<ILeadDistribution>(
  'LeadDistribution',
  LeadDistributionSchema
);
