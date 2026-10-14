import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  INVOICE_ACTIVITY_TYPES,
  type InvoiceActivityType,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export interface IInvoiceActivity {
  _id: Types.ObjectId;
  invoiceId: Types.ObjectId;
  activityType: InvoiceActivityType;
  performedBy: Types.ObjectId;
  performerName: string;
  performerRole: string;
  description: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export type InvoiceActivityDocument = HydratedDocument<IInvoiceActivity>;
export type InvoiceActivityModel = Model<IInvoiceActivity>;

export const InvoiceActivitySchema = new Schema<IInvoiceActivity>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    activityType: {
      type: String,
      required: true,
      enum: Object.values(INVOICE_ACTIVITY_TYPES),
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    performerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    performerRole: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'invoice_activities',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

InvoiceActivitySchema.index({ invoiceId: 1, createdAt: -1 });

export const InvoiceActivity =
  (models.InvoiceActivity as InvoiceActivityModel) ||
  model<IInvoiceActivity>('InvoiceActivity', InvoiceActivitySchema);
