import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  MEETING_STATUSES,
  MEETING_TYPES,
  enumValues,
  type MeetingStatus,
  type MeetingType,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';
import { isUrl } from '@/lib/validations/common';

/**
 * A scheduled meeting with a lead.
 *
 * Meetings are a separate collection rather than a Communication row
 * because they carry their own lifecycle (scheduled → completed /
 * cancelled / no show), an assignee and an outcome. The timeline receives
 * a derived Communication entry for each lifecycle change, so the history
 * reads chronologically without duplicating meeting fields.
 *
 * No calendar or conferencing integration: `meetingUrl` is whatever the
 * host typed in by hand.
 */
export interface IMeeting {
  _id: Types.ObjectId;
  leadId: Types.ObjectId;
  title: string;
  description?: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  type: MeetingType;
  /** Room / address. Optional — a phone call has no location. */
  location?: string | null;
  /** Manually pasted conferencing link for type = VIDEO. */
  meetingUrl?: string | null;
  status: MeetingStatus;
  createdBy: Types.ObjectId;
  /** Person expected to run the meeting (default: the lead assignee). */
  assignedTo?: Types.ObjectId | null;
  /** Private working notes taken during/after the meeting. */
  notes?: string | null;
  /** What was decided, captured when the meeting is completed. */
  outcome?: string | null;
  completedAt?: Date | null;
  cancelReason?: string | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type MeetingDocument = HydratedDocument<IMeeting>;
export type MeetingModel = Model<IMeeting>;

export const MeetingSchema = new Schema<IMeeting>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 5,
      max: 600,
      default: 30,
    },
    type: {
      type: String,
      required: true,
      enum: enumValues(MEETING_TYPES),
      default: MEETING_TYPES.PHONE,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    meetingUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      validate: {
        validator: (value: string) => isUrl(value),
        message: 'meetingUrl must be a valid http(s) URL',
      },
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(MEETING_STATUSES),
      default: MEETING_STATUSES.SCHEDULED,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 4000,
    },
    outcome: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    completedAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'meetings',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

/**
 * Indexes, all driven by real queries:
 * - `{ leadId, scheduledAt }` — the meeting list on a lead.
 * - `{ scheduledAt, status }` — today's / upcoming meetings per scope.
 * - `{ assignedTo, scheduledAt }` — a marketing user's own agenda.
 */
MeetingSchema.index({ leadId: 1, scheduledAt: -1 });
MeetingSchema.index({ scheduledAt: 1, status: 1 });
MeetingSchema.index({ assignedTo: 1, scheduledAt: 1 });

export const Meeting = (models.Meeting as Model<IMeeting>) || model<IMeeting>('Meeting', MeetingSchema);
