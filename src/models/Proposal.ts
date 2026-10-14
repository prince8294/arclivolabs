import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import { PROPOSAL_STATUSES, type ProposalStatus } from '@/lib/constants/proposals';
import { stripVersionKey } from '@/lib/db/schema-utils';

/**
 * A parent commercial opportunity / quotation for ONE lead or client.
 *
 * The Proposal is deliberately a thin parent. All commercial content
 * (scope, pricing, terms, payment plan) lives on immutable
 * `ProposalVersion` documents, so revising a quote never rewrites what
 * the customer was actually sent. `currentVersion` always points at the
 * version that represents the offer today.
 *
 * Ownership / authorization model:
 * - `assignedMarketingUserId` mirrors the linked Lead's `assignedTo` (or
 *   the linked Client's `assignedMarketingUserId`) at creation time and is
 *   what the marketing portal filters on.
 * - `leadId` and `clientId` are mutually exclusive at creation: a
 *   commercial offer may be produced for a lead BEFORE it becomes a client
 *   (Part 8), or for an existing client asking for extra work. When the
 *   lead is later converted, `clientId` is backfilled and `leadId` is kept
 *   so the acquisition origin is never lost.
 *
 * `status` is a denormalised mirror of the current version's status, kept
 * for list filtering and indexing. It is always written by the same action
 * that moves the version, inside the same transaction, so the two cannot
 * drift.
 */
export interface IProposal {
  _id: Types.ObjectId;
  /** Readable code, e.g. `PRP-0001`. All versions share this code. */
  proposalCode: string;
  title: string;
  description?: string | null;
  /** Exactly one of leadId / clientId is set at creation. */
  leadId?: Types.ObjectId | null;
  clientId?: Types.ObjectId | null;
  /** Admin who created the commercial offer. */
  createdBy?: Types.ObjectId | null;
  /** Marketing owner used to scope the marketing portal. */
  assignedMarketingUserId?: Types.ObjectId | null;
  status: ProposalStatus;
  /** Highest version number allocated so far (>= 1). */
  /** Number of the version that currently represents the offer. */
  currentVersion: number;
  /** Reference to that version, so list screens need no join. */
  currentVersionId?: Types.ObjectId | null;
  /** References to `Service`, for list filtering. Never a price source. */
  serviceCategories: Types.ObjectId[];
  currency: string;
  /** Marketing request this proposal was created from, if any. */
  sourceRequestId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProposalDocument = HydratedDocument<IProposal>;
export type ProposalModel = Model<IProposal>;

export const ProposalSchema = new Schema<IProposal>(
  {
    proposalCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedMarketingUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(PROPOSAL_STATUSES),
      default: PROPOSAL_STATUSES.DRAFT,
    },
    currentVersion: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    currentVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'ProposalVersion',
    },
    serviceCategories: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
      default: [],
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 3,
    },
    sourceRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'ProposalRequest',
    },
  },
  {
    timestamps: true,
    collection: 'proposals',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

// Readable, unique code. Codes are allocated by the shared Counter
// (`generateSequentialCode('proposal', 'PRP')`), never from a count.
ProposalSchema.index({ proposalCode: 1 }, { unique: true });
ProposalSchema.index({ status: 1, createdAt: -1 });
ProposalSchema.index({ leadId: 1, createdAt: -1 });
ProposalSchema.index({ clientId: 1, createdAt: -1 });
ProposalSchema.index({ assignedMarketingUserId: 1, createdAt: -1 });
ProposalSchema.index({ createdAt: -1 });
ProposalSchema.index({ sourceRequestId: 1 }, { sparse: true });

export const Proposal = (models.Proposal as Model<IProposal>) || model<IProposal>('Proposal', ProposalSchema);
