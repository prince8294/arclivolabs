import { z } from 'zod';

import { TASK_COMMENT_VISIBILITIES } from '@/lib/constants/enums';
import { enumField, zodFieldErrors } from './common';

export const createTaskCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty.')
    .max(4000, 'Comment cannot exceed 4000 characters.'),
  visibility: enumField(
    TASK_COMMENT_VISIBILITIES,
    'Invalid comment visibility.'
  ).default(TASK_COMMENT_VISIBILITIES.INTERNAL),
});

export const updateTaskCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty.')
    .max(4000, 'Comment cannot exceed 4000 characters.'),
});

export { zodFieldErrors };
