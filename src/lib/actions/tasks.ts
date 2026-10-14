'use server';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { requireAuth } from '@/lib/auth/authorization';
import {
  canManageProject,
  canReviewTask,
  isActiveProjectMember,
} from '@/lib/auth/project-permissions';
import { generateSequentialCode } from '@/lib/db/generate-code';
import { withOptionalTransaction } from '@/lib/db/transaction';
import { Project } from '@/models/Project';
import { ProjectMember } from '@/models/ProjectMember';
import { ProjectMilestone } from '@/models/ProjectMilestone';
import { Task, type ITask } from '@/models/Task';
import { TaskActivity } from '@/models/TaskActivity';
import { User } from '@/models/User';
import {
  PROJECT_STATUSES,
  TASK_ACTIVITY_TYPES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  USER_STATUS,
} from '@/lib/constants/enums';
import {
  createTaskSchema,
  reassignTaskSchema,
  reportBlockerSchema,
  resolveBlockerSchema,
  reviewTaskSchema,
  submitTaskReviewSchema,
  updateProgressSchema,
  updateTaskSchema,
  zodFieldErrors,
} from '@/lib/validations/task';
import { USER_ROLES } from '@/types/auth';
import { createNotification } from '@/lib/notifications/create';

export type TaskActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  taskId?: string;
  taskCode?: string;
};

/**
 * Synchronizes operational progress for milestone and project from tasks.
 * Preserves independent milestone and project approval rules.
 */
async function syncProgress(projectId: Types.ObjectId, milestoneId?: Types.ObjectId | null) {
  try {
    if (milestoneId) {
      const [totalMsTasks, completedMsTasks] = await Promise.all([
        Task.countDocuments({
          milestoneId,
          status: { $ne: TASK_STATUSES.CANCELLED },
        }),
        Task.countDocuments({
          milestoneId,
          status: TASK_STATUSES.COMPLETED,
        }),
      ]);

      const msProgress =
        totalMsTasks > 0 ? Math.round((completedMsTasks / totalMsTasks) * 100) : 0;

      await ProjectMilestone.findByIdAndUpdate(milestoneId, {
        progressPercentage: msProgress,
      });
    }

    const [totalProjTasks, completedProjTasks] = await Promise.all([
      Task.countDocuments({
        projectId,
        status: { $ne: TASK_STATUSES.CANCELLED },
      }),
      Task.countDocuments({
        projectId,
        status: TASK_STATUSES.COMPLETED,
      }),
    ]);

    const projProgress =
      totalProjTasks > 0 ? Math.round((completedProjTasks / totalProjTasks) * 100) : 0;

    await Project.findByIdAndUpdate(projectId, {
      progressPercentage: projProgress,
    });
  } catch (error) {
    console.error('Error syncing operational progress:', error);
  }
}

/**
 * Creates a new task.
 * Admin or designated Project Manager only.
 */
export async function createTask(rawData: unknown): Promise<TaskActionResult> {
  const user = await requireAuth();

  const parseResult = createTaskSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, [
        'title',
        'projectId',
        'milestoneId',
        'assignedTo',
        'priority',
        'startDate',
        'dueDate',
        'estimatedHours',
      ]),
      message: 'Please resolve form validation errors.',
    };
  }

  const data = parseResult.data;
  await connectDB();

  // Verify permission
  const hasPermission = await canManageProject(user, data.projectId);
  if (!hasPermission) {
    return {
      success: false,
      message: 'You are not authorized to create tasks for this project.',
    };
  }

  // Validate Project
  const project = await Project.findById(new Types.ObjectId(data.projectId));
  if (!project) {
    return { success: false, message: 'Project not found.' };
  }
  if (
    project.status === PROJECT_STATUSES.COMPLETED ||
    project.status === PROJECT_STATUSES.CANCELLED
  ) {
    return {
      success: false,
      message: `Cannot add tasks to a ${project.status.toLowerCase()} project.`,
    };
  }

  // Validate Milestone if provided
  let milestoneObjectId: Types.ObjectId | null = null;
  if (data.milestoneId) {
    const ms = await ProjectMilestone.findOne({
      _id: new Types.ObjectId(data.milestoneId),
      projectId: project._id,
    });
    if (!ms) {
      return {
        success: false,
        fieldErrors: { milestoneId: 'Milestone must belong to the selected project.' },
      };
    }
    milestoneObjectId = ms._id;
  }

  // Validate Assignee if provided
  let assigneeObjectId: Types.ObjectId | null = null;
  let assigneeUser: { name: string } | null = null;
  if (data.assignedTo) {
    const assignee = await User.findById(new Types.ObjectId(data.assignedTo));
    if (!assignee || assignee.status !== USER_STATUS.ACTIVE) {
      return {
        success: false,
        fieldErrors: { assignedTo: 'Assignee must be an active employee account.' },
      };
    }
    const isMember = await isActiveProjectMember(assignee._id, project._id);
    if (!isMember) {
      return {
        success: false,
        fieldErrors: {
          assignedTo: 'Selected employee is not an active team member of this project.',
        },
      };
    }
    assigneeObjectId = assignee._id;
    assigneeUser = { name: assignee.name };
  }

  // Validate parent task if provided
  let parentObjectId: Types.ObjectId | null = null;
  if (data.parentTaskId) {
    const parent = await Task.findOne({
      _id: new Types.ObjectId(data.parentTaskId),
      projectId: project._id,
    });
    if (!parent) {
      return {
        success: false,
        fieldErrors: { parentTaskId: 'Parent task must belong to the same project.' },
      };
    }
    parentObjectId = parent._id;
  }

  // Atomic creation
  const result = await withOptionalTransaction(async (session) => {
    const taskCode = await generateSequentialCode('task', 'TASK', session);

    const taskDocs = await Task.create(
      [
        {
          taskCode,
          projectId: project._id,
          milestoneId: milestoneObjectId,
          title: data.title,
          description: data.description || null,
          status: TASK_STATUSES.TODO,
          priority: data.priority,
          assignedTo: assigneeObjectId,
          createdBy: new Types.ObjectId(user.id),
          startDate: data.startDate || null,
          dueDate: data.dueDate || null,
          estimatedMinutes: data.estimatedHours || 0,
          progressPercentage: 0,
          labels: data.labels || [],
          parentTaskId: parentObjectId,
          dependencies: (data.dependencies || []).map((id) => new Types.ObjectId(id)),
        },
      ],
      { session }
    );

    const newTask = taskDocs[0];

    // Record Activity
    await TaskActivity.create(
      [
        {
          taskId: newTask._id,
          actorUserId: new Types.ObjectId(user.id),
          type: TASK_ACTIVITY_TYPES.TASK_CREATED,
          summary: `Task ${taskCode} created by ${user.name}.`,
          metadata: {
            title: data.title,
            priority: data.priority,
            assignedTo: assigneeUser ? assigneeUser.name : 'Unassigned',
          },
        },
      ],
      { session }
    );

    if (assigneeObjectId) {
      await TaskActivity.create(
        [
          {
            taskId: newTask._id,
            actorUserId: new Types.ObjectId(user.id),
            type: TASK_ACTIVITY_TYPES.TASK_ASSIGNED,
            summary: `Task assigned to ${assigneeUser?.name}.`,
            metadata: {
              assigneeId: assigneeObjectId.toString(),
              assigneeName: assigneeUser?.name,
            },
          },
        ],
        { session }
      );
    }

    return newTask;
  });

  await syncProgress(project._id, milestoneObjectId);
  if (result.assignedTo) await createNotification({ recipientUserId: result.assignedTo, type: 'TASK_ASSIGNED', title: 'New task assigned', message: `${result.taskCode}: ${result.title}`, resourceType: 'Task', resourceId: result._id, resourceUrl: `/employee/tasks/${result._id}`, idempotencyKey: `task-assigned:${result._id}:${result.assignedTo}` });

  revalidatePath('/admin/tasks');
  revalidatePath('/admin/tasks/board');
  revalidatePath(`/admin/projects/${project._id}`);
  revalidatePath(`/admin/projects/${project._id}/tasks`);
  revalidatePath('/employee/tasks');
  revalidatePath('/employee/tasks/board');

  return {
    success: true,
    taskId: result._id.toString(),
    taskCode: result.taskCode,
    message: `Task ${result.taskCode} created successfully.`,
  };
}

/**
 * Updates task configuration (title, dates, priority, etc.).
 * Admin or designated Project Manager only.
 */
export async function updateTask(
  taskId: string,
  rawData: unknown
): Promise<TaskActionResult> {
  const user = await requireAuth();

  const parseResult = updateTaskSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, [
        'title',
        'milestoneId',
        'assignedTo',
        'priority',
        'startDate',
        'dueDate',
        'estimatedHours',
      ]),
      message: 'Please resolve form validation errors.',
    };
  }

  const data = parseResult.data;
  await connectDB();

  if (!Types.ObjectId.isValid(taskId)) {
    return { success: false, message: 'Invalid task ID.' };
  }

  const task = await Task.findById(new Types.ObjectId(taskId));
  if (!task) {
    return { success: false, message: 'Task not found.' };
  }

  const hasPermission = await canManageProject(user, task.projectId);
  if (!hasPermission) {
    return { success: false, message: 'You are not authorized to edit this task.' };
  }

  // Milestone validation
  let milestoneObjectId: Types.ObjectId | null = task.milestoneId || null;
  if (data.milestoneId !== undefined) {
    if (data.milestoneId) {
      const ms = await ProjectMilestone.findOne({
        _id: new Types.ObjectId(data.milestoneId),
        projectId: task.projectId,
      });
      if (!ms) {
        return {
          success: false,
          fieldErrors: { milestoneId: 'Milestone must belong to the same project.' },
        };
      }
      milestoneObjectId = ms._id;
    } else {
      milestoneObjectId = null;
    }
  }

  // Assignee reassignment validation
  let newAssigneeId: Types.ObjectId | null = task.assignedTo || null;
  let reassigned = false;
  let previousAssigneeName = 'Unassigned';
  let newAssigneeName = 'Unassigned';

  if (data.assignedTo !== undefined) {
    if (data.assignedTo) {
      const assignee = await User.findById(new Types.ObjectId(data.assignedTo));
      if (!assignee || assignee.status !== USER_STATUS.ACTIVE) {
        return {
          success: false,
          fieldErrors: { assignedTo: 'Assignee must be an active user.' },
        };
      }
      const isMember = await isActiveProjectMember(assignee._id, task.projectId);
      if (!isMember) {
        return {
          success: false,
          fieldErrors: {
            assignedTo: 'Selected employee is not an active team member of this project.',
          },
        };
      }
      if (
        !task.assignedTo ||
        task.assignedTo.toString() !== assignee._id.toString()
      ) {
        reassigned = true;
        newAssigneeId = assignee._id;
        newAssigneeName = assignee.name;
        if (task.assignedTo) {
          const prevUser = await User.findById(task.assignedTo).select('name');
          if (prevUser) previousAssigneeName = prevUser.name;
        }
      }
    } else {
      if (task.assignedTo) {
        reassigned = true;
        newAssigneeId = null;
        newAssigneeName = 'Unassigned';
        const prevUser = await User.findById(task.assignedTo).select('name');
        if (prevUser) previousAssigneeName = prevUser.name;
      }
    }
  }

  // Prevent self-dependency or circular dependency
  const dependencies = data.dependencies
    ? data.dependencies
        .filter((d) => d !== taskId)
        .map((d) => new Types.ObjectId(d))
    : task.dependencies;

  const previousPriority = task.priority;

  await withOptionalTransaction(async (session) => {
    task.title = data.title;
    if (data.description !== undefined) task.description = data.description;
    task.milestoneId = milestoneObjectId;
    task.priority = data.priority;
    task.assignedTo = newAssigneeId;
    if (data.startDate !== undefined) task.startDate = data.startDate;
    if (data.dueDate !== undefined) task.dueDate = data.dueDate;
    if (data.estimatedHours !== undefined) task.estimatedMinutes = data.estimatedHours;
    if (data.labels !== undefined) task.labels = data.labels;
    task.dependencies = dependencies;
    task.updatedBy = new Types.ObjectId(user.id);

    await task.save({ session });

    if (previousPriority !== data.priority) {
      await TaskActivity.create(
        [
          {
            taskId: task._id,
            actorUserId: new Types.ObjectId(user.id),
            type: TASK_ACTIVITY_TYPES.PRIORITY_CHANGED,
            summary: `Priority changed from ${previousPriority} to ${data.priority}.`,
            metadata: { previousPriority, newPriority: data.priority },
          },
        ],
        { session }
      );
    }

    if (reassigned) {
      await TaskActivity.create(
        [
          {
            taskId: task._id,
            actorUserId: new Types.ObjectId(user.id),
            type: TASK_ACTIVITY_TYPES.TASK_REASSIGNED,
            summary: `Task reassigned from ${previousAssigneeName} to ${newAssigneeName}.`,
            metadata: {
              previousAssignee: previousAssigneeName,
              newAssignee: newAssigneeName,
            },
          },
        ],
        { session }
      );
    }
  });

  await syncProgress(task.projectId, milestoneObjectId);

  revalidatePath('/admin/tasks');
  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath('/admin/tasks/board');
  revalidatePath(`/admin/projects/${task.projectId}`);
  revalidatePath('/employee/tasks');

  return {
    success: true,
    taskId: task._id.toString(),
    taskCode: task.taskCode,
    message: 'Task updated successfully.',
  };
}

/**
 * Reassigns an existing task to an employee.
 */
export async function reassignTask(
  taskId: string,
  newAssigneeId: string | null
): Promise<TaskActionResult> {
  const user = await requireAuth();
  await connectDB();

  if (!Types.ObjectId.isValid(taskId)) {
    return { success: false, message: 'Invalid task ID.' };
  }

  const task = await Task.findById(new Types.ObjectId(taskId));
  if (!task) {
    return { success: false, message: 'Task not found.' };
  }

  const hasPermission = await canManageProject(user, task.projectId);
  if (!hasPermission) {
    return { success: false, message: 'You are not authorized to reassign this task.' };
  }

  let assigneeObjId: Types.ObjectId | null = null;
  let newAssigneeName = 'Unassigned';
  let prevAssigneeName = 'Unassigned';

  if (task.assignedTo) {
    const prevUser = await User.findById(task.assignedTo).select('name');
    if (prevUser) prevAssigneeName = prevUser.name;
  }

  if (newAssigneeId) {
    if (!Types.ObjectId.isValid(newAssigneeId)) {
      return { success: false, message: 'Invalid employee ID.' };
    }
    const assignee = await User.findById(new Types.ObjectId(newAssigneeId));
    if (!assignee || assignee.status !== USER_STATUS.ACTIVE) {
      return { success: false, message: 'Assignee must be an active employee account.' };
    }
    const isMember = await isActiveProjectMember(assignee._id, task.projectId);
    if (!isMember) {
      return {
        success: false,
        message: 'Employee is not an active team member of this project.',
      };
    }
    assigneeObjId = assignee._id;
    newAssigneeName = assignee.name;
  }

  task.assignedTo = assigneeObjId;
  task.updatedBy = new Types.ObjectId(user.id);
  await task.save();

  await TaskActivity.create({
    taskId: task._id,
    actorUserId: new Types.ObjectId(user.id),
    type: TASK_ACTIVITY_TYPES.TASK_REASSIGNED,
    summary: `Task reassigned from ${prevAssigneeName} to ${newAssigneeName}.`,
    metadata: {
      previousAssignee: prevAssigneeName,
      newAssignee: newAssigneeName,
    },
  });
  if (assigneeObjId) await createNotification({ recipientUserId: assigneeObjId, type: 'TASK_ASSIGNED', title: 'Task assigned', message: `${task.taskCode}: ${task.title}`, resourceType: 'Task', resourceId: task._id, resourceUrl: `/employee/tasks/${task._id}`, idempotencyKey: `task-reassigned:${task._id}:${assigneeObjId}:${task.updatedAt.getTime()}` });

  revalidatePath('/admin/tasks');
  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath('/admin/tasks/board');
  revalidatePath('/employee/tasks');
  revalidatePath('/employee/tasks/board');

  return {
    success: true,
    message: `Task reassigned to ${newAssigneeName}.`,
  };
}

/**
 * Starts work on an assigned task (moves TODO -> IN_PROGRESS).
 */
export async function startTaskWork(taskId: string): Promise<TaskActionResult> {
  const user = await requireAuth();
  await connectDB();

  if (!Types.ObjectId.isValid(taskId)) {
    return { success: false, message: 'Invalid task ID.' };
  }

  const task = await Task.findById(new Types.ObjectId(taskId));
  if (!task) {
    return { success: false, message: 'Task not found.' };
  }

  // Check ownership / permissions
  const isPM = await canManageProject(user, task.projectId);
  const isAssigned = task.assignedTo && task.assignedTo.toString() === user.id;

  if (!isPM && !isAssigned) {
    return { success: false, message: 'You are not assigned to this task.' };
  }

  // Active membership check
  if (!isPM && isAssigned) {
    const isMember = await isActiveProjectMember(user.id, task.projectId);
    if (!isMember) {
      return {
        success: false,
        message: 'You are no longer an active member of this project.',
      };
    }
  }

  if (
    task.status !== TASK_STATUSES.TODO &&
    task.status !== TASK_STATUSES.CHANGES_REQUESTED
  ) {
    return {
      success: false,
      message: `Cannot start work from ${task.status.toLowerCase()} status.`,
    };
  }

  const previousStatus = task.status;
  task.status = TASK_STATUSES.IN_PROGRESS;
  if (!task.startDate) {
    task.startDate = new Date();
  }
  task.updatedBy = new Types.ObjectId(user.id);
  await task.save();

  await TaskActivity.create({
    taskId: task._id,
    actorUserId: new Types.ObjectId(user.id),
    type: TASK_ACTIVITY_TYPES.TASK_STARTED,
    summary: `${user.name} started work on task.`,
    metadata: { previousStatus, newStatus: TASK_STATUSES.IN_PROGRESS },
  });

  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath('/admin/tasks/board');
  revalidatePath(`/employee/tasks/${taskId}`);
  revalidatePath('/employee/tasks/board');
  revalidatePath('/employee');

  return { success: true, message: 'Work started on task.' };
}

/**
 * Updates self-reported task progress (0 to 100).
 */
export async function updateTaskProgress(
  taskId: string,
  progressPercentage: number
): Promise<TaskActionResult> {
  const user = await requireAuth();
  await connectDB();

  if (!Types.ObjectId.isValid(taskId)) {
    return { success: false, message: 'Invalid task ID.' };
  }

  const task = await Task.findById(new Types.ObjectId(taskId));
  if (!task) {
    return { success: false, message: 'Task not found.' };
  }

  const isPM = await canManageProject(user, task.projectId);
  const isAssigned = task.assignedTo && task.assignedTo.toString() === user.id;

  if (!isPM && !isAssigned) {
    return { success: false, message: 'Unauthorized to update this task.' };
  }

  if (!isPM && isAssigned) {
    const isMember = await isActiveProjectMember(user.id, task.projectId);
    if (!isMember) {
      return { success: false, message: 'You are no longer active in this project.' };
    }
  }

  const clamped = Math.min(100, Math.max(0, Math.round(progressPercentage)));
  const previousProgress = task.progressPercentage;

  task.progressPercentage = clamped;
  task.updatedBy = new Types.ObjectId(user.id);
  await task.save();

  await TaskActivity.create({
    taskId: task._id,
    actorUserId: new Types.ObjectId(user.id),
    type: TASK_ACTIVITY_TYPES.PROGRESS_UPDATED,
    summary: `Progress updated from ${previousProgress}% to ${clamped}%.`,
    metadata: { previousProgress, newProgress: clamped },
  });

  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath(`/employee/tasks/${taskId}`);

  return { success: true, message: `Progress updated to ${clamped}%.` };
}

/**
 * Reports a blocker on a task (moves to BLOCKED).
 */
export async function reportTaskBlocker(
  taskId: string,
  rawData: unknown
): Promise<TaskActionResult> {
  const user = await requireAuth();

  const parseResult = reportBlockerSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['reason', 'description']),
      message: 'Please provide a valid blocker reason.',
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

  const isPM = await canManageProject(user, task.projectId);
  const isAssigned = task.assignedTo && task.assignedTo.toString() === user.id;

  if (!isPM && !isAssigned) {
    return { success: false, message: 'Unauthorized to report blockers for this task.' };
  }

  if (!isPM && isAssigned) {
    const isMember = await isActiveProjectMember(user.id, task.projectId);
    if (!isMember) {
      return { success: false, message: 'Not an active project member.' };
    }
  }

  const { reason, description } = parseResult.data;
  task.status = TASK_STATUSES.BLOCKED;
  task.blocker = {
    reason,
    description: description || null,
    reportedAt: new Date(),
    reportedBy: new Types.ObjectId(user.id),
  };
  task.updatedBy = new Types.ObjectId(user.id);
  await task.save();

  await TaskActivity.create({
    taskId: task._id,
    actorUserId: new Types.ObjectId(user.id),
    type: TASK_ACTIVITY_TYPES.BLOCKER_REPORTED,
    summary: `Blocker reported: "${reason}"`,
    metadata: { reason, description },
  });

  revalidatePath('/admin/tasks');
  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath('/admin/tasks/board');
  revalidatePath(`/employee/tasks/${taskId}`);
  revalidatePath('/employee/tasks/board');

  return { success: true, message: 'Blocker reported successfully.' };
}

/**
 * Resolves a blocker and resumes work (moves back to IN_PROGRESS).
 */
export async function resolveTaskBlocker(
  taskId: string,
  rawData: unknown
): Promise<TaskActionResult> {
  const user = await requireAuth();

  const parseResult = resolveBlockerSchema.safeParse(rawData || {});
  if (!parseResult.success) {
    return {
      success: false,
      message: 'Invalid resolution notes.',
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

  const isPM = await canManageProject(user, task.projectId);
  const isAssigned = task.assignedTo && task.assignedTo.toString() === user.id;

  if (!isPM && !isAssigned) {
    return { success: false, message: 'Unauthorized to resolve blocker.' };
  }

  if (task.status !== TASK_STATUSES.BLOCKED) {
    return { success: false, message: 'Task is not currently blocked.' };
  }

  const resolutionNotes = parseResult.data.resolutionNotes || null;

  if (task.blocker) {
    task.blocker.resolvedAt = new Date();
    task.blocker.resolvedBy = new Types.ObjectId(user.id);
    task.blocker.resolutionNotes = resolutionNotes;
  }

  task.status = TASK_STATUSES.IN_PROGRESS;
  task.updatedBy = new Types.ObjectId(user.id);
  await task.save();

  await TaskActivity.create({
    taskId: task._id,
    actorUserId: new Types.ObjectId(user.id),
    type: TASK_ACTIVITY_TYPES.BLOCKER_RESOLVED,
    summary: `Blocker resolved by ${user.name}.`,
    metadata: { resolutionNotes },
  });

  revalidatePath('/admin/tasks');
  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath('/admin/tasks/board');
  revalidatePath(`/employee/tasks/${taskId}`);
  revalidatePath('/employee/tasks/board');

  return { success: true, message: 'Blocker resolved. Task moved to In Progress.' };
}

/**
 * Submits work for review (moves to IN_REVIEW).
 * Requires work summary and optional evidence URLs.
 */
export async function submitTaskForReview(
  taskId: string,
  rawData: unknown
): Promise<TaskActionResult> {
  const user = await requireAuth();

  const parseResult = submitTaskReviewSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['submissionNotes']),
      message: 'Please provide a summary of completed work.',
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

  const isPM = await canManageProject(user, task.projectId);
  const isAssigned = task.assignedTo && task.assignedTo.toString() === user.id;

  if (!isPM && !isAssigned) {
    return { success: false, message: 'Unauthorized to submit this task.' };
  }

  if (!isPM && isAssigned) {
    const isMember = await isActiveProjectMember(user.id, task.projectId);
    if (!isMember) {
      return { success: false, message: 'Not an active project member.' };
    }
  }

  if (
    task.status !== TASK_STATUSES.IN_PROGRESS &&
    task.status !== TASK_STATUSES.CHANGES_REQUESTED &&
    task.status !== TASK_STATUSES.TODO
  ) {
    return {
      success: false,
      message: `Cannot submit for review from ${task.status.toLowerCase()} status.`,
    };
  }

  // Check incomplete dependencies
  if (task.dependencies && task.dependencies.length > 0) {
    const incompleteDeps = await Task.find({
      _id: { $in: task.dependencies },
      status: { $ne: TASK_STATUSES.COMPLETED },
    }).select('taskCode title status');

    if (incompleteDeps.length > 0) {
      const depCodes = incompleteDeps.map((d) => d.taskCode).join(', ');
      return {
        success: false,
        message: `Cannot submit for review: required dependencies are incomplete (${depCodes}).`,
      };
    }
  }

  const { submissionNotes, submissionLinks } = parseResult.data;

  task.status = TASK_STATUSES.IN_REVIEW;
  task.submittedAt = new Date();
  task.submittedBy = new Types.ObjectId(user.id);
  task.submissionNotes = submissionNotes;
  task.submissionLinks = submissionLinks;
  task.updatedBy = new Types.ObjectId(user.id);
  await task.save();

  await TaskActivity.create({
    taskId: task._id,
    actorUserId: new Types.ObjectId(user.id),
    type: TASK_ACTIVITY_TYPES.SUBMITTED_FOR_REVIEW,
    summary: `${user.name} submitted task for review.`,
    metadata: {
      submissionNotes,
      linksCount: submissionLinks.length,
    },
  });
  const reviewers = await User.find({ role: USER_ROLES.ADMIN, status: USER_STATUS.ACTIVE }).select('_id').lean(); await Promise.all(reviewers.map((reviewer) => createNotification({ recipientUserId: reviewer._id, type: 'TASK_SUBMITTED_FOR_REVIEW', title: 'Task submitted for review', message: `${task.taskCode}: ${task.title}`, resourceType: 'Task', resourceId: task._id, resourceUrl: `/admin/tasks/${task._id}`, idempotencyKey: `task-review:${task._id}:${task.submittedAt?.getTime()}:${reviewer._id}` })));

  revalidatePath('/admin/tasks');
  revalidatePath('/admin/tasks/review');
  revalidatePath('/admin/tasks/board');
  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath(`/employee/tasks/${taskId}`);
  revalidatePath('/employee/tasks/board');

  return { success: true, message: 'Work submitted for review successfully.' };
}

/**
 * Reviews a submitted task (Approve or Request Changes).
 * Self-approval is strictly forbidden!
 */
export async function reviewTask(
  taskId: string,
  rawData: unknown
): Promise<TaskActionResult> {
  const user = await requireAuth();

  const parseResult = reviewTaskSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['action', 'feedbackNotes']),
      message: 'Please resolve review feedback errors.',
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

  // Security: Check reviewer eligibility (prevents self-approval)
  const canReview = await canReviewTask(user, task);
  if (!canReview.allowed) {
    return {
      success: false,
      message: canReview.reason || 'You are not authorized to review this task.',
    };
  }

  if (task.status !== TASK_STATUSES.IN_REVIEW) {
    return {
      success: false,
      message: `Task is not currently in review (status: ${task.status}).`,
    };
  }

  const { action, feedbackNotes } = parseResult.data;
  const now = new Date();

  if (action === 'APPROVE') {
    task.status = TASK_STATUSES.COMPLETED;
    task.progressPercentage = 100;
    task.completedAt = now;
    task.reviewedBy = new Types.ObjectId(user.id);
    task.reviewedAt = now;
    task.reviewNotes = feedbackNotes || 'Approved.';
    task.updatedBy = new Types.ObjectId(user.id);
    await task.save();

    await TaskActivity.create({
      taskId: task._id,
      actorUserId: new Types.ObjectId(user.id),
      type: TASK_ACTIVITY_TYPES.TASK_APPROVED,
      summary: `Work approved by ${user.name}. Task marked as Completed.`,
      metadata: { reviewNotes: task.reviewNotes },
    });
    if (task.assignedTo) await createNotification({ recipientUserId: task.assignedTo, type: 'TASK_APPROVED', title: 'Task approved', message: `${task.taskCode} was approved.`, resourceType: 'Task', resourceId: task._id, resourceUrl: `/employee/tasks/${task._id}`, idempotencyKey: `task-approved:${task._id}:${now.getTime()}` });

    await syncProgress(task.projectId, task.milestoneId);

    revalidatePath('/admin/tasks');
    revalidatePath('/admin/tasks/review');
    revalidatePath('/admin/tasks/completed');
    revalidatePath('/admin/tasks/board');
    revalidatePath(`/admin/tasks/${taskId}`);
    revalidatePath(`/admin/projects/${task.projectId}`);
    revalidatePath(`/employee/tasks/${taskId}`);

    return {
      success: true,
      message: `Task ${task.taskCode} approved and marked completed.`,
    };
  } else {
    // REQUEST_CHANGES
    task.status = TASK_STATUSES.CHANGES_REQUESTED;
    task.reviewedBy = new Types.ObjectId(user.id);
    task.reviewedAt = now;
    task.reviewNotes = feedbackNotes;
    task.updatedBy = new Types.ObjectId(user.id);
    await task.save();

    await TaskActivity.create({
      taskId: task._id,
      actorUserId: new Types.ObjectId(user.id),
      type: TASK_ACTIVITY_TYPES.CHANGES_REQUESTED,
      summary: `Changes requested by ${user.name}: "${feedbackNotes}"`,
      metadata: { feedbackNotes },
    });
    if (task.assignedTo) await createNotification({ recipientUserId: task.assignedTo, type: 'TASK_CHANGES_REQUESTED', title: 'Task changes requested', message: `${task.taskCode} needs changes.`, resourceType: 'Task', resourceId: task._id, resourceUrl: `/employee/tasks/${task._id}`, idempotencyKey: `task-changes:${task._id}:${now.getTime()}` });

    revalidatePath('/admin/tasks');
    revalidatePath('/admin/tasks/review');
    revalidatePath('/admin/tasks/board');
    revalidatePath(`/admin/tasks/${taskId}`);
    revalidatePath(`/employee/tasks/${taskId}`);
    revalidatePath('/employee/tasks/board');

    return {
      success: true,
      message: 'Changes requested. The employee can revise their work.',
    };
  }
}

/**
 * Cancels a task.
 * Admin or designated Project Manager only.
 */
export async function cancelTask(taskId: string): Promise<TaskActionResult> {
  const user = await requireAuth();
  await connectDB();

  if (!Types.ObjectId.isValid(taskId)) {
    return { success: false, message: 'Invalid task ID.' };
  }

  const task = await Task.findById(new Types.ObjectId(taskId));
  if (!task) {
    return { success: false, message: 'Task not found.' };
  }

  const hasPermission = await canManageProject(user, task.projectId);
  if (!hasPermission) {
    return { success: false, message: 'Unauthorized to cancel this task.' };
  }

  task.status = TASK_STATUSES.CANCELLED;
  task.updatedBy = new Types.ObjectId(user.id);
  await task.save();

  await TaskActivity.create({
    taskId: task._id,
    actorUserId: new Types.ObjectId(user.id),
    type: TASK_ACTIVITY_TYPES.TASK_CANCELLED,
    summary: `Task cancelled by ${user.name}.`,
    metadata: { previousStatus: task.status },
  });

  await syncProgress(task.projectId, task.milestoneId);

  revalidatePath('/admin/tasks');
  revalidatePath(`/admin/tasks/${taskId}`);
  revalidatePath('/admin/tasks/board');

  return { success: true, message: `Task ${task.taskCode} cancelled.` };
}
