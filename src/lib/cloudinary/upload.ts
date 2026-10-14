import 'server-only';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { getCloudinaryClient, isCloudinaryConfigured } from './config';
import { getResourceType, getCloudinaryFolder, generatePublicId } from './utils';
import type { FileCategory } from '@/lib/constants/enums';

export interface UploadFileOptions {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  projectId: string;
  category: FileCategory;
  fileCode: string;
  versionNumber: number;
}

export interface UploadFileResult {
  cloudinaryPublicId: string;
  cloudinaryAssetId?: string;
  secureUrl: string;
  sizeBytes: number;
  format: string;
  resourceType: 'image' | 'video' | 'raw';
  deliveryType: string;
}

export async function uploadToCloudinary(options: UploadFileOptions): Promise<UploadFileResult> {
  const { buffer, filename, mimeType, projectId, category, fileCode, versionNumber } = options;

  const ext = filename.split('.').pop() || '';
  const resourceType = getResourceType(mimeType, ext);
  const folder = getCloudinaryFolder(projectId, category);
  const publicId = `${folder}/${generatePublicId(fileCode, versionNumber)}`;

  if (!isCloudinaryConfigured()) {
    // Graceful offline fallback when Cloudinary credentials are not supplied
    console.warn('[Cloudinary] Credentials not configured. Simulating upload metadata.');
    return {
      cloudinaryPublicId: publicId,
      cloudinaryAssetId: `mock-asset-${Date.now()}`,
      secureUrl: `https://res.cloudinary.com/demo/${resourceType}/upload/${publicId}.${ext || 'bin'}`,
      sizeBytes: buffer.length,
      format: ext.toLowerCase(),
      resourceType,
      deliveryType: 'authenticated',
    };
  }

  const cloudinary = getCloudinaryClient();

  return new Promise<UploadFileResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType,
        type: 'authenticated', // Protect files with authenticated delivery
        overwrite: false,
        use_filename: false,
        unique_filename: true,
      },
      (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
        if (error || !result) {
          // If 'authenticated' fails due to account restrictions, retry with standard upload
          cloudinary.uploader.upload_stream(
            {
              public_id: publicId,
              resource_type: resourceType,
              overwrite: false,
            },
            (retryErr?: UploadApiErrorResponse, retryResult?: UploadApiResponse) => {
              if (retryErr || !retryResult) {
                return reject(retryErr || error || new Error('Upload to Cloudinary failed'));
              }
              resolve({
                cloudinaryPublicId: retryResult.public_id,
                cloudinaryAssetId: retryResult.asset_id,
                secureUrl: retryResult.secure_url,
                sizeBytes: retryResult.bytes,
                format: retryResult.format || ext.toLowerCase(),
                resourceType,
                deliveryType: 'upload',
              });
            }
          ).end(buffer);
          return;
        }

        resolve({
          cloudinaryPublicId: result.public_id,
          cloudinaryAssetId: result.asset_id,
          secureUrl: result.secure_url,
          sizeBytes: result.bytes,
          format: result.format || ext.toLowerCase(),
          resourceType,
          deliveryType: 'authenticated',
        });
      }
    );

    uploadStream.end(buffer);
  });
}
