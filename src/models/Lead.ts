import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  DEFAULT_CURRENCY,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LOST_REASONS,
  LeadSource,
  LeadStatus,
  LostReason,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';
import { isEmail, isPhone } from '@/lib/validations/common';

/** Readable lead code format, e.g. `LEAD-0001`. */
export const LEAD_CODE_PATTERN = /^LEAD-\d{4,}$/;

/**
 * A potential client in the CRM pipeline.
 *
 * Ownership model: `assignedTo` is the MARKETING user responsible for the
 * lead (null = unassigned pool) and is the single source of truth for
 * marketing-portal access. `createdBy` records who captured the lead,
 * which is not necessarily the assignee.
 *
 * `serviceInterest` holds references to `Service` documents rather than
 * free text, so a lead can cover several services and CRM filters stay
 * relational. `notes` is a single general-purpose note field in this
 * phase — it is NOT a communication timeline (calls, WhatsApp, meetings
 * arrive as their own records in a later phase).
 *
 * `convertedClientId` / `convertedAt` are reserved for the controlled
 * lead → client conversion workflow and are never set here: marking a
 * lead WON only changes `status`.
 *
 * `importBatchId` links the lead to the CSV import batch that created it
 * (Part 7). Not set for manually created leads.
 */
export interface ILead {
  _id: Types.ObjectId;
  leadCode: string;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  website?: string | null;
  source: LeadSource;
  /** References to `Service`. Empty when not yet decided. */
  serviceInterest: Types.ObjectId[];
  estimatedBudget?: number | null;
  currency: string;
  status: LeadStatus;
  /** MARKETING user responsible for the lead, or null when unassigned. */
  assignedTo?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  /** Real UTC Date. Follow-up state is derived, never stored. */
  nextFollowUpAt?: Date | null;
  statusChangedAt?: Date | null;
  notes?: string | null;
  /** Only meaningful while `status` is LOST. */
  lostReason?: LostReason | null;
  lostReasonNote?: string | null;
  convertedClientId?: Types.ObjectId | null;
  convertedAt?: Date | null;
  /** Optional link to the LeadImport batch that created this lead. */
  importBatchId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LeadDocument = HydratedDocument<ILead>;
export type LeadModel = Model<ILead>;

export const LeadSchema = new Schema<ILead>(
  {
    leadCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => LEAD_CODE_PATTERN.test(value.toUpperCase()),
        message: 'leadCode must follow the LEAD-0000 format (e.g. LEAD-0001)',
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    // Not unique: the same person may enquire more than once, and a lead
    // is only a candidate at this stage. Duplicate detection is advisory
    // (see the create action) rather than a hard constraint.
    email: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 254,
      validate: {
        validator: (value: string) => isEmail(value),
        message: 'email must be a valid email address',
      },
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => isPhone(value),
        message:
          'phone must be a valid phone number (international formats allowed)',
      },
    },
    alternatePhone: {
      type: String,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => isPhone(value),
        message:
          'alternatePhone must be a valid phone number (international formats allowed)',
      },
    },
    website: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    source: {
      type: String,
      required: true,
      enum: enumValues(LEAD_SOURCES),
      default: LEAD_SOURCES.MANUAL,
    },
    serviceInterest: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
      default: [],
    },
    estimatedBudget: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 3,
      default: DEFAULT_CURRENCY,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(LEAD_STATUSES),
      default: LEAD_STATUSES.NEW,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    nextFollowUpAt: {
      type: Date,
    },
    statusChangedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 4000,
    },
    lostReason: {
      type: String,
      enum: enumValues(LOST_REASONS),
    },
    lostReasonNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    // Populated by the controlled client-conversion workflow (later
    // phase). Declared now so no migration is needed when it lands.
    convertedClientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
    },
    convertedAt: {
      type: Date,
    },
    /** Optional link to the LeadImport batch that created this lead. */
    importBatchId: {
      type: Schema.Types.ObjectId,
      ref: 'LeadImport',
    },
  },
  {
    timestamps: true,
    collection: 'leads',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

LeadSchema.index({ leadCode: 1 }, { unique: true });
LeadSchema.index({ status: 1, createdAt: -1 });
// The marketing portal always queries `assignedTo` first, usually with a
// status filter on top.
LeadSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
LeadSchema.index({ nextFollowUpAt: 1 });
LeadSchema.index({ serviceInterest: 1 });
LeadSchema.index({ email: 1 });
LeadSchema.index({ phone: 1 });
LeadSchema.index({ importBatchId: 1 });

export const Lead = (models.Lead as Model<ILead>) || model<ILead>('Lead', LeadSchema);
