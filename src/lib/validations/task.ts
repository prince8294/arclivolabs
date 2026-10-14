import { z } from 'zod';

import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/constants/enums';
import { enumField, isUrl, zodFieldErrors } from './common';

export const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export const optionalObjectIdSchema = z
  .string()
  .trim()
  .transform((val) => (val === '' ? null : val))
  .refine((val) => val === null || OBJECT_ID_PATTERN.test(val), {
    message: 'Invalid identifier format.',
  });

export const requiredObjectIdSchema = (message: string) =>
  z
    .string()
    .trim()
    .regex(OBJECT_ID_PATTERN, message);

export const taskTitleSchema = z
  .string()
  .trim()
  .min(2, 'Enter a task title (at least 2 characters).')
  .max(200, 'Task title is too long (max 200 characters).');

export const taskDescriptionSchema = z
  .string()
  .trim()
  .max(5000, 'Description cannot exceed 5000 characters.')
  .transform((val) => (val === '' ? null : val));

export const taskPrioritySchema = enumField(
  TASK_PRIORITIES,
  'Select a valid task priority.'
);

export const taskStatusSchema = enumField(
  TASK_STATUSES,
  'Select a valid task status.'
);

export const optionalDateSchema = z
  .string()
  .trim()
  .transform((val) => (val === '' ? null : val))
  .refine(
    (val) => {
      if (val === null) return true;
      const d = new Date(val);
      return !isNaN(d.getTime());
    },
    { message: 'Enter a valid date.' }
  )
  .transform((val) => (val ? new Date(val) : null));

export const submissionLinkSchema = z.object({
  title: z.string().trim().min(1, 'Link title is required.').max(100),
  url: z
    .string()
    .trim()
    .min(1, 'URL is required.')
    .max(1000)
    .refine((val) => isUrl(val), {
      message: 'Must be a valid URL (including https://).',
    }),
});

export const createTaskSchema = z
  .object({
    title: taskTitleSchema,
    description: taskDescriptionSchema.optional(),
    projectId: requiredObjectIdSchema('Select a project.'),
    milestoneId: optionalObjectIdSchema.optional(),
    assignedTo: optionalObjectIdSchema.optional(),
    priority: taskPrioritySchema.default(TASK_PRIORITIES.MEDIUM),
    startDate: optionalDateSchema.optional(),
    dueDate: optionalDateSchema.optional(),
    estimatedHours: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === '') return 0;
        const num = typeof val === 'number' ? val : parseFloat(val);
        return isNaN(num) || num < 0 ? 0 : Math.round(num * 60); // store as minutes
      }),
    labels: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
        return val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }),
    parentTaskId: optionalObjectIdSchema.optional(),
    dependencies: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((val) => {
        if (!val) return [];
        const arr = Array.isArray(val) ? val : [val];
        return arr
          .map((s) => s.trim())
          .filter((s) => OBJECT_ID_PATTERN.test(s));
      }),
  })
  .refine(
    (data) => {
      if (data.startDate && data.dueDate) {
        return data.startDate.getTime() <= data.dueDate.getTime();
      }
      return true;
    },
    {
      message: 'Start date cannot be after due date.',
      path: ['dueDate'],
    }
  );

export const updateTaskSchema = z
  .object({
    title: taskTitleSchema,
    description: taskDescriptionSchema.optional(),
    milestoneId: optionalObjectIdSchema.optional(),
    assignedTo: optionalObjectIdSchema.optional(),
    priority: taskPrioritySchema,
    status: taskStatusSchema.optional(),
    progressPercentage: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === '') return undefined;
        const num = typeof val === 'number' ? val : parseInt(val, 10);
        return isNaN(num) ? undefined : Math.min(100, Math.max(0, num));
      }),
    startDate: optionalDateSchema.optional(),
    dueDate: optionalDateSchema.optional(),
    estimatedHours: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === '') return undefined;
        const num = typeof val === 'number' ? val : parseFloat(val);
        return isNaN(num) || num < 0 ? 0 : Math.round(num * 60);
      }),
    labels: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((val) => {
        if (!val) return undefined;
        if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
        return val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }),
    parentTaskId: optionalObjectIdSchema.optional(),
    dependencies: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((val) => {
        if (!val) return undefined;
        const arr = Array.isArray(val) ? val : [val];
        return arr
          .map((s) => s.trim())
          .filter((s) => OBJECT_ID_PATTERN.test(s));
      }),
  })
  .refine(
    (data) => {
      if (data.startDate && data.dueDate) {
        return data.startDate.getTime() <= data.dueDate.getTime();
      }
      return true;
    },
    {
      message: 'Start date cannot be after due date.',
      path: ['dueDate'],
    }
  );

export const reassignTaskSchema = z.object({
  assignedTo: optionalObjectIdSchema,
});

export const updateProgressSchema = z.object({
  progressPercentage: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === 'number' ? val : parseInt(String(val), 10);
      if (isNaN(num)) throw new Error('Progress must be a number between 0 and 100.');
      return Math.min(100, Math.max(0, num));
    }),
});

export const reportBlockerSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(2, 'Enter the blocker reason (at least 2 characters).')
    .max(200, 'Reason is too long (max 200 characters).'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description is too long.')
    .optional()
    .transform((val) => (val === '' ? null : val)),
});

export const resolveBlockerSchema = z.object({
  resolutionNotes: z
    .string()
    .trim()
    .max(2000, 'Resolution notes are too long.')
    .optional()
    .transform((val) => (val === '' ? null : val)),
});

export const submitTaskReviewSchema = z.object({
  submissionNotes: z
    .string()
    .trim()
    .min(2, 'Please provide a brief summary of the completed work.')
    .max(2000, 'Submission summary is too long (max 2000 characters).'),
  submissionLinks: z
    .array(submissionLinkSchema)
    .optional()
    .default([]),
});

export const reviewTaskSchema = z
  .object({
    action: z.enum(['APPROVE', 'REQUEST_CHANGES'], {
      message: 'Action must be APPROVE or REQUEST_CHANGES.',
    }),
    feedbackNotes: z
      .string()
      .trim()
      .max(2000, 'Feedback notes are too long.')
      .optional()
      .transform((val) => (val === '' ? null : val)),
  })
  .refine(
    (data) => {
      if (data.action === 'REQUEST_CHANGES' && (!data.feedbackNotes || data.feedbackNotes.trim().length < 5)) {
        return false;
      }
      return true;
    },
    {
      message: 'Provide clear feedback when requesting changes (at least 5 characters).',
      path: ['feedbackNotes'],
    }
  );

export { zodFieldErrors };
