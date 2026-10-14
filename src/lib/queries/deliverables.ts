import 'server-only';
import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { ProjectDeliverable, type IProjectDeliverable } from '@/models/ProjectDeliverable';
import { FileVersion } from '@/models/FileVersion';
import { FileAsset } from '@/models/FileAsset';
import { Project } from '@/models/Project';
import { Client } from '@/models/Client';
import { USER_ROLES, type AuthUser } from '@/types/auth';
import { getClientProfileForUser } from '@/lib/auth/client-profile';
import { DELIVERABLE_STATUSES } from '@/lib/constants/enums';

export interface SerializedDeliverable {
  _id: string;
  deliverableCode: string;
  projectId: string;
  project?: {
    _id: string;
    projectCode: string;
    title: string;
  };
  clientId: string;
  client?: {
    _id: string;
    clientCode: string;
    name: string;
  };
  title: string;
  description?: string | null;
  deliveryNotes?: string | null;
  status: string;
  files: Array<{
    _id: string;
    fileAssetId: string;
    displayName: string;
    versionNumber: number;
    format: string;
    mimeType: string;
    sizeBytes: number;
    originalName: string;
  }>;
  createdBy: {
    _id: string;
    name: string;
  };
  publishedBy?: {
    _id: string;
    name: string;
  } | null;
  publishedAt?: string | null;
  clientAcknowledgedAt?: string | null;
  acknowledgedBy?: {
    _id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export async function listDeliverables(
  projectId: string | undefined,
  user: AuthUser
): Promise<SerializedDeliverable[]> {
  await connectDB();

  const query: Record<string, unknown> = {};

  if (projectId && Types.ObjectId.isValid(projectId)) {
    query.projectId = new Types.ObjectId(projectId);
  }

  if (user.role === USER_ROLES.CLIENT) {
    const clientProfile = await getClientProfileForUser(user.id);
    if (!clientProfile) {
      return [];
    }
    query.clientId = new Types.ObjectId(clientProfile.id);
    // Client only sees PUBLISHED or ACKNOWLEDGED deliverables
    query.status = { $in: [DELIVERABLE_STATUSES.PUBLISHED, DELIVERABLE_STATUSES.ACKNOWLEDGED] };
  } else if (user.role === USER_ROLES.EMPLOYEE) {
    // Employee only sees deliverables if assigned to the project
    // Admin sees all
  }

  const docs = await ProjectDeliverable.find(query)
    .populate('projectId', 'projectCode title')
    .populate('clientId', 'clientCode name')
    .populate('createdBy', 'name')
    .populate('publishedBy', 'name')
    .populate('acknowledgedBy', 'name')
    .populate({
      path: 'fileVersionIds',
      populate: {
        path: 'fileAssetId',
        select: 'displayName format mimeType sizeBytes fileCode',
      },
    })
    .sort({ createdAt: -1 })
    .lean();

  return docs.map((doc: any) => ({
    _id: doc._id.toString(),
    deliverableCode: doc.deliverableCode,
    projectId: doc.projectId?._id?.toString() || doc.projectId?.toString(),
    project: doc.projectId?._id
      ? {
          _id: doc.projectId._id.toString(),
          projectCode: doc.projectId.projectCode,
          title: doc.projectId.title,
        }
      : undefined,
    clientId: doc.clientId?._id?.toString() || doc.clientId?.toString(),
    client: doc.clientId?._id
      ? {
          _id: doc.clientId._id.toString(),
          clientCode: doc.clientId.clientCode,
          name: doc.clientId.name,
        }
      : undefined,
    title: doc.title,
    description: doc.description || null,
    deliveryNotes: doc.deliveryNotes || null,
    status: doc.status,
    files: (doc.fileVersionIds || []).map((fv: any) => ({
      _id: fv._id.toString(),
      fileAssetId: fv.fileAssetId?._id?.toString() || fv.fileAssetId?.toString(),
      displayName: fv.fileAssetId?.displayName || fv.originalName,
      versionNumber: fv.versionNumber,
      format: fv.format,
      mimeType: fv.mimeType,
      sizeBytes: fv.sizeBytes,
      originalName: fv.originalName,
    })),
    createdBy: {
      _id: doc.createdBy?._id?.toString() || doc.createdBy?.toString(),
      name: doc.createdBy?.name || 'Unknown',
    },
    publishedBy: doc.publishedBy?._id
      ? {
          _id: doc.publishedBy._id.toString(),
          name: doc.publishedBy.name,
        }
      : null,
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    clientAcknowledgedAt: doc.clientAcknowledgedAt ? doc.clientAcknowledgedAt.toISOString() : null,
    acknowledgedBy: doc.acknowledgedBy?._id
      ? {
          _id: doc.acknowledgedBy._id.toString(),
          name: doc.acknowledgedBy.name,
        }
      : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }));
}

export async function getDeliverableById(
  id: string,
  user: AuthUser
): Promise<SerializedDeliverable | null> {
  await connectDB();

  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  const doc = await ProjectDeliverable.findById(id)
    .populate('projectId', 'projectCode title')
    .populate('clientId', 'clientCode name')
    .populate('createdBy', 'name')
    .populate('publishedBy', 'name')
    .populate('acknowledgedBy', 'name')
    .populate({
      path: 'fileVersionIds',
      populate: {
        path: 'fileAssetId',
        select: 'displayName format mimeType sizeBytes fileCode',
      },
    })
    .lean();

  if (!doc) {
    return null;
  }

  if (user.role === USER_ROLES.CLIENT) {
    const clientProfile = await getClientProfileForUser(user.id);
    if (!clientProfile || clientProfile.id !== (doc.clientId as any)?._id?.toString()) {
      return null;
    }
    if (doc.status !== DELIVERABLE_STATUSES.PUBLISHED && doc.status !== DELIVERABLE_STATUSES.ACKNOWLEDGED) {
      return null;
    }
  }

  return {
    _id: doc._id.toString(),
    deliverableCode: doc.deliverableCode,
    projectId: (doc.projectId as any)?._id?.toString() || doc.projectId.toString(),
    project: (doc.projectId as any)?._id
      ? {
          _id: (doc.projectId as any)._id.toString(),
          projectCode: (doc.projectId as any).projectCode,
          title: (doc.projectId as any).title,
        }
      : undefined,
    clientId: (doc.clientId as any)?._id?.toString() || doc.clientId.toString(),
    client: (doc.clientId as any)?._id
      ? {
          _id: (doc.clientId as any)._id.toString(),
          clientCode: (doc.clientId as any).clientCode,
          name: (doc.clientId as any).name,
        }
      : undefined,
    title: doc.title,
    description: doc.description || null,
    deliveryNotes: doc.deliveryNotes || null,
    status: doc.status,
    files: (doc.fileVersionIds || []).map((fv: any) => ({
      _id: fv._id.toString(),
      fileAssetId: fv.fileAssetId?._id?.toString() || fv.fileAssetId?.toString(),
      displayName: fv.fileAssetId?.displayName || fv.originalName,
      versionNumber: fv.versionNumber,
      format: fv.format,
      mimeType: fv.mimeType,
      sizeBytes: fv.sizeBytes,
      originalName: fv.originalName,
    })),
    createdBy: {
      _id: (doc.createdBy as any)?._id?.toString() || doc.createdBy.toString(),
      name: (doc.createdBy as any)?.name || 'Unknown',
    },
    publishedBy: (doc.publishedBy as any)?._id
      ? {
          _id: (doc.publishedBy as any)._id.toString(),
          name: (doc.publishedBy as any).name,
        }
      : null,
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    clientAcknowledgedAt: doc.clientAcknowledgedAt ? doc.clientAcknowledgedAt.toISOString() : null,
    acknowledgedBy: (doc.acknowledgedBy as any)?._id
      ? {
          _id: (doc.acknowledgedBy as any)._id.toString(),
          name: (doc.acknowledgedBy as any).name,
        }
      : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
