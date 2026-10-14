import { z } from 'zod';

export const createDeliverableSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(3000).optional().nullable(),
  deliveryNotes: z.string().trim().max(2000).optional().nullable(),
  fileVersionIds: z.array(z.string().min(1)).min(1, 'At least one file must be selected for the deliverable'),
});

export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;

export const updateDeliverableSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(3000).optional().nullable(),
  deliveryNotes: z.string().trim().max(2000).optional().nullable(),
  fileVersionIds: z.array(z.string().min(1)).min(1, 'At least one file must be selected for the deliverable'),
});

export type UpdateDeliverableInput = z.infer<typeof updateDeliverableSchema>;

export const acknowledgeDeliverableSchema = z.object({
  deliverableId: z.string().min(1, 'Deliverable ID is required'),
});

export type AcknowledgeDeliverableInput = z.infer<typeof acknowledgeDeliverableSchema>;
