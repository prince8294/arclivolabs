import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  PROJECT_MEMBER_ROLES,
  PROJECT_MEMBER_STATUSES,
  ProjectMemberRole,
  ProjectMemberStatus,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export interface IProjectMember {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  /**
   * Project-level responsibility (e.g. DEVELOPER). This is NOT an
   * authentication role and never widens access - see
   * `PROJECT_MEMBER_ROLES` in lib/constants/enums.
   */
  role: ProjectMemberRole;
  /**
   * Free-text responsibility on this specific project, e.g.
   * "Frontend Development". Kept separate from `role` because the role is a
   * controlled vocabulary while this is descriptive detail.
   */
  responsibility?: string | null;
  status: ProjectMemberStatus;
  assignedAt: Date;
  assignedBy?: Types.ObjectId | null;
  removedAt?: Date | null;
  removedBy?: Types.ObjectId | null;
  /** Why the assignment ended - history is never deleted (§20). */
  removalReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectMemberDocument = HydratedDocument<IProjectMember>;
export type ProjectMemberModel = Model<IProjectMember>;

export const ProjectMemberSchema = new Schema<IProjectMember>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: enumValues(PROJECT_MEMBER_ROLES),
      default: PROJECT_MEMBER_ROLES.DEVELOPER,
    },
    responsibility: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(PROJECT_MEMBER_STATUSES),
      default: PROJECT_MEMBER_STATUSES.ACTIVE,
    },
    assignedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    removedAt: {
      type: Date,
    },
    removedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    removalReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    collection: 'project_members',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
ProjectMemberSchema.index({ userId: 1, status: 1 });
ProjectMemberSchema.index({ projectId: 1, status: 1 });

export const ProjectMember =
  (models.ProjectMember as ProjectMemberModel) ||
  model<IProjectMember, ProjectMemberModel>('ProjectMember', ProjectMemberSchema);
