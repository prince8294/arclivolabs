import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  FILE_CATEGORIES,
  FILE_VISIBILITIES,
  FILE_STATUSES,
  FileCategory,
  FileVisibility,
  FileStatus,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export const FILE_CODE_PATTERN = /^FILE-\d{4,}$/;

export interface IFileAsset {
  _id: Types.ObjectId;
  fileCode: string;
  originalName: string;
  displayName: string;
  cloudinaryPublicId: string;
  cloudinaryAssetId?: string | null;
  resourceType: 'image' | 'video' | 'raw';
  deliveryType: string;
  format: string;
  mimeType: string;
  sizeBytes: number;
  projectId: Types.ObjectId;
  clientId: Types.ObjectId;
  taskId?: Types.ObjectId | null;
  milestoneId?: Types.ObjectId | null;
  requirementId?: Types.ObjectId | null;
  approvalId?: Types.ObjectId | null;
  uploadedBy: Types.ObjectId;
  category: FileCategory;
  visibility: FileVisibility;
  status: FileStatus;
  currentVersionNumber: number;
  description?: string | null;
  reviewNotes?: string | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  archivedAt?: Date | null;
  archivedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FileAssetDocument = HydratedDocument<IFileAsset>;
export type FileAssetModel = Model<IFileAsset>;

export const FileAssetSchema = new Schema<IFileAsset>(
  {
    fileCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => FILE_CODE_PATTERN.test(value.toUpperCase()),
        message: 'fileCode must follow the FILE-0000 format (e.g. FILE-0001)',
      },
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
      trim: true,
    },
    cloudinaryAssetId: {
      type: String,
      trim: true,
    },
    resourceType: {
      type: String,
      required: true,
      enum: ['image', 'video', 'raw'],
      default: 'raw',
    },
    deliveryType: {
      type: String,
      required: true,
      default: 'authenticated',
    },
    format: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 20,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
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
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
    },
    milestoneId: {
      type: Schema.Types.ObjectId,
      ref: 'ProjectMilestone',
    },
    requirementId: {
      type: Schema.Types.ObjectId,
      ref: 'ClientRequirement',
    },
    approvalId: {
      type: Schema.Types.ObjectId,
      ref: 'ClientApproval',
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: enumValues(FILE_CATEGORIES),
      default: FILE_CATEGORIES.DOCUMENT,
    },
    visibility: {
      type: String,
      required: true,
      enum: enumValues(FILE_VISIBILITIES),
      default: FILE_VISIBILITIES.ADMIN_ONLY,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(FILE_STATUSES),
      default: FILE_STATUSES.PROCESSING,
    },
    currentVersionNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
    archivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'file_assets',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

FileAssetSchema.index({ fileCode: 1 }, { unique: true });
FileAssetSchema.index({ projectId: 1, visibility: 1, status: 1 });
FileAssetSchema.index({ clientId: 1, visibility: 1, status: 1 });
FileAssetSchema.index({ taskId: 1, status: 1 });
FileAssetSchema.index({ milestoneId: 1, status: 1 });
FileAssetSchema.index({ requirementId: 1 });
FileAssetSchema.index({ uploadedBy: 1, createdAt: -1 });
FileAssetSchema.index({ category: 1 });

export const FileAsset =
  (models.FileAsset as FileAssetModel) ||
  model<IFileAsset, FileAssetModel>('FileAsset', FileAssetSchema);
