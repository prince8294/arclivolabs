import 'server-only';

import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { Project } from '@/models/Project';
import { ProjectMember } from '@/models/ProjectMember';
import { Task, type ITask } from '@/models/Task';
import { PROJECT_MEMBER_ROLES, PROJECT_MEMBER_STATUSES } from '@/lib/constants/enums';
import { USER_ROLES, type AuthUser } from '@/types/auth';

/**
 * Checks whether the current user is a global Admin or a Project Manager
 * for the specified project.
 */
export async function canManageProject(
  user: AuthUser,
  projectId: string | Types.ObjectId
): Promise<boolean> {
  if (user.role === USER_ROLES.ADMIN) {
    return true;
  }
  if (user.role !== USER_ROLES.EMPLOYEE) {
    return false;
  }

  await connectDB();
  const projId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
  const project = await Project.findById(projId).select('managerId').lean();
  if (!project) {
    return false;
  }

  if (project.managerId && project.managerId.toString() === user.id) {
    return true;
  }

  const managerMember = await ProjectMember.findOne({
    projectId: projId,
    userId: new Types.ObjectId(user.id),
    role: PROJECT_MEMBER_ROLES.PROJECT_MANAGER,
    status: PROJECT_MEMBER_STATUSES.ACTIVE,
  }).lean();

  return Boolean(managerMember);
}

/**
 * Checks whether an employee is currently an active member of a project.
 */
export async function isActiveProjectMember(
  userId: string | Types.ObjectId,
  projectId: string | Types.ObjectId
): Promise<boolean> {
  await connectDB();
  const uId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const pId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;

  const member = await ProjectMember.findOne({
    projectId: pId,
    userId: uId,
    status: PROJECT_MEMBER_STATUSES.ACTIVE,
  }).lean();

  return Boolean(member);
}

/**
 * Verifies whether the user has read access to a task.
 * - Admin: full access
 * - Project Manager of task's project: full access
 * - Employee assigned to task (or active member of task's project): read access
 */
export async function canViewTask(
  user: AuthUser,
  task: ITask
): Promise<boolean> {
  if (user.role === USER_ROLES.ADMIN) {
    return true;
  }
  if (user.role !== USER_ROLES.EMPLOYEE) {
    return false;
  }

  // Check if user is PM of this project
  const isPM = await canManageProject(user, task.projectId);
  if (isPM) {
    return true;
  }

  // Check if active project member
  return isActiveProjectMember(user.id, task.projectId);
}

/**
 * Verifies whether the user can modify task details (reassign, set priority, etc.)
 * Only Admin or scoped Project Manager.
 */
export async function canEditTaskSettings(
  user: AuthUser,
  task: ITask
): Promise<boolean> {
  return canManageProject(user, task.projectId);
}

/**
 * Verifies whether the user is authorized to review (approve / request changes)
 * a submitted task. Self-approval is strictly forbidden.
 */
export async function canReviewTask(
  user: AuthUser,
  task: ITask
): Promise<{ allowed: boolean; reason?: string }> {
  // Employee cannot review their own submitted work!
  if (task.assignedTo && task.assignedTo.toString() === user.id) {
    return { allowed: false, reason: 'Employees cannot review or approve their own work.' };
  }
  if (task.submittedBy && task.submittedBy.toString() === user.id) {
    return { allowed: false, reason: 'You cannot review a task you submitted.' };
  }

  if (user.role === USER_ROLES.ADMIN) {
    return { allowed: true };
  }

  const isPM = await canManageProject(user, task.projectId);
  if (isPM) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'You do not have reviewer permissions for this project.' };
}
