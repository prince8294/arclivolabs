import 'server-only';
import { getCloudinaryClient, isCloudinaryConfigured } from './config';

export interface GenerateDownloadUrlOptions {
  publicId: string;
  format?: string;
  resourceType?: 'image' | 'video' | 'raw';
  deliveryType?: string;
  expiresInSeconds?: number;
  attachmentName?: string;
}

export function generateAuthorizedDownloadUrl(options: GenerateDownloadUrlOptions): string {
  const {
    publicId,
    format,
    resourceType = 'raw',
    deliveryType = 'authenticated',
    expiresInSeconds = 300, // 5 minutes default
    attachmentName,
  } = options;

  if (!isCloudinaryConfigured()) {
    return `/api/files/mock-download?publicId=${encodeURIComponent(publicId)}`;
  }

  const cloudinary = getCloudinaryClient();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  try {
    if (deliveryType === 'authenticated' || resourceType === 'raw') {
      return cloudinary.utils.private_download_url(publicId, format || '', {
        resource_type: resourceType,
        type: deliveryType,
        expires_at: expiresAt,
        attachment: attachmentName ? true : false,
      });
    }

    // Signed delivery URL for images/videos
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: deliveryType,
      sign_url: true,
      secure: true,
      flags: attachmentName ? `attachment:${attachmentName}` : undefined,
    });
  } catch (error) {
    console.error('[Cloudinary] Failed to generate private download URL:', error);
    // Fallback signed URL
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: deliveryType,
      sign_url: true,
      secure: true,
    });
  }
}
