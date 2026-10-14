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
  }>;
}

export async function GET(req: NextRequest, props: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
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

    // Get current version
    const version = await FileVersion.findOne({
      fileAssetId: file._id,
      versionNumber: file.currentVersionNumber,
    }).lean();

    const publicId = version?.cloudinaryPublicId || file.cloudinaryPublicId;
    const format = version?.format || file.format;
    const resourceType = (version?.resourceType || file.resourceType) as 'image' | 'video' | 'raw';
    const deliveryType = version?.deliveryType || file.deliveryType;
    const originalName = version?.originalName || file.originalName;

    // Secure safe attachment filename for headers
    const safeFilename = encodeURIComponent(originalName.replace(/[^\w.-]/g, '_'));

    if (!isCloudinaryConfigured()) {
      // Offline / Test mock mode: return download response
      return new NextResponse(`Mock file content for: ${file.displayName} (${file.fileCode})`, {
        status: 200,
        headers: {
          'Content-Type': file.mimeType || 'application/octet-stream',
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
    console.error('[Download Route Error]:', err);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
