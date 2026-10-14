'use server';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { requireAuth } from '@/lib/auth/authorization';
import { canViewTask } from '@/lib/auth/project-permissions';
import { Task } from '@/models/Task';
import { TaskComment } from '@/models/TaskComment';
import { TaskActivity } from '@/models/TaskActivity';
import { TASK_ACTIVITY_TYPES, TASK_COMMENT_VISIBILITIES } from '@/lib/constants/enums';
import {
  createTaskCommentSchema,
  updateTaskCommentSchema,
  zodFieldErrors,
} from '@/lib/validations/task-comment';
import { USER_ROLES } from '@/types/auth';

export type TaskCommentActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  commentId?: string;
};

export async function addTaskComment(
  taskId: string,
  rawData: unknown
): Promise<TaskCommentActionResult> {
  const user = await requireAuth();

  const parseResult = createTaskCommentSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['content']),
      message: 'Enter a valid comment.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(taskId)) {
    return { success: false, message: 'Invalid task ID.' };
  }

  const task = await Task.findById(new Types.ObjectId(taskId));
  if (!task) {
    return { success: false, message: 'Task not found.' };
  }

  const hasAccess = await canViewTask(user, task);
  if (!hasAccess) {
    return { success: false, message: 'You are not authorized to comment on this task.' };
  }

  const comment = await TaskComment.create({
    taskId: task._id,
    authorId: new Types.ObjectId(user.id),
    content: parseResult.data.content,
    visibility: TASK_COMMENT_VISIBILITIES.INTERNAL,
  });

  await TaskActivity.create({
    taskId: task._id,
    actorUserId: new Types.ObjectId(user.id),
    type: TASK_ACTIVITY_TYPES.COMMENT_ADDED,
    summary: `${user.name} added an internal comment.`,
  });

  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath(`/employee/tasks/${taskId}`);

  return {
    success: true,
    commentId: comment._id.toString(),
    message: 'Comment added.',
  };
}

export async function editTaskComment(
  commentId: string,
  rawData: unknown
): Promise<TaskCommentActionResult> {
  const user = await requireAuth();

  const parseResult = updateTaskCommentSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['content']),
      message: 'Comment cannot be empty.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(commentId)) {
    return { success: false, message: 'Invalid comment ID.' };
  }

  const comment = await TaskComment.findById(new Types.ObjectId(commentId));
  if (!comment) {
    return { success: false, message: 'Comment not found.' };
  }

  const isAuthor = comment.authorId.toString() === user.id;
  const isAdmin = user.role === USER_ROLES.ADMIN;

  if (!isAuthor && !isAdmin) {
    return { success: false, message: 'You can only edit your own comments.' };
  }

  comment.content = parseResult.data.content;
  comment.isEdited = true;
  comment.editedAt = new Date();
  await comment.save();

  revalidatePath(`/admin/tasks/${comment.taskId}`);
  revalidatePath(`/employee/tasks/${comment.taskId}`);

  return { success: true, message: 'Comment updated.' };
}
