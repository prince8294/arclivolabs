import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canUploadToProject } from '@/lib/auth/file-permissions';
import { uploadToCloudinary } from '@/lib/cloudinary/upload';
import { generateSequentialCode } from '@/lib/db/generate-code';
import { FileAsset } from '@/models/FileAsset';
import { FileVersion } from '@/models/FileVersion';
import { Project } from '@/models/Project';
import { Task } from '@/models/Task';
import { ProjectMilestone } from '@/models/ProjectMilestone';
import { ClientRequirement } from '@/models/ClientRequirement';
import {
  FILE_CATEGORIES,
  FILE_VISIBILITIES,
  FILE_STATUSES,
  type FileCategory,
  type FileVisibility,
} from '@/lib/constants/enums';
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  PROHIBITED_EXTENSIONS,
  sanitizeFilename,
} from '@/lib/constants/files';
import { USER_ROLES } from '@/types/auth';
import { canUploadFileVersion } from '@/lib/files/upload-policy';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      return NextResponse.json(
        { error: 'File uploads require multipart/form-data.' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const parentFileId = formData.get('parentFileId') as string | null; // For uploading a new version
    const category = (formData.get('category') as string) || FILE_CATEGORIES.DOCUMENT;
    const rawVisibility = formData.get('visibility') as string | null;
    const displayName = (formData.get('displayName') as string) || '';
    const description = (formData.get('description') as string) || '';
    const changeSummary = (formData.get('changeSummary') as string) || '';
    const taskId = formData.get('taskId') as string | null;
    const milestoneId = formData.get('milestoneId') as string | null;
    const requirementId = formData.get('requirementId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!projectId || !Types.ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: 'Valid Project ID is required' }, { status: 400 });
    }

    if (parentFileId && !Types.ObjectId.isValid(parentFileId)) {
      return NextResponse.json({ error: 'Invalid parent file ID' }, { status: 400 });
    }

    await connectDB();
    const project = await Project.findById(projectId).lean();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check upload permissions for this user & project
    const perm = await canUploadToProject(user, projectId);
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Forbidden' }, { status: 403 });
    }

    let parentFileDoc = null;
    if (parentFileId) {
      parentFileDoc = await FileAsset.findById(parentFileId);
      if (!parentFileDoc || parentFileDoc.projectId.toString() !== project._id.toString()) {
        return NextResponse.json(
          { error: 'Parent file not found or does not belong to this project' },
          { status: 404 }
        );
      }
      if (!canUploadFileVersion(user, {
        status: parentFileDoc.status,
        visibility: parentFileDoc.visibility,
        uploadedBy: parentFileDoc.uploadedBy.toString(),
      })) {
        return NextResponse.json(
          { error: parentFileDoc.status === FILE_STATUSES.ARCHIVED
              ? 'Archived files cannot receive new versions'
              : 'You are not allowed to upload a version of this file' },
          { status: parentFileDoc.status === FILE_STATUSES.ARCHIVED ? 409 : 403 }
        );
      }
    }

    // Validate Task if passed
    if (taskId) {
      if (!Types.ObjectId.isValid(taskId)) {
        return NextResponse.json({ error: 'Invalid Task ID' }, { status: 400 });
      }
      const task = await Task.findOne({ _id: taskId, projectId }).lean();
      if (!task) {
        return NextResponse.json({ error: 'Task does not belong to this project' }, { status: 400 });
      }
    }

    // Validate Milestone if passed
    if (milestoneId) {
      if (!Types.ObjectId.isValid(milestoneId)) {
        return NextResponse.json({ error: 'Invalid Milestone ID' }, { status: 400 });
      }
      const ms = await ProjectMilestone.findOne({ _id: milestoneId, projectId }).lean();
      if (!ms) {
        return NextResponse.json({ error: 'Milestone does not belong to this project' }, { status: 400 });
      }
    }

    // Validate ClientRequirement if passed
    if (requirementId) {
      if (!Types.ObjectId.isValid(requirementId)) {
        return NextResponse.json({ error: 'Invalid Requirement ID' }, { status: 400 });
      }
      const reqDoc = await ClientRequirement.findOne({ _id: requirementId, projectId }).lean();
      if (!reqDoc) {
        return NextResponse.json({ error: 'Requirement does not belong to this project' }, { status: 400 });
      }
    }

    // Sanitize and inspect filename & extension
    const originalName = sanitizeFilename(file.name);
    const ext = (originalName.split('.').pop() || '').toLowerCase();

    if (new Set<string>(PROHIBITED_EXTENSIONS).has(ext)) {
      return NextResponse.json(
        { error: `Executable or script format (.${ext}) is prohibited for security reasons.` },
        { status: 400 }
      );
    }

    if (!new Set<string>(ALLOWED_EXTENSIONS).has(ext)) {
      return NextResponse.json(
        { error: `File format (.${ext}) is not supported. Allowed formats include PDF, DOCX, XLSX, CSV, Images, Videos, ZIP.` },
        { status: 400 }
      );
    }

    // Check MIME type and Size Limits
    const mimeConfig = ALLOWED_MIME_TYPES[file.type.toLowerCase()];
    if (!mimeConfig) {
      return NextResponse.json(
        { error: `File MIME type (${file.type || 'unknown'}) is not supported.` },
        { status: 400 }
      );
    }
    const maxSizeBytes = mimeConfig.maxSize;

    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `File exceeds maximum allowed size of ${Math.round(maxSizeBytes / (1024 * 1024))} MB.` },
        { status: 400 }
      );
    }

    // Derive initial visibility
    const allowedCategories = Object.values(FILE_CATEGORIES) as string[];
    if (!parentFileDoc && !allowedCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid file category' }, { status: 400 });
    }

    const allowedVisibilities = Object.values(FILE_VISIBILITIES) as string[];
    if (
      !parentFileDoc &&
      user.role === USER_ROLES.ADMIN &&
      rawVisibility &&
      !allowedVisibilities.includes(rawVisibility)
    ) {
      return NextResponse.json({ error: 'Invalid file visibility' }, { status: 400 });
    }

    let visibility: FileVisibility;
    if (user.role === USER_ROLES.CLIENT) {
      visibility = FILE_VISIBILITIES.CLIENT_UPLOADED;
    } else if (user.role === USER_ROLES.EMPLOYEE) {
      visibility = FILE_VISIBILITIES.INTERNAL_TEAM;
    } else {
      // ADMIN
      visibility = (rawVisibility as FileVisibility) || FILE_VISIBILITIES.ADMIN_ONLY;
    }

    // Derive initial status
    let status: (typeof FILE_STATUSES)[keyof typeof FILE_STATUSES] = FILE_STATUSES.READY;
    if (user.role === USER_ROLES.EMPLOYEE) {
      status = FILE_STATUSES.PENDING_REVIEW;
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let fileAssetDoc;
    let nextVersionNumber = 1;

    if (parentFileDoc) {
      // Adding a new version to existing FileAsset
      fileAssetDoc = parentFileDoc;
      nextVersionNumber = fileAssetDoc.currentVersionNumber + 1;
    } else {
      // Generate new sequential file code
      const fileCode = await generateSequentialCode('file', 'FILE');
      fileAssetDoc = new FileAsset({
        fileCode,
        originalName,
        displayName: displayName.trim() || originalName,
        cloudinaryPublicId: 'pending',
        resourceType: 'raw',
        deliveryType: 'authenticated',
        format: ext,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        projectId: project._id,
        clientId: project.clientId,
        taskId: taskId ? new Types.ObjectId(taskId) : null,
        milestoneId: milestoneId ? new Types.ObjectId(milestoneId) : null,
        requirementId: requirementId ? new Types.ObjectId(requirementId) : null,
        uploadedBy: new Types.ObjectId(user.id),
        category: category as FileCategory,
        visibility,
        status: FILE_STATUSES.PROCESSING,
        currentVersionNumber: 1,
        description: description.trim() || null,
      });
    }

    // Perform Cloudinary Upload
    const uploadResult = await uploadToCloudinary({
      buffer,
      filename: originalName,
      mimeType: file.type || 'application/octet-stream',
      projectId: project._id.toString(),
      category: parentFileDoc?.category ?? (category as FileCategory),
      fileCode: fileAssetDoc.fileCode,
      versionNumber: nextVersionNumber,
    });

    // Create FileVersion
    await FileVersion.create({
      fileAssetId: fileAssetDoc._id,
      versionNumber: nextVersionNumber,
      originalName,
      cloudinaryPublicId: uploadResult.cloudinaryPublicId,
      cloudinaryAssetId: uploadResult.cloudinaryAssetId,
      resourceType: uploadResult.resourceType,
      deliveryType: uploadResult.deliveryType,
      format: uploadResult.format,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: uploadResult.sizeBytes,
      uploadedBy: new Types.ObjectId(user.id),
      changeSummary: changeSummary.trim() || (nextVersionNumber === 1 ? 'Initial upload' : null),
      status,
    });

    // Update FileAsset with latest version info
    fileAssetDoc.cloudinaryPublicId = uploadResult.cloudinaryPublicId;
    fileAssetDoc.cloudinaryAssetId = uploadResult.cloudinaryAssetId;
    fileAssetDoc.resourceType = uploadResult.resourceType;
    fileAssetDoc.deliveryType = uploadResult.deliveryType;
    fileAssetDoc.format = uploadResult.format;
    fileAssetDoc.mimeType = file.type || 'application/octet-stream';
    fileAssetDoc.sizeBytes = uploadResult.sizeBytes;
    fileAssetDoc.currentVersionNumber = nextVersionNumber;
    fileAssetDoc.status = status;
    await fileAssetDoc.save();

    // If requirementId was attached, link file to ClientRequirement
    if (requirementId) {
      await ClientRequirement.findByIdAndUpdate(requirementId, {
        $addToSet: { fileAssetIds: fileAssetDoc._id },
      });
    }

    return NextResponse.json({
      success: true,
      file: {
        _id: fileAssetDoc._id.toString(),
        fileCode: fileAssetDoc.fileCode,
        displayName: fileAssetDoc.displayName,
        versionNumber: nextVersionNumber,
        status: fileAssetDoc.status,
      },
    });
  } catch (err: unknown) {
    console.error('[Upload API Error]:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'File upload failed' },
      { status: 500 }
    );
  }
}
