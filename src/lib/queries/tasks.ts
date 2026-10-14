import 'server-only';

import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { Task, type ITask } from '@/models/Task';
import { TaskComment } from '@/models/TaskComment';
import { TaskActivity } from '@/models/TaskActivity';
import { Employee } from '@/models/Employee';
import { User } from '@/models/User';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/constants/enums';

export interface TaskListFilterParams {
  search?: string;
  status?: string;
  priority?: string;
  projectId?: string;
  assignedTo?: string;
  milestoneId?: string;
  overdueOnly?: boolean;
  pendingReviewOnly?: boolean;
  completedOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface PopulatedTaskItem {
  _id: string;
  taskCode: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progressPercentage: number;
  estimatedMinutes: number;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  submittedAt?: string | null;
  labels: string[];
  project: {
    _id: string;
    projectCode: string;
    title: string;
  };
  milestone?: {
    _id: string;
    milestoneCode: string;
    title: string;
  } | null;
  assignee?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  creator: {
    _id: string;
    name: string;
    email: string;
  };
  blocker?: {
    reason: string;
    reportedAt: string;
  } | null;
}

export async function listTasks(params: TaskListFilterParams) {
  await connectDB();

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {};

  if (params.status && Object.values(TASK_STATUSES).includes(params.status as TaskStatus)) {
    query.status = params.status;
  }

  if (params.priority && Object.values(TASK_PRIORITIES).includes(params.priority as TaskPriority)) {
    query.priority = params.priority;
  }

  if (params.projectId && Types.ObjectId.isValid(params.projectId)) {
    query.projectId = new Types.ObjectId(params.projectId);
  }

  if (params.assignedTo && Types.ObjectId.isValid(params.assignedTo)) {
    query.assignedTo = new Types.ObjectId(params.assignedTo);
  }

  if (params.milestoneId && Types.ObjectId.isValid(params.milestoneId)) {
    query.milestoneId = new Types.ObjectId(params.milestoneId);
  }

  if (params.pendingReviewOnly) {
    query.status = TASK_STATUSES.IN_REVIEW;
  }

  if (params.completedOnly) {
    query.status = TASK_STATUSES.COMPLETED;
  }

  if (params.overdueOnly) {
    query.dueDate = { $lt: new Date() };
    query.status = { $nin: [TASK_STATUSES.COMPLETED, TASK_STATUSES.CANCELLED] };
  }

  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    const regex = new RegExp(s, 'i');
    query.$or = [{ taskCode: regex }, { title: regex }, { labels: regex }];
  }

  const [rawItems, total] = await Promise.all([
    Task.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('projectId', 'projectCode title')
      .populate('milestoneId', 'milestoneCode title')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .lean(),
    Task.countDocuments(query),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: PopulatedTaskItem[] = rawItems.map((doc: any) => ({
    _id: doc._id.toString(),
    taskCode: doc.taskCode,
    title: doc.title,
    description: doc.description || null,
    status: doc.status,
    priority: doc.priority,
    progressPercentage: doc.progressPercentage || 0,
    estimatedMinutes: doc.estimatedMinutes || 0,
    startDate: doc.startDate ? doc.startDate.toISOString() : null,
    dueDate: doc.dueDate ? doc.dueDate.toISOString() : null,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
    submittedAt: doc.submittedAt ? doc.submittedAt.toISOString() : null,
    labels: doc.labels || [],
    project: {
      _id: doc.projectId?._id?.toString() || '',
      projectCode: doc.projectId?.projectCode || '',
      title: doc.projectId?.title || 'Unknown Project',
    },
    milestone: doc.milestoneId
      ? {
          _id: doc.milestoneId._id?.toString() || '',
          milestoneCode: doc.milestoneId.milestoneCode || '',
          title: doc.milestoneId.title || '',
        }
      : null,
    assignee: doc.assignedTo
      ? {
          _id: doc.assignedTo._id?.toString() || '',
          name: doc.assignedTo.name || '',
          email: doc.assignedTo.email || '',
        }
      : null,
    creator: {
      _id: doc.createdBy?._id?.toString() || '',
      name: doc.createdBy?.name || '',
      email: doc.createdBy?.email || '',
    },
    blocker: doc.blocker
      ? {
          reason: doc.blocker.reason,
          reportedAt: doc.blocker.reportedAt ? doc.blocker.reportedAt.toISOString() : '',
        }
      : null,
  }));

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function getTaskById(taskId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(taskId)) return null;

  const rawDoc = await Task.findById(new Types.ObjectId(taskId))
    .populate('projectId', 'projectCode title status managerId')
    .populate('milestoneId', 'milestoneCode title status sequence progressPercentage')
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role')
    .populate('reviewedBy', 'name email')
    .populate('submittedBy', 'name email')
    .populate('parentTaskId', 'taskCode title status')
    .populate('dependencies', 'taskCode title status priority dueDate')
    .lean();

  if (!rawDoc) return null;

  // Fetch subtasks
  const rawSubtasks = await Task.find({ parentTaskId: rawDoc._id })
    .sort({ createdAt: 1 })
    .populate('assignedTo', 'name')
    .lean();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = rawDoc;

  return {
    _id: doc._id.toString(),
    taskCode: doc.taskCode,
    title: doc.title,
    description: doc.description || null,
    status: doc.status as TaskStatus,
    priority: doc.priority as TaskPriority,
    progressPercentage: doc.progressPercentage || 0,
    estimatedMinutes: doc.estimatedMinutes || 0,
    startDate: doc.startDate ? doc.startDate.toISOString() : null,
    dueDate: doc.dueDate ? doc.dueDate.toISOString() : null,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
    reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
    reviewNotes: doc.reviewNotes || null,
    submittedAt: doc.submittedAt ? doc.submittedAt.toISOString() : null,
    submissionNotes: doc.submissionNotes || null,
    submissionLinks: (doc.submissionLinks || []).map((l: { title: string; url: string }) => ({
      title: l.title,
      url: l.url,
    })),
    labels: doc.labels || [],
    project: {
      _id: doc.projectId?._id?.toString() || '',
      projectCode: doc.projectId?.projectCode || '',
      title: doc.projectId?.title || '',
      status: doc.projectId?.status || '',
      managerId: doc.projectId?.managerId?.toString() || null,
    },
    milestone: doc.milestoneId
      ? {
          _id: doc.milestoneId._id?.toString() || '',
          milestoneCode: doc.milestoneId.milestoneCode || '',
          title: doc.milestoneId.title || '',
          status: doc.milestoneId.status || '',
          sequence: doc.milestoneId.sequence || 1,
          progressPercentage: doc.milestoneId.progressPercentage || 0,
        }
      : null,
    assignee: doc.assignedTo
      ? {
          _id: doc.assignedTo._id?.toString() || '',
          name: doc.assignedTo.name || '',
          email: doc.assignedTo.email || '',
          role: doc.assignedTo.role || '',
        }
      : null,
    creator: {
      _id: doc.createdBy?._id?.toString() || '',
      name: doc.createdBy?.name || '',
      email: doc.createdBy?.email || '',
    },
    reviewer: doc.reviewedBy
      ? {
          _id: doc.reviewedBy._id?.toString() || '',
          name: doc.reviewedBy.name || '',
        }
      : null,
    submitter: doc.submittedBy
      ? {
          _id: doc.submittedBy._id?.toString() || '',
          name: doc.submittedBy.name || '',
        }
      : null,
    parentTask: doc.parentTaskId
      ? {
          _id: doc.parentTaskId._id?.toString() || '',
          taskCode: doc.parentTaskId.taskCode || '',
          title: doc.parentTaskId.title || '',
          status: doc.parentTaskId.status || '',
        }
      : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dependencies: (doc.dependencies || []).map((dep: any) => ({
      _id: dep._id?.toString() || '',
      taskCode: dep.taskCode || '',
      title: dep.title || '',
      status: dep.status || '',
      priority: dep.priority || '',
      dueDate: dep.dueDate ? dep.dueDate.toISOString() : null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subtasks: rawSubtasks.map((st: any) => ({
      _id: st._id.toString(),
      taskCode: st.taskCode,
      title: st.title,
      status: st.status,
      priority: st.priority,
      progressPercentage: st.progressPercentage || 0,
      assigneeName: st.assignedTo?.name || 'Unassigned',
      dueDate: st.dueDate ? st.dueDate.toISOString() : null,
    })),
    blocker: doc.blocker
      ? {
          reason: doc.blocker.reason,
          description: doc.blocker.description || null,
          reportedAt: doc.blocker.reportedAt ? doc.blocker.reportedAt.toISOString() : '',
          resolvedAt: doc.blocker.resolvedAt ? doc.blocker.resolvedAt.toISOString() : null,
          resolutionNotes: doc.blocker.resolutionNotes || null,
        }
      : null,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : '',
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : '',
  };
}

export async function getTaskComments(taskId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(taskId)) return [];

  const comments = await TaskComment.find({ taskId: new Types.ObjectId(taskId) })
    .sort({ createdAt: 1 })
    .populate('authorId', 'name email role')
    .lean();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return comments.map((c: any) => ({
    _id: c._id.toString(),
    content: c.content,
    visibility: c.visibility,
    isEdited: Boolean(c.isEdited),
    editedAt: c.editedAt ? c.editedAt.toISOString() : null,
    createdAt: c.createdAt ? c.createdAt.toISOString() : '',
    author: {
      _id: c.authorId?._id?.toString() || '',
      name: c.authorId?.name || 'User',
      email: c.authorId?.email || '',
      role: c.authorId?.role || '',
    },
  }));
}

export async function getTaskActivities(taskId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(taskId)) return [];

  const activities = await TaskActivity.find({ taskId: new Types.ObjectId(taskId) })
    .sort({ createdAt: -1 })
    .populate('actorUserId', 'name email role')
    .limit(50)
    .lean();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return activities.map((a: any) => ({
    _id: a._id.toString(),
    type: a.type,
    summary: a.summary,
    metadata: a.metadata || null,
    createdAt: a.createdAt ? a.createdAt.toISOString() : '',
    actor: {
      _id: a.actorUserId?._id?.toString() || '',
      name: a.actorUserId?.name || 'System',
      role: a.actorUserId?.role || '',
    },
  }));
}

export async function getTaskBoard(filters: {
  projectId?: string;
  assignedTo?: string;
  search?: string;
}) {
  await connectDB();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {};

  if (filters.projectId && Types.ObjectId.isValid(filters.projectId)) {
    query.projectId = new Types.ObjectId(filters.projectId);
  }

  if (filters.assignedTo && Types.ObjectId.isValid(filters.assignedTo)) {
    query.assignedTo = new Types.ObjectId(filters.assignedTo);
  }

  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim();
    const regex = new RegExp(s, 'i');
    query.$or = [{ taskCode: regex }, { title: regex }, { labels: regex }];
  }

  const tasks = await Task.find(query)
    .sort({ priority: -1, dueDate: 1, createdAt: -1 })
    .populate('projectId', 'projectCode title')
    .populate('assignedTo', 'name email')
    .lean();

  const board: Record<TaskStatus, PopulatedTaskItem[]> = {
    [TASK_STATUSES.TODO]: [],
    [TASK_STATUSES.IN_PROGRESS]: [],
    [TASK_STATUSES.BLOCKED]: [],
    [TASK_STATUSES.IN_REVIEW]: [],
    [TASK_STATUSES.CHANGES_REQUESTED]: [],
    [TASK_STATUSES.COMPLETED]: [],
    [TASK_STATUSES.CANCELLED]: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks.forEach((t: any) => {
    const item: PopulatedTaskItem = {
      _id: t._id.toString(),
      taskCode: t.taskCode,
      title: t.title,
      description: t.description || null,
      status: t.status,
      priority: t.priority,
      progressPercentage: t.progressPercentage || 0,
      estimatedMinutes: t.estimatedMinutes || 0,
      startDate: t.startDate ? t.startDate.toISOString() : null,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      submittedAt: t.submittedAt ? t.submittedAt.toISOString() : null,
      labels: t.labels || [],
      project: {
        _id: t.projectId?._id?.toString() || '',
        projectCode: t.projectId?.projectCode || '',
        title: t.projectId?.title || 'Unknown',
      },
      milestone: null,
      assignee: t.assignedTo
        ? {
            _id: t.assignedTo._id?.toString() || '',
            name: t.assignedTo.name || '',
            email: t.assignedTo.email || '',
          }
        : null,
      creator: {
        _id: '',
        name: '',
        email: '',
      },
    };

    if (board[t.status as TaskStatus]) {
      board[t.status as TaskStatus].push(item);
    }
  });

  return board;
}

export async function getAdminTaskStats() {
  await connectDB();
  const now = new Date();

  const [
    totalTasks,
    activeTasks,
    pendingReviews,
    overdueTasks,
    blockedTasks,
    completedTasks,
  ] = await Promise.all([
    Task.countDocuments({ status: { $ne: TASK_STATUSES.CANCELLED } }),
    Task.countDocuments({ status: TASK_STATUSES.IN_PROGRESS }),
    Task.countDocuments({ status: TASK_STATUSES.IN_REVIEW }),
    Task.countDocuments({
      dueDate: { $lt: now },
      status: { $nin: [TASK_STATUSES.COMPLETED, TASK_STATUSES.CANCELLED] },
    }),
    Task.countDocuments({ status: TASK_STATUSES.BLOCKED }),
    Task.countDocuments({ status: TASK_STATUSES.COMPLETED }),
  ]);

  return {
    totalTasks,
    activeTasks,
    pendingReviews,
    overdueTasks,
    blockedTasks,
    completedTasks,
  };
}

export async function getEmployeeDashboardStats(userId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(userId)) {
    return {
      activeTasks: 0,
      dueToday: 0,
      overdue: 0,
      blocked: 0,
      pendingReview: 0,
      completedRecently: 0,
      nearestDeadlines: [],
    };
  }

  const userObjectId = new Types.ObjectId(userId);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    activeTasks,
    dueToday,
    overdue,
    blocked,
    pendingReview,
    completedRecently,
    rawDeadlines,
  ] = await Promise.all([
    Task.countDocuments({
      assignedTo: userObjectId,
      status: { $in: [TASK_STATUSES.TODO, TASK_STATUSES.IN_PROGRESS, TASK_STATUSES.CHANGES_REQUESTED] },
    }),
    Task.countDocuments({
      assignedTo: userObjectId,
      dueDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: [TASK_STATUSES.COMPLETED, TASK_STATUSES.CANCELLED] },
    }),
    Task.countDocuments({
      assignedTo: userObjectId,
      dueDate: { $lt: startOfDay },
      status: { $nin: [TASK_STATUSES.COMPLETED, TASK_STATUSES.CANCELLED] },
    }),
    Task.countDocuments({
      assignedTo: userObjectId,
      status: TASK_STATUSES.BLOCKED,
    }),
    Task.countDocuments({
      assignedTo: userObjectId,
      status: TASK_STATUSES.IN_REVIEW,
    }),
    Task.countDocuments({
      assignedTo: userObjectId,
      status: TASK_STATUSES.COMPLETED,
      completedAt: { $gte: sevenDaysAgo },
    }),
    Task.find({
      assignedTo: userObjectId,
      status: { $nin: [TASK_STATUSES.COMPLETED, TASK_STATUSES.CANCELLED] },
      dueDate: { $ne: null },
    })
      .sort({ dueDate: 1 })
      .limit(5)
      .populate('projectId', 'title projectCode')
      .lean(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nearestDeadlines = rawDeadlines.map((t: any) => ({
    _id: t._id.toString(),
    taskCode: t.taskCode,
    title: t.title,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    projectTitle: t.projectId?.title || 'Unknown Project',
  }));

  return {
    activeTasks,
    dueToday,
    overdue,
    blocked,
    pendingReview,
    completedRecently,
    nearestDeadlines,
  };
}

export async function getEmployeeWorkload() {
  await connectDB();
  const now = new Date();

  // Fetch all active employees
  const employees = await Employee.find({ status: 'ACTIVE' })
    .populate('userId', 'name email status')
    .lean();

  const userIds = employees
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e: any) => e.userId?._id)
    .filter(Boolean);

  // Aggregate task counts per user
  const taskAgg = await Task.aggregate([
    {
      $match: {
        assignedTo: { $in: userIds },
        status: { $ne: TASK_STATUSES.CANCELLED },
      },
    },
    {
      $group: {
        _id: '$assignedTo',
        totalAssigned: { $sum: 1 },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', TASK_STATUSES.IN_PROGRESS] }, 1, 0] },
        },
        blocked: {
          $sum: { $cond: [{ $eq: ['$status', TASK_STATUSES.BLOCKED] }, 1, 0] },
        },
        pendingReview: {
          $sum: { $cond: [{ $eq: ['$status', TASK_STATUSES.IN_REVIEW] }, 1, 0] },
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', TASK_STATUSES.COMPLETED] }, 1, 0] },
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ['$dueDate', now] },
                  { $ne: ['$status', TASK_STATUSES.COMPLETED] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const statsMap = new Map();
  taskAgg.forEach((item) => {
    statsMap.set(item._id.toString(), item);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return employees.map((emp: any) => {
    const uId = emp.userId?._id?.toString() || '';
    const stat = statsMap.get(uId) || {};
    return {
      employeeId: emp._id.toString(),
      userId: uId,
      employeeCode: emp.employeeCode,
      name: emp.userId?.name || 'Unknown',
      email: emp.userId?.email || '',
      department: emp.department,
      designation: emp.designation,
      totalAssigned: stat.totalAssigned || 0,
      inProgress: stat.inProgress || 0,
      blocked: stat.blocked || 0,
      pendingReview: stat.pendingReview || 0,
      completed: stat.completed || 0,
      overdue: stat.overdue || 0,
    };
  });
}
