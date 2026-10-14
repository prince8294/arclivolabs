import 'server-only';

import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { PROJECT_ACTIVITY_TYPES, type ProjectActivityType } from '@/lib/constants/enums';
import { calculateProjectProgress } from '@/lib/projects/metrics';
import { Project } from '@/models/Project';
import { ProjectActivity } from '@/models/ProjectActivity';
import { ProjectMilestone } from '@/models/ProjectMilestone';

/**
 * Per-project counter key for milestone sequence numbers (§24). Scoping the
 * counter to the project is what makes codes like `PRJ-0001-M01` safe under
 * concurrent creation instead of relying on array length.
 */
export function milestoneSequenceKey(projectId: string | Types.ObjectId): string {
  return `project-milestone:${String(projectId)}`;
}

/** `PRJ-0007` + `3` → `PRJ-0007-M03`. */
export function formatMilestoneCode(projectCode: string, sequence: number): string {
  return `${projectCode}-M${String(sequence).padStart(2, '0')}`;
}

/**
 * Recompute and persist the denormalized project progress (§30).
 *
 * Always called server-side after a milestone mutation so the stored value can
 * never drift from the milestone rows. Never accepts a browser-supplied
 * percentage.
 *
 * @returns the freshly stored progress value, or null for an invalid id.
 */
export async function recalculateProjectProgress(projectId: string): Promise<number | null> {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) return null;

  const objectId = new Types.ObjectId(projectId);
  const milestones = await ProjectMilestone.find({ projectId: objectId })
    .select('status progressPercentage')
    .lean();

  const progressPercentage = calculateProjectProgress(milestones);
  await Project.updateOne({ _id: objectId }, { $set: { progressPercentage } });

  return progressPercentage;
}

/**
 * Append one entry to a project's activity timeline (§42).
 *
 * Intentionally fire-and-forget friendly: activity logging must never fail a
 * business operation, so callers can `await` it without wrapping in try/catch,
 * but failures are swallowed rather than surfaced to the user.
 *
 * @param metadata keep it free of payroll, secrets and client payment data.
 */
export async function logProjectActivity(input: {
  projectId: string | Types.ObjectId;
  type: ProjectActivityType;
  actorUserId: string | Types.ObjectId;
  title: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    if (!Types.ObjectId.isValid(input.projectId) || !Types.ObjectId.isValid(input.actorUserId)) {
      return;
    }

    await ProjectActivity.create({
      projectId: new Types.ObjectId(String(input.projectId)),
      type: input.type,
      actorUserId: new Types.ObjectId(String(input.actorUserId)),
      title: input.title.slice(0, 300),
      summary: input.summary ? input.summary.slice(0, 1000) : null,
      metadata: input.metadata ?? undefined,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('project activity log failed', error);
  }
}

export { PROJECT_ACTIVITY_TYPES };
