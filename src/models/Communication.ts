import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  CALL_RESULTS,
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_TYPES,
  COMMUNICATION_VISIBILITIES,
  LEAD_ACTIVITY_EVENTS,
  enumValues,
  type CallResult,
  type CommunicationDirection,
  type CommunicationType,
  type CommunicationVisibility,
  type LeadActivityEvent,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

/**
 * Extra key/value context for an entry (previous status, assignee names,
 * meeting id, ...). Values are written server-side as short strings; the
 * field is declared Mixed so timeline queries return plain objects.
 */
export type CommunicationMetadata = Record<string, string>;

/**
 * A single entry on a lead's communication timeline.
 *
 * One collection covers both human-logged activity and the automatic
 * activity log, so a lead's history is one chronological list:
 *
 * - manual: CALL / WHATSAPP / EMAIL / INTERNAL_NOTE, always written with
 *   `createdBy` = the acting user and `occurredAt` = when it happened.
 * - derived: FOLLOW_UP and MEETING mirror a follow-up / meeting change.
 * - automatic: SYSTEM entries carry an `event` code plus a sentence
 *   composed on the server (`createLeadSystemActivity`).
 *
 * Records are immutable: business history is never edited or deleted, and
 * `createdBy` can never be changed by a form payload.
 *
 * `clientId` / `projectId` are declared but unused in this phase — they
 * let a lead be converted into a client later without moving or
 * re-writing the pre-sales history (see the Lead → Client conversion
 * phase).
 */
export interface ICommunication {
  _id: Types.ObjectId;
  /** Owning lead. Required in this phase; the timeline lives on the lead. */
  leadId: Types.ObjectId;
  /** Reserved for post-conversion client linkage. Never set yet. */
  clientId?: Types.ObjectId | null;
  /** Reserved for post-conversion project linkage. Never set yet. */
  projectId?: Types.ObjectId | null;
  type: CommunicationType;
  /** INBOUND / OUTBOUND / INTERNAL. Null for SYSTEM entries. */
  direction?: CommunicationDirection | null;
  subject?: string | null;
  summary?: string | null;
  notes?: string | null;
  /** Only meaningful for type = CALL. */
  callResult?: CallResult | null;
  /** Who was spoken to, e.g. "Owner" or "Front desk". */
  contactPerson?: string | null;
  /** Acting user id, always taken from the session server-side. */
  createdBy: Types.ObjectId;
  /** When the interaction actually happened (not when it was typed). */
  occurredAt: Date;
  /** Set when this entry also scheduled the lead's next follow-up. */
  nextFollowUpAt?: Date | null;
  visibility: CommunicationVisibility;
  /** Event code for type = SYSTEM entries. */
  event?: LeadActivityEvent | null;
  metadata?: CommunicationMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CommunicationDocument = HydratedDocument<ICommunication>;
export type CommunicationModel = Model<ICommunication>;

export const CommunicationSchema = new Schema<ICommunication>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    type: {
      type: String,
      required: true,
      enum: enumValues(COMMUNICATION_TYPES),
    },
    direction: {
      type: String,
      enum: enumValues(COMMUNICATION_DIRECTIONS),
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 4000,
    },
    callResult: {
      type: String,
      enum: enumValues(CALL_RESULTS),
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    nextFollowUpAt: {
      type: Date,
    },
    visibility: {
      type: String,
      required: true,
      enum: enumValues(COMMUNICATION_VISIBILITIES),
      default: COMMUNICATION_VISIBILITIES.INTERNAL,
    },
    event: {
      type: String,
      enum: enumValues(LEAD_ACTIVITY_EVENTS),
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: true,
    collection: 'communications',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

/**
 * Indexes, all driven by real queries:
 * - `{ leadId, occurredAt }` — the lead timeline (also sorted).
 * - `{ leadId, type, occurredAt }` — the same timeline with a type filter.
 * - `{ type, occurredAt }` — admin/marketing recent-activity feeds.
 * - `{ createdBy }` — "entries I logged".
 * - `{ occurredAt }` — company-wide latest activity.
 */
CommunicationSchema.index({ leadId: 1, occurredAt: -1 });
CommunicationSchema.index({ leadId: 1, type: 1, occurredAt: -1 });
CommunicationSchema.index({ type: 1, occurredAt: -1 });
CommunicationSchema.index({ createdBy: 1 });
CommunicationSchema.index({ occurredAt: -1 });

export const Communication = (models.Communication as Model<ICommunication>) || model<ICommunication>(
  'Communication',
  CommunicationSchema
);
