import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  CLIENT_APPROVAL_STATUSES,
  ClientApprovalStatus,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export const APPROVAL_CODE_PATTERN = /^APR-\d{4,}$/;

export interface IClientApproval {
  _id: Types.ObjectId;
  approvalCode: string;
  projectId: Types.ObjectId;
  clientId: Types.ObjectId;
  title: string;
  description?: string | null;
  fileAssetId: Types.ObjectId;
  fileVersionNumber: number;
  status: ClientApprovalStatus;
  requestedBy: Types.ObjectId;
  decidedBy?: Types.ObjectId | null;
  decidedAt?: Date | null;
  feedbackNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ClientApprovalDocument = HydratedDocument<IClientApproval>;
export type ClientApprovalModel = Model<IClientApproval>;

export const ClientApprovalSchema = new Schema<IClientApproval>(
  {
    approvalCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => APPROVAL_CODE_PATTERN.test(value.toUpperCase()),
        message: 'approvalCode must follow the APR-0000 format (e.g. APR-0001)',
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
    fileAssetId: {
      type: Schema.Types.ObjectId,
      ref: 'FileAsset',
      required: true,
    },
    fileVersionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(CLIENT_APPROVAL_STATUSES),
      default: CLIENT_APPROVAL_STATUSES.PENDING,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    decidedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    decidedAt: {
      type: Date,
    },
    feedbackNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    collection: 'client_approvals',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

ClientApprovalSchema.index({ approvalCode: 1 }, { unique: true });
ClientApprovalSchema.index({ projectId: 1, status: 1 });
ClientApprovalSchema.index({ clientId: 1, status: 1 });
ClientApprovalSchema.index({ fileAssetId: 1, fileVersionNumber: 1 });

export const ClientApproval =
  (models.ClientApproval as ClientApprovalModel) ||
  model<IClientApproval, ClientApprovalModel>(
    'ClientApproval',
    ClientApprovalSchema
  );
