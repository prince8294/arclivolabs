import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  PROPOSAL_REQUEST_STATUSES,
  REQUEST_PRIORITIES,
  REVISION_REQUEST_STATUSES,
  type ProposalRequestStatus,
  type RequestPriority,
  type RevisionRequestStatus,
} from '@/lib/constants/proposals';
import { stripVersionKey } from '@/lib/db/schema-utils';

/**
 * A marketing user's request that Admin prepare a quotation.
 *
 * This is deliberately NOT a Proposal. A request carries requirements, an
 * expected budget and a priority; it carries no approved pricing, no terms
 * and no customer-facing status. Admin converts it into a real Proposal
 * (which then goes through the normal draft -> approve -> issue lifecycle),
 * at which point `proposalId` is stamped and the status becomes CONVERTED.
 *
 * Ownership: a marketing user may only create a request for a Lead or
 * Client assigned to them, enforced server-side on create and re-checked
 * on read.
 */
export interface IProposalRequest {
  _id: Types.ObjectId;
  requestCode: string;
  leadId?: Types.ObjectId | null;
  clientId?: Types.ObjectId | null;
  /** Marketing user who asked for the quotation. */
  requestedBy: Types.ObjectId;
  /** Copies of the requirement text for the admin review screen. */
  requestedServices: string[];
  requirements?: string | null;
  /** Integer minor units. An expectation, never an agreed price. */
  expectedBudgetMinor?: number | null;
  currency: string;
  expectedTimeline?: string | null;
  customerNotes?: string | null;
  priority: RequestPriority;
  status: ProposalRequestStatus;
  /** Admin-only triage note. Never exposed to the requesting marketing user. */
  adminNotes?: string | null;
  /** Set when Admin converts this request into a Proposal. */
  proposalId?: Types.ObjectId | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProposalRequestDocument = HydratedDocument<IProposalRequest>;
export type ProposalRequestModel = Model<IProposalRequest>;

export const ProposalRequestSchema = new Schema<IProposalRequest>(
  {
    requestCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedServices: { type: [{ type: String, trim: true, maxlength: 150 }], default: [] },
    requirements: { type: String, trim: true, maxlength: 5000 },
    expectedBudgetMinor: { type: Number, min: 0 },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 3,
    },
    expectedTimeline: { type: String, trim: true, maxlength: 300 },
    customerNotes: { type: String, trim: true, maxlength: 2000 },
    priority: {
      type: String,
      enum: Object.values(REQUEST_PRIORITIES),
      default: REQUEST_PRIORITIES.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(PROPOSAL_REQUEST_STATUSES),
      default: PROPOSAL_REQUEST_STATUSES.SUBMITTED,
    },
    adminNotes: { type: String, trim: true, maxlength: 2000 },
    proposalId: { type: Schema.Types.ObjectId, ref: 'Proposal' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'proposalrequests',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

ProposalRequestSchema.index({ requestCode: 1 }, { unique: true });
ProposalRequestSchema.index({ requestedBy: 1, createdAt: -1 });
ProposalRequestSchema.index({ status: 1, createdAt: -1 });
ProposalRequestSchema.index({ leadId: 1 });
ProposalRequestSchema.index({ clientId: 1 });
ProposalRequestSchema.index({ proposalId: 1 }, { sparse: true });

export const ProposalRequest = (models.ProposalRequest as Model<IProposalRequest>) || model<IProposalRequest>(
  'ProposalRequest',
  ProposalRequestSchema
);

/* -------------------------------------------------------------------------- */
/* Revision requests                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A marketing user's request to change an issued proposal.
 *
 * Marketing cannot edit issued pricing, so the only lever they have is to
 * ask. Admin reviews the request and, if the commercial terms really need
 * to change, creates a new DRAFT version. Marketing's own request status is
 * flipped to ADDRESSED when that revision is created (or DECLINED when the
 * existing terms are kept) - the commercial decision itself always happens
 * on a new version, never by mutating an issued one.
 */
export interface IRevisionRequest {
  _id: Types.ObjectId;
  proposalId: Types.ObjectId;
  /** The issued version the customer reacted to. */
  againstVersion: number;
  requestedBy: Types.ObjectId;
  requestedChanges?: string | null;
  reason?: string | null;
  customerFeedback?: string | null;
  /** The budget the customer is now asking for, in minor units. */
  requestedBudgetMinor?: number | null;
  currency: string;
  status: RevisionRequestStatus;
  adminResponse?: string | null;
  resolvedBy?: Types.ObjectId | null;
  resolvedAt?: Date | null;
  /** Version created to address this request, when one exists. */
  resolvedVersion?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RevisionRequestDocument = HydratedDocument<IRevisionRequest>;
export type RevisionRequestModel = Model<IRevisionRequest>;

export const RevisionRequestSchema = new Schema<IRevisionRequest>(
  {
    proposalId: {
      type: Schema.Types.ObjectId,
      ref: 'Proposal',
      required: true,
    },
    againstVersion: { type: Number, required: true, min: 1 },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedChanges: { type: String, trim: true, maxlength: 3000 },
    reason: { type: String, trim: true, maxlength: 1000 },
    customerFeedback: { type: String, trim: true, maxlength: 2000 },
    requestedBudgetMinor: { type: Number, min: 0 },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 3,
    },
    status: {
      type: String,
      enum: Object.values(REVISION_REQUEST_STATUSES),
      default: REVISION_REQUEST_STATUSES.OPEN,
    },
    adminResponse: { type: String, trim: true, maxlength: 2000 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    resolvedVersion: { type: Number, min: 1 },
  },
  {
    timestamps: true,
    collection: 'revisionrequests',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

RevisionRequestSchema.index({ proposalId: 1, status: 1, createdAt: -1 });
RevisionRequestSchema.index({ requestedBy: 1, createdAt: -1 });

export const RevisionRequest = (models.RevisionRequest as Model<IRevisionRequest>) || model<IRevisionRequest>(
  'RevisionRequest',
  RevisionRequestSchema
);
