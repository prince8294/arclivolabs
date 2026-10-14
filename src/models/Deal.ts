import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import { DEAL_STATUSES, type DealStatus } from '@/lib/constants/proposals';
import { stripVersionKey } from '@/lib/db/schema-utils';

/**
 * A finalized commercial agreement.
 *
 * The Deal is the durable record of WHAT WAS AGREED. It stores an
 * immutable copy of the accepted commercial snapshot (scope, deliverables,
 * pricing summary, payment plan, terms, validity) taken from the accepted
 * `ProposalVersion` at finalization time.
 *
 * Why the snapshot instead of only a reference: the agreed amount, the
 * payment schedule and the terms must survive any later proposal edit.
 * A live proposal is explicitly NOT the record of agreed terms, because
 * revisions create new versions while the customer's signed position stays
 * at the version they accepted.
 *
 * Financial integrity: `agreedAmountMinor` is written once at finalization
 * and there is no action in this phase that edits it. A material change
 * later requires an explicit amendment/revision process (not implemented in
 * Part 9). A finalized Deal is NOT a received payment.
 */
export interface IDeal {
  _id: Types.ObjectId;
  /** Readable code, e.g. `DEAL-0001`. */
  dealCode: string;
  proposalId: Types.ObjectId;
  /**
   * The accepted ProposalVersion. UNIQUE: the database itself prevents a
   * second deal for the same accepted version, which is the real guard
   * against double-click / repeated-request finalization. Client-side
   * button disabling is only a convenience.
   */
  acceptedProposalVersionId: Types.ObjectId;
  /** Version number of the accepted version, denormalised for reports. */
  acceptedVersion: number;
  leadId?: Types.ObjectId | null;
  clientId?: Types.ObjectId | null;
  title: string;
  /** Integer minor units, copied from the accepted version at finalization. */
  agreedAmountMinor: number;
  currency: string;
  /** Copy of the accepted version's payment milestones. Planned, not paid. */
  paymentPlanSnapshot: IDealPaymentMilestone[];
  status: DealStatus;
  acceptedAt?: Date | null;
  finalizedAt: Date;
  finalizedBy: Types.ObjectId;
  /** Optional external reference (contract no., signed doc name, ...). */
  agreementReference?: string | null;
  notes?: string | null;
  /**
   * Compact commercial snapshot for display and for Part 10 (Project) to
   * bootstrap scope/timeline from. Deliberately small and read-only.
   */
  commercialSnapshot: {
    proposalCode: string;
    overview?: string | null;
    deliverables: string[];
    includedFeatures: string[];
    excludedFeatures: string[];
    estimatedDuration?: string | null;
    expectedStartDate?: Date | null;
    deliveryMilestones: Array<{ name: string; description?: string | null; sequence: number }>;
    validUntil?: Date | null;
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    terms: Record<string, string | null | undefined>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IDealPaymentMilestone {
  name: string;
  type: string;
  valueMinor: number;
  amountMinor: number;
  condition?: string | null;
  dueDate?: Date | null;
  sequence: number;
}

export type DealDocument = HydratedDocument<IDeal>;
export type DealModel = Model<IDeal>;

const DealPaymentMilestoneSchema = new Schema<IDealPaymentMilestone>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    type: { type: String, required: true, trim: true, maxlength: 20 },
    valueMinor: { type: Number, required: true, min: 0, default: 0 },
    amountMinor: { type: Number, required: true, min: 0, default: 0 },
    condition: { type: String, trim: true, maxlength: 1000 },
    dueDate: { type: Date },
    sequence: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

export const DealSchema = new Schema<IDeal>(
  {
    dealCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    proposalId: {
      type: Schema.Types.ObjectId,
      ref: 'Proposal',
      required: true,
    },
    acceptedProposalVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'ProposalVersion',
      required: true,
    },
    acceptedVersion: { type: Number, required: true, min: 1 },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    agreedAmountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true, maxlength: 3 },
    paymentPlanSnapshot: { type: [DealPaymentMilestoneSchema], default: [] },
    status: {
      type: String,
      required: true,
      enum: Object.values(DEAL_STATUSES),
      default: DEAL_STATUSES.FINALIZED,
    },
    acceptedAt: { type: Date },
    finalizedAt: { type: Date, required: true },
    finalizedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    agreementReference: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 4000 },
    commercialSnapshot: {
      proposalCode: { type: String, required: true },
      overview: { type: String, trim: true, maxlength: 5000 },
      deliverables: { type: [String], default: [] },
      includedFeatures: { type: [String], default: [] },
      excludedFeatures: { type: [String], default: [] },
      estimatedDuration: { type: String, trim: true, maxlength: 200 },
      expectedStartDate: { type: Date },
      deliveryMilestones: {
        type: [
          new Schema(
            {
              name: { type: String, required: true, trim: true, maxlength: 200 },
              description: { type: String, trim: true, maxlength: 1000 },
              sequence: { type: Number, required: true, min: 1 },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
      validUntil: { type: Date },
      subtotalMinor: { type: Number, min: 0, default: 0 },
      discountMinor: { type: Number, min: 0, default: 0 },
      taxMinor: { type: Number, min: 0, default: 0 },
      terms: { type: Schema.Types.Mixed },
    },
  },
  {
    timestamps: true,
    collection: 'deals',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

DealSchema.index({ dealCode: 1 }, { unique: true });
// Hard database guarantee: one Deal per accepted ProposalVersion. This is
// what makes double finalization impossible even under concurrent requests.
DealSchema.index({ acceptedProposalVersionId: 1 }, { unique: true });
DealSchema.index({ proposalId: 1 });
DealSchema.index({ leadId: 1, createdAt: -1 });
DealSchema.index({ clientId: 1, createdAt: -1 });
DealSchema.index({ status: 1, createdAt: -1 });

export const Deal = (models.Deal as Model<IDeal>) || model<IDeal>('Deal', DealSchema);
