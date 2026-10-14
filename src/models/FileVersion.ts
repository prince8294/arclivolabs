import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  FILE_STATUSES,
  FileStatus,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export interface IFileVersion {
  _id: Types.ObjectId;
  fileAssetId: Types.ObjectId;
  versionNumber: number;
  originalName: string;
  cloudinaryPublicId: string;
  cloudinaryAssetId?: string | null;
  resourceType: 'image' | 'video' | 'raw';
  deliveryType: string;
  format: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: Types.ObjectId;
  changeSummary?: string | null;
  status: FileStatus;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  createdAt: Date;
}

export type FileVersionDocument = HydratedDocument<IFileVersion>;
export type FileVersionModel = Model<IFileVersion>;

export const FileVersionSchema = new Schema<IFileVersion>(
  {
    fileAssetId: {
      type: Schema.Types.ObjectId,
      ref: 'FileAsset',
      required: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    originalName: {
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
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changeSummary: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(FILE_STATUSES),
      default: FILE_STATUSES.PROCESSING,
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
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: 'file_versions',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

FileVersionSchema.index({ fileAssetId: 1, versionNumber: 1 }, { unique: true });
FileVersionSchema.index({ fileAssetId: 1, createdAt: -1 });
FileVersionSchema.index({ uploadedBy: 1 });

export const FileVersion =
  (models.FileVersion as FileVersionModel) ||
  model<IFileVersion, FileVersionModel>('FileVersion', FileVersionSchema);
