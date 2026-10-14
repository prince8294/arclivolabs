import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import { TASK_COMMENT_VISIBILITIES, TaskCommentVisibility, enumValues } from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export interface ITaskComment {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  authorId: Types.ObjectId;
  content: string;
  visibility: TaskCommentVisibility;
  isEdited: boolean;
  editedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskCommentDocument = HydratedDocument<ITaskComment>;
export type TaskCommentModel = Model<ITaskComment>;

export const TaskCommentSchema = new Schema<ITaskComment>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    visibility: {
      type: String,
      required: true,
      enum: enumValues(TASK_COMMENT_VISIBILITIES),
      default: TASK_COMMENT_VISIBILITIES.INTERNAL,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'task_comments',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

TaskCommentSchema.index({ taskId: 1, createdAt: 1 });
TaskCommentSchema.index({ authorId: 1 });

export const TaskComment =
  (models.TaskComment as TaskCommentModel) ||
  model<ITaskComment, TaskCommentModel>('TaskComment', TaskCommentSchema);
