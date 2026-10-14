import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import { stripVersionKey } from '@/lib/db/schema-utils';

/** Readable service code format, e.g. `SVC-0001`. */
export const SERVICE_CODE_PATTERN = /^SVC-\d{4,}$/;

/**
 * Catalogue entry for a service Arclivo Labs sells (website development,
 * SEO, video editing, ...).
 *
 * Lead records reference these documents through `Lead.serviceInterest`,
 * so the CRM forms never hardcode a service list. `isActive` retires a
 * service from new selection without breaking historical leads.
 */
export interface IService {
  _id: Types.ObjectId;
  serviceCode: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  /** Lower sorts first in every select. */
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ServiceDocument = HydratedDocument<IService>;
export type ServiceModel = Model<IService>;

export const ServiceSchema = new Schema<IService>(
  {
    serviceCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) =>
          SERVICE_CODE_PATTERN.test(value.toUpperCase()),
        message: 'serviceCode must follow the SVC-0000 format (e.g. SVC-0001)',
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 100,
    },
  },
  {
    timestamps: true,
    collection: 'services',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

ServiceSchema.index({ serviceCode: 1 }, { unique: true });
ServiceSchema.index({ name: 1 }, { unique: true });
ServiceSchema.index({ isActive: 1, sortOrder: 1 });

export const Service = (models.Service as Model<IService>) || model<IService>('Service', ServiceSchema);
