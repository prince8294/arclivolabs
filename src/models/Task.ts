import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskPriority,
  TaskStatus,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export const TASK_CODE_PATTERN = /^TASK-\d{4,}$/;

export interface ITaskSubmissionLink {
  title: string;
  url: string;
}

export interface ITaskBlocker {
  reason: string;
  description?: string | null;
  reportedAt: Date;
  reportedBy: Types.ObjectId;
  resolvedAt?: Date | null;
  resolvedBy?: Types.ObjectId | null;
  resolutionNotes?: string | null;
}

export interface ITask {
  _id: Types.ObjectId;
  taskCode: string;
  projectId: Types.ObjectId;
  milestoneId?: Types.ObjectId | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Primary assignee: User account with EMPLOYEE role */
  assignedTo?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  completedAt?: Date | null;
  estimatedMinutes: number;
  progressPercentage: number;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  submittedAt?: Date | null;
  submittedBy?: Types.ObjectId | null;
  submissionNotes?: string | null;
  submissionLinks: ITaskSubmissionLink[];
  parentTaskId?: Types.ObjectId | null;
  dependencies: Types.ObjectId[];
  blocker?: ITaskBlocker | null;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type TaskDocument = HydratedDocument<ITask>;
export type TaskModel = Model<ITask>;

const TaskSubmissionLinkSchema = new Schema<ITaskSubmissionLink>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    url: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const TaskBlockerSchema = new Schema<ITaskBlocker>(
  {
    reason: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    reportedAt: { type: Date, required: true, default: Date.now },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNotes: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

export const TaskSchema = new Schema<ITask>(
  {
    taskCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => TASK_CODE_PATTERN.test(value.toUpperCase()),
        message: 'taskCode must follow the TASK-0000 format (e.g. TASK-0001)',
      },
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    milestoneId: {
      type: Schema.Types.ObjectId,
      ref: 'ProjectMilestone',
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
    status: {
      type: String,
      required: true,
      enum: enumValues(TASK_STATUSES),
      default: TASK_STATUSES.TODO,
    },
    priority: {
      type: String,
      required: true,
      enum: enumValues(TASK_PRIORITIES),
      default: TASK_PRIORITIES.MEDIUM,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    startDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    estimatedMinutes: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    progressPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
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
    submittedAt: {
      type: Date,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    submissionNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    submissionLinks: {
      type: [TaskSubmissionLinkSchema],
      default: [],
    },
    parentTaskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
    },
    dependencies: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
      default: [],
    },
    blocker: {
      type: TaskBlockerSchema,
      default: null,
    },
    labels: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'tasks',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

TaskSchema.index({ taskCode: 1 }, { unique: true });
TaskSchema.index({ projectId: 1, status: 1 });
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ milestoneId: 1, status: 1 });
TaskSchema.index({ dueDate: 1, status: 1 });
TaskSchema.index({ parentTaskId: 1 });

export const Task =
  (models.Task as TaskModel) || model<ITask, TaskModel>('Task', TaskSchema);
