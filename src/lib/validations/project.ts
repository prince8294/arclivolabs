import { z } from 'zod';

import {
  PROJECT_HEALTHS,
  PROJECT_MEMBER_ROLES,
  PROJECT_MILESTONE_STATUSES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  TASK_PRIORITIES,
} from '@/lib/constants/enums';
import { enumField, zodFieldErrors } from './common';
import {
  OBJECT_ID_PATTERN,
  optionalDateSchema,
  optionalObjectIdSchema,
  requiredObjectIdSchema,
} from './task';

const optionalTextList = z
  .string()
  .trim()
  .max(5000)
  .optional()
  .transform((value) =>
    value
      ? value
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      : []
  );

/**
 * A list of referenced ids that yields a clean `string[]` (blank entries
 * dropped, malformed ids rejected) so callers never have to filter `null`.
 */
const objectIdListSchema = z
  .array(
    z
      .string()
      .trim()
      .refine((value) => value === '' || OBJECT_ID_PATTERN.test(value), {
        message: 'Invalid identifier format.',
      })
  )
  .transform((values) => values.filter((value) => value !== ''));

/* -------------------------------------------------------------------------- */
/* Project                                                                     */
/* -------------------------------------------------------------------------- */

const projectCoreShape = {
  title: z.string().trim().min(2, 'Enter a project title.').max(200),
  description: z.string().trim().max(5000).optional().transform((v) => v || null),
  clientId: requiredObjectIdSchema('Select a client.'),
  projectType: enumField(PROJECT_TYPES, 'Select a project type.').default(
    PROJECT_TYPES.OTHER
  ),
  priority: enumField(TASK_PRIORITIES, 'Select a valid priority.').default(
    TASK_PRIORITIES.MEDIUM
  ),
  startDate: optionalDateSchema.optional(),
  expectedEndDate: optionalDateSchema.optional(),
};

export const createProjectSchema = z
  .object({
    ...projectCoreShape,
    /** Optional: links a finalized Deal and turns this into a deal project. */
    dealId: optionalObjectIdSchema.optional(),
    managerId: optionalObjectIdSchema.optional(),
    health: enumField(PROJECT_HEALTHS, 'Select a valid project health.').default(
      PROJECT_HEALTHS.ON_TRACK
    ),
    /** New projects always begin in PLANNING; status moves go through the gate. */
    status: enumField(PROJECT_STATUSES, 'Select a valid project status.').default(
      PROJECT_STATUSES.PLANNING
    ),
    scopeSummary: z.string().trim().max(5000).optional().transform((v) => v || null),
    includedFeatures: optionalTextList,
    deliverables: optionalTextList,
    dependencies: optionalTextList,
    customerResponsibilities: optionalTextList,
    outOfScope: optionalTextList,
  })
  .refine(
    (data) => !data.startDate || !data.expectedEndDate || data.startDate <= data.expectedEndDate,
    { message: 'Start date cannot be after the expected completion date.', path: ['expectedEndDate'] }
  );

export const updateProjectSchema = z
  .object({
    ...projectCoreShape,
    managerId: optionalObjectIdSchema.optional(),
    health: enumField(PROJECT_HEALTHS, 'Select a valid project health.'),
  })
  .refine(
    (data) => !data.startDate || !data.expectedEndDate || data.startDate <= data.expectedEndDate,
    { message: 'Start date cannot be after the expected completion date.', path: ['expectedEndDate'] }
  );

/** §12 - a status change is only allowed if the transition is permitted. */
export const updateProjectStatusSchema = z.object({
  status: enumField(PROJECT_STATUSES, 'Select a valid project status.'),
  health: enumField(PROJECT_HEALTHS, 'Select a valid project health.').optional(),
  /** Required to pause or cancel so the timeline keeps the reason (§49, §52). */
  reason: z.string().trim().max(1000).optional().transform((v) => v || null),
  /** Records internal completion; distinct from later client acceptance. */
  completionNotes: z.string().trim().max(2000).optional().transform((v) => v || null),
});

export const projectStatusFields = [
  'status',
  'health',
  'reason',
  'completionNotes',
] as const;

/* -------------------------------------------------------------------------- */
/* Project team                                                                */
/* -------------------------------------------------------------------------- */

export const addProjectMemberSchema = z.object({
  userId: requiredObjectIdSchema('Select an employee.'),
  role: enumField(PROJECT_MEMBER_ROLES, 'Select a project member role.').default(
    PROJECT_MEMBER_ROLES.DEVELOPER
  ),
  responsibility: z
    .string()
    .trim()
    .max(200, 'Responsibility is too long.')
    .optional()
    .transform((v) => v || null),
});

export const updateProjectMemberSchema = z.object({
  role: enumField(PROJECT_MEMBER_ROLES, 'Select a project member role.'),
  responsibility: z
    .string()
    .trim()
    .max(200, 'Responsibility is too long.')
    .optional()
    .transform((v) => v || null),
});

export const removeProjectMemberSchema = z.object({
  userId: requiredObjectIdSchema('Select a team member.'),
  reason: z.string().trim().max(500).optional().transform((v) => v || null),
});

/* -------------------------------------------------------------------------- */
/* Milestones                                                                  */
/* -------------------------------------------------------------------------- */

export const createProjectMilestoneSchema = z
  .object({
    title: z.string().trim().min(2, 'Enter a milestone title.').max(200),
    description: z.string().trim().max(3000).optional().transform((v) => v || null),
    deliverables: optionalTextList,
    /** Optional: assigned server-side as max(sequence)+1 when omitted. */
    sequence: z.coerce.number().int().min(1, 'Sequence must be at least 1.').optional(),
    startDate: optionalDateSchema.optional(),
    dueDate: optionalDateSchema.optional(),
    assignedTo: optionalObjectIdSchema.optional(),
    dependsOn: objectIdListSchema.optional(),
    clientVisible: z.coerce.boolean().default(false),
  })
  .refine(
    (data) => !data.startDate || !data.dueDate || data.startDate <= data.dueDate,
    { message: 'Start date cannot be after the due date.', path: ['dueDate'] }
  );

export const updateProjectMilestoneSchema = z
  .object({
    title: z.string().trim().min(2, 'Enter a milestone title.').max(200),
    description: z.string().trim().max(3000).optional().transform((v) => v || null),
    deliverables: optionalTextList,
    sequence: z.coerce.number().int().min(1, 'Sequence must be at least 1.'),
    startDate: optionalDateSchema.optional(),
    dueDate: optionalDateSchema.optional(),
    assignedTo: optionalObjectIdSchema.optional(),
    dependsOn: objectIdListSchema.optional(),
    clientVisible: z.coerce.boolean().default(false),
  })
  .refine(
    (data) => !data.startDate || !data.dueDate || data.startDate <= data.dueDate,
    { message: 'Start date cannot be after the due date.', path: ['dueDate'] }
  );

/** Employee progress update on a milestone they are responsible for. */
export const updateMilestoneProgressSchema = z.object({
  progressPercentage: z.coerce
    .number()
    .int('Progress must be a whole number.')
    .min(0, 'Progress cannot be negative.')
    .max(100, 'Progress cannot exceed 100.'),
  note: z.string().trim().max(2000).optional().transform((v) => v || null),
});

export const submitMilestoneForReviewSchema = z.object({
  notes: z.string().trim().max(2000).optional().transform((v) => v || null),
});

export const reviewMilestoneSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REQUEST_CHANGES'], {
      message: 'Choose whether to approve or request changes.',
    }),
    reviewNotes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => v || null),
  })
  .refine(
    (data) => data.decision !== 'REQUEST_CHANGES' || Boolean(data.reviewNotes),
    {
      message: 'Explain what needs to change before requesting changes.',
      path: ['reviewNotes'],
    }
  );

export const updateMilestoneStatusSchema = z.object({
  status: enumField(
    PROJECT_MILESTONE_STATUSES,
    'Select a valid milestone status.'
  ),
});

/* -------------------------------------------------------------------------- */
/* Internal notes                                                              */
/* -------------------------------------------------------------------------- */

export const addProjectNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(3, 'Write a short internal note.')
    .max(5000, 'Note is too long.'),
});

/** Cancelling a milestone always records why (§52). */
export const cancelMilestoneReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Record why this milestone is cancelled.')
    .max(2000, 'Reason is too long.'),
});

/* -------------------------------------------------------------------------- */

export const projectFieldNames = [
  'title',
  'clientId',
  'dealId',
  'managerId',
  'projectType',
  'priority',
  'health',
  'status',
  'startDate',
  'expectedEndDate',
  'scopeSummary',
  'deliverables',
  'includedFeatures',
  'dependencies',
  'customerResponsibilities',
  'outOfScope',
] as const;

export const milestoneFieldNames = [
  'title',
  'description',
  'deliverables',
  'sequence',
  'startDate',
  'dueDate',
  'assignedTo',
  'clientVisible',
  'progressPercentage',
  'note',
  'reviewNotes',
  'notes',
] as const;

export { zodFieldErrors };
