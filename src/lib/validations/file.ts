import { z } from 'zod';
import {
  FILE_CATEGORIES,
  FILE_VISIBILITIES,
  enumValues,
} from '@/lib/constants/enums';

export const uploadFileSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  category: z.enum(enumValues(FILE_CATEGORIES)),
  visibility: z.enum(enumValues(FILE_VISIBILITIES)).optional(),
  displayName: z.string().trim().min(1, 'Display name is required').max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  taskId: z.string().optional().nullable(),
  milestoneId: z.string().optional().nullable(),
  requirementId: z.string().optional().nullable(),
  changeSummary: z.string().trim().max(1000).optional(),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;

export const updateFileMetadataSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(255),
  category: z.enum(enumValues(FILE_CATEGORIES)),
  visibility: z.enum(enumValues(FILE_VISIBILITIES)),
  description: z.string().trim().max(2000).optional().nullable(),
});

export type UpdateFileMetadataInput = z.infer<typeof updateFileMetadataSchema>;

export const reviewFileSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reviewNotes: z.string().trim().max(2000).optional().nullable(),
});

export type ReviewFileInput = z.infer<typeof reviewFileSchema>;

export const changeVisibilitySchema = z.object({
  visibility: z.enum(enumValues(FILE_VISIBILITIES)),
});

export type ChangeVisibilityInput = z.infer<typeof changeVisibilitySchema>;
