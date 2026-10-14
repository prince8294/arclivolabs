import 'server-only';

import { Types } from 'mongoose';

import {
  MEETING_STATUSES,
  type MeetingStatus,
  type MeetingType,
} from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { resolveScopedLeadId } from '@/lib/queries/communications';
import { Meeting } from '@/models/Meeting';
import { startOfLocalDay, startOfNextLocalDay } from '@/lib/utils/follow-up';

/**
 * Read access to lead meetings.
 *
 * Meetings live in their own collection but share the lead-ownership rule:
 * every function accepts an optional `ownerUserId` and re-checks that the
 * lead is still assigned to that user before returning anything. Meeting
 * assignments are projected to `name` only.
 */

export interface MeetingListItem {
  id: string;
  leadId: string;
  title: string;
  description: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  type: MeetingType;
  location: string | null;
  meetingUrl: string | null;
  status: MeetingStatus;
  outcome: string | null;
  notes: string | null;
  cancelReason: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  assignedToUserId: string | null;
  assignedToName: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
}

interface PopulatedRef {
  _id: Types.ObjectId;
  name?: string;
}

interface RawMeetingRow {
  _id: Types.ObjectId;
  leadId: Types.ObjectId;
  title: string;
  description?: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  type: MeetingType;
  location?: string | null;
  meetingUrl?: string | null;
  status: MeetingStatus;
  outcome?: string | null;
  notes?: string | null;
  cancelReason?: string | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  assignedTo?: PopulatedRef | null;
  createdBy?: PopulatedRef | null;
}

const MEETING_POPULATE = ['assignedTo', 'createdBy'] as const;

function toListItem(row: RawMeetingRow): MeetingListItem {
  return {
    id: row._id.toString(),
    leadId: row.leadId.toString(),
    title: row.title,
    description: row.description ?? null,
    scheduledAt: row.scheduledAt,
    durationMinutes: row.durationMinutes,
    type: row.type,
    location: row.location ?? null,
    meetingUrl: row.meetingUrl ?? null,
    status: row.status,
    outcome: row.outcome ?? null,
    notes: row.notes ?? null,
    cancelReason: row.cancelReason ?? null,
    completedAt: row.completedAt ?? null,
    cancelledAt: row.cancelledAt ?? null,
    createdAt: row.createdAt,
    assignedToUserId: row.assignedTo ? row.assignedTo._id.toString() : null,
    assignedToName: row.assignedTo?.name ?? null,
    createdByUserId: row.createdBy ? row.createdBy._id.toString() : null,
    createdByName: row.createdBy?.name ?? null,
  };
}

export interface LeadMeetings {
  upcoming: MeetingListItem[];
  past: MeetingListItem[];
}

/**
 * Every meeting for a lead, split into upcoming (scheduled and still in the
 * future) and past (completed, cancelled, no-show or already elapsed).
 * Both halves are capped so a long-running lead cannot flood the page.
 */
export async function listLeadMeetings(
  leadId: string,
  ownerUserId?: string,
  now: Date = new Date()
): Promise<LeadMeetings> {
  const scopedLeadId = await resolveScopedLeadId(leadId, ownerUserId);
  if (!scopedLeadId) {
    return { upcoming: [], past: [] };
  }

  await connectDB();

  const leadObjectId = new Types.ObjectId(scopedLeadId);
  const [upcoming, past] = await Promise.all([
    Meeting.find({
      leadId: leadObjectId,
      status: MEETING_STATUSES.SCHEDULED,
      scheduledAt: { $gte: now },
    })
      .populate(MEETING_POPULATE.join(' '), 'name')
      .sort({ scheduledAt: 1 })
      .limit(25)
      .lean()
      .exec(),
    Meeting.find({
      leadId: leadObjectId,
      $or: [
        { status: { $ne: MEETING_STATUSES.SCHEDULED } },
        { scheduledAt: { $lt: now } },
      ],
    })
      .populate(MEETING_POPULATE.join(' '), 'name')
      .sort({ scheduledAt: -1 })
      .limit(25)
      .lean()
      .exec(),
  ]);

  return {
    upcoming: (upcoming as unknown as RawMeetingRow[]).map(toListItem),
    past: (past as unknown as RawMeetingRow[]).map(toListItem),
  };
}

/**
 * A single meeting, resolved inside the caller's scope.
 *
 * Both the meeting and its lead must pass the check, so a marketing user
 * cannot read or update a meeting attached to somebody else's lead.
 */
export async function getScopedMeeting(
  meetingId: string,
  ownerUserId?: string
): Promise<MeetingListItem | null> {
  if (!Types.ObjectId.isValid(meetingId)) {
    return null;
  }
  await connectDB();

  const meeting = await Meeting.findById(meetingId)
    .populate(MEETING_POPULATE.join(' '), 'name')
    .lean()
    .exec();

  if (!meeting) {
    return null;
  }

  const row = meeting as unknown as RawMeetingRow;
  const scopedLeadId = await resolveScopedLeadId(
    row.leadId.toString(),
    ownerUserId
  );
  if (!scopedLeadId) {
    return null;
  }

  return toListItem(row);
}

/* ------------------------------------------------------------------ */
/* Dashboards                                                         */
/* ------------------------------------------------------------------ */

export interface AgendaMeetingItem extends MeetingListItem {
  leadCode: string;
}

/**
 * Meetings for a dashboard list (today, or the next N days).
 *
 * The lead is joined through an aggregation so the marketing scope stays
 * part of the same query — there is no post-filter that could leak a
 * meeting on somebody else's lead.
 */
export async function listAgendaMeetings(options: {
  ownerUserId?: string;
  /** Local day to report; defaults to today. */
  day?: Date;
  /** When true, report everything scheduled from now onwards. */
  upcoming?: boolean;
  limit?: number;
}): Promise<AgendaMeetingItem[]> {
  await connectDB();

  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const now = options.day ?? new Date();

  let scheduledRange: Record<string, unknown>;
  if (options.upcoming) {
    scheduledRange = { $gte: now };
  } else {
    scheduledRange = {
      $gte: startOfLocalDay(now),
      $lt: startOfNextLocalDay(now),
    };
  }

  const match: Record<string, unknown> = {
    status: MEETING_STATUSES.SCHEDULED,
    scheduledAt: scheduledRange,
  };

  const rows = await Meeting.aggregate([
    { $match: match },
    { $sort: { scheduledAt: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'leads',
        localField: 'leadId',
        foreignField: '_id',
        as: '__lead',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'assignedTo',
        foreignField: '_id',
        as: '__assignee',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: '__creator',
      },
    },
    // Marketing scope is applied to the joined lead, never in JavaScript.
    ...(options.ownerUserId
      ? [
          {
            $match: {
              '__lead.assignedTo': new Types.ObjectId(options.ownerUserId),
            },
          },
        ]
      : []),
    {
      $project: {
        leadId: 1,
        title: 1,
        description: 1,
        scheduledAt: 1,
        durationMinutes: 1,
        type: 1,
        location: 1,
        meetingUrl: 1,
        status: 1,
        outcome: 1,
        notes: 1,
        cancelReason: 1,
        completedAt: 1,
        cancelledAt: 1,
        createdAt: 1,
        assignedTo: 1,
        createdBy: 1,
        assigneeName: { $arrayElemAt: ['$__assignee.name', 0] },
        creatorName: { $arrayElemAt: ['$__creator.name', 0] },
        leadCode: { $arrayElemAt: ['$__lead.leadCode', 0] },
      },
    },
  ]).exec();

  return (rows as Array<Record<string, unknown>>).map((row) => {
    const assignedTo = row.assignedTo as Types.ObjectId | null | undefined;
    const createdBy = row.createdBy as Types.ObjectId | null | undefined;
    return {
      id: String(row._id),
      leadId: String(row.leadId),
      title: String(row.title),
      description: (row.description as string | null) ?? null,
      scheduledAt: row.scheduledAt as Date,
      durationMinutes: Number(row.durationMinutes ?? 30),
      type: row.type as MeetingType,
      location: (row.location as string | null) ?? null,
      meetingUrl: (row.meetingUrl as string | null) ?? null,
      status: row.status as MeetingStatus,
      outcome: (row.outcome as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      cancelReason: (row.cancelReason as string | null) ?? null,
      completedAt: (row.completedAt as Date | null) ?? null,
      cancelledAt: (row.cancelledAt as Date | null) ?? null,
      createdAt: row.createdAt as Date,
      assignedToUserId: assignedTo ? assignedTo.toString() : null,
      assignedToName: (row.assigneeName as string | null) ?? null,
      createdByUserId: createdBy ? createdBy.toString() : null,
      createdByName: (row.creatorName as string | null) ?? null,
      leadCode: (row.leadCode as string | undefined) ?? '',
    };
  });
}

/**
 * Counts for the dashboard cards.
 *
 * The marketing scope is applied by joining the lead and matching
 * `assignedTo`, because a meeting has no owner field of its own — an
 * in-memory filter after counting would report other people's meetings.
 */
export async function countAgendaMeetings(
  ownerUserId?: string
): Promise<{ today: number; upcoming: number }> {
  await connectDB();

  const now = new Date();
  const scoped =
    ownerUserId && Types.ObjectId.isValid(ownerUserId)
      ? [
          {
            $lookup: {
              from: 'leads',
              localField: 'leadId',
              foreignField: '_id',
              as: '__lead',
            },
          },
          {
            $match: {
              '__lead.assignedTo': new Types.ObjectId(ownerUserId),
            },
          },
        ]
      : [];

  const countFor = async (range: Record<string, unknown>): Promise<number> => {
    const rows = await Meeting.aggregate([
      { $match: { status: MEETING_STATUSES.SCHEDULED, scheduledAt: range } },
      ...scoped,
      { $count: 'value' },
    ]).exec();
    return Number(rows[0]?.value ?? 0);
  };

  const [today, upcoming] = await Promise.all([
    countFor({
      $gte: startOfLocalDay(now),
      $lt: startOfNextLocalDay(now),
    }),
    countFor({ $gte: startOfNextLocalDay(now) }),
  ]);

  return { today, upcoming };
}

