export const MAX_FILE_SIZE_BYTES = {
  IMAGE: 10 * 1024 * 1024, // 10 MB
  DOCUMENT: 20 * 1024 * 1024, // 20 MB
  ARCHIVE: 50 * 1024 * 1024, // 50 MB
  VIDEO: 100 * 1024 * 1024, // 100 MB
  DEFAULT: 20 * 1024 * 1024, // 20 MB
} as const;

export const ALLOWED_MIME_TYPES: Record<string, { category: string; maxSize: number }> = {
  // Documents
  'application/pdf': { category: 'DOCUMENT', maxSize: MAX_FILE_SIZE_BYTES.DOCUMENT },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    category: 'DOCUMENT',
    maxSize: MAX_FILE_SIZE_BYTES.DOCUMENT,
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    category: 'DOCUMENT',
    maxSize: MAX_FILE_SIZE_BYTES.DOCUMENT,
  },
  'text/csv': { category: 'DOCUMENT', maxSize: MAX_FILE_SIZE_BYTES.DOCUMENT },
  'text/plain': { category: 'DOCUMENT', maxSize: MAX_FILE_SIZE_BYTES.DOCUMENT },

  // Images
  'image/jpeg': { category: 'IMAGE', maxSize: MAX_FILE_SIZE_BYTES.IMAGE },
  'image/png': { category: 'IMAGE', maxSize: MAX_FILE_SIZE_BYTES.IMAGE },
  'image/webp': { category: 'IMAGE', maxSize: MAX_FILE_SIZE_BYTES.IMAGE },
  'image/svg+xml': { category: 'DESIGN', maxSize: MAX_FILE_SIZE_BYTES.IMAGE },

  // Videos
  'video/mp4': { category: 'VIDEO', maxSize: MAX_FILE_SIZE_BYTES.VIDEO },
  'video/webm': { category: 'VIDEO', maxSize: MAX_FILE_SIZE_BYTES.VIDEO },

  // Archives
  'application/zip': { category: 'DELIVERABLE', maxSize: MAX_FILE_SIZE_BYTES.ARCHIVE },
  'application/x-zip-compressed': { category: 'DELIVERABLE', maxSize: MAX_FILE_SIZE_BYTES.ARCHIVE },
};

export const ALLOWED_EXTENSIONS = [
  'pdf',
  'docx',
  'xlsx',
  'csv',
  'txt',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'svg',
  'mp4',
  'webm',
  'zip',
] as const;

export const PROHIBITED_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'sh',
  'msi',
  'dll',
  'vbs',
  'ps1',
  'com',
  'scr',
  'pif',
  'hta',
  'cpl',
  'jar',
] as const;

export function sanitizeFilename(filename: string): string {
  // Strip null bytes, control characters, path traversals
  const basename = filename.replace(/^.*[\\/]/, '');
  const sanitized = basename
    .replace(/[\0\x00-\x1F\x7F<>:"/\\|?*]/g, '')
    .trim()
    .replace(/^\.+/, ''); // no hidden or relative dots at start
  return sanitized.length > 0 ? sanitized.slice(0, 150) : 'attachment';
}
