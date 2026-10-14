import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  ACCEPTANCE_METHODS,
  DELIVERY_METHODS,
  DISCOUNT_TYPES,
  PROPOSAL_STATUSES,
  REJECTION_REASONS,
  type AcceptanceMethod,
  type DeliveryMethod,
  type DiscountType,
  type ProposalStatus,
  type RejectionReason,
} from '@/lib/constants/proposals';
import { stripVersionKey } from '@/lib/db/schema-utils';

/**
 * An immutable commercial snapshot of one version of a quotation.
 *
 * Every monetary field is stored as an INTEGER number of minor units
 * (paise for INR, cents for USD, ...). `unitPriceMinor`, `lineTotalMinor`,
 * `grandTotalMinor` etc. are produced exclusively by the server pricing
 * engine (`src/lib/proposals/pricing.ts`); nothing a browser submits is
 * copied in verbatim. Deal and, later, Invoice read these same integers so
 * the money representation can never diverge between modules.
 *
 * Immutability contract:
 * - A version may only be edited while `status === DRAFT`.
 * - Approving freezes the commercial block (`commercialLockedAt`).
 * - Issuing freezes everything customer-visible, including the validity
 *   window and terms.
 * - Revising CREATES a new draft version; the previous issued version is
 *   moved to SUPERSEDED and is never rewritten.
 */
export interface IProposalVersion {
  _id: Types.ObjectId;
  proposalId: Types.ObjectId;
  /** 1-based, unique per proposal. */
  version: number;
  status: ProposalStatus;

  /* --------------------------- Customer content --------------------------- */
  title: string;
  description?: string | null;
  /** Short intro shown on the PDF and list rows. */
  overview?: string | null;

  /** Structured scope of work. */
  scope: {
    summary?: string | null;
    includedFeatures: string[];
    excludedFeatures: string[];
    dependencies: string[];
    customerResponsibilities: string[];
  };
  deliverables: string[];

  /* ------------------------------ Pricing -------------------------------- */
  currency: string;
  lineItems: IProposalLineItem[];
  /** Sum of line net amounts (minor units). */
  subtotalMinor: number;
  lineDiscountTotalMinor: number;
  proposalDiscount: {
    type: DiscountType;
    /** Fixed amount in minor units, or a percent (0-100). */
    valueMinor: number;
    amountMinor: number;
  };
  lineTaxTotalMinor: number;
  proposalTax: {
    /** Tax is opt-in: never auto-applied because the business is in India. */
    enabled: boolean;
    ratePercent?: number | null;
    label?: string | null;
    amountMinor: number;
  };
  /** subtotal - proposal discount. */
  taxableBaseMinor: number;
  taxMinor: number;
  grandTotalMinor: number;

  /* --------------------------- Payment plan ----------------------------- */
  /**
   * Planned milestones only. These are NOT received payments - no paid
   * amount, receipt or payment record exists in this phase.
   */
  paymentMilestones: IPaymentMilestone[];

  /* ------------------------- Delivery / timeline ------------------------ */
  timeline: {
    estimatedDuration?: string | null;
    expectedStartDate?: Date | null;
    milestones: IDeliveryMilestone[];
    deliveryConditions?: string | null;
    revisionAllowance?: string | null;
    supportPeriod?: string | null;
  };

  /* ------------------------------- Terms -------------------------------- */
  terms: {
    offerValidity?: string | null;
    scopeLimitations?: string | null;
    revisionPolicy?: string | null;
    paymentTerms?: string | null;
    deliveryConditions?: string | null;
    clientResponsibilities?: string | null;
    cancellationTerms?: string | null;
    supportTerms?: string | null;
    intellectualProperty?: string | null;
  };

  /* ------------------------------ Validity ------------------------------ */
  /** Set when the version is issued. */
  issueDate?: Date | null;
  validUntil?: Date | null;

  /* --------------------------- Approval / audit ------------------------ */
  submittedForApprovalAt?: Date | null;
  submittedForApprovalBy?: Types.ObjectId | null;
  approvedBy?: Types.ObjectId | null;
  approvedAt?: Date | null;
  /** Once set, commercial fields can never be edited again. */
  commercialLockedAt?: Date | null;
  issuedAt?: Date | null;
  issuedBy?: Types.ObjectId | null;
  /** Manual delivery log. The system never sends email/WhatsApp itself. */
  sentAt?: Date | null;
  sentBy?: Types.ObjectId | null;
  delivery?: {
    method?: DeliveryMethod | null;
    recipient?: string | null;
    recipientDetail?: string | null;
    notes?: string | null;
    deliveredAt?: Date | null;
  } | null;
  cancelledAt?: Date | null;
  cancelledBy?: Types.ObjectId | null;
  cancellationReason?: string | null;
  supersededAt?: Date | null;
  supersededByVersion?: number | null;

  /** Structured customer decision, recorded by Admin. */
  acceptance?: {
    acceptedBy: string;
    acceptedAt: Date;
    method: AcceptanceMethod;
    /** Reference of the actual confirmation (message id, mail, signed doc). */
    evidence?: string | null;
    notes?: string | null;
    recordedBy: Types.ObjectId;
    /** The proposal version number that was accepted, denormalised for reports. */
    acceptedVersion: number;
  } | null;
  rejection?: {
    reason: RejectionReason;
    reasonNote?: string | null;
    customerFeedback?: string | null;
    rejectedAt: Date;
    recordedBy: Types.ObjectId;
  } | null;

  /** Why this revision was created, shown in the comparison view. */
  changeSummary?: string | null;

  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProposalLineItem {
  /** Catalogue service, or null for a custom service row. */
  serviceId?: Types.ObjectId | null;
  serviceName: string;
  description?: string | null;
  quantity: number;
  unit: string;
  /** Integer minor units. Never read back from the browser. */
  unitPriceMinor: number;
  grossMinor: number;
  discountType: DiscountType;
  /** Fixed amount (minor units) or percent, matching `discountType`. */
  discountValueMinor: number;
  discountMinor: number;
  netMinor: number;
  /** Percent, or null when the line is not taxable. */
  taxRatePercent?: number | null;
  taxMinor: number;
  lineTotalMinor: number;
}

export interface IPaymentMilestone {
  name: string;
  /** Fixed amount (minor units) or percent of the grand total. */
  type: DiscountType;
  /** Minor units when FIXED, percent when PERCENTAGE. */
  valueMinor: number;
  /** Resolved amount for this milestone, in minor units. */
  amountMinor: number;
  condition?: string | null;
  dueDate?: Date | null;
  sequence: number;
}

export interface IDeliveryMilestone {
  name: string;
  description?: string | null;
  sequence: number;
}

export type ProposalVersionDocument = HydratedDocument<IProposalVersion>;
export type ProposalVersionModel = Model<IProposalVersion>;

const ProposalLineItemSchema = new Schema<IProposalLineItem>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    serviceName: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 2000 },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true, maxlength: 40 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    grossMinor: { type: Number, required: true, min: 0 },
    discountType: {
      type: String,
      enum: Object.values(DISCOUNT_TYPES),
      default: DISCOUNT_TYPES.NONE,
    },
    discountValueMinor: { type: Number, min: 0, default: 0 },
    discountMinor: { type: Number, min: 0, default: 0 },
    netMinor: { type: Number, min: 0, default: 0 },
    taxRatePercent: { type: Number, min: 0, max: 100 },
    taxMinor: { type: Number, min: 0, default: 0 },
    lineTotalMinor: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const PaymentMilestoneSchema = new Schema<IPaymentMilestone>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    type: {
      type: String,
      enum: Object.values(DISCOUNT_TYPES),
      default: DISCOUNT_TYPES.FIXED,
    },
    valueMinor: { type: Number, required: true, min: 0, default: 0 },
    amountMinor: { type: Number, required: true, min: 0, default: 0 },
    condition: { type: String, trim: true, maxlength: 1000 },
    dueDate: { type: Date },
    sequence: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const DeliveryMilestoneSchema = new Schema<IDeliveryMilestone>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    sequence: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

export const ProposalVersionSchema = new Schema<IProposalVersion>(
  {
    proposalId: {
      type: Schema.Types.ObjectId,
      ref: 'Proposal',
      required: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'version must be a whole number',
      },
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(PROPOSAL_STATUSES),
      default: PROPOSAL_STATUSES.DRAFT,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    overview: { type: String, trim: true, maxlength: 5000 },

    scope: {
      summary: { type: String, trim: true, maxlength: 5000 },
      includedFeatures: {
        type: [{ type: String, trim: true, maxlength: 300 }],
        default: [],
      },
      excludedFeatures: {
        type: [{ type: String, trim: true, maxlength: 300 }],
        default: [],
      },
      dependencies: {
        type: [{ type: String, trim: true, maxlength: 300 }],
        default: [],
      },
      customerResponsibilities: {
        type: [{ type: String, trim: true, maxlength: 300 }],
        default: [],
      },
    },
    deliverables: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      default: [],
    },

    currency: { type: String, required: true, uppercase: true, trim: true, maxlength: 3 },
    lineItems: { type: [ProposalLineItemSchema], default: [] },
    subtotalMinor: { type: Number, required: true, min: 0, default: 0 },
    lineDiscountTotalMinor: { type: Number, min: 0, default: 0 },
    proposalDiscount: {
      type: {
        type: String,
        enum: Object.values(DISCOUNT_TYPES),
        default: DISCOUNT_TYPES.NONE,
      },
      valueMinor: { type: Number, min: 0, default: 0 },
      amountMinor: { type: Number, min: 0, default: 0 },
    },
    lineTaxTotalMinor: { type: Number, min: 0, default: 0 },
    proposalTax: {
      enabled: { type: Boolean, default: false },
      ratePercent: { type: Number, min: 0, max: 100 },
      label: { type: String, trim: true, maxlength: 80 },
      amountMinor: { type: Number, min: 0, default: 0 },
    },
    taxableBaseMinor: { type: Number, required: true, min: 0, default: 0 },
    taxMinor: { type: Number, min: 0, default: 0 },
    grandTotalMinor: { type: Number, required: true, min: 0, default: 0 },

    paymentMilestones: { type: [PaymentMilestoneSchema], default: [] },

    timeline: {
      estimatedDuration: { type: String, trim: true, maxlength: 200 },
      expectedStartDate: { type: Date },
      milestones: { type: [DeliveryMilestoneSchema], default: [] },
      deliveryConditions: { type: String, trim: true, maxlength: 3000 },
      revisionAllowance: { type: String, trim: true, maxlength: 500 },
      supportPeriod: { type: String, trim: true, maxlength: 500 },
    },

    terms: {
      offerValidity: { type: String, trim: true, maxlength: 3000 },
      scopeLimitations: { type: String, trim: true, maxlength: 3000 },
      revisionPolicy: { type: String, trim: true, maxlength: 3000 },
      paymentTerms: { type: String, trim: true, maxlength: 3000 },
      deliveryConditions: { type: String, trim: true, maxlength: 3000 },
      clientResponsibilities: { type: String, trim: true, maxlength: 3000 },
      cancellationTerms: { type: String, trim: true, maxlength: 3000 },
      supportTerms: { type: String, trim: true, maxlength: 3000 },
      intellectualProperty: { type: String, trim: true, maxlength: 3000 },
    },

    issueDate: { type: Date },
    validUntil: { type: Date },

    submittedForApprovalAt: { type: Date },
    submittedForApprovalBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    commercialLockedAt: { type: Date },
    issuedAt: { type: Date },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sentAt: { type: Date },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
    delivery: {
      method: {
        type: String,
        enum: Object.values(DELIVERY_METHODS),
      },
      recipient: { type: String, trim: true, maxlength: 150 },
      recipientDetail: { type: String, trim: true, maxlength: 200 },
      notes: { type: String, trim: true, maxlength: 2000 },
      deliveredAt: { type: Date },
    },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String, trim: true, maxlength: 1000 },
    supersededAt: { type: Date },
    supersededByVersion: { type: Number, min: 1 },

    acceptance: {
      acceptedBy: { type: String, required: true, trim: true, maxlength: 150 },
      acceptedAt: { type: Date, required: true },
      method: {
        type: String,
        enum: Object.values(ACCEPTANCE_METHODS),
        required: true,
      },
      evidence: { type: String, trim: true, maxlength: 1000 },
      notes: { type: String, trim: true, maxlength: 2000 },
      recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      acceptedVersion: { type: Number, required: true, min: 1 },
    },
    rejection: {
      reason: {
        type: String,
        enum: Object.values(REJECTION_REASONS),
        required: true,
      },
      reasonNote: { type: String, trim: true, maxlength: 1000 },
      customerFeedback: { type: String, trim: true, maxlength: 2000 },
      rejectedAt: { type: Date, required: true },
      recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },

    changeSummary: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    collection: 'proposalversions',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

// Exactly one version number per proposal - this unique index is the
// database-level guarantee that version history cannot fork.
ProposalVersionSchema.index({ proposalId: 1, version: 1 }, { unique: true });
ProposalVersionSchema.index({ status: 1, validUntil: 1 });
ProposalVersionSchema.index({ proposalId: 1, status: 1 });

export const ProposalVersion = (models.ProposalVersion as Model<IProposalVersion>) || model<IProposalVersion>(
  'ProposalVersion',
  ProposalVersionSchema
);
