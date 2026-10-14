import 'server-only';

import connectDB from '@/lib/db/mongoose';
import { Project } from '@/models/Project';
import { Client } from '@/models/Client';
import type { IFileAsset } from '@/models/FileAsset';
import { isActiveProjectMember } from './project-permissions';
import { getClientProfileForUser } from './client-profile';
import { USER_ROLES, type AuthUser } from '@/types/auth';
import { FILE_VISIBILITIES, FILE_STATUSES } from '@/lib/constants/enums';

export interface FileAccessCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates whether the user is permitted to view/download a file asset.
 */
export async function canAccessFile(
  user: AuthUser,
  file: IFileAsset
): Promise<FileAccessCheckResult> {
  if (user.role === USER_ROLES.ADMIN) {
    return { allowed: true };
  }

  await connectDB();

  // If file is archived, only Admin can access
  if (file.status === FILE_STATUSES.ARCHIVED) {
    return { allowed: false, reason: 'This file has been archived.' };
  }

  // EMPLOYEE
  if (user.role === USER_ROLES.EMPLOYEE) {
    // If Admin Only, employees cannot see it
    if (file.visibility === FILE_VISIBILITIES.ADMIN_ONLY) {
      return { allowed: false, reason: 'This document is restricted to administrators.' };
    }

    // If employee is the uploader, they can see their own file
    if (file.uploadedBy.toString() === user.id) {
      return { allowed: true };
    }

    // Must be an active member of the project
    const isMember = await isActiveProjectMember(user.id, file.projectId);
    if (!isMember) {
      return { allowed: false, reason: 'You are not assigned to this project.' };
    }

    return { allowed: true };
  }

  // CLIENT
  if (user.role === USER_ROLES.CLIENT) {
    const clientProfile = await getClientProfileForUser(user.id);
    if (!clientProfile || clientProfile.id !== file.clientId.toString()) {
      return { allowed: false, reason: 'You do not have access to this client file.' };
    }

    // Client can only see CLIENT_VISIBLE or their own CLIENT_UPLOADED files
    if (
      file.visibility === FILE_VISIBILITIES.CLIENT_VISIBLE ||
      (file.visibility === FILE_VISIBILITIES.CLIENT_UPLOADED && file.uploadedBy.toString() === user.id)
    ) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'This file is not published or visible to clients.' };
  }

  // MARKETING
  if (user.role === USER_ROLES.MARKETING) {
    // Check if client is assigned to this marketing user
    const client = await Client.findById(file.clientId).select('assignedMarketingUserId').lean();
    if (client?.assignedMarketingUserId?.toString() === user.id) {
      // Marketing can only see CLIENT_VISIBLE or CLIENT_UPLOADED documents
      if (
        file.visibility === FILE_VISIBILITIES.CLIENT_VISIBLE ||
        file.visibility === FILE_VISIBILITIES.CLIENT_UPLOADED
      ) {
        return { allowed: true };
      }
    }
    return { allowed: false, reason: 'Marketing users cannot access internal project assets.' };
  }

  return { allowed: false, reason: 'Unauthorized' };
}

/**
 * Validates whether the user can upload a file into a project.
 */
export async function canUploadToProject(
  user: AuthUser,
  projectId: string
): Promise<FileAccessCheckResult> {
  if (user.role === USER_ROLES.ADMIN) {
    return { allowed: true };
  }

  await connectDB();
  const proj = await Project.findById(projectId).lean();
  if (!proj) {
    return { allowed: false, reason: 'Project not found.' };
  }

  if (user.role === USER_ROLES.EMPLOYEE) {
    const isMember = await isActiveProjectMember(user.id, projectId);
    if (!isMember) {
      return { allowed: false, reason: 'You are not assigned to this project.' };
    }
    return { allowed: true };
  }

  if (user.role === USER_ROLES.CLIENT) {
    const clientProfile = await getClientProfileForUser(user.id);
    if (!clientProfile || clientProfile.id !== proj.clientId.toString()) {
      return { allowed: false, reason: 'You do not own this project.' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Unauthorized to upload to this project.' };
}
