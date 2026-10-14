import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { getCurrentUser } from '@/lib/auth/current-user';
import { canAccessFile } from '@/lib/auth/file-permissions';
import { generateAuthorizedDownloadUrl } from '@/lib/cloudinary/download';
import { isCloudinaryConfigured } from '@/lib/cloudinary/config';
import { FileAsset, type IFileAsset } from '@/models/FileAsset';
import { FileVersion } from '@/models/FileVersion';

interface RouteParams {
  params: Promise<{
    id: string;
    versionNumber: string;
  }>;
}

export async function GET(req: NextRequest, props: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, versionNumber: vNumStr } = await props.params;
    const versionNumber = parseInt(vNumStr, 10);

    if (!Types.ObjectId.isValid(id) || isNaN(versionNumber)) {
      return NextResponse.json({ error: 'Invalid file or version parameter' }, { status: 400 });
    }

    await connectDB();
    const file = await FileAsset.findById(id).lean();
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const access = await canAccessFile(user, file as unknown as IFileAsset);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || 'Forbidden' }, { status: 403 });
    }

    const version = await FileVersion.findOne({
      fileAssetId: file._id,
      versionNumber,
    }).lean();

    if (!version) {
      return NextResponse.json({ error: 'Requested version not found' }, { status: 404 });
    }

    const publicId = version.cloudinaryPublicId;
    const format = version.format;
    const resourceType = version.resourceType as 'image' | 'video' | 'raw';
    const deliveryType = version.deliveryType;
    const originalName = version.originalName;

    const safeFilename = encodeURIComponent(originalName.replace(/[^\w.-]/g, '_'));

    if (!isCloudinaryConfigured()) {
      return new NextResponse(`Mock file content for: ${file.displayName} v${versionNumber}`, {
        status: 200,
        headers: {
          'Content-Type': version.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
        },
      });
    }

    const downloadUrl = generateAuthorizedDownloadUrl({
      publicId,
      format,
      resourceType,
      deliveryType,
      expiresInSeconds: 300,
      attachmentName: safeFilename,
    });

    return NextResponse.redirect(downloadUrl, { status: 307 });
  } catch (err: any) {
    console.error('[Version Download Route Error]:', err);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
