import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';
import { PAYMENT_ALLOCATION_STATUSES, type PaymentAllocationStatus } from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export interface IPaymentAllocation {
  _id: Types.ObjectId;
  paymentId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  amountMinor: number;
  currency: string;
  status: PaymentAllocationStatus;
  allocatedBy: Types.ObjectId;
  allocatedAt: Date;
  reversedAt?: Date | null;
  reversalReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export type PaymentAllocationDocument = HydratedDocument<IPaymentAllocation>;
export type PaymentAllocationModel = Model<IPaymentAllocation>;
export const PaymentAllocationSchema = new Schema<IPaymentAllocation>(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    status: { type: String, required: true, enum: Object.values(PAYMENT_ALLOCATION_STATUSES), default: PAYMENT_ALLOCATION_STATUSES.ACTIVE },
    allocatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    allocatedAt: { type: Date, required: true, default: Date.now },
    reversedAt: { type: Date, default: null },
    reversalReason: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, collection: 'payment_allocations', toJSON: { transform: stripVersionKey }, toObject: { transform: stripVersionKey } }
);
PaymentAllocationSchema.index({ paymentId: 1, invoiceId: 1 }, { unique: true });
PaymentAllocationSchema.index({ invoiceId: 1, status: 1 });
export const PaymentAllocation =
  (models.PaymentAllocation as PaymentAllocationModel) ||
  model<IPaymentAllocation, PaymentAllocationModel>('PaymentAllocation', PaymentAllocationSchema);
