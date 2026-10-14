import { Schema, Types, model, models } from 'mongoose';
import { LEAVE_TYPES, type LeaveType } from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export interface ILeaveBalanceAdjustment { _id: Types.ObjectId; employeeUserId: Types.ObjectId; year: number; leaveType: LeaveType; deltaDays: number; reason: string; adjustedBy: Types.ObjectId; createdAt: Date; updatedAt: Date }
const LeaveBalanceAdjustmentSchema = new Schema<ILeaveBalanceAdjustment>({ employeeUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, year: { type: Number, required: true, min: 2000, max: 2200 }, leaveType: { type: String, enum: Object.values(LEAVE_TYPES), required: true }, deltaDays: { type: Number, required: true, min: -366, max: 366 }, reason: { type: String, required: true, trim: true, maxlength: 1000 }, adjustedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true, collection: 'leave_balance_adjustments', toJSON: { transform: stripVersionKey } });
LeaveBalanceAdjustmentSchema.index({ employeeUserId: 1, year: 1, leaveType: 1, createdAt: -1 });
export const LeaveBalanceAdjustment = models.LeaveBalanceAdjustment || model<ILeaveBalanceAdjustment>('LeaveBalanceAdjustment', LeaveBalanceAdjustmentSchema);
