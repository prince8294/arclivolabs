import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import { TAX_TREATMENTS, type TaxTreatment } from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export interface IBillingSetting {
  _id: Types.ObjectId;
  key: string; // 'primary' singleton key
  companyName: string;
  legalName: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logoUrl?: string | null;

  // Tax Configuration (§27)
  taxEnabled: boolean;
  taxRegistrationNumber?: string | null; // e.g. GSTIN
  taxLabel: string; // e.g. 'GSTIN'
  defaultTaxRate: number; // e.g. 18 or 0
  defaultTaxTreatment: TaxTreatment;
  sellerState?: string | null; // e.g. 'Maharashtra'

  // Payment Terms & Footer (§29, §47)
  defaultPaymentTerms?: string | null;
  invoiceFooterNote?: string | null;
  bankAccountDetails?: string | null;
  upiPaymentInstructions?: string | null;

  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BillingSettingDocument = HydratedDocument<IBillingSetting>;
export type BillingSettingModel = Model<IBillingSetting>;

export const BillingSettingSchema = new Schema<IBillingSetting>(
  {
    key: {
      type: String,
      required: true,
      default: 'primary',
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      default: 'Arclivo Labs',
    },
    legalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      default: 'Arclivo Labs',
    },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    email: { type: String, trim: true, maxlength: 150, default: '' },
    phone: { type: String, trim: true, maxlength: 50, default: '' },
    website: { type: String, trim: true, maxlength: 200, default: '' },
    logoUrl: { type: String, trim: true, maxlength: 500 },

    taxEnabled: { type: Boolean, required: true, default: false },
    taxRegistrationNumber: { type: String, trim: true, maxlength: 50, default: '' },
    taxLabel: { type: String, trim: true, maxlength: 50, default: 'GSTIN' },
    defaultTaxRate: { type: Number, min: 0, max: 100, default: 0 },
    defaultTaxTreatment: {
      type: String,
      required: true,
      enum: Object.values(TAX_TREATMENTS),
      default: TAX_TREATMENTS.NONE,
    },
    sellerState: { type: String, trim: true, maxlength: 100, default: '' },

    defaultPaymentTerms: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: 'Payment is due within 15 days of invoice date. Payment via verified UPI or bank transfer.',
    },
    invoiceFooterNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: 'Thank you for choosing Arclivo Labs.',
    },
    bankAccountDetails: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    upiPaymentInstructions: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'billing_settings',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);

BillingSettingSchema.index({ key: 1 }, { unique: true });

export const BillingSetting =
  (models.BillingSetting as BillingSettingModel) ||
  model<IBillingSetting>('BillingSetting', BillingSettingSchema);
