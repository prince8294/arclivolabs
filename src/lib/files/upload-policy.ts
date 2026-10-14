import {
  FILE_STATUSES,
  FILE_VISIBILITIES,
  type FileStatus,
  type FileVisibility,
} from '../constants/enums.ts';
import { USER_ROLES, type UserRole } from '../../types/auth.ts';

interface VersionUploadUser {
  id: string;
  role: UserRole;
}

interface VersionUploadFile {
  status: FileStatus;
  visibility: FileVisibility;
  uploadedBy: string;
}

/**
 * Applies file-level rules after access to the containing project has already
 * been established. Project membership/ownership remains a separate check.
 */
export function canUploadFileVersion(
  user: VersionUploadUser,
  file: VersionUploadFile
): boolean {
  if (file.status === FILE_STATUSES.ARCHIVED) return false;
  if (user.role === USER_ROLES.ADMIN) return true;
  if (user.role === USER_ROLES.EMPLOYEE) return true;
  if (user.role === USER_ROLES.CLIENT) {
    return (
      file.visibility === FILE_VISIBILITIES.CLIENT_UPLOADED &&
      file.uploadedBy === user.id
    );
  }
  return false;
}
