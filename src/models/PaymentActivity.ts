import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';
import { PAYMENT_ACTIVITY_TYPES, type PaymentActivityType } from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';
export interface IPaymentActivity { _id: Types.ObjectId; paymentId: Types.ObjectId; activityType: PaymentActivityType; actorUserId: Types.ObjectId; actorName: string; actorRole: string; description: string; metadata?: Record<string, unknown> | null; createdAt: Date; }
export type PaymentActivityDocument = HydratedDocument<IPaymentActivity>;
export type PaymentActivityModel = Model<IPaymentActivity>;
export const PaymentActivitySchema = new Schema<IPaymentActivity>({ paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true }, activityType: { type: String, required: true, enum: Object.values(PAYMENT_ACTIVITY_TYPES) }, actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, actorName: { type: String, required: true, maxlength: 150 }, actorRole: { type: String, required: true, maxlength: 30 }, description: { type: String, required: true, maxlength: 1000 }, metadata: { type: Schema.Types.Mixed } }, { timestamps: { createdAt: true, updatedAt: false }, collection: 'payment_activities', toJSON: { transform: stripVersionKey }, toObject: { transform: stripVersionKey } });
PaymentActivitySchema.index({ paymentId: 1, createdAt: -1 });
export const PaymentActivity = (models.PaymentActivity as PaymentActivityModel) || model<IPaymentActivity, PaymentActivityModel>('PaymentActivity', PaymentActivitySchema);
