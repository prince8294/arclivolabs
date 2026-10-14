import 'server-only';
import { getCloudinaryClient, isCloudinaryConfigured } from './config';

export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'raw'
): Promise<boolean> {
  if (!isCloudinaryConfigured()) {
    return true;
  }

  const cloudinary = getCloudinaryClient();
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    return result.result === 'ok';
  } catch (err) {
    console.error(`[Cloudinary] Failed to delete asset ${publicId}:`, err);
    return false;
  }
}
