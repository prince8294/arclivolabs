import 'server-only';
import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { FileAsset, type IFileAsset } from '@/models/FileAsset';
import { FileVersion, type IFileVersion } from '@/models/FileVersion';
import { Project } from '@/models/Project';
import { ProjectMember } from '@/models/ProjectMember';
import { Client } from '@/models/Client';
import { User } from '@/models/User';
import { USER_ROLES, type AuthUser } from '@/types/auth';
import { getClientProfileForUser } from '@/lib/auth/client-profile';
import { canAccessFile } from '@/lib/auth/file-permissions';
import { FILE_STATUSES, FILE_VISIBILITIES, PROJECT_MEMBER_STATUSES } from '@/lib/constants/enums';

export interface FileFilters {
  projectId?: string;
  clientId?: string;
  category?: string;
  visibility?: string;
  status?: string;
  search?: string;
  taskId?: string;
  milestoneId?: string;
  page?: number;
  pageSize?: number;
}

export interface SerializedFileAsset {
  _id: string;
  fileCode: string;
  originalName: string;
  displayName: string;
  cloudinaryPublicId: string;
  resourceType: 'image' | 'video' | 'raw';
  deliveryType: string;
  format: string;
  mimeType: string;
  sizeBytes: number;
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
  taskId?: string | null;
  milestoneId?: string | null;
  uploadedBy: {
    _id: string;
    name: string;
    email: string;
  };
  category: string;
  visibility: string;
  status: string;
  currentVersionNumber: number;
  description?: string | null;
  reviewNotes?: string | null;
  reviewedBy?: {
    _id: string;
    name: string;
  } | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedFileVersion {
  _id: string;
  fileAssetId: string;
  versionNumber: number;
  originalName: string;
  cloudinaryPublicId: string;
  resourceType: 'image' | 'video' | 'raw';
  deliveryType: string;
  format: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: {
    _id: string;
    name: string;
  };
  changeSummary?: string | null;
  status: string;
  reviewedBy?: {
    _id: string;
    name: string;
  } | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
}

export async function listFiles(filters: FileFilters, user: AuthUser) {
  await connectDB();

  const query: Record<string, unknown> = {};
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
  const skip = (page - 1) * pageSize;

  // Role Scoping
  if (user.role === USER_ROLES.EMPLOYEE) {
    // Get all projects where employee is active member
    const memberships = await ProjectMember.find({
      userId: new Types.ObjectId(user.id),
      status: PROJECT_MEMBER_STATUSES.ACTIVE,
    })
      .select('projectId')
      .lean();

    const allowedProjectIds = memberships.map((m) => m.projectId);

    query.$and = [
      {
        $or: [
          { uploadedBy: new Types.ObjectId(user.id) },
          {
            projectId: { $in: allowedProjectIds },
            visibility: { $in: [FILE_VISIBILITIES.INTERNAL_TEAM, FILE_VISIBILITIES.CLIENT_UPLOADED, FILE_VISIBILITIES.CLIENT_VISIBLE] },
          },
        ],
      },
      { status: { $ne: FILE_STATUSES.ARCHIVED } },
    ];
  } else if (user.role === USER_ROLES.CLIENT) {
    const clientProfile = await getClientProfileForUser(user.id);
    if (!clientProfile) {
      return { files: [], total: 0, page, totalPages: 0 };
    }

    query.$and = [
      { clientId: new Types.ObjectId(clientProfile.id) },
      {
        $or: [
          { visibility: FILE_VISIBILITIES.CLIENT_VISIBLE },
          {
            visibility: FILE_VISIBILITIES.CLIENT_UPLOADED,
            uploadedBy: new Types.ObjectId(user.id),
          },
        ],
      },
      { status: { $ne: FILE_STATUSES.ARCHIVED } },
    ];
  } else if (user.role === USER_ROLES.MARKETING) {
    const clients = await Client.find({
      assignedMarketingUserId: new Types.ObjectId(user.id),
    })
      .select('_id')
      .lean();

    const clientIds = clients.map((c) => c._id);
    query.$and = [
      { clientId: { $in: clientIds } },
      { visibility: { $in: [FILE_VISIBILITIES.CLIENT_VISIBLE, FILE_VISIBILITIES.CLIENT_UPLOADED] } },
      { status: { $ne: FILE_STATUSES.ARCHIVED } },
    ];
  }

  // Filters
  if (filters.projectId) {
    query.projectId = new Types.ObjectId(filters.projectId);
  }
  if (filters.clientId && user.role === USER_ROLES.ADMIN) {
    query.clientId = new Types.ObjectId(filters.clientId);
  }
  if (filters.category) {
    query.category = filters.category;
  }
  if (filters.visibility && user.role === USER_ROLES.ADMIN) {
    query.visibility = filters.visibility;
  }
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.taskId) {
    query.taskId = new Types.ObjectId(filters.taskId);
  }
  if (filters.milestoneId) {
    query.milestoneId = new Types.ObjectId(filters.milestoneId);
  }

  if (filters.search) {
    const safeRegex = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { displayName: safeRegex },
      { originalName: safeRegex },
      { fileCode: safeRegex },
    ];
  }

  const [docs, total] = await Promise.all([
    FileAsset.find(query)
      .populate('projectId', 'projectCode title')
      .populate('clientId', 'clientCode name')
      .populate('uploadedBy', 'name email')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    FileAsset.countDocuments(query),
  ]);

  const files: SerializedFileAsset[] = docs.map((doc: any) => ({
    _id: doc._id.toString(),
    fileCode: doc.fileCode,
    originalName: doc.originalName,
    displayName: doc.displayName,
    cloudinaryPublicId: doc.cloudinaryPublicId,
    resourceType: doc.resourceType,
    deliveryType: doc.deliveryType,
    format: doc.format,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
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
    taskId: doc.taskId?.toString() || null,
    milestoneId: doc.milestoneId?.toString() || null,
    uploadedBy: {
      _id: doc.uploadedBy?._id?.toString() || doc.uploadedBy?.toString(),
      name: doc.uploadedBy?.name || 'Unknown',
      email: doc.uploadedBy?.email || '',
    },
    category: doc.category,
    visibility: doc.visibility,
    status: doc.status,
    currentVersionNumber: doc.currentVersionNumber,
    description: doc.description || null,
    reviewNotes: doc.reviewNotes || null,
    reviewedBy: doc.reviewedBy?._id
      ? {
          _id: doc.reviewedBy._id.toString(),
          name: doc.reviewedBy.name,
        }
      : null,
    reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }));

  return {
    files,
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getFileById(id: string, user: AuthUser) {
  await connectDB();

  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  const fileDoc = await FileAsset.findById(id)
    .populate('projectId', 'projectCode title')
    .populate('clientId', 'clientCode name')
    .populate('uploadedBy', 'name email')
    .populate('reviewedBy', 'name')
    .lean();

  if (!fileDoc) {
    return null;
  }

  const access = await canAccessFile(user, fileDoc as unknown as IFileAsset);
  if (!access.allowed) {
    return null;
  }

  const versionsDoc = await FileVersion.find({
    fileAssetId: fileDoc._id,
  })
    .populate('uploadedBy', 'name')
    .populate('reviewedBy', 'name')
    .sort({ versionNumber: -1 })
    .lean();

  const serializedFile: SerializedFileAsset = {
    _id: fileDoc._id.toString(),
    fileCode: fileDoc.fileCode,
    originalName: fileDoc.originalName,
    displayName: fileDoc.displayName,
    cloudinaryPublicId: fileDoc.cloudinaryPublicId,
    resourceType: fileDoc.resourceType,
    deliveryType: fileDoc.deliveryType,
    format: fileDoc.format,
    mimeType: fileDoc.mimeType,
    sizeBytes: fileDoc.sizeBytes,
    projectId: (fileDoc.projectId as any)?._id?.toString() || fileDoc.projectId.toString(),
    project: (fileDoc.projectId as any)?._id
      ? {
          _id: (fileDoc.projectId as any)._id.toString(),
          projectCode: (fileDoc.projectId as any).projectCode,
          title: (fileDoc.projectId as any).title,
        }
      : undefined,
    clientId: (fileDoc.clientId as any)?._id?.toString() || fileDoc.clientId.toString(),
    client: (fileDoc.clientId as any)?._id
      ? {
          _id: (fileDoc.clientId as any)._id.toString(),
          clientCode: (fileDoc.clientId as any).clientCode,
          name: (fileDoc.clientId as any).name,
        }
      : undefined,
    taskId: fileDoc.taskId?.toString() || null,
    milestoneId: fileDoc.milestoneId?.toString() || null,
    uploadedBy: {
      _id: (fileDoc.uploadedBy as any)?._id?.toString() || fileDoc.uploadedBy.toString(),
      name: (fileDoc.uploadedBy as any)?.name || 'Unknown',
      email: (fileDoc.uploadedBy as any)?.email || '',
    },
    category: fileDoc.category,
    visibility: fileDoc.visibility,
    status: fileDoc.status,
    currentVersionNumber: fileDoc.currentVersionNumber,
    description: fileDoc.description || null,
    reviewNotes: fileDoc.reviewNotes || null,
    reviewedBy: (fileDoc.reviewedBy as any)?._id
      ? {
          _id: (fileDoc.reviewedBy as any)._id.toString(),
          name: (fileDoc.reviewedBy as any).name,
        }
      : null,
    reviewedAt: fileDoc.reviewedAt ? fileDoc.reviewedAt.toISOString() : null,
    createdAt: fileDoc.createdAt.toISOString(),
    updatedAt: fileDoc.updatedAt.toISOString(),
  };

  const serializedVersions: SerializedFileVersion[] = versionsDoc.map((v: any) => ({
    _id: v._id.toString(),
    fileAssetId: v.fileAssetId.toString(),
    versionNumber: v.versionNumber,
    originalName: v.originalName,
    cloudinaryPublicId: v.cloudinaryPublicId,
    resourceType: v.resourceType,
    deliveryType: v.deliveryType,
    format: v.format,
    mimeType: v.mimeType,
    sizeBytes: v.sizeBytes,
    uploadedBy: {
      _id: v.uploadedBy?._id?.toString() || v.uploadedBy?.toString(),
      name: v.uploadedBy?.name || 'Unknown',
    },
    changeSummary: v.changeSummary || null,
    status: v.status,
    reviewedBy: v.reviewedBy?._id
      ? {
          _id: v.reviewedBy._id.toString(),
          name: v.reviewedBy.name,
        }
      : null,
    reviewedAt: v.reviewedAt ? v.reviewedAt.toISOString() : null,
    reviewNotes: v.reviewNotes || null,
    createdAt: v.createdAt.toISOString(),
  }));

  return {
    file: serializedFile,
    versions: serializedVersions,
  };
}

export async function getFileStats(user: AuthUser) {
  await connectDB();

  if (user.role === USER_ROLES.ADMIN) {
    const [awaitingReview, recentUploads, totalActive] = await Promise.all([
      FileAsset.countDocuments({ status: FILE_STATUSES.PENDING_REVIEW }),
      FileAsset.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      FileAsset.countDocuments({ status: { $ne: FILE_STATUSES.ARCHIVED } }),
    ]);

    return { awaitingReview, recentUploads, totalActive };
  }

  if (user.role === USER_ROLES.EMPLOYEE) {
    const [myUploads, myAwaitingReview, myRejected] = await Promise.all([
      FileAsset.countDocuments({ uploadedBy: new Types.ObjectId(user.id) }),
      FileAsset.countDocuments({
        uploadedBy: new Types.ObjectId(user.id),
        status: FILE_STATUSES.PENDING_REVIEW,
      }),
      FileAsset.countDocuments({
        uploadedBy: new Types.ObjectId(user.id),
        status: FILE_STATUSES.REJECTED,
      }),
    ]);

    return { myUploads, myAwaitingReview, myRejected };
  }

  return {};
}
