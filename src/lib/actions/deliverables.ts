'use server';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { requireRole } from '@/lib/auth/authorization';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getClientProfileForUser } from '@/lib/auth/client-profile';
import { ProjectDeliverable } from '@/models/ProjectDeliverable';
import { FileVersion } from '@/models/FileVersion';
import { FileAsset } from '@/models/FileAsset';
import { Project } from '@/models/Project';
import { generateSequentialCode } from '@/lib/db/generate-code';
import {
  DELIVERABLE_STATUSES,
  FILE_VISIBILITIES,
  FILE_STATUSES,
} from '@/lib/constants/enums';
import { USER_ROLES } from '@/types/auth';
import { createDeliverableSchema } from '@/lib/validations/deliverable';

export async function createDeliverableAction(data: {
  projectId: string;
  title: string;
  description?: string | null;
  deliveryNotes?: string | null;
  fileVersionIds: string[];
}) {
  const user = await requireRole(USER_ROLES.ADMIN);
  const parsed = createDeliverableSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  await connectDB();
  const project = await Project.findById(parsed.data.projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  // Verify all fileVersionIds exist
  const versions = await FileVersion.find({
    _id: { $in: parsed.data.fileVersionIds.map((id) => new Types.ObjectId(id)) },
  });

  if (versions.length !== parsed.data.fileVersionIds.length) {
    return { success: false, error: 'One or more selected file versions were not found' };
  }

  const deliverableCode = await generateSequentialCode('deliverable', 'DLV');

  const deliverable = await ProjectDeliverable.create({
    deliverableCode,
    projectId: project._id,
    clientId: project.clientId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    deliveryNotes: parsed.data.deliveryNotes || null,
    fileVersionIds: versions.map((v) => v._id),
    status: DELIVERABLE_STATUSES.DRAFT,
    createdBy: new Types.ObjectId(user.id),
  });

  revalidatePath(`/admin/projects/${project._id}/deliverables`);

  return { success: true, deliverableId: deliverable._id.toString(), deliverableCode };
}

export async function publishDeliverableAction(deliverableId: string) {
  const user = await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  const deliverable = await ProjectDeliverable.findById(deliverableId);
  if (!deliverable) {
    return { success: false, error: 'Deliverable not found' };
  }

  deliverable.status = DELIVERABLE_STATUSES.PUBLISHED;
  deliverable.publishedBy = new Types.ObjectId(user.id);
  deliverable.publishedAt = new Date();
  await deliverable.save();

  // Ensure all included file assets become CLIENT_VISIBLE
  const versions = await FileVersion.find({
    _id: { $in: deliverable.fileVersionIds },
  });

  const fileAssetIds = versions.map((v) => v.fileAssetId);
  await FileAsset.updateMany(
    { _id: { $in: fileAssetIds } },
    {
      $set: {
        visibility: FILE_VISIBILITIES.CLIENT_VISIBLE,
        status: FILE_STATUSES.APPROVED,
      },
    }
  );

  revalidatePath(`/admin/projects/${deliverable.projectId}/deliverables`);
  revalidatePath(`/client/projects/${deliverable.projectId}/deliverables`);
  revalidatePath(`/client/files`);

  return { success: true };
}

export async function acknowledgeDeliverableAction(deliverableId: string) {
  const user = await requireRole(USER_ROLES.CLIENT);
  const clientProfile = await getClientProfileForUser(user.id);
  if (!clientProfile) {
    return { success: false, error: 'Client profile not found' };
  }

  await connectDB();
  const deliverable = await ProjectDeliverable.findById(deliverableId);
  if (!deliverable) {
    return { success: false, error: 'Deliverable not found' };
  }

  if (deliverable.clientId.toString() !== clientProfile.id) {
    return { success: false, error: 'You do not own this deliverable' };
  }

  if (deliverable.status !== DELIVERABLE_STATUSES.PUBLISHED) {
    return { success: false, error: 'Deliverable is not published' };
  }

  deliverable.status = DELIVERABLE_STATUSES.ACKNOWLEDGED;
  deliverable.clientAcknowledgedAt = new Date();
  deliverable.acknowledgedBy = new Types.ObjectId(user.id);
  await deliverable.save();

  revalidatePath(`/client/projects/${deliverable.projectId}/deliverables`);
  revalidatePath(`/admin/projects/${deliverable.projectId}/deliverables`);

  return { success: true };
}
