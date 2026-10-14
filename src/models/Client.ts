import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  CLIENT_STATUS,
  CLIENT_SOURCES,
  CLIENT_TYPES,
  ClientSource,
  ClientStatus,
  ClientType,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';
import { isEmail, isPhone } from '@/lib/validations/common';

/** Readable client code format, e.g. `CLT-0001`. */
export const CLIENT_CODE_PATTERN = /^CLT-\d{4,}$/;

/**
 * Structured address used for billing and shipping. Kept as a shared
 * sub-schema so invoice modules can reuse it.
 */
export interface IAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export const AddressSchema = new Schema<IAddress>(
  {
    line1: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    line2: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    state: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    postalCode: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    country: {
      type: String,
      trim: true,
      maxlength: 100,
    },
  },
  { _id: false }
);

/**
 * A client is the person or company doing business with Arclivo Labs —
 * not necessarily a login account. The optional `userId` links the client
 * record to a User account with the CLIENT role when one exists (e.g.
 * created through self-signup or a portal invitation).
 */
export interface IClient {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | null;
  clientCode: string;
  type: ClientType;
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  alternatePhone?: string | null;
  website?: string | null;
  billingAddress?: IAddress | null;
  shippingAddress?: IAddress | null;
  taxId?: string | null;
  notes?: string | null;
  status: ClientStatus;
  source: ClientSource;
  assignedMarketingUserId?: Types.ObjectId | null;
  /** Immutable acquisition owner captured from the originating Lead at conversion. */
  marketingAttributionUserId?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  /**
   * The original Lead that produced this Client through the controlled
   * conversion workflow. Null for manually created clients. Multiple future
   * Leads may still point to the same Client via Lead.convertedClientId, so
   * this field is NOT unique — it records the acquisition origin only.
   */
  originLeadId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ClientDocument = HydratedDocument<IClient>;
export type ClientModel = Model<IClient>;

export const ClientSchema = new Schema<IClient>(
  {
    // Optional link to the owning User account (CLIENT role).
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    clientCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => CLIENT_CODE_PATTERN.test(value.toUpperCase()),
        message: 'clientCode must follow the CLT-0000 format (e.g. CLT-0001)',
      },
    },
    type: {
      type: String,
      required: true,
      enum: enumValues(CLIENT_TYPES),
    },
    // Personal name for PERSON clients; primary contact name for COMPANY.
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    // Conditionally required: a COMPANY client must carry a company name.
    // (Mongoose skips path `validate` for missing values, so the required
    // validator is the reliable mechanism for conditional rules.)
    companyName: {
      type: String,
      trim: true,
      maxlength: 200,
      required: [
        function (this: { type?: ClientType | null }) {
          return this.type === CLIENT_TYPES.COMPANY;
        },
        'companyName is required when client type is COMPANY',
      ],
    },
    // Not unique: a client email may legitimately match the linked
    // User account email, and uniqueness is enforced on User instead.
    email: {
      type: String,
      required: true,
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
    billingAddress: {
      type: AddressSchema,
    },
    shippingAddress: {
      type: AddressSchema,
    },
    // Tax identifier (GSTIN, VAT, EIN, ...). Deliberately format-agnostic
    // so non-Indian clients can be supported later.
    taxId: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(CLIENT_STATUS),
      default: CLIENT_STATUS.ACTIVE,
    },
    source: {
      type: String,
      required: true,
      enum: enumValues(CLIENT_SOURCES),
    },
    // The MARKETING user responsible for this client, if assigned.
    assignedMarketingUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    marketingAttributionUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      immutable: true,
    },
    // The user who created this client record.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // The user who last updated this client record.
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    /**
     * The original Lead that produced this Client through the controlled
     * conversion workflow. Null for manually created clients. Multiple
     * future Leads may still point to the same Client via
     * Lead.convertedClientId, so this field is NOT unique — it records the
     * acquisition origin only.
     */
    originLeadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
    },
  },
  {
    timestamps: true,
    collection: 'clients',
    toJSON: {
      virtuals: false,
      transform: stripVersionKey,
    },
    toObject: {
      virtuals: false,
      transform: stripVersionKey,
    },
  }
);

ClientSchema.index({ clientCode: 1 }, { unique: true });
// Only one client record per login account; multiple nulls are fine.
ClientSchema.index({ userId: 1 }, { unique: true, sparse: true });
ClientSchema.index({ status: 1, source: 1 });
ClientSchema.index({ email: 1 });
ClientSchema.index({ assignedMarketingUserId: 1 });
ClientSchema.index({ marketingAttributionUserId: 1 });
ClientSchema.index({ originLeadId: 1 });

export const Client = (models.Client as Model<IClient>) || model<IClient>('Client', ClientSchema);
