import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  BILLING_MILESTONE_STATUSES,
  type BillingMilestoneStatus,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export interface IBillingScheduleMilestone {
  _id: Types.ObjectId;
  milestoneCode: string;
  title: string;
  description?: string | null;
  amountMinor: number;
  percentage?: number | null;
  billingCondition?: string | null;
  plannedDueDate?: Date | null;
  linkedInvoiceId?: Types.ObjectId | null;
  status: BillingMilestoneStatus;
  billedAt?: Date | null;
}

export interface IBillingSchedule {
  _id: Types.ObjectId;
  dealId: Types.ObjectId;
  clientId: Types.ObjectId;
  projectId?: Types.ObjectId | null;
  currency: string;
  totalScheduledMinor: number;
  milestones: IBillingScheduleMilestone[];
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type BillingScheduleDocument = HydratedDocument<IBillingSchedule>;
export type BillingScheduleModel = Model<IBillingSchedule>;

const BillingScheduleMilestoneSchema = new Schema<IBillingScheduleMilestone>(
  {
    milestoneCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    amountMinor: { type: Number, required: true, min: 0 },
    percentage: { type: Number, min: 0, max: 100 },
    billingCondition: { type: String, trim: true, maxlength: 1000 },
    plannedDueDate: { type: Date },
    linkedInvoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    status: {
      type: String,
      required: true,
      enum: Object.values(BILLING_MILESTONE_STATUSES),
      default: BILLING_MILESTONE_STATUSES.NOT_BILLED,
    },
    billedAt: { type: Date },
  },
  { _id: true }
);

export const BillingScheduleSchema = new Schema<IBillingSchedule>(
  {
    dealId: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
      required: true,
      unique: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 3,
      default: 'INR',
    },
    totalScheduledMinor: {
      type: Number,
      required: true,
      min: 0,
    },
    milestones: {
      type: [BillingScheduleMilestoneSchema],
      required: true,
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    collection: 'billing_schedules',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

BillingScheduleSchema.index({ clientId: 1, createdAt: -1 });
BillingScheduleSchema.index({ projectId: 1 });

export const BillingSchedule =
  (models.BillingSchedule as BillingScheduleModel) ||
  model<IBillingSchedule>('BillingSchedule', BillingScheduleSchema);
