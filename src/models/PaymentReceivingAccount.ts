import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import { PAYMENT_ACCOUNT_TYPES, type PaymentAccountType } from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export const PAYMENT_ACCOUNT_CODE_PATTERN = /^PAC-\d{4,}$/;

export interface IPaymentReceivingAccount {
  _id: Types.ObjectId;
  accountCode: string;
  type: PaymentAccountType;
  displayName: string;
  upiId?: string | null;
  bankName?: string | null;
  accountHolderName: string;
  accountNumber?: string | null;
  ifscCode?: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentReceivingAccountDocument = HydratedDocument<IPaymentReceivingAccount>;
export type PaymentReceivingAccountModel = Model<IPaymentReceivingAccount>;

export const PaymentReceivingAccountSchema = new Schema<IPaymentReceivingAccount>(
  {
    accountCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    type: { type: String, required: true, enum: Object.values(PAYMENT_ACCOUNT_TYPES) },
    displayName: { type: String, required: true, trim: true, maxlength: 150 },
    upiId: { type: String, trim: true, lowercase: true, maxlength: 150 },
    bankName: { type: String, trim: true, maxlength: 150 },
    accountHolderName: { type: String, required: true, trim: true, maxlength: 150 },
    accountNumber: { type: String, trim: true, maxlength: 50, select: false },
    ifscCode: { type: String, trim: true, uppercase: true, maxlength: 30 },
    isActive: { type: Boolean, required: true, default: true },
    isDefault: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    collection: 'payment_receiving_accounts',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);
PaymentReceivingAccountSchema.index({ accountCode: 1 }, { unique: true });
PaymentReceivingAccountSchema.index({ type: 1, isActive: 1 });
PaymentReceivingAccountSchema.index(
  { isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

export const PaymentReceivingAccount =
  (models.PaymentReceivingAccount as PaymentReceivingAccountModel) ||
  model<IPaymentReceivingAccount, PaymentReceivingAccountModel>(
    'PaymentReceivingAccount',
    PaymentReceivingAccountSchema
  );
