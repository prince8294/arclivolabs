import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  PROJECT_ACTIVITY_TYPES,
  ProjectActivityType,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

/**
 * Append-only internal activity log for a single project (§41/§42).
 *
 * Deliberately separate from TaskActivity (Part 11, per-task history) and
 * from CRM Communication records (Part 6, client conversation): these are
 * different business domains and must not be mixed.
 */
export interface IProjectActivity {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  type: ProjectActivityType;
  /** Who performed the action. */
  actorUserId: Types.ObjectId;
  /** Human-readable one-liner rendered directly in the timeline. */
  title: string;
  summary?: string | null;
  /**
   * Structured before/after context, e.g. deadline moves. Must never hold
   * secrets, payroll, or client payment data (§42).
   */
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export type ProjectActivityDocument = HydratedDocument<IProjectActivity>;
export type ProjectActivityModel = Model<IProjectActivity>;

export const ProjectActivitySchema = new Schema<IProjectActivity>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: enumValues(PROJECT_ACTIVITY_TYPES),
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    // Insert-only: createdAt is set explicitly and never updated, so the
    // timeline order cannot be rewritten after the fact.
    timestamps: false,
    collection: 'project_activities',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

ProjectActivitySchema.index({ projectId: 1, createdAt: -1 });
ProjectActivitySchema.index({ projectId: 1, type: 1 });

export const ProjectActivity =
  (models.ProjectActivity as ProjectActivityModel) ||
  model<IProjectActivity, ProjectActivityModel>('ProjectActivity', ProjectActivitySchema);
