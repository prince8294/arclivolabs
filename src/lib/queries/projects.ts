import 'server-only';

import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import {
  ACTIVE_PROJECT_STATUSES,
  EMPLOYEE_STATUS,
  PROJECT_FILTER_PRESETS,
  PROJECT_HEALTHS,
  PROJECT_MEMBER_STATUSES,
  PROJECT_MILESTONE_STATUSES,
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  USER_STATUS,
  type ProjectFilterPreset,
  type ProjectHealth,
  type ProjectMilestoneStatus,
  type ProjectStatus,
  type TaskPriority,
} from '@/lib/constants/enums';
import { DEAL_STATUSES } from '@/lib/constants/proposals';
import {
  deriveMilestoneDeadlineState,
  deriveProjectOverdue,
  dueThisWeekUpperBound,
} from '@/lib/projects/metrics';
import { toMongoRegex } from '@/lib/utils/regex';
import { Client } from '@/models/Client';
import { Deal } from '@/models/Deal';
import { Employee } from '@/models/Employee';
import { Project } from '@/models/Project';
import { ProjectActivity } from '@/models/ProjectActivity';
import { ProjectMember } from '@/models/ProjectMember';
import { ProjectMilestone } from '@/models/ProjectMilestone';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { USER_ROLES, type UserRole } from '@/types/auth';

export const LIST_PAGE_SIZE_DEFAULT = 20;
export const LIST_PAGE_SIZE_MAX = 100;

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isOneOf<T extends string>(value: string | undefined, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Shape of a populated Client reference. */
interface PopulatedClient {
  _id: Types.ObjectId;
  name?: string;
  companyName?: string;
  clientCode?: string;
  email?: string;
  phone?: string;
  assignedMarketingUserId?: Types.ObjectId | null;
}

/** Shape of a populated User reference. */
interface PopulatedUser {
  _id: Types.ObjectId;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
}

/** Shape of a populated Deal reference. */
interface PopulatedDeal {
  _id: Types.ObjectId;
  dealCode?: string;
  status?: string;
}

/** Shape of a populated ProjectMilestone reference (dependency links). */
interface PopulatedMilestoneRef {
  _id: Types.ObjectId;
  milestoneCode?: string;
  title?: string;
}

/**
 * Narrow a populated ref to its document shape, or null when populate missed
 * (mongoose types the field as the raw ObjectId in that case).
 */
function populated<T extends { _id: Types.ObjectId }>(value: unknown): T | null {
  if (!value || typeof value !== 'object' || !('_id' in value)) return null;
  return value as T;
}

function displayName(
  source: { name?: string | null; companyName?: string | null } | null | undefined
): string {
  if (!source) return '';
  return source.companyName?.trim() || source.name?.trim() || '';
}

/* -------------------------------------------------------------------------- */
/* List params                                                                 */
/* -------------------------------------------------------------------------- */

export interface ProjectListParams {
  search?: string;
  status?: string;
  priority?: string;
  health?: string;
  clientId?: string;
  managerId?: string;
  /** Named list shortcut (active / completed / overdue / ...). */
  preset?: string;
  /** ISO date; only projects due on or before this are returned. */
  deadlineBefore?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
}

/** Whitelist every URL param; never pass raw user input into a query. */
export function parseProjectListParams(raw: RawSearchParams): ProjectListParams {
  const page = Math.max(1, parseInt(firstValue(raw.page) ?? '1', 10) || 1);
  const limit = Math.min(
    LIST_PAGE_SIZE_MAX,
    Math.max(
      1,
      parseInt(
        firstValue(raw.limit) ?? String(LIST_PAGE_SIZE_DEFAULT),
        10
      ) || LIST_PAGE_SIZE_DEFAULT
    )
  );

  const status = firstValue(raw.status);
  const priority = firstValue(raw.priority);
  const health = firstValue(raw.health);
  const preset = firstValue(raw.preset);

  return {
    search: (firstValue(raw.search) ?? '').trim().slice(0, 120),
    status: isOneOf(status, Object.values(PROJECT_STATUSES)) ? status : '',
    priority: isOneOf(priority, Object.values(TASK_PRIORITIES)) ? priority : '',
    health: isOneOf(health, Object.values(PROJECT_HEALTHS)) ? health : '',
    clientId: isObjectIdParam(raw.clientId) ? raw.clientId : '',
    managerId: isObjectIdParam(raw.managerId) ? raw.managerId : '',
    preset: isOneOf(preset, Object.values(PROJECT_FILTER_PRESETS)) ? preset : '',
    deadlineBefore: isIsoDateParam(raw.deadlineBefore) ? raw.deadlineBefore : '',
    createdFrom: isIsoDateParam(raw.createdFrom) ? raw.createdFrom : '',
    createdTo: isIsoDateParam(raw.createdTo) ? raw.createdTo : '',
    page,
    limit,
  };
}

function isObjectIdParam(value: string | string[] | undefined): value is string {
  const single = firstValue(value);
  return typeof single === 'string' && Types.ObjectId.isValid(single);
}

function isIsoDateParam(value: string | string[] | undefined): value is string {
  const single = firstValue(value);
  if (typeof single !== 'string' || single.length === 0) return false;
  return !Number.isNaN(new Date(single).getTime());
}

/** True when any filter/search is narrowing the list, for the empty state. */
export function hasProjectFilters(params: ProjectListParams): boolean {
  return Boolean(
    params.search ||
      params.status ||
      params.priority ||
      params.health ||
      params.clientId ||
      params.managerId ||
      params.preset ||
      params.deadlineBefore ||
      params.createdFrom ||
      params.createdTo
  );
}

interface ProjectQueryFilter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Translate validated list params into a Mongo filter.
 *
 * Exported so the employee and marketing lists can reuse the identical
 * preset/date semantics instead of re-implementing them.
 */
export function buildProjectFilter(
  params: ProjectListParams = {},
  /**
   * Extra OR-clauses merged into the search term, e.g. matching on client name
   * once the caller has resolved candidate client ids.
   */
  extraSearchClauses: ProjectQueryFilter[] = []
): ProjectQueryFilter {
  const filter: ProjectQueryFilter = {};

  if (params.search || extraSearchClauses.length > 0) {
    const or: ProjectQueryFilter[] = [];
    if (params.search) {
      const regex = toMongoRegex(params.search);
      or.push({ projectCode: regex }, { title: regex }, { description: regex });
    }
    or.push(...extraSearchClauses);
    filter.$or = or;
  }

  if (params.status) {
    filter.status = params.status;
  }

  if (params.priority) {
    filter.priority = params.priority;
  }

  if (params.health) {
    filter.health = params.health;
  }

  if (params.clientId && Types.ObjectId.isValid(params.clientId)) {
    filter.clientId = new Types.ObjectId(params.clientId);
  }

  if (params.managerId && Types.ObjectId.isValid(params.managerId)) {
    filter.managerId = new Types.ObjectId(params.managerId);
  }

  switch (params.preset as ProjectFilterPreset | '') {
    case PROJECT_FILTER_PRESETS.ACTIVE:
      filter.status = { $in: [...ACTIVE_PROJECT_STATUSES] };
      break;
    case PROJECT_FILTER_PRESETS.COMPLETED:
      filter.status = PROJECT_STATUSES.COMPLETED;
      break;
    case PROJECT_FILTER_PRESETS.ON_HOLD:
      filter.status = PROJECT_STATUSES.ON_HOLD;
      break;
    case PROJECT_FILTER_PRESETS.OVERDUE:
      filter.expectedEndDate = { $lt: startOfToday() };
      filter.status = {
        $nin: [PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CANCELLED],
      };
      break;
    case PROJECT_FILTER_PRESETS.DUE_THIS_WEEK:
      filter.expectedEndDate = { $gte: startOfToday(), $lte: dueThisWeekUpperBound() };
      filter.status = {
        $nin: [PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CANCELLED],
      };
      break;
    default:
      break;
  }

  if (params.deadlineBefore) {
    filter.expectedEndDate = {
      ...(filter.expectedEndDate ?? {}),
      $lte: new Date(params.deadlineBefore),
    };
  }

  if (params.createdFrom || params.createdTo) {
    filter.createdAt = {
      ...(params.createdFrom ? { $gte: new Date(params.createdFrom) } : {}),
      ...(params.createdTo ? { $lte: new Date(params.createdTo) } : {}),
    };
  }

  return filter;
}

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/* -------------------------------------------------------------------------- */
/* List                                                                        */
/* -------------------------------------------------------------------------- */

export interface ProjectListItem {
  _id: string;
  projectCode: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  priority: TaskPriority;
  origin: string;
  projectType: string;
  progressPercentage: number;
  startDate: string | null;
  expectedEndDate: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  client: { _id: string; clientCode: string; name: string } | null;
  manager: { _id: string; name: string; email: string } | null;
  createdAt: string;
}

export async function listProjects(params: ProjectListParams = {}) {
  await connectDB();

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(
    LIST_PAGE_SIZE_MAX,
    Math.max(1, params.limit || LIST_PAGE_SIZE_DEFAULT)
  );
  const skip = (page - 1) * limit;

  // Search by client name too: resolve matching clients first, then OR their
  // ids into the query so everything still happens in the database (§34).
  const extraSearchClauses: ProjectQueryFilter[] = [];
  if (params.search) {
    const regex = toMongoRegex(params.search);
    const matching = await Client.find({
      $or: [{ name: regex }, { companyName: regex }, { clientCode: regex }],
    })
      .select('_id')
      .lean();
    extraSearchClauses.push({ clientId: { $in: matching.map((c) => c._id) } });
  }

  const filter = buildProjectFilter(params, extraSearchClauses);

  const [rawProjects, total] = await Promise.all([
    Project.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('clientId', 'clientCode name companyName')
      .populate('managerId', 'name email')
      .lean(),
    Project.countDocuments(filter),
  ]);

  const now = new Date();
  const items: ProjectListItem[] = rawProjects.map((p) => {
    const overdue = deriveProjectOverdue(
      { expectedEndDate: p.expectedEndDate ?? null, status: p.status },
      now
    );
    const client = populated<PopulatedClient>(p.clientId);
    const manager = populated<PopulatedUser>(p.managerId);

    return {
      _id: p._id.toString(),
      projectCode: p.projectCode,
      title: p.title,
      description: p.description ?? null,
      status: p.status,
      health: p.health,
      priority: p.priority,
      origin: p.origin,
      projectType: p.projectType,
      progressPercentage: p.progressPercentage ?? 0,
      startDate: toIso(p.startDate),
      expectedEndDate: toIso(p.expectedEndDate),
      isOverdue: overdue.isOverdue,
      daysOverdue: overdue.daysOverdue,
      client: client
        ? {
            _id: client._id.toString(),
            clientCode: client.clientCode ?? '',
            name: displayName(client) || 'Client',
          }
        : null,
      manager: manager
        ? {
            _id: manager._id.toString(),
            name: manager.name ?? '',
            email: manager.email ?? '',
          }
        : null,
      createdAt: toIso(p.createdAt) ?? '',
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Minimal project reference list used by pickers elsewhere in the app (for
 * example the file manager). Thin wrapper over `listProjects` so those callers
 * keep a single source of truth for project access.
 */
export async function getProjects(params: ProjectListParams = {}): Promise<{
  projects: Array<{ _id: string; projectCode: string; title: string }>;
  total: number;
}> {
  const result = await listProjects({ ...params, limit: params.limit ?? LIST_PAGE_SIZE_MAX });

  return {
    projects: result.items.map((p) => ({
      _id: p._id,
      projectCode: p.projectCode,
      title: p.title,
    })),
    total: result.total,
  };
}

/* -------------------------------------------------------------------------- */
/* Stats                                                                       */
/* -------------------------------------------------------------------------- */


export interface ProjectStats {
  total: number;
  active: number;
  onHold: number;
  atRisk: number;
  delayed: number;
  blocked: number;
  overdue: number;
  completed: number;
}

/** Real aggregation over the projects collection - no synthetic numbers. */
export async function getProjectStats(): Promise<ProjectStats> {
  await connectDB();

  const [row] = await Project.aggregate<{
    _id: null;
    total: number;
    active: number;
    onHold: number;
    atRisk: number;
    delayed: number;
    blocked: number;
    overdue: number;
    completed: number;
  }>([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $in: ['$status', [...ACTIVE_PROJECT_STATUSES]] }, 1, 0] },
        },
        onHold: {
          $sum: { $cond: [{ $eq: ['$status', PROJECT_STATUSES.ON_HOLD] }, 1, 0] },
        },
        atRisk: { $sum: { $cond: [{ $eq: ['$health', PROJECT_HEALTHS.AT_RISK] }, 1, 0] } },
        delayed: { $sum: { $cond: [{ $eq: ['$health', PROJECT_HEALTHS.DELAYED] }, 1, 0] } },
        blocked: { $sum: { $cond: [{ $eq: ['$health', PROJECT_HEALTHS.BLOCKED] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$status', PROJECT_STATUSES.COMPLETED] },
                  { $ne: ['$status', PROJECT_STATUSES.CANCELLED] },
                  { $ne: [{ $ifNull: ['$expectedEndDate', null] }, null] },
                  { $lt: ['$expectedEndDate', startOfToday()] },
                ],
              },
              1,
              0,
            ],
          },
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', PROJECT_STATUSES.COMPLETED] }, 1, 0] },
        },
      },
    },
  ]);

  return {
    total: row?.total ?? 0,
    active: row?.active ?? 0,
    onHold: row?.onHold ?? 0,
    atRisk: row?.atRisk ?? 0,
    delayed: row?.delayed ?? 0,
    blocked: row?.blocked ?? 0,
    overdue: row?.overdue ?? 0,
    completed: row?.completed ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                      */
/* -------------------------------------------------------------------------- */

export interface ProjectDetail extends ProjectListItem {
  actualEndDate: string | null;
  holdReason: string | null;
  cancellationReason: string | null;
  dealId: string | null;
  acceptedProposalVersionId: string | null;
  dealCode: string | null;
  scopeSnapshot: {
    summary: string | null;
    includedFeatures: string[];
    excludedFeatures: string[];
    dependencies: string[];
    customerResponsibilities: string[];
    deliverables: string[];
    estimatedDuration: string | null;
  };
  agreedAmountSnapshot: number | null;
  currency: string;
  internalNotes: Array<{
    _id: string;
    authorName: string;
    authorRole: string;
    body: string;
    createdAt: string | null;
  }>;
  teamSize: number;
  milestoneCount: number;
  completedMilestoneCount: number;
  pendingReviewCount: number;
  creator: { _id: string; name: string; email: string };
}

export async function getProjectById(projectId: string): Promise<ProjectDetail | null> {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) return null;

  const raw = await Project.findById(new Types.ObjectId(projectId))
    .populate('clientId', 'clientCode name companyName email phone')
    .populate('managerId', 'name email role')
    .populate('dealId', 'dealCode status')
    .populate('createdBy', 'name email')
    .lean();

  if (!raw) return null;

  const now = new Date();
  const overdue = deriveProjectOverdue(
    { expectedEndDate: raw.expectedEndDate ?? null, status: raw.status },
    now
  );

  const projectIdObj = raw._id;

  const [teamSize, milestoneAgg] = await Promise.all([
    ProjectMember.countDocuments({
      projectId: projectIdObj,
      status: PROJECT_MEMBER_STATUSES.ACTIVE,
    }),
    ProjectMilestone.aggregate<{ total: number; completed: number; pendingReview: number }>([
      { $match: { projectId: projectIdObj } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [
                { $eq: ['$status', PROJECT_MILESTONE_STATUSES.COMPLETED] },
                1,
                0,
              ],
            },
          },
          pendingReview: {
            $sum: {
              $cond: [
                { $eq: ['$status', PROJECT_MILESTONE_STATUSES.PENDING_REVIEW] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const milestones = milestoneAgg[0];
  const client = populated<PopulatedClient>(raw.clientId);
  const manager = populated<PopulatedUser>(raw.managerId);
  const creator = populated<PopulatedUser>(raw.createdBy);
  const deal = populated<PopulatedDeal>(raw.dealId);

  return {
    _id: raw._id.toString(),
    projectCode: raw.projectCode,
    title: raw.title,
    description: raw.description ?? null,
    status: raw.status,
    health: raw.health,
    priority: raw.priority,
    origin: raw.origin,
    projectType: raw.projectType,
    progressPercentage: raw.progressPercentage ?? 0,
    startDate: toIso(raw.startDate),
    expectedEndDate: toIso(raw.expectedEndDate),
    actualEndDate: toIso(raw.actualEndDate),
    isOverdue: overdue.isOverdue,
    daysOverdue: overdue.daysOverdue,
    holdReason: raw.holdReason ?? null,
    cancellationReason: raw.cancellationReason ?? null,
    client: client
      ? {
          _id: client._id.toString(),
          clientCode: client.clientCode ?? '',
          name: displayName(client) || 'Client',
        }
      : null,
    manager: manager
      ? {
          _id: manager._id.toString(),
          name: manager.name ?? '',
          email: manager.email ?? '',
        }
      : null,
    dealId: deal ? deal._id.toString() : null,
    acceptedProposalVersionId: raw.acceptedProposalVersionId
      ? String(raw.acceptedProposalVersionId)
      : null,
    dealCode: deal?.dealCode ?? null,
    scopeSnapshot: {
      summary: raw.scopeSnapshot?.summary ?? null,
      includedFeatures: raw.scopeSnapshot?.includedFeatures ?? [],
      excludedFeatures: raw.scopeSnapshot?.excludedFeatures ?? [],
      dependencies: raw.scopeSnapshot?.dependencies ?? [],
      customerResponsibilities: raw.scopeSnapshot?.customerResponsibilities ?? [],
      deliverables: raw.scopeSnapshot?.deliverables ?? [],
      estimatedDuration: raw.scopeSnapshot?.estimatedDuration ?? null,
    },
    agreedAmountSnapshot: raw.agreedAmountSnapshot ?? null,
    currency: raw.currency,
    internalNotes: (raw.internalNotes ?? []).map((note) => ({
      _id: String(note._id),
      authorName: note.authorName,
      authorRole: note.authorRole,
      body: note.body,
      createdAt: toIso(note.createdAt),
    })),
    teamSize,
    milestoneCount: milestones?.total ?? 0,
    completedMilestoneCount: milestones?.completed ?? 0,
    pendingReviewCount: milestones?.pendingReview ?? 0,
    creator: {
      _id: creator?._id.toString() ?? '',
      name: creator?.name ?? '',
      email: creator?.email ?? '',
    },
    createdAt: toIso(raw.createdAt) ?? '',
  };
}

/* -------------------------------------------------------------------------- */
/* Team                                                                        */
/* -------------------------------------------------------------------------- */

export interface ProjectMemberItem {
  _id: string;
  userId: string;
  name: string;
  email: string;
  userStatus: string;
  role: string;
  responsibility: string | null;
  designation: string;
  department: string;
  employeeCode: string;
  employmentType: string;
  skills: string[];
  assignedAt: string | null;
  status: string;
}

export async function getActiveProjectMembers(projectId: string): Promise<ProjectMemberItem[]> {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) return [];

  const members = await ProjectMember.find({
    projectId: new Types.ObjectId(projectId),
    status: PROJECT_MEMBER_STATUSES.ACTIVE,
  })
    .populate('userId', 'name email role status')
    .sort({ assignedAt: 1 })
    .lean();

  const userIds = members.map((m) => m.userId?._id).filter(Boolean) as Types.ObjectId[];

  // Employee profiles live in their own collection, so join them explicitly
  // rather than relying on an undeclared populated path on User.
  const profiles = userIds.length
    ? await Employee.find({ userId: { $in: userIds } })
        .select('userId employeeCode designation department employmentType skills status')
        .lean()
    : [];
  const profileByUser = new Map(profiles.map((p) => [p.userId.toString(), p]));

  return members.map((m) => {
    const user = populated<PopulatedUser>(m.userId);
    const uid = user?._id.toString() ?? '';
    const profile = profileByUser.get(uid);
    return {
      _id: String(m._id),
      userId: uid,
      name: user?.name ?? 'Unknown',
      email: user?.email ?? '',
      userStatus: user?.status ?? '',
      role: m.role,
      responsibility: m.responsibility ?? null,
      designation: profile?.designation ?? '',
      department: profile?.department ?? '',
      employeeCode: profile?.employeeCode ?? '',
      employmentType: profile?.employmentType ?? '',
      skills: profile?.skills ?? [],
      assignedAt: toIso(m.assignedAt),
      status: m.status,
    };
  });
}

/** Removed members kept for attribution history (§20). */
export async function getRemovedProjectMembers(
  projectId: string
): Promise<Array<{ userId: string; name: string; role: string; removedAt: string | null; removalReason: string | null }>> {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) return [];

  const members = await ProjectMember.find({
    projectId: new Types.ObjectId(projectId),
    status: PROJECT_MEMBER_STATUSES.REMOVED,
  })
    .populate('userId', 'name')
    .sort({ removedAt: -1 })
    .lean();

  return members.map((m) => {
    const user = populated<PopulatedUser>(m.userId);
    return {
      userId: user?._id.toString() ?? '',
      name: user?.name ?? 'Former member',
      role: m.role,
      removedAt: toIso(m.removedAt),
      removalReason: m.removalReason ?? null,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Assignable staff                                                            */
/* -------------------------------------------------------------------------- */

/** Minimal client list for the project form's client picker. */
export async function listClientOptions(search?: string): Promise<
  Array<{ _id: string; name: string; clientCode: string }>
> {
  await connectDB();

  const term = (search ?? '').trim();
  const filter = term
    ? {
        $or: [
          { name: toMongoRegex(term) },
          { companyName: toMongoRegex(term) },
          { clientCode: toMongoRegex(term) },
        ],
      }
    : {};

  const clients = await Client.find(filter)
    .select('name companyName clientCode')
    .sort({ clientCode: 1 })
    .limit(200)
    .lean();

  return clients.map((c) => ({
    _id: String(c._id),
    name: displayName(c) || 'Client',
    clientCode: c.clientCode,
  }));
}


export interface AssignableEmployee {
  _id: string;
  name: string;
  email: string;
  employeeCode: string;
  designation: string;
  department: string;
  employmentType: string;
  skills: string[];
  /** Active project assignments - a light availability signal (§18). */
  activeProjectCount: number;
}

/**
 * Active employees available for assignment, with real database values and a
 * live count of their current project load (§19).
 */
export async function listAssignableEmployees(search?: string): Promise<AssignableEmployee[]> {
  await connectDB();

  const employees = await Employee.find({ status: { $ne: EMPLOYEE_STATUS.TERMINATED } })
    .select('userId employeeCode designation department employmentType skills status')
    .sort({ employeeCode: 1 })
    .lean();

  if (employees.length === 0) return [];

  const users = await User.find({
    _id: { $in: employees.map((e) => e.userId) },
    status: USER_STATUS.ACTIVE,
    role: { $in: [USER_ROLES.EMPLOYEE, USER_ROLES.ADMIN] },
  })
    .select('_id name email')
    .lean();

  const userById = new Map(users.map((u) => [String(u._id), u]));
  const visible = employees.filter((e) => userById.has(e.userId.toString()));

  const loads = await ProjectMember.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { status: PROJECT_MEMBER_STATUSES.ACTIVE } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);
  const loadByUser = new Map(loads.map((l) => [String(l._id), l.count]));

  const term = (search ?? '').trim();
  const options: AssignableEmployee[] = visible.map((e) => {
    const user = userById.get(e.userId.toString());
    return {
      _id: String(e.userId),
      name: user?.name ?? '',
      email: user?.email ?? '',
      employeeCode: e.employeeCode,
      designation: e.designation,
      department: e.department,
      employmentType: e.employmentType,
      skills: e.skills ?? [],
      activeProjectCount: loadByUser.get(e.userId.toString()) ?? 0,
    };
  });

  if (!term) return options;

  const needle = term.toLowerCase();
  return options.filter((o) =>
    [o.name, o.email, o.employeeCode, o.designation, o.department, ...o.skills]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  );
}

/** Distinct managers referenced by existing projects, for the filter bar. */
export async function listProjectManagers(): Promise<Array<{ _id: string; name: string }>> {
  await connectDB();
  const managers = await User.find({
    _id: { $in: await Project.distinct('managerId') },
  })
    .select('_id name')
    .lean();
  return managers.map((m) => ({ _id: String(m._id), name: m.name }));
}

/** Clients that already have at least one project, for the filter bar. */
export async function listProjectClients(): Promise<Array<{ _id: string; name: string; clientCode: string }>> {
  await connectDB();
  const clientIds = await Project.distinct('clientId');
  if (clientIds.length === 0) return [];
  const clients = await Client.find({ _id: { $in: clientIds } })
    .select('name companyName clientCode')
    .lean();
  return clients.map((c) => ({
    _id: String(c._id),
    name: displayName(c) || 'Client',
    clientCode: c.clientCode,
  }));
}

/* -------------------------------------------------------------------------- */
/* Milestones                                                                  */
/* -------------------------------------------------------------------------- */

export interface ProjectMilestoneItem {
  _id: string;
  milestoneCode: string;
  title: string;
  description: string | null;
  deliverables: string[];
  sequence: number;
  status: ProjectMilestoneStatus;
  progressPercentage: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  deadlineState: string;
  daysUntilDue: number | null;
  assignee: { _id: string; name: string } | null;
  dependsOn: Array<{ _id: string; milestoneCode: string; title: string }>;
  clientVisible: boolean;
  review: {
    submittedBy: { _id: string; name: string } | null;
    submittedAt: string | null;
    submissionNotes: string | null;
    reviewedBy: { _id: string; name: string } | null;
    reviewedAt: string | null;
    reviewNotes: string | null;
  };
  canSelfApprove: boolean;
}

export async function getProjectMilestones(
  projectId: string,
  viewerId?: string
): Promise<ProjectMilestoneItem[]> {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) return [];

  const milestones = await ProjectMilestone.find({ projectId: new Types.ObjectId(projectId) })
    .populate('assignedTo', 'name')
    .populate('submittedBy', 'name')
    .populate('reviewedBy', 'name')
    .populate('dependsOn', 'milestoneCode title')
    .sort({ sequence: 1 })
    .lean();

  const now = new Date();
  const today = new Date(now).setHours(0, 0, 0, 0);

  return milestones.map((ms) => {
    const assignee = populated<PopulatedUser>(ms.assignedTo);
    const submitter = populated<PopulatedUser>(ms.submittedBy);
    const reviewer = populated<PopulatedUser>(ms.reviewedBy);

    return {
      _id: String(ms._id),
      milestoneCode: ms.milestoneCode,
      title: ms.title,
      description: ms.description ?? null,
      deliverables: ms.deliverables ?? [],
      sequence: ms.sequence,
      status: ms.status,
      progressPercentage: ms.progressPercentage ?? 0,
      startDate: toIso(ms.startDate),
      dueDate: toIso(ms.dueDate),
      completedAt: toIso(ms.completedAt),
      deadlineState: deriveMilestoneDeadlineState(
        { status: ms.status, dueDate: ms.dueDate ?? null },
        now
      ),
      daysUntilDue: ms.dueDate
        ? Math.round(
            (new Date(ms.dueDate).setHours(0, 0, 0, 0) - today) / (24 * 60 * 60 * 1000)
          )
        : null,
      assignee: assignee
        ? { _id: assignee._id.toString(), name: assignee.name ?? '' }
        : null,
      dependsOn: (ms.dependsOn ?? [])
        .map((d) => populated<PopulatedMilestoneRef>(d))
        .filter((d): d is PopulatedMilestoneRef => d !== null)
        .map((d) => ({
          _id: d._id.toString(),
          milestoneCode: d.milestoneCode ?? '',
          title: d.title ?? '',
        })),
      clientVisible: ms.clientVisible,
      review: {
        submittedBy: submitter
          ? { _id: submitter._id.toString(), name: submitter.name ?? '' }
          : null,
        submittedAt: toIso(ms.submittedAt),
        submissionNotes: ms.submissionNotes ?? null,
        reviewedBy: reviewer
          ? { _id: reviewer._id.toString(), name: reviewer.name ?? '' }
          : null,
        reviewedAt: toIso(ms.reviewedAt),
        reviewNotes: ms.reviewNotes ?? null,
      },
      // Surfaces the "you cannot approve your own submission" rule in the UI so
      // the reviewer button is hidden rather than failing after the click.
      canSelfApprove: Boolean(
        viewerId && submitter && submitter._id.toString() === viewerId
      ),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Activity timeline                                                           */
/* -------------------------------------------------------------------------- */

export interface ProjectActivityItem {
  _id: string;
  type: string;
  title: string;
  summary: string | null;
  createdAt: string;
  actor: { _id: string; name: string };
}

export async function getProjectActivity(
  projectId: string,
  options: { page?: number; limit?: number } = {}
): Promise<{ items: ProjectActivityItem[]; total: number; page: number; totalPages: number }> {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }

  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));

  const [rows, total] = await Promise.all([
    ProjectActivity.find({ projectId: new Types.ObjectId(projectId) })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actorUserId', 'name')
      .lean(),
    ProjectActivity.countDocuments({ projectId: new Types.ObjectId(projectId) }),
  ]);

  return {
items: rows.map((row) => {
      const actor = populated<PopulatedUser>(row.actorUserId);
      return {
        _id: String(row._id),
        type: row.type,
        title: row.title,
        summary: row.summary ?? null,
        createdAt: toIso(row.createdAt) ?? '',
        actor: {
          _id: actor?._id.toString() ?? '',
          name: actor?.name ?? 'System',
        },
      };
    }),

    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/* -------------------------------------------------------------------------- */
/* Task summary (Part 11 integration)                                          */
/* -------------------------------------------------------------------------- */

export async function getProjectTaskSummary(projectId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) {
    return {
      total: 0,
      open: 0,
      inProgress: 0,
      blocked: 0,
      inReview: 0,
      changesRequested: 0,
      completed: 0,
      progressPercentage: 0,
    };
  }

  const pObjectId = new Types.ObjectId(projectId);

  const [total, open, inProgress, blocked, inReview, changesRequested, completed] =
    await Promise.all([
      Task.countDocuments({ projectId: pObjectId, status: { $ne: 'CANCELLED' } }),
      Task.countDocuments({ projectId: pObjectId, status: 'TODO' }),
      Task.countDocuments({ projectId: pObjectId, status: 'IN_PROGRESS' }),
      Task.countDocuments({ projectId: pObjectId, status: 'BLOCKED' }),
      Task.countDocuments({ projectId: pObjectId, status: 'IN_REVIEW' }),
      Task.countDocuments({ projectId: pObjectId, status: 'CHANGES_REQUESTED' }),
      Task.countDocuments({ projectId: pObjectId, status: 'COMPLETED' }),
    ]);

  return {
    total,
    open,
    inProgress,
    blocked,
    inReview,
    changesRequested,
    completed,
    progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Deal bootstrap                                                              */
/* -------------------------------------------------------------------------- */

export interface ProjectDealPrefill {
  dealId: string;
  dealCode: string;
  status: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string | null;
  currency: string;
  agreedAmountMinor: number;
  overview: string | null;
  deliverables: string[];
  includedFeatures: string[];
  excludedFeatures: string[];
  expectedStartDate: string | null;
  estimatedDuration: string | null;
  deliveryMilestones: Array<{
    name: string;
    description?: string | null;
    sequence: number;
  }>;
  existingProjectId: string | null;
  existingProjectCode: string | null;
}

/**
 * Commercial data for the create-project form when starting from a finalized
 * Deal (§8). Read-only: this prefill never writes back to the Deal.
 */
export async function getDealProjectPrefill(dealId: string): Promise<ProjectDealPrefill | null> {
  await connectDB();
  if (!Types.ObjectId.isValid(dealId)) return null;

  const deal = await Deal.findById(new Types.ObjectId(dealId))
    .populate('clientId', 'name companyName clientCode')
    .populate('proposalId', 'title description proposalCode')
    .lean();

  if (!deal) return null;

  const existing = await Project.findOne({ dealId: deal._id }).select('projectCode').lean();

  const client = deal.clientId as
    | { _id: Types.ObjectId; name?: string; companyName?: string; clientCode?: string }
    | null;

  const snapshot = deal.commercialSnapshot ?? null;

  return {
    dealId: String(deal._id),
    dealCode: deal.dealCode,
    status: deal.status,
    clientId: client ? String(client._id) : '',
    clientName: client ? displayName(client) || 'Client' : '',
    title: deal.title,
    description:
      (deal.proposalId as { description?: string } | null)?.description ??
      snapshot?.overview ??
      null,
    currency: deal.currency,
    agreedAmountMinor: deal.agreedAmountMinor,
    overview: snapshot?.overview ?? null,
    deliverables: snapshot?.deliverables ?? [],
    includedFeatures: snapshot?.includedFeatures ?? [],
    excludedFeatures: snapshot?.excludedFeatures ?? [],
    expectedStartDate: toIso(snapshot?.expectedStartDate),
    estimatedDuration: snapshot?.estimatedDuration ?? null,
    deliveryMilestones: snapshot?.deliveryMilestones ?? [],
    existingProjectId: existing ? String(existing._id) : null,
    existingProjectCode: existing?.projectCode ?? null,
  };
}

/** Deals eligible to become a project (finalized, client present, no project). */
export async function listProjectableDeals(search?: string) {
  await connectDB();

  const deals = await Deal.find({
    status: { $in: [DEAL_STATUSES.FINALIZED, DEAL_STATUSES.READY_FOR_PROJECT] },
    clientId: { $ne: null },
  })
    .populate('clientId', 'name companyName')
    .sort({ finalizedAt: -1 })
    .limit(100)
    .lean();

  const used = new Set(
    (await Project.find({ dealId: { $in: deals.map((d) => d._id) } })
      .select('dealId')
      .lean()
  ).map((p) => String(p.dealId))
  );

  const options = deals
    .map((d) => ({
      _id: String(d._id),
      dealCode: d.dealCode,
      title: d.title,
      clientName: displayName(populated<PopulatedClient>(d.clientId)) || 'Client',
      currency: d.currency,
      hasProject: used.has(String(d._id)),
    }))
    .filter((o) => !o.hasProject);

  const term = (search ?? '').trim().toLowerCase();
  if (!term) return options;
  return options.filter((o) =>
    `${o.dealCode} ${o.title} ${o.clientName}`.toLowerCase().includes(term)
  );
}

/* -------------------------------------------------------------------------- */
/* Employee-scoped access                                                      */
/* -------------------------------------------------------------------------- */

/** True when `userId` holds an ACTIVE membership on `projectId` (§39). */
export async function hasActiveProjectMembership(
  userId: string,
  projectId: string
): Promise<boolean> {
  await connectDB();
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(projectId)) return false;

  const member = await ProjectMember.findOne({
    projectId: new Types.ObjectId(projectId),
    userId: new Types.ObjectId(userId),
    status: PROJECT_MEMBER_STATUSES.ACTIVE,
  })
    .select('_id')
    .lean();

  return Boolean(member);
}

export interface EmployeeProjectItem {
  _id: string;
  projectCode: string;
  title: string;
  status: ProjectStatus;
  priority: TaskPriority;
  progressPercentage: number;
  startDate: string | null;
  expectedEndDate: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  clientName: string;
  role: string;
  responsibility: string | null;
  assignedMilestoneCount: number;
  nextDueDate: string | null;
}

/**
 * Projects the given employee is actively assigned to (§37).
 *
 * Membership is resolved in the database - the employee's id comes from the
 * session, never from the URL.
 */
export async function listEmployeeProjects(userId: string): Promise<EmployeeProjectItem[]> {
  await connectDB();
  if (!Types.ObjectId.isValid(userId)) return [];

  const memberships = await ProjectMember.find({
    userId: new Types.ObjectId(userId),
    status: PROJECT_MEMBER_STATUSES.ACTIVE,
  })
    .select('projectId role responsibility')
    .lean();

  if (memberships.length === 0) return [];

  const projectIds = memberships.map((m) => m.projectId);
  const roleByProject = new Map(
    memberships.map((m) => [String(m.projectId), { role: m.role, responsibility: m.responsibility }])
  );

  const [projects, milestoneCounts] = await Promise.all([
    Project.find({ _id: { $in: projectIds } })
      .populate('clientId', 'name companyName')
      .sort({ createdAt: -1 })
      .lean(),
    ProjectMilestone.aggregate<{ _id: Types.ObjectId; count: number; nextDue: Date }>([
      {
        $match: {
          projectId: { $in: projectIds },
          assignedTo: new Types.ObjectId(userId),
          status: {
            $nin: [
              PROJECT_MILESTONE_STATUSES.COMPLETED,
              PROJECT_MILESTONE_STATUSES.CANCELLED,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$projectId',
          count: { $sum: 1 },
          nextDue: { $min: '$dueDate' },
        },
      },
    ]),
  ]);

  const milestoneByProject = new Map(
    milestoneCounts.map((m) => [String(m._id), { count: m.count, nextDue: m.nextDue }])
  );

  const now = new Date();

  return projects.map((p) => {
    const overdue = deriveProjectOverdue(
      { expectedEndDate: p.expectedEndDate ?? null, status: p.status },
      now
    );
    const membership = roleByProject.get(String(p._id));
    const milestones = milestoneByProject.get(String(p._id));

    return {
      _id: String(p._id),
      projectCode: p.projectCode,
      title: p.title,
      status: p.status,
      priority: p.priority,
      progressPercentage: p.progressPercentage ?? 0,
      startDate: toIso(p.startDate),
      expectedEndDate: toIso(p.expectedEndDate),
      isOverdue: overdue.isOverdue,
      daysOverdue: overdue.daysOverdue,
      clientName: displayName(p.clientId as { name?: string; companyName?: string } | null),
      role: membership?.role ?? '',
      responsibility: membership?.responsibility ?? null,
      assignedMilestoneCount: milestones?.count ?? 0,
      nextDueDate: toIso(milestones?.nextDue),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Marketing-scoped access                                                     */
/* -------------------------------------------------------------------------- */

export interface MarketingProjectItem {
  _id: string;
  projectCode: string;
  title: string;
  status: ProjectStatus;
  progressPercentage: number;
expectedEndDate: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  clientName: string;
  completedMilestones: number;
  totalMilestones: number;
}


/**
 * High-level project visibility for the Marketing user who owns the client
 * (§40). Deliberately omits team, notes, financials and internal milestones.
 */
export async function listMarketingProjects(userId: string): Promise<MarketingProjectItem[]> {
  await connectDB();
  if (!Types.ObjectId.isValid(userId)) return [];

  const clients = await Client.find({ assignedMarketingUserId: new Types.ObjectId(userId) })
    .select('_id')
    .lean();
  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c._id);
  const projects = await Project.find({ clientId: { $in: clientIds } })
    .populate('clientId', 'name companyName')
    .sort({ createdAt: -1 })
    .lean();

const counts = await ProjectMilestone.aggregate<{
    _id: Types.ObjectId;
    total: number;
    completed: number;
    visible: number;
  }>([

    { $match: { projectId: { $in: projects.map((p) => p._id) } } },
    {
      $group: {
        _id: '$projectId',
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', PROJECT_MILESTONE_STATUSES.COMPLETED] }, 1, 0] },
        },
        visible: { $sum: { $cond: ['$clientVisible', 1, 0] } },
      },
    },
  ]);
  const countByProject = new Map(counts.map((c) => [String(c._id), c]));

  const now = new Date();

  return projects.map((p) => {
    const overdue = deriveProjectOverdue(
      { expectedEndDate: p.expectedEndDate ?? null, status: p.status },
      now
    );
    const stats = countByProject.get(String(p._id));
    return {
      _id: String(p._id),
      projectCode: p.projectCode,
      title: p.title,
      status: p.status,
progressPercentage: p.progressPercentage ?? 0,
      expectedEndDate: toIso(p.expectedEndDate),
      isOverdue: overdue.isOverdue,
      daysOverdue: overdue.daysOverdue,
      clientName: displayName(populated<PopulatedClient>(p.clientId)),
      completedMilestones: stats?.completed ?? 0,
      totalMilestones: stats?.total ?? 0,
    };

  });
}

export interface MarketingProjectDetail {
  _id: string;
  projectCode: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  progressPercentage: number;
  startDate: string | null;
  expectedEndDate: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  clientName: string;
  projectType: string;
  milestones: Array<{
    _id: string;
    title: string;
    sequence: number;
    status: ProjectMilestoneStatus;
    progressPercentage: number;
    dueDate: string | null;
    completedAt: string | null;
  }>;
}

/**
 * Marketing-safe project view. Ownership is verified server-side by
 * `Client.assignedMarketingUserId` (§40); only `clientVisible` milestones are
 * returned.
 */
export async function getMarketingProjectDetail(
  projectId: string,
  marketingUserId: string
): Promise<MarketingProjectDetail | null> {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(marketingUserId)) {
    return null;
  }

  const project = await Project.findById(new Types.ObjectId(projectId))
    .populate('clientId', 'name companyName assignedMarketingUserId')
    .lean();

  if (!project || !project.clientId) return null;

  // Ownership gate: the requesting marketing user must own this client.
  const ownerId = String(
    (project.clientId as { assignedMarketingUserId?: Types.ObjectId })
      .assignedMarketingUserId ?? ''
  );
  if (!ownerId || ownerId !== String(marketingUserId)) return null;

  const milestones = await ProjectMilestone.find({
    projectId: project._id,
    clientVisible: true,
  })
    .select('title sequence status progressPercentage dueDate completedAt')
    .sort({ sequence: 1 })
    .lean();

  const now = new Date();
  const overdue = deriveProjectOverdue(
    { expectedEndDate: project.expectedEndDate ?? null, status: project.status },
    now
  );

  return {
    _id: String(project._id),
    projectCode: project.projectCode,
    title: project.title,
    description: project.description ?? null,
    status: project.status,
    progressPercentage: project.progressPercentage ?? 0,
    startDate: toIso(project.startDate),
    expectedEndDate: toIso(project.expectedEndDate),
    isOverdue: overdue.isOverdue,
    daysOverdue: overdue.daysOverdue,
    clientName: displayName(project.clientId as { name?: string; companyName?: string }),
    projectType: project.projectType,
    milestones: milestones.map((m) => ({
      _id: String(m._id),
      title: m.title,
      sequence: m.sequence,
      status: m.status,
      progressPercentage: m.progressPercentage ?? 0,
      dueDate: toIso(m.dueDate),
      completedAt: toIso(m.completedAt),
    })),
  };
}

/** Re-exported so route guards can reason about roles without deep imports. */
export type { UserRole };
