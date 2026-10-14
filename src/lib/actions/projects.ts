'use server';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import {
  ensureSequenceAtLeast,
  generateSequentialCode,
  reserveSequenceRange,
} from '@/lib/db/generate-code';
import { withOptionalTransaction } from '@/lib/db/transaction';
import { createNotification } from '@/lib/notifications/create';
import {
  formatMilestoneCode,
  logProjectActivity,
  milestoneSequenceKey,
  recalculateProjectProgress,
} from '@/lib/projects/service';
import {
  EMPLOYEE_STATUS,
  PROJECT_ACTIVITY_TYPES,
  PROJECT_MEMBER_ROLES,
  PROJECT_MEMBER_STATUSES,
  PROJECT_MILESTONE_STATUSES,
  PROJECT_MILESTONE_TRANSITIONS,
  PROJECT_ORIGINS,
  PROJECT_STATUS_TRANSITIONS,
  PROJECT_STATUSES,
  TASK_ACTIVITY_TYPES,
  TASK_STATUSES,
  USER_STATUS,
  type ProjectMilestoneStatus,
  type ProjectStatus,
} from '@/lib/constants/enums';
import { DEAL_STATUSES } from '@/lib/constants/proposals';
import {
  addProjectMemberSchema,
  addProjectNoteSchema,
  cancelMilestoneReasonSchema,
  createProjectMilestoneSchema,
  createProjectSchema,
  milestoneFieldNames,
  projectFieldNames,
  removeProjectMemberSchema,
  reviewMilestoneSchema,
  submitMilestoneForReviewSchema,
  updateMilestoneProgressSchema,
  updateMilestoneStatusSchema,
  updateProjectMemberSchema,
  updateProjectMilestoneSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  zodFieldErrors,
} from '@/lib/validations/project';
import { Client } from '@/models/Client';
import { Deal, type DealDocument } from '@/models/Deal';
import { Employee } from '@/models/Employee';
import { Project } from '@/models/Project';
import { ProjectMember } from '@/models/ProjectMember';
import { ProjectMilestone } from '@/models/ProjectMilestone';
import { Task } from '@/models/Task';
import { TaskActivity } from '@/models/TaskActivity';
import { User } from '@/models/User';
import { USER_ROLES } from '@/types/auth';

export type ProjectActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  projectId?: string;
};

/** Deal statuses that may legitimately become a project (§8). */
const PROJECTABLE_DEAL_STATUSES: readonly string[] = [
  DEAL_STATUSES.FINALIZED,
  DEAL_STATUSES.READY_FOR_PROJECT,
];

/** Thrown internally when the partial unique index rejects a 2nd deal project. */
class DuplicateProjectError extends Error {
  constructor() {
    super('A project already exists for this deal.');
    this.name = 'DuplicateProjectError';
  }
}

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: number }).code === 11000;

function revalidateProjectPaths(projectId?: string): void {
  revalidatePath('/admin/projects');
  if (projectId) {
    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath(`/admin/projects/${projectId}/team`);
    revalidatePath(`/admin/projects/${projectId}/milestones`);
    revalidatePath(`/admin/projects/${projectId}/timeline`);
  }
  revalidatePath('/employee/projects');
  revalidatePath('/marketing/projects');
  revalidatePath('/admin/tasks/new');
}

const humanise = (value: string): string =>
  value.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

/* -------------------------------------------------------------------------- */
/* Create                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Create a project, optionally bootstrapped from a finalized Deal (§8/§9).
 *
 * Transactional where the deployment supports it: project + manager membership
 * + seeded milestones + activity. `withOptionalTransaction` degrades
 * gracefully on standalone mongod, so we never claim atomicity we don't have.
 */
export async function createProject(rawData: unknown): Promise<ProjectActionResult> {
  const user = await requireRole(USER_ROLES.ADMIN);

  const parseResult = createProjectSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, projectFieldNames),
      message: 'Please resolve form errors.',
    };
  }

  const data = parseResult.data;
  await connectDB();

  // ---- Client must exist -------------------------------------------------
  const clientExists =
    Types.ObjectId.isValid(data.clientId) &&
    (await Client.exists({ _id: new Types.ObjectId(data.clientId) }));

  if (!clientExists) {
    return {
      success: false,
      fieldErrors: { clientId: 'Select an existing client.' },
      message: 'The selected client no longer exists.',
    };
  }

  // ---- Deal linkage ------------------------------------------------------
  let deal: DealDocument | null = null;
  let clientId = new Types.ObjectId(data.clientId);

  if (data.dealId) {
    if (!Types.ObjectId.isValid(data.dealId)) {
      return {
        success: false,
        fieldErrors: { dealId: 'Select an existing deal.' },
        message: 'Invalid deal reference.',
      };
    }

    deal = await Deal.findById(new Types.ObjectId(data.dealId));

    if (!deal) {
      return {
        success: false,
        fieldErrors: { dealId: 'Select an existing deal.' },
        message: 'The selected deal no longer exists.',
      };
    }

    if (!PROJECTABLE_DEAL_STATUSES.includes(deal.status)) {
      return {
        success: false,
        fieldErrors: { dealId: 'This deal is not ready to become a project.' },
        message:
          'Only finalized deals can create a project. Cancel or re-finalize this deal first.',
      };
    }

    // A deal still awaiting client conversion must not produce a project with
    // an invalid client reference (§8).
    if (!deal.clientId) {
      return {
        success: false,
        fieldErrors: { dealId: 'This deal has no client yet.' },
        message:
          'This deal is awaiting client conversion. Create the client record first, then retry.',
      };
    }

    clientId = deal.clientId;

    // ---- Duplicate guard (§10) -------------------------------------------
    const existing = await Project.findOne({ dealId: deal._id })
      .select('projectCode')
      .lean();
    if (existing) {
      return {
        success: false,
        projectId: existing._id.toString(),
        message: `Project already created. View Project: ${existing.projectCode}`,
      };
    }
  }

  // ---- Manager eligibility ----------------------------------------------
  let managerId: Types.ObjectId | null = null;
  if (data.managerId) {
    const manager = Types.ObjectId.isValid(data.managerId)
      ? await findEligibleStaff(new Types.ObjectId(data.managerId))
      : null;
    if (!manager) {
      return {
        success: false,
        fieldErrors: { managerId: 'Project manager must be an active employee or admin.' },
        message: 'The selected project manager is not an active employee or admin.',
      };
    }
    managerId = manager._id;
  }

  const snapshot = deal?.commercialSnapshot;

  const scopeSnapshot = {
    summary: snapshot?.overview ?? data.scopeSummary ?? null,
    includedFeatures: data.includedFeatures.length
      ? data.includedFeatures
      : (snapshot?.includedFeatures ?? []),
    excludedFeatures: data.outOfScope.length
      ? data.outOfScope
      : (snapshot?.excludedFeatures ?? []),
    dependencies: data.dependencies,
    customerResponsibilities: data.customerResponsibilities,
    deliverables: data.deliverables.length ? data.deliverables : (snapshot?.deliverables ?? []),
    estimatedDuration: snapshot?.estimatedDuration ?? null,
  };

  const origin = deal ? PROJECT_ORIGINS.DEAL : PROJECT_ORIGINS.MANUAL;
  const actorId = new Types.ObjectId(user.id);

  let project;
  try {
    project = await withOptionalTransaction(async (session) => {
      const projectCode = await generateSequentialCode('project', 'PRJ', session);

      let created;
      try {
        [created] = await Project.create(
          [
            {
              projectCode,
              title: data.title,
              description: data.description,
              clientId,
              dealId: deal ? deal._id : null,
              acceptedProposalVersionId: deal ? deal.acceptedProposalVersionId : null,
              proposalId: deal ? deal.proposalId : null,
              origin,
              status: PROJECT_STATUSES.PLANNING,
              health: data.health,
              priority: data.priority,
              projectType: data.projectType,
              serviceIds: [],
              managerId,
              startDate: data.startDate ?? null,
              expectedEndDate: data.expectedEndDate ?? null,
              progressPercentage: 0,
              internalNotes: [],
              scopeSnapshot,
              // Read-only display copy of the Deal. Never written back (§53).
              agreedAmountSnapshot: deal ? deal.agreedAmountMinor : null,
              currency: deal ? deal.currency : 'INR',
              createdBy: actorId,
              updatedBy: actorId,
            },
          ],
          { session }
        );
      } catch (error) {
        // The partial unique index on dealId is the real concurrency guard (§10).
        if (deal && isDuplicateKeyError(error)) throw new DuplicateProjectError();
        throw error;
      }

      if (managerId) {
        await ProjectMember.create(
          [
            {
              projectId: created._id,
              userId: managerId,
              role: PROJECT_MEMBER_ROLES.PROJECT_MANAGER,
              responsibility: 'Project Coordination',
              status: PROJECT_MEMBER_STATUSES.ACTIVE,
              assignedAt: new Date(),
              assignedBy: actorId,
            },
          ],
          { session }
        );
      }

      // Seed milestones from the accepted deal's delivery milestones (§25).
      // Admin can reorder, rename, add or cancel them afterwards.
      const seed = snapshot?.deliveryMilestones ?? [];
      for (const entry of seed) {
        const { end } = await reserveSequenceRange(
          milestoneSequenceKey(created._id),
          1,
          session
        );
        await ProjectMilestone.create(
          [
            {
              milestoneCode: formatMilestoneCode(projectCode, end),
              projectId: created._id,
              title: entry.name,
              description: entry.description ?? null,
              deliverables: [],
              sequence: end,
              status: PROJECT_MILESTONE_STATUSES.NOT_STARTED,
              progressPercentage: 0,
              dueDate: null,
              assignedTo: null,
              dependsOn: [],
              clientVisible: true,
              createdBy: actorId,
              updatedBy: actorId,
            },
          ],
          { session }
        );
      }

      return created;
    });
  } catch (error) {
    if (error instanceof DuplicateProjectError) {
      const existing = await Project.findOne({ dealId: deal?._id })
        .select('projectCode _id')
        .lean();
      return {
        success: false,
        projectId: existing?._id.toString(),
        message: `Project already created. View Project: ${existing?.projectCode ?? ''}`,
      };
    }
    console.error('createProject failed', error);
    return {
      success: false,
      message: 'Unable to create the project. Please try again.',
    };
  }

  await logProjectActivity({
    projectId: project._id,
    type: PROJECT_ACTIVITY_TYPES.PROJECT_CREATED,
    actorUserId: user.id,
    title: `Project ${project.projectCode} created`,
    summary:
      origin === PROJECT_ORIGINS.DEAL
        ? `Created from deal ${deal?.dealCode}.`
        : 'Created as a manual project with no linked deal.',
    metadata: { origin, dealId: deal ? String(deal._id) : null },
  });

  revalidateProjectPaths(project._id.toString());

  return {
    success: true,
    projectId: project._id.toString(),
    message: `Project ${project.projectCode} created successfully.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Update                                                                      */
/* -------------------------------------------------------------------------- */

export async function updateProject(
  projectId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const user = await requireRole(USER_ROLES.ADMIN);

  const parseResult = updateProjectSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, projectFieldNames),
      message: 'Please resolve form errors.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) {
    return { success: false, message: 'Invalid project ID.' };
  }

  const project = await Project.findById(new Types.ObjectId(projectId));
  if (!project) return { success: false, message: 'Project not found.' };

  const data = parseResult.data;
  const actorId = new Types.ObjectId(user.id);

  let managerId: Types.ObjectId | null = null;
  if (data.managerId) {
    const manager = Types.ObjectId.isValid(data.managerId)
      ? await findEligibleStaff(new Types.ObjectId(data.managerId))
      : null;
    if (!manager) {
      return {
        success: false,
        fieldErrors: { managerId: 'Project manager must be an active employee or admin.' },
        message: 'The selected project manager is not an active employee or admin.',
      };
    }
    managerId = manager._id;
  }

  const previousEndDate = project.expectedEndDate ?? null;
  const previousManagerId = project.managerId ?? null;

  project.title = data.title;
  project.description = data.description;
  project.projectType = data.projectType;
  project.priority = data.priority;
  project.health = data.health;
  project.startDate = data.startDate ?? null;
  project.expectedEndDate = data.expectedEndDate ?? null;
  project.managerId = managerId;
  project.updatedBy = actorId;
  await project.save();

  if ((previousManagerId?.toString() ?? null) !== (managerId?.toString() ?? null)) {
    await syncManagerMembership(project._id, managerId, actorId);
    await logProjectActivity({
      projectId: project._id,
      type: PROJECT_ACTIVITY_TYPES.MANAGER_CHANGED,
      actorUserId: user.id,
      title: managerId ? 'Project manager assigned' : 'Project manager cleared',
      metadata: {
        previousManagerId: previousManagerId ? String(previousManagerId) : null,
        managerId: managerId ? String(managerId) : null,
      },
    });
  }

  await logProjectActivity({
    projectId: project._id,
    type: PROJECT_ACTIVITY_TYPES.PROJECT_UPDATED,
    actorUserId: user.id,
    title: 'Project details updated',
    summary: `Priority set to ${humanise(data.priority)}.`,
    metadata: { priority: data.priority, projectType: data.projectType },
  });

  // A deadline move is an operational schedule change, tracked with old/new
  // values so the history is auditable (§45). Deal terms are untouched.
  if (previousEndDate?.getTime() !== (project.expectedEndDate?.getTime() ?? null)) {
    await logProjectActivity({
      projectId: project._id,
      type: PROJECT_ACTIVITY_TYPES.DEADLINE_CHANGED,
      actorUserId: user.id,
      title: 'Expected completion date changed',
      summary: `From ${formatDateOnly(previousEndDate)} to ${formatDateOnly(project.expectedEndDate)}.`,
      metadata: {
        previousExpectedEndDate: previousEndDate?.toISOString() ?? null,
        newExpectedEndDate: project.expectedEndDate?.toISOString() ?? null,
      },
    });
  }

  revalidateProjectPaths(projectId);

  return { success: true, projectId, message: 'Project updated successfully.' };
}

/* -------------------------------------------------------------------------- */
/* Status / lifecycle                                                          */
/* -------------------------------------------------------------------------- */

export async function changeProjectStatus(
  projectId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const user = await requireRole(USER_ROLES.ADMIN);

  const parseResult = updateProjectStatusSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, [
        'status',
        'health',
        'reason',
        'completionNotes',
      ]),
      message: 'Please resolve form errors.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) {
    return { success: false, message: 'Invalid project ID.' };
  }

  const project = await Project.findById(new Types.ObjectId(projectId));
  if (!project) return { success: false, message: 'Project not found.' };

  const data = parseResult.data;
  const previousStatus = project.status;
  const nextStatus = data.status as ProjectStatus;
  const statusChanged = nextStatus !== previousStatus;

  // Health can be corrected on its own without moving the status (§14).
  if (!statusChanged) {
    if (!data.health) {
      return { success: false, message: 'The project is already in that state.' };
    }
    if (data.health === project.health) {
      return { success: false, message: 'Nothing to update.' };
    }
  }

  if (statusChanged) {
    const allowed = PROJECT_STATUS_TRANSITIONS[previousStatus];
    if (!allowed.includes(nextStatus)) {
      return {
        success: false,
        message: `A project cannot move from ${humanise(previousStatus)} to ${humanise(
          nextStatus
        )}.`,
      };
    }
  }

  // Pause and cancellation must carry a reason (§49, §52).
  if (statusChanged && nextStatus === PROJECT_STATUSES.ON_HOLD && !data.reason) {
    return {
      success: false,
      fieldErrors: { reason: 'Record why the project is paused.' },
      message: 'A hold reason is required.',
    };
  }
  if (statusChanged && nextStatus === PROJECT_STATUSES.CANCELLED && !data.reason) {
    return {
      success: false,
      fieldErrors: { reason: 'Record why the project is cancelled.' },
      message: 'A cancellation reason is required.',
    };
  }

  // Completing a project is an explicit, validated admin decision (§51). This
  // is INTERNAL completion only - client acceptance arrives in Parts 12-13.
  if (statusChanged && nextStatus === PROJECT_STATUSES.COMPLETED) {
    if (!data.completionNotes) {
      return {
        success: false,
        fieldErrors: { completionNotes: 'Add an internal completion note.' },
        message: 'An internal completion note is required.',
      };
    }

    const milestones = await ProjectMilestone.find({
      projectId: project._id,
      status: { $ne: PROJECT_MILESTONE_STATUSES.CANCELLED },
    })
      .select('title status')
      .lean();

    const blocked = milestones.filter(
      (m) => m.status === PROJECT_MILESTONE_STATUSES.BLOCKED
    );
    if (blocked.length > 0) {
      return {
        success: false,
        message: `Resolve or cancel the blocked milestone(s) first: ${blocked
          .map((m) => m.title)
          .join(', ')}.`,
      };
    }

    const unfinished = milestones.filter(
      (m) => m.status !== PROJECT_MILESTONE_STATUSES.COMPLETED
    );
    if (unfinished.length > 0) {
      return {
        success: false,
        message: `${unfinished.length} milestone(s) are not completed yet. Complete them, or cancel the ones that no longer apply.`,
      };
    }
  }

  const actorId = new Types.ObjectId(user.id);
  const now = new Date();

  if (statusChanged) {
    project.status = nextStatus;

    if (nextStatus === PROJECT_STATUSES.IN_PROGRESS && !project.startDate) {
      // Stamp the operational start date the first time work begins.
      project.startDate = now;
    }
    if (nextStatus === PROJECT_STATUSES.COMPLETED) {
      project.actualEndDate = now;
    }
    if (nextStatus === PROJECT_STATUSES.ON_HOLD) {
      project.holdReason = data.reason ?? null;
    }
    if (nextStatus === PROJECT_STATUSES.CANCELLED) {
      project.cancellationReason = data.reason ?? null;
    }
  }

  if (data.health) project.health = data.health;
  project.updatedBy = actorId;
  await project.save();

  if (statusChanged) {
    await logProjectActivity({
      projectId: project._id,
      type: activityTypeForStatus(nextStatus, previousStatus),
      actorUserId: user.id,
      title: activityTitleForStatus(nextStatus),
      summary: data.reason ?? data.completionNotes ?? null,
      metadata: { previousStatus, newStatus: nextStatus },
    });
  } else {
    await logProjectActivity({
      projectId: project._id,
      type: PROJECT_ACTIVITY_TYPES.HEALTH_CHANGED,
      actorUserId: user.id,
      title: `Project health set to ${humanise(project.health)}`,
      metadata: { previousHealth: project.health, health: data.health },
    });
  }

  revalidateProjectPaths(projectId);

  return {
    success: true,
    projectId,
    message: statusChanged
      ? `Project moved to ${humanise(nextStatus)}.`
      : 'Project health updated.',
  };
}

/* -------------------------------------------------------------------------- */
/* Internal notes                                                              */
/* -------------------------------------------------------------------------- */

export async function addProjectNote(
  projectId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  // Admins and assigned team members may both add work-related notes (§44).
  const user = await requireAuth();

  const parseResult = addProjectNoteSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['note']),
      message: 'Please resolve form errors.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) {
    return { success: false, message: 'Invalid project ID.' };
  }

  if (user.role !== USER_ROLES.ADMIN) {
    const allowed =
      user.role === USER_ROLES.EMPLOYEE && (await isProjectTeamMember(user.id, projectId));
    if (!allowed) {
      return { success: false, message: 'You do not have access to this project.' };
    }
  }

  const note = parseResult.data.note;

  await Project.updateOne(
    { _id: new Types.ObjectId(projectId) },
    {
      $push: {
        internalNotes: {
          authorUserId: new Types.ObjectId(user.id),
          authorName: user.name,
          authorRole: user.role,
          body: note,
          createdAt: new Date(),
        },
      },
      $set: { updatedBy: new Types.ObjectId(user.id) },
    }
  );

  await logProjectActivity({
    projectId,
    type: PROJECT_ACTIVITY_TYPES.NOTE_ADDED,
    actorUserId: user.id,
    title: 'Internal note added',
    summary: note,
  });

  revalidateProjectPaths(projectId);

  return { success: true, projectId, message: 'Internal note added.' };
}

/* -------------------------------------------------------------------------- */
/* Team                                                                        */
/* -------------------------------------------------------------------------- */

export async function addProjectMember(
  projectId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const user = await requireRole(USER_ROLES.ADMIN);

  const parseResult = addProjectMemberSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['userId', 'role', 'responsibility']),
      message: 'Please select a valid member and role.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) {
    return { success: false, message: 'Invalid project ID.' };
  }

  const project = await Project.findById(new Types.ObjectId(projectId));
  if (!project) return { success: false, message: 'Project not found.' };

  const { userId, role, responsibility } = parseResult.data;

  // Only genuinely eligible, active staff may receive a new assignment (§18).
  const staff = Types.ObjectId.isValid(userId)
    ? await findEligibleStaff(new Types.ObjectId(userId))
    : null;
  if (!staff) {
    return {
      success: false,
      fieldErrors: { userId: 'That user is not an active employee.' },
      message: 'Suspended, inactive or non-employee accounts cannot be assigned.',
    };
  }

  const existing = await ProjectMember.findOne({
    projectId: project._id,
    userId: staff._id,
    status: PROJECT_MEMBER_STATUSES.ACTIVE,
  });
  if (existing) {
    return {
      success: false,
      message: `${staff.name} is already an active member of this project.`,
    };
  }

  // Upsert keeps one row per (project, user), so a previous removal is
  // reactivated rather than duplicated (§21).
  await ProjectMember.findOneAndUpdate(
    { projectId: project._id, userId: staff._id },
    {
      $set: {
        role,
        responsibility: responsibility ?? null,
        status: PROJECT_MEMBER_STATUSES.ACTIVE,
        assignedAt: new Date(),
        assignedBy: new Types.ObjectId(user.id),
        removedAt: null,
        removedBy: null,
        removalReason: null,
      },
    },
    { upsert: true, new: true }
  );

  // Promoting to PROJECT_MANAGER also stamps the project's managerId.
  if (role === PROJECT_MEMBER_ROLES.PROJECT_MANAGER && project.managerId?.toString() !== staff._id.toString()) {
    project.managerId = staff._id;
    project.updatedBy = new Types.ObjectId(user.id);
    await project.save();
  }

  await logProjectActivity({
    projectId: project._id,
    type: PROJECT_ACTIVITY_TYPES.MEMBER_ASSIGNED,
    actorUserId: user.id,
    title: `${staff.name} assigned to project`,
    summary: `${humanise(role)}${responsibility ? ` - ${responsibility}` : ''}`,
    metadata: { userId: String(staff._id), role },
  });
  await createNotification({ recipientUserId: staff._id, type: 'PROJECT_ASSIGNED', title: 'Project assignment', message: `You were added to ${project.projectCode}: ${project.title}.`, resourceType: 'Project', resourceId: project._id, resourceUrl: `/employee/projects/${project._id}`, idempotencyKey: `project-assigned:${project._id}:${staff._id}` });

  revalidateProjectPaths(projectId);

  return { success: true, projectId, message: `${staff.name} added to project team.` };
}

export async function updateProjectMember(
  projectId: string,
  memberUserId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const user = await requireRole(USER_ROLES.ADMIN);

  const parseResult = updateProjectMemberSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['role', 'responsibility']),
      message: 'Please resolve form errors.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(memberUserId)) {
    return { success: false, message: 'Invalid identifiers.' };
  }

  const member = await ProjectMember.findOne({
    projectId: new Types.ObjectId(projectId),
    userId: new Types.ObjectId(memberUserId),
    status: PROJECT_MEMBER_STATUSES.ACTIVE,
  });
  if (!member) return { success: false, message: 'Active member record not found.' };

  const previousRole = member.role;
  member.role = parseResult.data.role;
  member.responsibility = parseResult.data.responsibility ?? null;
  await member.save();

  // Keep Project.managerId consistent with the PROJECT_MANAGER assignment.
  const project = await Project.findById(new Types.ObjectId(projectId));
  if (project) {
    const isManagerNow = member.role === PROJECT_MEMBER_ROLES.PROJECT_MANAGER;
    const wasManager = project.managerId?.toString() === memberUserId;

    if (isManagerNow && !wasManager) {
      project.managerId = member.userId;
      project.updatedBy = new Types.ObjectId(user.id);
      await project.save();
      await logProjectActivity({
        projectId,
        type: PROJECT_ACTIVITY_TYPES.MANAGER_CHANGED,
        actorUserId: user.id,
        title: 'Project manager assigned',
        metadata: { userId: memberUserId },
      });
    } else if (!isManagerNow && wasManager) {
      // Demoted: clear the manager reference rather than leave it dangling.
      project.managerId = null;
      project.updatedBy = new Types.ObjectId(user.id);
      await project.save();
    }
  }

  await logProjectActivity({
    projectId,
    type: PROJECT_ACTIVITY_TYPES.MEMBER_ASSIGNED,
    actorUserId: user.id,
    title: 'Team member assignment updated',
    metadata: { userId: memberUserId, previousRole, role: member.role },
  });

  revalidateProjectPaths(projectId);

  return { success: true, projectId, message: 'Assignment updated.' };
}

/**
 * Remove a member from the active team.
 *
 * Access is revoked immediately (status becomes REMOVED) but the row is kept so
 * historical contribution stays attributable (§20). Their open milestones and
 * tasks are released for reassignment.
 */
export async function removeProjectMember(
  projectId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const adminUser = await requireRole(USER_ROLES.ADMIN);

  const parseResult = removeProjectMemberSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['userId', 'reason']),
      message: 'Select a valid team member.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) {
    return { success: false, message: 'Invalid project ID.' };
  }

  const { userId, reason } = parseResult.data;
  if (!Types.ObjectId.isValid(userId)) {
    return { success: false, message: 'Invalid identifiers.' };
  }

  const pId = new Types.ObjectId(projectId);
  const uId = new Types.ObjectId(userId);

  const member = await ProjectMember.findOne({
    projectId: pId,
    userId: uId,
    status: PROJECT_MEMBER_STATUSES.ACTIVE,
  });
  if (!member) return { success: false, message: 'Active member record not found.' };

  const removedUser = await User.findById(uId).select('name');
  const removedName = removedUser?.name || 'Employee';
  const actorId = new Types.ObjectId(adminUser.id);

  member.status = PROJECT_MEMBER_STATUSES.REMOVED;
  member.removedAt = new Date();
  member.removedBy = actorId;
  member.removalReason = reason ?? null;
  await member.save();

  // Release their open milestones for reassignment.
  const openMilestones = await ProjectMilestone.find({
    projectId: pId,
    assignedTo: uId,
    status: {
      $nin: [
        PROJECT_MILESTONE_STATUSES.COMPLETED,
        PROJECT_MILESTONE_STATUSES.CANCELLED,
      ],
    },
  }).select('_id');

  if (openMilestones.length > 0) {
    await ProjectMilestone.updateMany(
      { _id: { $in: openMilestones.map((m) => m._id) } },
      { $set: { assignedTo: null, updatedBy: actorId } }
    );
  }

  // Release their open tasks for reassignment (Part 11 integration).
  const activeTasks = await Task.find({
    projectId: pId,
    assignedTo: uId,
    status: { $nin: [TASK_STATUSES.COMPLETED, TASK_STATUSES.CANCELLED] },
  });

  for (const task of activeTasks) {
    task.assignedTo = null;
    task.updatedBy = actorId;
    await task.save();
    await TaskActivity.create({
      taskId: task._id,
      actorUserId: actorId,
      type: TASK_ACTIVITY_TYPES.TASK_REASSIGNED,
      summary: `Assignee ${removedName} removed from project. Task is unassigned and awaiting reassignment.`,
      metadata: { previousAssignee: removedName, newAssignee: 'Unassigned' },
    });
  }

  // If the removed member was the manager, clear the reference.
  const project = await Project.findById(pId);
  if (project && project.managerId?.toString() === userId) {
    project.managerId = null;
    project.updatedBy = actorId;
    await project.save();
  }

  await logProjectActivity({
    projectId: pId,
    type: PROJECT_ACTIVITY_TYPES.MEMBER_REMOVED,
    actorUserId: adminUser.id,
    title: `${removedName} removed from project`,
    summary:
      reason ??
      `${openMilestones.length} milestone(s) and ${activeTasks.length} task(s) released for reassignment.`,
    metadata: {
      userId,
      releasedMilestones: openMilestones.length,
      releasedTasks: activeTasks.length,
    },
  });

  revalidateProjectPaths(projectId);
  revalidatePath(`/admin/projects/${projectId}/tasks`);
  revalidatePath('/admin/tasks');
  revalidatePath('/admin/tasks/board');
  revalidatePath('/employee/tasks');

  return {
    success: true,
    projectId,
    message: `${removedName} removed. ${
      openMilestones.length + activeTasks.length
    } open item(s) released for reassignment.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Milestones                                                                  */
/* -------------------------------------------------------------------------- */

export async function createProjectMilestone(
  projectId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const adminUser = await requireRole(USER_ROLES.ADMIN);

  const parseResult = createProjectMilestoneSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, milestoneFieldNames),
      message: 'Please resolve milestone form errors.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) {
    return { success: false, message: 'Invalid project ID.' };
  }

  const project = await Project.findById(new Types.ObjectId(projectId));
  if (!project) return { success: false, message: 'Project not found.' };

  const data = parseResult.data;
  const actorId = new Types.ObjectId(adminUser.id);

  // Sequence: honour an explicit Admin value, otherwise allocate atomically.
  const key = milestoneSequenceKey(project._id);
  let sequence: number;
  if (data.sequence) {
    sequence = data.sequence;
    await ensureSequenceAtLeast(key, sequence);
  } else {
    const { end } = await reserveSequenceRange(key, 1);
    sequence = end;
  }

  const duplicateSequence = await ProjectMilestone.findOne({
    projectId: project._id,
    sequence,
  })
    .select('title')
    .lean();
  if (duplicateSequence) {
    return {
      success: false,
      fieldErrors: {
        sequence: `Sequence ${sequence} is already used by "${duplicateSequence.title}".`,
      },
      message: 'That milestone sequence is already in use.',
    };
  }

  const assignee = await resolveMilestoneAssignee(data.assignedTo, project._id);
  if (assignee.error) {
    return { success: false, fieldErrors: { assignedTo: assignee.error }, message: assignee.error };
  }

  const dependencyError = await validateMilestoneDependencies(
    project._id,
    null,
    data.dependsOn ?? []
  );
  if (dependencyError) {
    return {
      success: false,
      fieldErrors: { dependsOn: dependencyError },
      message: dependencyError,
    };
  }

  const milestoneCode = formatMilestoneCode(project.projectCode, sequence);

  await ProjectMilestone.create({
    milestoneCode,
    projectId: project._id,
    title: data.title,
    description: data.description,
    deliverables: data.deliverables,
    sequence,
    status: PROJECT_MILESTONE_STATUSES.NOT_STARTED,
    progressPercentage: 0,
    startDate: data.startDate ?? null,
    dueDate: data.dueDate ?? null,
    assignedTo: assignee.userId,
    dependsOn: data.dependsOn ?? [],
    clientVisible: data.clientVisible,
    createdBy: actorId,
    updatedBy: actorId,
  });

  await recalculateProjectProgress(projectId);

  await logProjectActivity({
    projectId: project._id,
    type: PROJECT_ACTIVITY_TYPES.MILESTONE_CREATED,
    actorUserId: adminUser.id,
    title: `Milestone ${milestoneCode} created`,
    summary: data.title,
    metadata: { milestoneCode, sequence },
  });

  revalidateProjectPaths(projectId);

  return { success: true, projectId, message: `Milestone ${milestoneCode} created.` };
}

export async function updateProjectMilestone(
  projectId: string,
  milestoneId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const adminUser = await requireRole(USER_ROLES.ADMIN);

  const parseResult = updateProjectMilestoneSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, milestoneFieldNames),
      message: 'Please resolve milestone form errors.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(milestoneId)) {
    return { success: false, message: 'Invalid identifiers.' };
  }

  const milestone = await ProjectMilestone.findOne({
    _id: new Types.ObjectId(milestoneId),
    projectId: new Types.ObjectId(projectId),
  });
  if (!milestone) return { success: false, message: 'Milestone not found.' };

  const data = parseResult.data;
  const actorId = new Types.ObjectId(adminUser.id);

  if (data.sequence !== milestone.sequence) {
    const clash = await ProjectMilestone.findOne({
      projectId: milestone.projectId,
      sequence: data.sequence,
      _id: { $ne: milestone._id },
    })
      .select('title')
      .lean();
    if (clash) {
      return {
        success: false,
        fieldErrors: { sequence: `"${clash.title}" already uses that sequence.` },
        message: 'That milestone sequence is already in use.',
      };
    }
    await ensureSequenceAtLeast(milestoneSequenceKey(milestone.projectId), data.sequence);
  }

  const dependencyError = await validateMilestoneDependencies(
    milestone.projectId,
    milestone._id,
    data.dependsOn ?? []
  );
  if (dependencyError) {
    return {
      success: false,
      fieldErrors: { dependsOn: dependencyError },
      message: dependencyError,
    };
  }

  const assignee = await resolveMilestoneAssignee(data.assignedTo, milestone.projectId);
  if (assignee.error) {
    return { success: false, fieldErrors: { assignedTo: assignee.error }, message: assignee.error };
  }

  milestone.title = data.title;
  milestone.description = data.description;
  milestone.deliverables = data.deliverables;
  milestone.sequence = data.sequence;
  milestone.startDate = data.startDate ?? null;
  milestone.dueDate = data.dueDate ?? null;
  milestone.dependsOn = (data.dependsOn ?? []).map((id) => new Types.ObjectId(id));
  milestone.clientVisible = data.clientVisible;
  milestone.assignedTo = assignee.userId;
  milestone.updatedBy = actorId;
  await milestone.save();

  await recalculateProjectProgress(projectId);

  await logProjectActivity({
    projectId,
    type: PROJECT_ACTIVITY_TYPES.MILESTONE_UPDATED,
    actorUserId: adminUser.id,
    title: `Milestone ${milestone.milestoneCode} updated`,
    summary: data.title,
    metadata: { milestoneCode: milestone.milestoneCode },
  });

  revalidateProjectPaths(projectId);

  return {
    success: true,
    projectId,
    message: `Milestone ${milestone.milestoneCode} updated.`,
  };
}

export async function updateMilestoneStatus(
  projectId: string,
  milestoneId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const adminUser = await requireRole(USER_ROLES.ADMIN);

  const parseResult = updateMilestoneStatusSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['status']),
      message: 'Select a valid milestone status.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(milestoneId)) {
    return { success: false, message: 'Invalid identifiers.' };
  }

  const milestone = await ProjectMilestone.findOne({
    _id: new Types.ObjectId(milestoneId),
    projectId: new Types.ObjectId(projectId),
  });
  if (!milestone) return { success: false, message: 'Milestone not found.' };

  const next = parseResult.data.status as ProjectMilestoneStatus;
  const previous = milestone.status;

  if (next === previous) {
    return { success: false, message: 'The milestone is already in that state.' };
  }

  // COMPLETED is only reachable through the review workflow so nobody can mark
  // finished work complete without a review pass (§28).
  if (next === PROJECT_MILESTONE_STATUSES.COMPLETED) {
    return {
      success: false,
      message: 'Approve a submitted milestone instead of setting it directly.',
    };
  }

  const allowed = PROJECT_MILESTONE_TRANSITIONS[previous];
  if (!allowed.includes(next)) {
    return {
      success: false,
      message: `A milestone cannot move from ${humanise(previous)} to ${humanise(next)}.`,
    };
  }

  milestone.status = next;
  milestone.updatedBy = new Types.ObjectId(adminUser.id);
  await milestone.save();

  await recalculateProjectProgress(projectId);

  await logProjectActivity({
    projectId,
    type: PROJECT_ACTIVITY_TYPES.MILESTONE_UPDATED,
    actorUserId: adminUser.id,
    title: `Milestone ${milestone.milestoneCode} moved to ${humanise(next)}`,
    metadata: { milestoneCode: milestone.milestoneCode, previousStatus: previous, next },
  });

  revalidateProjectPaths(projectId);

  return { success: true, projectId, message: 'Milestone status updated.' };
}

/**
 * Employee progress update. Permitted for the responsible employee and for the
 * project's manager; Admin may always correct it (§27).
 */
export async function updateMilestoneProgress(
  projectId: string,
  milestoneId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const user = await requireAuth();

  const parseResult = updateMilestoneProgressSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['progressPercentage', 'note']),
      message: 'Progress must be a whole number between 0 and 100.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(milestoneId)) {
    return { success: false, message: 'Invalid identifiers.' };
  }

  const milestone = await ProjectMilestone.findOne({
    _id: new Types.ObjectId(milestoneId),
    projectId: new Types.ObjectId(projectId),
  });
  if (!milestone) return { success: false, message: 'Milestone not found.' };

  if (!(await canUpdateMilestone(user.id, user.role, milestone))) {
    return {
      success: false,
      message: 'You can only update progress on milestones assigned to you.',
    };
  }

  if (milestone.status === PROJECT_MILESTONE_STATUSES.COMPLETED) {
    return { success: false, message: 'This milestone is already approved.' };
  }
  if (milestone.status === PROJECT_MILESTONE_STATUSES.PENDING_REVIEW) {
    return {
      success: false,
      message:
        'This milestone is awaiting review. Ask the admin to send it back if changes are needed.',
    };
  }

  const data = parseResult.data;

  // Any recorded progress implies work has started, so a milestone can never
  // sit at NOT_STARTED with a non-zero percentage.
  if (
    data.progressPercentage > 0 &&
    milestone.status === PROJECT_MILESTONE_STATUSES.NOT_STARTED
  ) {
    milestone.status = PROJECT_MILESTONE_STATUSES.IN_PROGRESS;
  }

  milestone.progressPercentage = data.progressPercentage;
  milestone.updatedBy = new Types.ObjectId(user.id);
  await milestone.save();

  await recalculateProjectProgress(projectId);

  await logProjectActivity({
    projectId,
    type: PROJECT_ACTIVITY_TYPES.MILESTONE_UPDATED,
    actorUserId: user.id,
    title: `${milestone.milestoneCode} progress set to ${data.progressPercentage}%`,
    summary: data.note ?? null,
    metadata: {
      milestoneCode: milestone.milestoneCode,
      progressPercentage: data.progressPercentage,
    },
  });

  revalidateProjectPaths(projectId);

  return { success: true, projectId, message: 'Progress updated.' };
}

export async function submitMilestoneForReview(
  projectId: string,
  milestoneId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const user = await requireAuth();

  const parseResult = submitMilestoneForReviewSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['notes']),
      message: 'Please resolve form errors.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(milestoneId)) {
    return { success: false, message: 'Invalid identifiers.' };
  }

  const milestone = await ProjectMilestone.findOne({
    _id: new Types.ObjectId(milestoneId),
    projectId: new Types.ObjectId(projectId),
  });
  if (!milestone) return { success: false, message: 'Milestone not found.' };

  if (!(await canUpdateMilestone(user.id, user.role, milestone))) {
    return {
      success: false,
      message: 'You can only submit milestones assigned to you.',
    };
  }

  if (
    milestone.status !== PROJECT_MILESTONE_STATUSES.IN_PROGRESS &&
    milestone.status !== PROJECT_MILESTONE_STATUSES.BLOCKED &&
    milestone.status !== PROJECT_MILESTONE_STATUSES.NOT_STARTED
  ) {
    return {
      success: false,
      message: 'This milestone cannot be submitted from its current state.',
    };
  }

  milestone.status = PROJECT_MILESTONE_STATUSES.PENDING_REVIEW;
  milestone.submittedBy = new Types.ObjectId(user.id);
  milestone.submittedAt = new Date();
  milestone.submissionNotes = parseResult.data.notes ?? null;
  // A submission implies near-finished work, but never 100 - approval sets that.
  milestone.progressPercentage = Math.max(milestone.progressPercentage, 90);
  milestone.updatedBy = new Types.ObjectId(user.id);
  await milestone.save();

  await recalculateProjectProgress(projectId);

  await logProjectActivity({
    projectId,
    type: PROJECT_ACTIVITY_TYPES.MILESTONE_SUBMITTED,
    actorUserId: user.id,
    title: `${milestone.milestoneCode} submitted for review`,
    summary: milestone.title,
    metadata: { milestoneCode: milestone.milestoneCode },
  });

  revalidateProjectPaths(projectId);

  return {
    success: true,
    projectId,
    message: `${milestone.milestoneCode} submitted for review.`,
  };
}

/**
 * Admin milestone review (§28). Explicitly refuses to let the submitter
 * approve their own work, even when that submitter is also an Admin.
 */
export async function reviewMilestone(
  projectId: string,
  milestoneId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const adminUser = await requireRole(USER_ROLES.ADMIN);

  const parseResult = reviewMilestoneSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parseResult.error, ['decision', 'reviewNotes']),
      message: 'Please resolve form errors.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(milestoneId)) {
    return { success: false, message: 'Invalid identifiers.' };
  }

  const milestone = await ProjectMilestone.findOne({
    _id: new Types.ObjectId(milestoneId),
    projectId: new Types.ObjectId(projectId),
  });
  if (!milestone) return { success: false, message: 'Milestone not found.' };

  if (milestone.status !== PROJECT_MILESTONE_STATUSES.PENDING_REVIEW) {
    return { success: false, message: 'Only a submitted milestone can be reviewed.' };
  }

  // Self-approval is refused even for an Admin who also submitted it (§28).
  if (milestone.submittedBy?.toString() === adminUser.id) {
    return {
      success: false,
      message: 'You cannot approve a milestone you submitted yourself.',
    };
  }

  const { decision, reviewNotes } = parseResult.data;
  const now = new Date();

  milestone.reviewedBy = new Types.ObjectId(adminUser.id);
  milestone.reviewedAt = now;
  milestone.reviewNotes = reviewNotes ?? null;
  milestone.updatedBy = new Types.ObjectId(adminUser.id);

  if (decision === 'APPROVE') {
    milestone.status = PROJECT_MILESTONE_STATUSES.COMPLETED;
    milestone.progressPercentage = 100;
    milestone.completedAt = now;
  } else {
    milestone.status = PROJECT_MILESTONE_STATUSES.IN_PROGRESS;
    // Leave submitted progress visible; the assignee continues from it.
    milestone.submittedAt = null;
  }

  await milestone.save();

  await recalculateProjectProgress(projectId);

  await logProjectActivity({
    projectId,
    type:
      decision === 'APPROVE'
        ? PROJECT_ACTIVITY_TYPES.MILESTONE_APPROVED
        : PROJECT_ACTIVITY_TYPES.MILESTONE_REJECTED,
    actorUserId: adminUser.id,
    title:
      decision === 'APPROVE'
        ? `${milestone.milestoneCode} approved`
        : `Changes requested on ${milestone.milestoneCode}`,
    summary: reviewNotes ?? null,
    metadata: { milestoneCode: milestone.milestoneCode, decision },
  });

  revalidateProjectPaths(projectId);

  return {
    success: true,
    projectId,
    message:
      decision === 'APPROVE'
        ? `${milestone.milestoneCode} approved and marked complete.`
        : `${milestone.milestoneCode} sent back for changes.`,
  };
}

/**
 * Cancel a milestone. History is preserved and the row is kept so completed
 * attribution is never lost (§52).
 */
export async function cancelProjectMilestone(
  projectId: string,
  milestoneId: string,
  rawData: unknown
): Promise<ProjectActionResult> {
  const adminUser = await requireRole(USER_ROLES.ADMIN);

  const parseResult = cancelMilestoneReasonSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      success: false,
      fieldErrors: { reason: 'Record why this milestone is cancelled.' },
      message: 'A cancellation reason is required.',
    };
  }

  await connectDB();
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(milestoneId)) {
    return { success: false, message: 'Invalid identifiers.' };
  }

  const milestone = await ProjectMilestone.findOne({
    _id: new Types.ObjectId(milestoneId),
    projectId: new Types.ObjectId(projectId),
  });
  if (!milestone) return { success: false, message: 'Milestone not found.' };

  if (milestone.status === PROJECT_MILESTONE_STATUSES.COMPLETED) {
    return { success: false, message: 'A completed milestone cannot be cancelled.' };
  }

  milestone.status = PROJECT_MILESTONE_STATUSES.CANCELLED;
  milestone.reviewNotes = parseResult.data.reason;
  milestone.updatedBy = new Types.ObjectId(adminUser.id);
  await milestone.save();

  await recalculateProjectProgress(projectId);

  await logProjectActivity({
    projectId,
    type: PROJECT_ACTIVITY_TYPES.MILESTONE_UPDATED,
    actorUserId: adminUser.id,
    title: `${milestone.milestoneCode} cancelled`,
    summary: parseResult.data.reason,
    metadata: { milestoneCode: milestone.milestoneCode },
  });

  revalidateProjectPaths(projectId);

  return { success: true, projectId, message: `${milestone.milestoneCode} cancelled.` };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Active membership check used by the note and read paths. */
async function isProjectTeamMember(userId: string, projectId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(projectId)) return false;
  const member = await ProjectMember.findOne({
    projectId: new Types.ObjectId(projectId),
    userId: new Types.ObjectId(userId),
    status: PROJECT_MEMBER_STATUSES.ACTIVE,
  })
    .select('_id')
    .lean();
  return Boolean(member);
}

/**
 * A user may write milestone progress if they own the milestone or manage the
 * project. Ordinary team membership alone is deliberately NOT enough (§27).
 */
async function canUpdateMilestone(
  userId: string,
  role: string,
  milestone: { assignedTo?: Types.ObjectId | null; projectId: Types.ObjectId }
): Promise<boolean> {
  if (role === USER_ROLES.ADMIN) return true;
  if (role !== USER_ROLES.EMPLOYEE) return false;
  if (!Types.ObjectId.isValid(userId)) return false;

  if (milestone.assignedTo && milestone.assignedTo.toString() === userId) return true;

  const project = await Project.findById(milestone.projectId)
    .select('managerId')
    .lean();
  return project?.managerId?.toString() === userId;
}

/**
 * Validate a milestone's prerequisites (§26): same project only, no
 * self-reference, and no cycles. Deliberately a simple reachability walk -
 * not a critical-path engine.
 */
async function validateMilestoneDependencies(
  projectId: Types.ObjectId,
  milestoneId: Types.ObjectId | null,
  dependsOn: readonly string[]
): Promise<string | null> {
  const ids = dependsOn.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;

  if (milestoneId && ids.includes(milestoneId.toString())) {
    return 'A milestone cannot depend on itself.';
  }

  if (ids.some((id) => !Types.ObjectId.isValid(id))) {
    return 'Invalid milestone dependency reference.';
  }

  const candidates = await ProjectMilestone.find({
    _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
    projectId,
  })
    .select('_id')
    .lean();

  if (candidates.length !== ids.length) {
    return 'Milestone dependencies must reference milestones in the same project.';
  }

  // Walk outward from each prerequisite; reaching this milestone would mean the
  // proposed edges close a loop.
  const adjacency = new Map<string, string[]>();
  const rows = await ProjectMilestone.find({ projectId })
    .select('_id dependsOn')
    .lean();
  for (const row of rows) {
    adjacency.set(
      row._id.toString(),
      (row.dependsOn ?? []).map((d) => d.toString())
    );
  }

  const stack = [...ids];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (milestoneId && current === milestoneId.toString()) {
      return 'That dependency would create a circular chain.';
    }
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(adjacency.get(current) ?? []));
  }

  return null;
}

type AssigneeResolution =
  | { userId: Types.ObjectId | null; error?: undefined }
  | { userId?: undefined; error: string };

/** A milestone assignee must be an active member of the same project. */
async function resolveMilestoneAssignee(
  assignedTo: string | null | undefined,
  projectId: Types.ObjectId
): Promise<AssigneeResolution> {
  if (!assignedTo) return { userId: null };
  if (!Types.ObjectId.isValid(assignedTo)) {
    return { error: 'Select a valid team member.' };
  }

  const candidate = new Types.ObjectId(assignedTo);
  const member = await ProjectMember.findOne({
    projectId,
    userId: candidate,
    status: PROJECT_MEMBER_STATUSES.ACTIVE,
  })
    .select('_id')
    .lean();

  if (!member) {
    return { error: 'The responsible person must be an active member of this project.' };
  }
  return { userId: candidate };
}

/** Active ADMIN or EMPLOYEE account with no terminated profile. */
async function findEligibleStaff(userId: Types.ObjectId) {
  const user = await User.findById(userId).select('_id name role status');
  if (!user) return null;
  if (user.status !== USER_STATUS.ACTIVE) return null;
  if (user.role !== USER_ROLES.EMPLOYEE && user.role !== USER_ROLES.ADMIN) return null;

  const profile = await Employee.findOne({ userId: user._id }).select('status').lean();
  if (profile && profile.status === EMPLOYEE_STATUS.TERMINATED) return null;

  return user;
}

/** Keep the manager's ProjectMember row in step with `Project.managerId`. */
async function syncManagerMembership(
  projectId: Types.ObjectId,
  managerId: Types.ObjectId | null,
  actorUserId: Types.ObjectId
): Promise<void> {
  if (!managerId) return;
  await ProjectMember.findOneAndUpdate(
    { projectId, userId: managerId },
    {
      $set: {
        role: PROJECT_MEMBER_ROLES.PROJECT_MANAGER,
        status: PROJECT_MEMBER_STATUSES.ACTIVE,
        assignedAt: new Date(),
        assignedBy: actorUserId,
        removedAt: null,
        removedBy: null,
      },
    },
    { upsert: true }
  );
}

function activityTypeForStatus(next: ProjectStatus, previous: ProjectStatus) {
  switch (next) {
    case PROJECT_STATUSES.IN_PROGRESS:
      // Coming back from a hold is a resume, not a fresh start.
      return previous === PROJECT_STATUSES.ON_HOLD
        ? PROJECT_ACTIVITY_TYPES.PROJECT_RESUMED
        : PROJECT_ACTIVITY_TYPES.PROJECT_STARTED;
    case PROJECT_STATUSES.ON_HOLD:
      return PROJECT_ACTIVITY_TYPES.PROJECT_PAUSED;
    case PROJECT_STATUSES.COMPLETED:
      return PROJECT_ACTIVITY_TYPES.PROJECT_COMPLETED;
    case PROJECT_STATUSES.CANCELLED:
      return PROJECT_ACTIVITY_TYPES.PROJECT_CANCELLED;
    default:
      return PROJECT_ACTIVITY_TYPES.STATUS_CHANGED;
  }
}

function activityTitleForStatus(next: ProjectStatus): string {
  switch (next) {
    case PROJECT_STATUSES.IN_PROGRESS:
      return 'Project moved to In Progress';
    case PROJECT_STATUSES.ON_HOLD:
      return 'Project put on hold';
    case PROJECT_STATUSES.COMPLETED:
      return 'Project marked complete (internal)';
    case PROJECT_STATUSES.CANCELLED:
      return 'Project cancelled';
    case PROJECT_STATUSES.NOT_STARTED:
      return 'Project marked not started';
    case PROJECT_STATUSES.IN_REVIEW:
      return 'Project moved to In Review';
    default:
      return `Project status changed to ${next}`;
  }
}

function formatDateOnly(value: Date | null | undefined): string {
  if (!value) return 'none';
  return value.toISOString().slice(0, 10);
}
