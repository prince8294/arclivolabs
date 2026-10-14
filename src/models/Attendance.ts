import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';

export interface IAttendance { _id: Types.ObjectId; employeeUserId: Types.ObjectId; employeeProfileId: Types.ObjectId; workDate: string; timezone: string; status: AttendanceStatus; firstCheckInAt?: Date | null; lastCheckOutAt?: Date | null; totalWorkedMinutes: number; totalBreakMinutes: number; source: string; correctionReason?: string | null; correctedBy?: Types.ObjectId | null; correctedAt?: Date | null; createdAt: Date; updatedAt: Date; }
export type AttendanceDocument = HydratedDocument<IAttendance>;
export type AttendanceModel = Model<IAttendance>;
export const AttendanceSchema = new Schema<IAttendance>({ employeeUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, employeeProfileId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true }, workDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, timezone: { type: String, required: true, default: 'Asia/Kolkata' }, status: { type: String, required: true, enum: Object.values(ATTENDANCE_STATUSES), default: ATTENDANCE_STATUSES.NOT_RECORDED }, firstCheckInAt: { type: Date, default: null }, lastCheckOutAt: { type: Date, default: null }, totalWorkedMinutes: { type: Number, required: true, min: 0, default: 0 }, totalBreakMinutes: { type: Number, required: true, min: 0, default: 0 }, source: { type: String, required: true, default: 'EMPLOYEE' }, correctionReason: { type: String, trim: true, maxlength: 1000 }, correctedBy: { type: Schema.Types.ObjectId, ref: 'User' }, correctedAt: Date }, { timestamps: true, collection: 'attendance', toJSON: { transform: stripVersionKey }, toObject: { transform: stripVersionKey } });
AttendanceSchema.index({ employeeUserId: 1, workDate: 1 }, { unique: true });
AttendanceSchema.index({ workDate: 1, status: 1 });
export const Attendance = (models.Attendance as AttendanceModel) || model<IAttendance, AttendanceModel>('Attendance', AttendanceSchema);
