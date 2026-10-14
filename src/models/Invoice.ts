import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  INVOICE_PAYMENT_STATUSES,
  INVOICE_STATUSES,
  INVOICE_TYPES,
  TAX_TREATMENTS,
  type InvoicePaymentStatus,
  type InvoiceStatus,
  type InvoiceType,
  type TaxTreatment,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';
import { AddressSchema, type IAddress } from './Client';

export const INVOICE_NUMBER_PATTERN = /^INV-\d{4}-\d{4,}$/;
export const DRAFT_CODE_PATTERN = /^DFT-\d{4,}$/;

export interface IInvoiceLineItem {
  _id?: Types.ObjectId;
  description: string;
  serviceId?: Types.ObjectId | null;
  quantity: number;
  unit?: string | null;
  unitPriceMinor: number;
  discountType?: 'PERCENTAGE' | 'FIXED' | null;
  discountValue?: number | null;
  discountMinor: number;
  taxRate?: number | null;
  taxMinor: number;
  lineTotalMinor: number;
}

export interface IInvoiceSellerSnapshot {
  companyName: string;
  legalName: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  taxLabel?: string | null;
}

export interface IInvoiceCustomerSnapshot {
  clientName: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddress?: IAddress | null;
  taxId?: string | null;
}

export interface IInvoiceTaxDetails {
  taxEnabled: boolean;
  taxTreatment: TaxTreatment;
  taxLabel?: string | null;
  taxRate?: number | null;
  cgstMinor?: number;
  sgstMinor?: number;
  igstMinor?: number;
  sellerState?: string | null;
  placeOfSupply?: string | null;
}

export interface IInvoice {
  _id: Types.ObjectId;
  invoiceCode: string;
  invoiceNumber?: string | null;
  clientId: Types.ObjectId;
  dealId?: Types.ObjectId | null;
  projectId?: Types.ObjectId | null;
  billingMilestoneId?: Types.ObjectId | null;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  paymentStatus: InvoicePaymentStatus;

  sellerSnapshot?: IInvoiceSellerSnapshot | null;
  customerSnapshot?: IInvoiceCustomerSnapshot | null;

  currency: string;
  lineItems: IInvoiceLineItem[];

  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;

  amountPaidMinor: number;
  amountDueMinor: number;

  issueDate: Date;
  dueDate: Date;

  description?: string | null;
  terms?: string | null;
  notes?: string | null;
  billingInstructions?: string | null;

  taxDetails?: IInvoiceTaxDetails | null;

  issuedBy?: Types.ObjectId | null;
  issuedAt?: Date | null;

  voidedBy?: Types.ObjectId | null;
  voidedAt?: Date | null;
  voidReason?: string | null;

  pdfAssetId?: string | null;
  pdfGeneratedAt?: Date | null;

  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceDocument = HydratedDocument<IInvoice>;
export type InvoiceModel = Model<IInvoice>;

const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    description: { type: String, required: true, trim: true, maxlength: 500 },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unit: { type: String, trim: true, maxlength: 50, default: 'unit' },
    unitPriceMinor: { type: Number, required: true, min: 0, default: 0 },
    discountType: { type: String, enum: ['PERCENTAGE', 'FIXED', null] },
    discountValue: { type: Number, min: 0, default: 0 },
    discountMinor: { type: Number, required: true, min: 0, default: 0 },
    taxRate: { type: Number, min: 0, max: 100, default: 0 },
    taxMinor: { type: Number, required: true, min: 0, default: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: true }
);

const InvoiceSellerSnapshotSchema = new Schema<IInvoiceSellerSnapshot>(
  {
    companyName: { type: String, required: true, trim: true, maxlength: 200 },
    legalName: { type: String, required: true, trim: true, maxlength: 200 },
    address: { type: String, trim: true, maxlength: 500 },
    email: { type: String, trim: true, maxlength: 150 },
    phone: { type: String, trim: true, maxlength: 50 },
    website: { type: String, trim: true, maxlength: 200 },
    taxId: { type: String, trim: true, maxlength: 50 },
    taxLabel: { type: String, trim: true, maxlength: 50 },
  },
  { _id: false }
);

const InvoiceCustomerSnapshotSchema = new Schema<IInvoiceCustomerSnapshot>(
  {
    clientName: { type: String, required: true, trim: true, maxlength: 200 },
    companyName: { type: String, trim: true, maxlength: 200 },
    email: { type: String, trim: true, maxlength: 150 },
    phone: { type: String, trim: true, maxlength: 50 },
    billingAddress: { type: AddressSchema },
    taxId: { type: String, trim: true, maxlength: 50 },
  },
  { _id: false }
);

const InvoiceTaxDetailsSchema = new Schema<IInvoiceTaxDetails>(
  {
    taxEnabled: { type: Boolean, required: true, default: false },
    taxTreatment: {
      type: String,
      required: true,
      enum: Object.values(TAX_TREATMENTS),
      default: TAX_TREATMENTS.NONE,
    },
    taxLabel: { type: String, trim: true, maxlength: 50 },
    taxRate: { type: Number, min: 0, max: 100, default: 0 },
    cgstMinor: { type: Number, min: 0, default: 0 },
    sgstMinor: { type: Number, min: 0, default: 0 },
    igstMinor: { type: Number, min: 0, default: 0 },
    sellerState: { type: String, trim: true, maxlength: 100 },
    placeOfSupply: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false }
);

export const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    dealId: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    billingMilestoneId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    invoiceType: {
      type: String,
      required: true,
      enum: Object.values(INVOICE_TYPES),
      default: INVOICE_TYPES.STANDARD,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(INVOICE_STATUSES),
      default: INVOICE_STATUSES.DRAFT,
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: Object.values(INVOICE_PAYMENT_STATUSES),
      default: INVOICE_PAYMENT_STATUSES.UNPAID,
    },
    sellerSnapshot: { type: InvoiceSellerSnapshotSchema },
    customerSnapshot: { type: InvoiceCustomerSnapshotSchema },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 3,
      default: 'INR',
    },
    lineItems: {
      type: [InvoiceLineItemSchema],
      required: true,
      default: [],
    },
    subtotalMinor: { type: Number, required: true, min: 0, default: 0 },
    discountMinor: { type: Number, required: true, min: 0, default: 0 },
    taxMinor: { type: Number, required: true, min: 0, default: 0 },
    totalMinor: { type: Number, required: true, min: 0, default: 0 },
    amountPaidMinor: { type: Number, required: true, min: 0, default: 0 },
    amountDueMinor: { type: Number, required: true, min: 0, default: 0 },
    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 2000 },
    terms: { type: String, trim: true, maxlength: 4000 },
    notes: { type: String, trim: true, maxlength: 4000 },
    billingInstructions: { type: String, trim: true, maxlength: 2000 },
    taxDetails: { type: InvoiceTaxDetailsSchema },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    issuedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    voidedAt: { type: Date },
    voidReason: { type: String, trim: true, maxlength: 1000 },
    pdfAssetId: { type: String, trim: true },
    pdfGeneratedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    collection: 'invoices',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

InvoiceSchema.index({ invoiceCode: 1 }, { unique: true });
InvoiceSchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true });
InvoiceSchema.index({ clientId: 1, createdAt: -1 });
InvoiceSchema.index({ dealId: 1, createdAt: -1 });
InvoiceSchema.index({ projectId: 1, createdAt: -1 });
InvoiceSchema.index({ status: 1, issueDate: -1 });
InvoiceSchema.index({ paymentStatus: 1, dueDate: 1 });
InvoiceSchema.index({ createdAt: -1 });

export const Invoice =
  (models.Invoice as InvoiceModel) || model<IInvoice>('Invoice', InvoiceSchema);
