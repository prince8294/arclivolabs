'use server';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { requireRole } from '@/lib/auth/authorization';
import { getCurrentUser } from '@/lib/auth/current-user';
import { FileAsset } from '@/models/FileAsset';
import { FileVersion } from '@/models/FileVersion';
import { ClientApproval } from '@/models/ClientApproval';
import { Client } from '@/models/Client';
import { createNotification } from '@/lib/notifications/create';
import { generateSequentialCode } from '@/lib/db/generate-code';
import {
  FILE_STATUSES,
  FILE_VISIBILITIES,
  CLIENT_APPROVAL_STATUSES,
  type FileVisibility,
} from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';

export async function updateFileMetadataAction(
  fileId: string,
  data: { displayName: string; category: string; visibility: string; description?: string | null }
) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  const file = await FileAsset.findById(fileId);
  if (!file) {
    return { success: false, error: 'File not found' };
  }

  file.displayName = data.displayName.trim();
  file.category = data.category as any;
  file.visibility = data.visibility as any;
  file.description = data.description?.trim() || null;
  await file.save();

  revalidatePath('/admin/files');
  revalidatePath(`/admin/files/${fileId}`);
  revalidatePath(`/admin/projects/${file.projectId}/files`);

  return { success: true };
}

export async function reviewFileVersionAction(
  fileId: string,
  versionNumber: number,
  decision: 'APPROVE' | 'REJECT',
  reviewNotes?: string | null
) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  const file = await FileAsset.findById(fileId);
  if (!file) {
    return { success: false, error: 'File not found' };
  }

  const version = await FileVersion.findOne({
    fileAssetId: file._id,
    versionNumber,
  });

  if (!version) {
    return { success: false, error: 'Version not found' };
  }

  const newStatus = decision === 'APPROVE' ? FILE_STATUSES.APPROVED : FILE_STATUSES.REJECTED;

  version.status = newStatus;
  version.reviewedBy = new Types.ObjectId(user.id);
  version.reviewedAt = new Date();
  version.reviewNotes = reviewNotes?.trim() || null;
  await version.save();

  // If this is the current active version, update FileAsset status as well
  if (file.currentVersionNumber === versionNumber) {
    file.status = newStatus;
    file.reviewedBy = new Types.ObjectId(user.id);
    file.reviewedAt = new Date();
    file.reviewNotes = reviewNotes?.trim() || null;
    await file.save();
  }

  revalidatePath('/admin/files');
  revalidatePath(`/admin/files/${fileId}`);
  revalidatePath(`/admin/projects/${file.projectId}/files`);
  revalidatePath(`/employee/projects/${file.projectId}/files`);

  return { success: true };
}

export async function changeFileVisibilityAction(
  fileId: string,
  visibility: FileVisibility
) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  const file = await FileAsset.findById(fileId);
  if (!file) {
    return { success: false, error: 'File not found' };
  }

  file.visibility = visibility;
  await file.save();

  revalidatePath('/admin/files');
  revalidatePath(`/admin/files/${fileId}`);
  revalidatePath(`/admin/projects/${file.projectId}/files`);
  revalidatePath(`/client/projects/${file.projectId}/files`);

  return { success: true };
}

export async function archiveFileAction(fileId: string) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  const file = await FileAsset.findById(fileId);
  if (!file) {
    return { success: false, error: 'File not found' };
  }

  file.status = FILE_STATUSES.ARCHIVED;
  file.archivedAt = new Date();
  file.archivedBy = new Types.ObjectId(user.id);
  await file.save();

  revalidatePath('/admin/files');
  revalidatePath(`/admin/files/${fileId}`);
  revalidatePath(`/admin/projects/${file.projectId}/files`);

  return { success: true };
}

/**
 * Creates a Client Approval request linked directly to an exact FileVersion (§31).
 */
export async function createClientApprovalForFileAction(
  fileId: string,
  versionNumber: number,
  title: string,
  description?: string
) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  const file = await FileAsset.findById(fileId);
  if (!file) {
    return { success: false, error: 'File not found' };
  }

  const version = await FileVersion.findOne({
    fileAssetId: file._id,
    versionNumber,
  });

  if (!version) {
    return { success: false, error: 'File version not found' };
  }

  const approvalCode = await generateSequentialCode('approval', 'APR');

  const approval = await ClientApproval.create({
    approvalCode,
    projectId: file.projectId,
    clientId: file.clientId,
    title: title.trim(),
    description: description?.trim() || null,
    fileAssetId: file._id,
    fileVersionNumber: versionNumber,
    status: CLIENT_APPROVAL_STATUSES.PENDING,
    requestedBy: new Types.ObjectId(user.id),
  });

  // Make file client visible if not already
  if (file.visibility !== FILE_VISIBILITIES.CLIENT_VISIBLE) {
    file.visibility = FILE_VISIBILITIES.CLIENT_VISIBLE;
    await file.save();
  }
  const client = await Client.findById(file.clientId).select('userId').lean(); if (client?.userId) await createNotification({ recipientUserId: client.userId, type: 'CLIENT_APPROVAL_REQUESTED', title: 'Approval requested', message: `${approvalCode}: ${title.trim()}`, resourceType: 'ClientApproval', resourceId: approval._id, resourceUrl: '/client/approvals', idempotencyKey: `client-approval:${approval._id}` });

  revalidatePath(`/admin/files/${fileId}`);
  revalidatePath(`/client/approvals`);
  revalidatePath(`/client/projects/${file.projectId}/files`);

  return { success: true, approvalCode };
}
