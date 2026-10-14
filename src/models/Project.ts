import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  ACTIVE_PROJECT_STATUSES,
  PROJECT_HEALTHS,
  PROJECT_ORIGINS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  TASK_PRIORITIES,
  ProjectHealth,
  ProjectOrigin,
  ProjectStatus,
  ProjectType,
  TaskPriority,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export const PROJECT_CODE_PATTERN = /^PRJ-\d{4,}$/;

/**
 * Read-only copy of the accepted commercial position, taken at project
 * creation so operations can display it without loading the Deal.
 *
 * IMPORTANT: this is a *reference copy for display only*. The Deal and its
 * accepted ProposalVersion remain the commercial source of truth, and nothing
 * in this module may write back to them. See the snapshot sub-schemas.
 */
export interface IProjectScopeSnapshot {
  summary?: string | null;
  includedFeatures: string[];
  excludedFeatures: string[];
  dependencies: string[];
  customerResponsibilities: string[];
  deliverables: string[];
  estimatedDuration?: string | null;
}

/**
 * An internal note on a project (§44). Always internal-only in Part 10 - the
 * Client Portal (Part 12) reads its own client-visible update stream, never
 * this array.
 */
export interface IProjectNote {
  _id: Types.ObjectId;
  authorUserId: Types.ObjectId;
  /** Denormalised so the note still reads correctly if the author is removed. */
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: Date;
}

export interface IProject {
  _id: Types.ObjectId;
  projectCode: string;
  title: string;
  description?: string | null;
  clientId: Types.ObjectId;
  /**
   * The finalized Deal this project delivers. SPARSE-UNIQUE: the database
   * itself rejects a second primary project for the same Deal, which is the
   * real guard against concurrent/double-clicked creation (§10). `null` is
   * allowed any number of times because manual projects have no Deal.
   */
  dealId?: Types.ObjectId | null;
  /** The accepted ProposalVersion behind `dealId`. Reference, never edited. */
  acceptedProposalVersionId?: Types.ObjectId | null;
  proposalId?: Types.ObjectId | null;
  origin: ProjectOrigin;

  status: ProjectStatus;
  /** Delivery health, set by Admin. Never overwritten automatically (§14). */
  health: ProjectHealth;
  priority: TaskPriority;
  projectType: ProjectType;
  serviceIds: Types.ObjectId[];

  /** Designated Project Manager user account. */
  managerId?: Types.ObjectId | null;
  startDate?: Date | null;
  /** Operational target end date. Changing it never touches Deal terms (§45). */
  expectedEndDate?: Date | null;
  /** Server date recorded when Admin completes the project. */
  actualEndDate?: Date | null;
  /** Reason captured when the project was paused. History is preserved. */
  holdReason?: string | null;
  /** Reason captured when the project was cancelled (§52). */
  cancellationReason?: string | null;

  /**
   * Server-derived average of counted milestone progress (§29). Denormalized
   * for list performance and rewritten by `recalculateProjectProgress`
   * immediately after every milestone mutation - never accepted from a form.
   */
  progressPercentage: number;

  /** Internal-only notes. Never exposed to Client or Marketing (§44). */
  internalNotes: IProjectNote[];

  scopeSnapshot: IProjectScopeSnapshot;
  /**
   * Agreed amount in integer minor units, copied from the Deal for display.
   * Read-only: progress updates must never rewrite finalized Deal terms (§53).
   */
  agreedAmountSnapshot?: number | null;
  currency: string;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectDocument = HydratedDocument<IProject>;
export type ProjectModel = Model<IProject>;

export const ProjectSchema = new Schema<IProject>(
  {
    projectCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => PROJECT_CODE_PATTERN.test(value.toUpperCase()),
        message: 'projectCode must follow the PRJ-0000 format (e.g. PRJ-0001)',
      },
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
      maxlength: 5000,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    dealId: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
      default: null,
    },
    acceptedProposalVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'ProposalVersion',
      default: null,
    },
    proposalId: {
      type: Schema.Types.ObjectId,
      ref: 'Proposal',
      default: null,
    },
    origin: {
      type: String,
      required: true,
      enum: enumValues(PROJECT_ORIGINS),
      default: PROJECT_ORIGINS.DEAL,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(PROJECT_STATUSES),
      default: PROJECT_STATUSES.PLANNING,
    },
    health: {
      type: String,
      required: true,
      enum: enumValues(PROJECT_HEALTHS),
      default: PROJECT_HEALTHS.ON_TRACK,
    },
    priority: {
      type: String,
      required: true,
      enum: enumValues(TASK_PRIORITIES),
      default: TASK_PRIORITIES.MEDIUM,
    },
    projectType: {
      type: String,
      required: true,
      enum: enumValues(PROJECT_TYPES),
      default: PROJECT_TYPES.OTHER,
    },
    serviceIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
      default: [],
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    expectedEndDate: {
      type: Date,
      default: null,
    },
    actualEndDate: {
      type: Date,
      default: null,
    },
    holdReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    progressPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    internalNotes: {
      type: [
        new Schema<IProjectNote>(
          {
            authorUserId: {
              type: Schema.Types.ObjectId,
              ref: 'User',
              required: true,
            },
            authorName: { type: String, required: true, trim: true, maxlength: 150 },
            authorRole: { type: String, required: true, trim: true, maxlength: 30 },
            body: { type: String, required: true, trim: true, maxlength: 5000 },
            createdAt: { type: Date, required: true, default: Date.now },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
    scopeSnapshot: {
      summary: { type: String, trim: true, maxlength: 5000 },
      includedFeatures: { type: [String], default: [] },
      excludedFeatures: { type: [String], default: [] },
      dependencies: { type: [String], default: [] },
      customerResponsibilities: { type: [String], default: [] },
      deliverables: { type: [String], default: [] },
      estimatedDuration: { type: String, trim: true, maxlength: 200 },
    },
    agreedAmountSnapshot: {
      type: Number,
      min: 0,
      default: null,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 3,
      default: 'INR',
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
    collection: 'projects',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

ProjectSchema.index({ projectCode: 1 }, { unique: true });
// One primary project per finalized Deal. Partial index so the many manual
// projects that have no Deal (`dealId: null`) are all still allowed.
ProjectSchema.index(
  { dealId: 1 },
  { unique: true, partialFilterExpression: { dealId: { $type: 'objectId' } } }
);
ProjectSchema.index({ clientId: 1, status: 1 });
ProjectSchema.index({ managerId: 1, status: 1 });
ProjectSchema.index({ status: 1, createdAt: -1 });
ProjectSchema.index({ status: 1, expectedEndDate: 1 });
ProjectSchema.index({ health: 1, status: 1 });

/** Statuses treated as "still live" when listing active work. */
ProjectSchema.statics.activeStatuses = () => ACTIVE_PROJECT_STATUSES;

export const Project =
  (models.Project as ProjectModel) || model<IProject, ProjectModel>('Project', ProjectSchema);
