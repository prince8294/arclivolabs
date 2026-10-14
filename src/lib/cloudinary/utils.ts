import 'server-only';
import crypto from 'crypto';
import { FILE_CATEGORIES, type FileCategory } from '@/lib/constants/enums';

export function getResourceType(mimeType: string, extension: string): 'image' | 'video' | 'raw' {
  const lowerExt = extension.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  // SVG is best handled as 'image' in Cloudinary or 'raw' if restricting SVG execution
  if (lowerExt === 'svg' || lowerMime === 'image/svg+xml') {
    return 'image';
  }

  if (lowerMime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(lowerExt)) {
    return 'image';
  }

  if (lowerMime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(lowerExt)) {
    return 'video';
  }

  return 'raw';
}

export function getCloudinaryFolder(projectId: string, category: FileCategory): string {
  const categoryFolderMap: Record<FileCategory, string> = {
    [FILE_CATEGORIES.CLIENT_REQUIREMENT]: 'requirements',
    [FILE_CATEGORIES.REFERENCE]: 'references',
    [FILE_CATEGORIES.DESIGN]: 'designs',
    [FILE_CATEGORIES.SOURCE_CODE]: 'employee-work',
    [FILE_CATEGORIES.DOCUMENT]: 'documents',
    [FILE_CATEGORIES.IMAGE]: 'designs',
    [FILE_CATEGORIES.VIDEO]: 'designs',
    [FILE_CATEGORIES.TASK_ATTACHMENT]: 'employee-work',
    [FILE_CATEGORIES.MILESTONE_ATTACHMENT]: 'milestones',
    [FILE_CATEGORIES.DELIVERABLE]: 'deliverables',
    [FILE_CATEGORIES.CONTRACT]: 'documents',
    [FILE_CATEGORIES.PAYMENT_PROOF]: 'payment-proofs',
    [FILE_CATEGORIES.OTHER]: 'documents',
  };

  const folderName = categoryFolderMap[category] || 'documents';
  return `arclivo-labs/projects/${projectId}/${folderName}`;
}

export function generatePublicId(fileCode: string, versionNumber: number): string {
  const uniqueSuffix = crypto.randomBytes(6).toString('hex');
  return `${fileCode.toLowerCase()}_v${versionNumber}_${uniqueSuffix}`;
}
