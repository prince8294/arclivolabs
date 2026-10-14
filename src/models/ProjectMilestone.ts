import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  PROJECT_MILESTONE_STATUSES,
  ProjectMilestoneStatus,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

/** Milestone code format, e.g. `PRJ-0001-M01` (§24). */
export const MILESTONE_CODE_PATTERN = /^PRJ-\d{4,}-M\d{2,}$/;

export interface IProjectMilestone {
  _id: Types.ObjectId;
  /** Derived from the parent project code + an atomic per-project counter. */
  milestoneCode: string;
  projectId: Types.ObjectId;
  title: string;
  description?: string | null;
  /** Concrete outputs expected from this milestone. */
  deliverables: string[];
  /** Display/execution order within the project. */
  sequence: number;
  status: ProjectMilestoneStatus;
  progressPercentage: number;
  startDate?: Date | null;
  dueDate?: Date | null;
  completedAt?: Date | null;

  /**
   * Responsible employee (a User with the EMPLOYEE role). Drives who may
   * submit work and post progress notes for this milestone.
   */
  assignedTo?: Types.ObjectId | null;

  /* ---------------------------- Review workflow -------------------------- */
  /** Employee who submitted the milestone for Admin review. */
  submittedBy?: Types.ObjectId | null;
  submittedAt?: Date | null;
  submissionNotes?: string | null;
  /** Admin reviewer. Never the same person as `submittedBy` (§28). */
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;

  /**
   * Prerequisite milestones inside the SAME project (§26). Validated on write:
   * no self-reference, no cycles, no cross-project links.
   */
  dependsOn: Types.ObjectId[];

  /**
   * Whether this milestone may be summarised to the Client Portal later
   * (Part 12). Internal-only milestones stay false by default so nothing
   * internal leaks by accident (§57).
   */
  clientVisible: boolean;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectMilestoneDocument = HydratedDocument<IProjectMilestone>;
export type ProjectMilestoneModel = Model<IProjectMilestone>;

export const ProjectMilestoneSchema = new Schema<IProjectMilestone>(
  {
    milestoneCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 30,
      validate: {
        validator: (value: string) => MILESTONE_CODE_PATTERN.test(value.toUpperCase()),
        message: 'milestoneCode must follow the PRJ-0000-M00 format (e.g. PRJ-0001-M01)',
      },
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
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
    deliverables: {
      type: [String],
      default: [],
    },
    sequence: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(PROJECT_MILESTONE_STATUSES),
      default: PROJECT_MILESTONE_STATUSES.NOT_STARTED,
    },
    progressPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    submissionNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    dependsOn: {
      type: [{ type: Schema.Types.ObjectId, ref: 'ProjectMilestone' }],
      default: [],
    },
    clientVisible: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'project_milestones',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

ProjectMilestoneSchema.index({ milestoneCode: 1 }, { unique: true });
// Two milestones in one project can never share a sequence number.
ProjectMilestoneSchema.index({ projectId: 1, sequence: 1 }, { unique: true });
ProjectMilestoneSchema.index({ projectId: 1, status: 1 });
ProjectMilestoneSchema.index({ projectId: 1, dueDate: 1 });
ProjectMilestoneSchema.index({ assignedTo: 1, status: 1 });

export const ProjectMilestone =
  (models.ProjectMilestone as ProjectMilestoneModel) ||
  model<IProjectMilestone, ProjectMilestoneModel>('ProjectMilestone', ProjectMilestoneSchema);
