import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import { TASK_ACTIVITY_TYPES, TaskActivityType, enumValues } from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export interface ITaskActivity {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  type: TaskActivityType;
  summary: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export type TaskActivityDocument = HydratedDocument<ITaskActivity>;
export type TaskActivityModel = Model<ITaskActivity>;

export const TaskActivitySchema = new Schema<ITaskActivity>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: enumValues(TASK_ACTIVITY_TYPES),
    },
    summary: {
      type: String,
      required: true,
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
    timestamps: false,
    collection: 'task_activities',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

TaskActivitySchema.index({ taskId: 1, createdAt: -1 });
TaskActivitySchema.index({ actorUserId: 1, createdAt: -1 });

export const TaskActivity =
  (models.TaskActivity as TaskActivityModel) ||
  model<ITaskActivity, TaskActivityModel>('TaskActivity', TaskActivitySchema);
