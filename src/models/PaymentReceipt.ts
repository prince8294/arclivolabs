import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';
import { PAYMENT_RECEIPT_STATUSES, type PaymentReceiptStatus } from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';
import { AddressSchema, type IAddress } from './Client';

export interface IPaymentReceiptAllocationSnapshot { invoiceId: Types.ObjectId; invoiceNumber: string; amountMinor: number; }
export interface IPaymentReceiptSellerSnapshot { companyName: string; legalName: string; address?: string | null; email?: string | null; phone?: string | null; website?: string | null; taxId?: string | null; }
export interface IPaymentReceiptCustomerSnapshot { clientCode: string; clientName: string; companyName?: string | null; email?: string | null; phone?: string | null; billingAddress?: IAddress | null; }
export interface IPaymentReceipt {
  _id: Types.ObjectId; receiptCode: string; paymentId: Types.ObjectId; clientId: Types.ObjectId;
  allocationSnapshot: IPaymentReceiptAllocationSnapshot[]; receiptAmountMinor: number; currency: string;
  sellerSnapshot: IPaymentReceiptSellerSnapshot; customerSnapshot: IPaymentReceiptCustomerSnapshot;
  paymentMethod: string; transactionReference: string; transactionDate: Date;
  verifiedBy: Types.ObjectId; verifiedAt: Date; issuedAt: Date; issuedBy: Types.ObjectId;
  pdfAssetId?: string | null; pdfGeneratedAt?: Date | null; pdfError?: string | null;
  status: PaymentReceiptStatus; invalidatedAt?: Date | null; invalidationReason?: string | null;
  createdAt: Date; updatedAt: Date;
}
export type PaymentReceiptDocument = HydratedDocument<IPaymentReceipt>;
export type PaymentReceiptModel = Model<IPaymentReceipt>;
const AllocationSnapshotSchema = new Schema<IPaymentReceiptAllocationSnapshot>({ invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true }, invoiceNumber: { type: String, required: true }, amountMinor: { type: Number, required: true, min: 1 } }, { _id: false });
const SellerSnapshotSchema = new Schema<IPaymentReceiptSellerSnapshot>({ companyName: { type: String, required: true }, legalName: { type: String, required: true }, address: String, email: String, phone: String, website: String, taxId: String }, { _id: false });
const CustomerSnapshotSchema = new Schema<IPaymentReceiptCustomerSnapshot>({ clientCode: { type: String, required: true }, clientName: { type: String, required: true }, companyName: String, email: String, phone: String, billingAddress: AddressSchema }, { _id: false });
export const PaymentReceiptSchema = new Schema<IPaymentReceipt>({
  receiptCode: { type: String, required: true, trim: true, uppercase: true }, paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true }, clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  allocationSnapshot: { type: [AllocationSnapshotSchema], required: true }, receiptAmountMinor: { type: Number, required: true, min: 1 }, currency: { type: String, required: true, uppercase: true, maxlength: 3 },
  sellerSnapshot: { type: SellerSnapshotSchema, required: true }, customerSnapshot: { type: CustomerSnapshotSchema, required: true },
  paymentMethod: { type: String, required: true }, transactionReference: { type: String, required: true }, transactionDate: { type: Date, required: true },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, verifiedAt: { type: Date, required: true }, issuedAt: { type: Date, required: true }, issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  pdfAssetId: { type: String, default: null }, pdfGeneratedAt: { type: Date, default: null }, pdfError: { type: String, maxlength: 1000, default: null },
  status: { type: String, required: true, enum: Object.values(PAYMENT_RECEIPT_STATUSES), default: PAYMENT_RECEIPT_STATUSES.PENDING_PDF }, invalidatedAt: { type: Date, default: null }, invalidationReason: { type: String, maxlength: 2000, default: null },
}, { timestamps: true, collection: 'payment_receipts', toJSON: { transform: stripVersionKey }, toObject: { transform: stripVersionKey } });
PaymentReceiptSchema.index({ receiptCode: 1 }, { unique: true });
PaymentReceiptSchema.index({ paymentId: 1 }, { unique: true });
PaymentReceiptSchema.index({ clientId: 1, issuedAt: -1 });
export const PaymentReceipt = (models.PaymentReceipt as PaymentReceiptModel) || model<IPaymentReceipt, PaymentReceiptModel>('PaymentReceipt', PaymentReceiptSchema);
