import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  COMMISSION_TYPES,
  MARKETING_STATUS,
  CommissionType,
  MarketingStatus,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

/** Readable marketing code format, e.g. `MKT-0001`. */
export const MARKETING_CODE_PATTERN = /^MKT-\d{4,}$/;

/**
 * Profile data for users with the MARKETING role (1:1 with a User account).
 *
 * Leads, follow-ups, meetings and commissions are stored in their own
 * collections — they are intentionally NOT embedded in this model.
 */
export interface IMarketingProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  marketingCode: string;
  designation: string;
  joiningDate: Date;
  commissionType: CommissionType;
  commissionValue: number;
  target?: number | null;
  status: MarketingStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type MarketingProfileDocument = HydratedDocument<IMarketingProfile>;
export type MarketingProfileModel = Model<IMarketingProfile>;

export const MarketingProfileSchema = new Schema<IMarketingProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    marketingCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) =>
          MARKETING_CODE_PATTERN.test(value.toUpperCase()),
        message: 'marketingCode must follow the MKT-0000 format (e.g. MKT-0001)',
      },
    },
    designation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    joiningDate: {
      type: Date,
      required: true,
    },
    commissionType: {
      type: String,
      required: true,
      enum: enumValues(COMMISSION_TYPES),
      default: COMMISSION_TYPES.NONE,
    },
    // Interpretation depends on commissionType:
    // PERCENTAGE -> percent of revenue (e.g. 10), FIXED -> fixed amount in
    // the account currency, NONE -> must be 0. No calculations happen at
    // this layer.
    commissionValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Period target (amount in the account currency). Optional.
    target: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(MARKETING_STATUS),
      default: MARKETING_STATUS.ACTIVE,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    collection: 'marketing_profiles',
    toJSON: {
      virtuals: false,
      transform: stripVersionKey,
    },
    toObject: {
      virtuals: false,
      transform: stripVersionKey,
    },
  }
);

MarketingProfileSchema.index({ marketingCode: 1 }, { unique: true });
MarketingProfileSchema.index({ userId: 1 }, { unique: true });

export const MarketingProfile = (models.MarketingProfile as Model<IMarketingProfile>) || model<IMarketingProfile>(
  'MarketingProfile',
  MarketingProfileSchema
);
