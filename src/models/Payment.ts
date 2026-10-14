import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  BANK_TRANSFER_CHANNELS,
  PAYMENT_METHODS,
  PAYMENT_SOURCES,
  PAYMENT_STATUSES,
  type BankTransferChannel,
  type PaymentMethod,
  type PaymentSource,
  type PaymentStatus,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';
import { PROCESSED_PAYMENT_STATUSES } from '@/lib/payments/core';

export const PAYMENT_CODE_PATTERN = /^PAY-\d{4}-\d{4,}$/;

export interface IPaymentReceivingAccountSnapshot {
  accountCode: string;
  type: string;
  displayName: string;
  upiId?: string | null;
  bankName?: string | null;
  accountHolderName: string;
  maskedAccountNumber?: string | null;
  ifscCode?: string | null;
}

export interface IPayment {
  _id: Types.ObjectId;
  paymentCode: string;
  clientId: Types.ObjectId;
  primaryInvoiceId: Types.ObjectId;
  dealId?: Types.ObjectId | null;
  projectId?: Types.ObjectId | null;
  submittedBy: Types.ObjectId;
  paymentMethod: PaymentMethod;
  bankTransferChannel?: BankTransferChannel | null;
  paymentSource: PaymentSource;
  amountMinor: number;
  currency: string;
  transactionReference: string;
  normalizedTransactionReference: string;
  transactionDate: Date;
  receivingAccountId: Types.ObjectId;
  receivingAccountSnapshot: IPaymentReceivingAccountSnapshot;
  proofFileAssetId?: Types.ObjectId | null;
  notes?: string | null;
  status: PaymentStatus;
  submittedAt: Date;
  verifiedBy?: Types.ObjectId | null;
  verifiedAt?: Date | null;
  verificationNotes?: string | null;
  bankStatementReference?: string | null;
  rejectedBy?: Types.ObjectId | null;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
  cancelledBy?: Types.ObjectId | null;
  cancelledAt?: Date | null;
  reversedBy?: Types.ObjectId | null;
  reversedAt?: Date | null;
  reversalReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentDocument = HydratedDocument<IPayment>;
export type PaymentModel = Model<IPayment>;

const ReceivingAccountSnapshotSchema = new Schema<IPaymentReceivingAccountSnapshot>(
  {
    accountCode: { type: String, required: true },
    type: { type: String, required: true },
    displayName: { type: String, required: true },
    upiId: { type: String },
    bankName: { type: String },
    accountHolderName: { type: String, required: true },
    maskedAccountNumber: { type: String },
    ifscCode: { type: String },
  },
  { _id: false }
);

export const PaymentSchema = new Schema<IPayment>(
  {
    paymentCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    primaryInvoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    dealId: { type: Schema.Types.ObjectId, ref: 'Deal', default: null },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paymentMethod: { type: String, required: true, enum: Object.values(PAYMENT_METHODS) },
    bankTransferChannel: { type: String, enum: [...Object.values(BANK_TRANSFER_CHANNELS), null], default: null },
    paymentSource: { type: String, required: true, enum: Object.values(PAYMENT_SOURCES) },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    transactionReference: { type: String, required: true, trim: true, maxlength: 150 },
    normalizedTransactionReference: { type: String, required: true, trim: true, uppercase: true, maxlength: 150 },
    transactionDate: { type: Date, required: true },
    receivingAccountId: { type: Schema.Types.ObjectId, ref: 'PaymentReceivingAccount', required: true },
    receivingAccountSnapshot: { type: ReceivingAccountSnapshotSchema, required: true },
    proofFileAssetId: { type: Schema.Types.ObjectId, ref: 'FileAsset', default: null },
    notes: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, required: true, enum: Object.values(PAYMENT_STATUSES), default: PAYMENT_STATUSES.SUBMITTED },
    submittedAt: { type: Date, required: true, default: Date.now },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    verificationNotes: { type: String, trim: true, maxlength: 2000, select: false },
    bankStatementReference: { type: String, trim: true, maxlength: 150, select: false },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 2000 },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reversedAt: { type: Date, default: null },
    reversalReason: { type: String, trim: true, maxlength: 2000 },
  },
  {
    timestamps: true,
    collection: 'payments',
    toJSON: { virtuals: false, transform: stripVersionKey },
    toObject: { virtuals: false, transform: stripVersionKey },
  }
);
PaymentSchema.index({ paymentCode: 1 }, { unique: true });
PaymentSchema.index({ clientId: 1, status: 1, submittedAt: -1 });
PaymentSchema.index({ primaryInvoiceId: 1, status: 1 });
PaymentSchema.index({ status: 1, submittedAt: -1 });
PaymentSchema.index({ receivingAccountId: 1, normalizedTransactionReference: 1 });
PaymentSchema.index(
  { receivingAccountId: 1, normalizedTransactionReference: 1, currency: 1 },
  {
    unique: true,
    name: 'uniq_processed_payment_reference',
    partialFilterExpression: {
      status: { $in: PROCESSED_PAYMENT_STATUSES },
    },
  }
);
PaymentSchema.index({ verifiedAt: -1 });

export const Payment =
  (models.Payment as PaymentModel) || model<IPayment, PaymentModel>('Payment', PaymentSchema);
