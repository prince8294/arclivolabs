import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  DELIVERABLE_STATUSES,
  DeliverableStatus,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export const DELIVERABLE_CODE_PATTERN = /^DLV-\d{4,}$/;

export interface IProjectDeliverable {
  _id: Types.ObjectId;
  deliverableCode: string;
  projectId: Types.ObjectId;
  clientId: Types.ObjectId;
  title: string;
  description?: string | null;
  deliveryNotes?: string | null;
  fileVersionIds: Types.ObjectId[];
  status: DeliverableStatus;
  createdBy: Types.ObjectId;
  publishedBy?: Types.ObjectId | null;
  publishedAt?: Date | null;
  clientAcknowledgedAt?: Date | null;
  acknowledgedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectDeliverableDocument = HydratedDocument<IProjectDeliverable>;
export type ProjectDeliverableModel = Model<IProjectDeliverable>;

export const ProjectDeliverableSchema = new Schema<IProjectDeliverable>(
  {
    deliverableCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => DELIVERABLE_CODE_PATTERN.test(value.toUpperCase()),
        message: 'deliverableCode must follow the DLV-0000 format (e.g. DLV-0001)',
      },
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 3000,
    },
    deliveryNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    fileVersionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'FileVersion',
        required: true,
      },
    ],
    status: {
      type: String,
      required: true,
      enum: enumValues(DELIVERABLE_STATUSES),
      default: DELIVERABLE_STATUSES.DRAFT,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    publishedAt: {
      type: Date,
    },
    clientAcknowledgedAt: {
      type: Date,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'project_deliverables',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

ProjectDeliverableSchema.index({ deliverableCode: 1 }, { unique: true });
ProjectDeliverableSchema.index({ projectId: 1, status: 1 });
ProjectDeliverableSchema.index({ clientId: 1, status: 1 });
ProjectDeliverableSchema.index({ publishedAt: -1 });

export const ProjectDeliverable =
  (models.ProjectDeliverable as ProjectDeliverableModel) ||
  model<IProjectDeliverable, ProjectDeliverableModel>(
    'ProjectDeliverable',
    ProjectDeliverableSchema
  );
