import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  CLIENT_REQUIREMENT_STATUSES,
  ClientRequirementStatus,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export const REQUIREMENT_CODE_PATTERN = /^REQ-\d{4,}$/;

export interface IClientRequirement {
  _id: Types.ObjectId;
  requirementCode: string;
  projectId: Types.ObjectId;
  clientId: Types.ObjectId;
  title: string;
  description: string;
  fileAssetIds: Types.ObjectId[];
  status: ClientRequirementStatus;
  submittedBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ClientRequirementDocument = HydratedDocument<IClientRequirement>;
export type ClientRequirementModel = Model<IClientRequirement>;

export const ClientRequirementSchema = new Schema<IClientRequirement>(
  {
    requirementCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => REQUIREMENT_CODE_PATTERN.test(value.toUpperCase()),
        message: 'requirementCode must follow the REQ-0000 format (e.g. REQ-0001)',
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
      required: true,
      trim: true,
      maxlength: 5000,
    },
    fileAssetIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'FileAsset',
      },
    ],
    status: {
      type: String,
      required: true,
      enum: enumValues(CLIENT_REQUIREMENT_STATUSES),
      default: CLIENT_REQUIREMENT_STATUSES.SUBMITTED,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    collection: 'client_requirements',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

ClientRequirementSchema.index({ requirementCode: 1 }, { unique: true });
ClientRequirementSchema.index({ projectId: 1, status: 1 });
ClientRequirementSchema.index({ clientId: 1, status: 1 });

export const ClientRequirement =
  (models.ClientRequirement as ClientRequirementModel) ||
  model<IClientRequirement, ClientRequirementModel>(
    'ClientRequirement',
    ClientRequirementSchema
  );
