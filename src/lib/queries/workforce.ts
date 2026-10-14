import 'server-only';

import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import { Attendance } from '@/models/Attendance';
import { AttendanceSession } from '@/models/AttendanceSession';
import { DailyWorkReport } from '@/models/DailyWorkReport';
import { Employee } from '@/models/Employee';
import { EmployeeLeaveBalance } from '@/models/EmployeeLeaveBalance';
import { LeaveRequest } from '@/models/LeaveRequest';
import { User } from '@/models/User';
import { EMPLOYEE_STATUS, LEAVE_STATUSES } from '@/lib/constants/enums';
import { localDateKey } from '@/lib/workforce/helpers';

const safePage = (value?: number) => Math.max(1, Math.trunc(value || 1));
const safeLimit = (value?: number) => Math.min(100, Math.max(1, Math.trunc(value || 20)));
const escaped = (value: string) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

async function matchingEmployees(params: { employeeProfileId?: string; department?: string; search?: string }) {
  const filter: Record<string, unknown> = {};
  if (params.employeeProfileId && Types.ObjectId.isValid(params.employeeProfileId)) filter._id = new Types.ObjectId(params.employeeProfileId);
  if (params.department) filter.department = params.department;
  if (params.search?.trim()) {
    const regex = escaped(params.search.trim());
    const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id').limit(100).lean();
    filter.$or = [{ employeeCode: regex }, { designation: regex }, { userId: { $in: users.map((row) => row._id) } }];
  }
  if (!Object.keys(filter).length) return null;
  return Employee.find(filter).select('_id').lean().then((rows) => rows.map((row) => row._id));
}

export async function getTodayAttendance(userId: string) {
  await connectDB();
  const workDate = localDateKey(new Date());
  const attendance = await Attendance.findOne({ employeeUserId: new Types.ObjectId(userId), workDate }).lean();
  const open = await AttendanceSession.findOne({ employeeUserId: new Types.ObjectId(userId), status: 'OPEN' }).lean();
  return { workDate, attendance: attendance ? { id: attendance._id.toString(), status: attendance.status, firstCheckInAt: attendance.firstCheckInAt?.toISOString() ?? null, lastCheckOutAt: attendance.lastCheckOutAt?.toISOString() ?? null, totalWorkedMinutes: attendance.totalWorkedMinutes } : null, openSession: open ? { id: open._id.toString(), checkInAt: open.checkInAt.toISOString() } : null };
}

export interface AttendanceListParams { userId?: string; employeeProfileId?: string; department?: string; status?: string; search?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }
export async function listAttendancePage(params: AttendanceListParams = {}) {
  await connectDB();
  const page = safePage(params.page); const limit = safeLimit(params.limit);
  const filter: Record<string, unknown> = {};
  if (params.userId && Types.ObjectId.isValid(params.userId)) filter.employeeUserId = new Types.ObjectId(params.userId);
  const employeeIds = await matchingEmployees(params);
  if (employeeIds) filter.employeeProfileId = { $in: employeeIds };
  if (params.status) filter.status = params.status;
  if (params.dateFrom || params.dateTo) filter.workDate = { ...(params.dateFrom ? { $gte: params.dateFrom } : {}), ...(params.dateTo ? { $lte: params.dateTo } : {}) };
  const [rows, total] = await Promise.all([
    Attendance.find(filter).sort({ workDate: -1, firstCheckInAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate({ path: 'employeeProfileId', select: 'employeeCode department designation userId', populate: { path: 'userId', select: 'name email' } }).lean(),
    Attendance.countDocuments(filter),
  ]);
  const leaves = rows.length ? await LeaveRequest.find({ employeeUserId: { $in: rows.map((row) => row.employeeUserId) }, status: LEAVE_STATUSES.APPROVED }).select('employeeUserId startDate endDate leaveType').lean() : [];
  const items = rows.map((row) => {
    const employee = row.employeeProfileId as unknown as { _id: Types.ObjectId; employeeCode: string; department: string; userId?: { name?: string; email?: string } };
    const approvedLeave = leaves.find((leave) => leave.employeeUserId.equals(row.employeeUserId) && leave.startDate <= row.workDate && leave.endDate >= row.workDate);
    return { id: row._id.toString(), employeeUserId: row.employeeUserId.toString(), employeeProfileId: employee?._id?.toString() ?? row.employeeProfileId.toString(), employeeName: employee?.userId?.name || employee?.userId?.email || 'Employee', employeeCode: employee?.employeeCode || '—', department: employee?.department || '—', workDate: row.workDate, status: row.status, firstCheckInAt: row.firstCheckInAt?.toISOString() ?? null, lastCheckOutAt: row.lastCheckOutAt?.toISOString() ?? null, totalWorkedMinutes: row.totalWorkedMinutes, correctedAt: row.correctedAt?.toISOString() ?? null, approvedLeave: approvedLeave ? approvedLeave.leaveType : null, hasLeaveConflict: Boolean(approvedLeave && row.firstCheckInAt) };
  });
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
export async function listAttendance(scope: { userId?: string; employeeProfileId?: string } = {}) { return (await listAttendancePage({ ...scope, limit: 100 })).items; }
export async function listAttendanceSessions(attendanceId: string) { if (!Types.ObjectId.isValid(attendanceId)) return []; await connectDB(); const rows = await AttendanceSession.find({ attendanceId: new Types.ObjectId(attendanceId) }).sort({ checkInAt: 1 }).lean(); return rows.map((row) => ({ id: row._id.toString(), checkInAt: row.checkInAt.toISOString(), checkOutAt: row.checkOutAt?.toISOString() ?? null, durationMinutes: row.durationMinutes ?? null, status: row.status })); }

export async function attendanceDashboardStats() {
  await connectDB(); const today = localDateKey(new Date());
  const [activeEmployees, openUserIds, checkedOutToday, approvedLeaveToday, incompleteSessions, recordedToday] = await Promise.all([
    Employee.countDocuments({ status: EMPLOYEE_STATUS.ACTIVE }), AttendanceSession.distinct('employeeUserId', { status: 'OPEN' }), Attendance.countDocuments({ workDate: today, lastCheckOutAt: { $ne: null } }), LeaveRequest.distinct('employeeUserId', { status: LEAVE_STATUSES.APPROVED, startDate: { $lte: today }, endDate: { $gte: today } }), AttendanceSession.countDocuments({ status: 'OPEN', checkInAt: { $lt: new Date(Date.now() - 16 * 60 * 60 * 1000) } }), Attendance.distinct('employeeUserId', { workDate: today }),
  ]);
  const accounted = new Set([...recordedToday.map(String), ...approvedLeaveToday.map(String)]).size;
  return { activeEmployees, currentlyCheckedIn: openUserIds.length, checkedOutToday, approvedLeaveToday: approvedLeaveToday.length, notYetRecorded: Math.max(0, activeEmployees - accounted), incompleteSessions };
}

export interface LeaveListParams { userId?: string; status?: string; leaveType?: string; employeeProfileId?: string; department?: string; search?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }
export async function listLeavesPage(params: LeaveListParams = {}) {
  await connectDB(); const page = safePage(params.page); const limit = safeLimit(params.limit); const filter: Record<string, unknown> = {};
  if (params.userId && Types.ObjectId.isValid(params.userId)) filter.employeeUserId = new Types.ObjectId(params.userId);
  const employeeIds = await matchingEmployees(params); if (employeeIds) filter.employeeProfileId = { $in: employeeIds };
  if (params.status) filter.status = params.status; if (params.leaveType) filter.leaveType = params.leaveType;
  if (params.dateFrom) filter.endDate = { $gte: params.dateFrom }; if (params.dateTo) filter.startDate = { $lte: params.dateTo };
  const [rows, total] = await Promise.all([LeaveRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate({ path: 'employeeProfileId', select: 'employeeCode department userId', populate: { path: 'userId', select: 'name email' } }).lean(), LeaveRequest.countDocuments(filter)]);
  const items = rows.map((row) => { const employee = row.employeeProfileId as unknown as { _id: Types.ObjectId; employeeCode: string; department: string; userId?: { name?: string; email?: string } }; return { id: row._id.toString(), leaveCode: row.leaveCode, employeeUserId: row.employeeUserId.toString(), employeeProfileId: employee?._id?.toString() ?? '', employeeName: employee?.userId?.name || employee?.userId?.email || 'Employee', employeeCode: employee?.employeeCode || '—', department: employee?.department || '—', leaveType: row.leaveType, startDate: row.startDate, endDate: row.endDate, requestedDays: row.requestedDays, reason: row.reason, status: row.status, reviewNotes: row.reviewNotes ?? null, createdAt: row.createdAt.toISOString() }; });
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
export async function listLeaves(scope: { userId?: string; status?: string } = {}) { return (await listLeavesPage({ ...scope, limit: 100 })).items; }
export async function leaveDashboardStats() { await connectDB(); const today = localDateKey(new Date()); const [pending, approved, rejected, upcoming] = await Promise.all([LeaveRequest.countDocuments({ status: LEAVE_STATUSES.PENDING }), LeaveRequest.countDocuments({ status: LEAVE_STATUSES.APPROVED }), LeaveRequest.countDocuments({ status: LEAVE_STATUSES.REJECTED }), LeaveRequest.countDocuments({ status: LEAVE_STATUSES.APPROVED, startDate: { $gt: today } })]); return { pending, approved, rejected, upcoming }; }
export async function getLeave(id: string, userId?: string) { if (!Types.ObjectId.isValid(id)) return null; await connectDB(); const filter: Record<string, unknown> = { _id: new Types.ObjectId(id) }; if (userId) filter.employeeUserId = new Types.ObjectId(userId); const row = await LeaveRequest.findOne(filter).lean(); return row ? { id: row._id.toString(), leaveCode: row.leaveCode, employeeUserId: row.employeeUserId.toString(), leaveType: row.leaveType, startDate: row.startDate, endDate: row.endDate, dayPortion: row.dayPortion, requestedDays: row.requestedDays, reason: row.reason, status: row.status, reviewNotes: row.reviewNotes ?? null } : null; }
export async function listLeaveBalances(userId: string) { await connectDB(); const rows = await EmployeeLeaveBalance.find({ employeeUserId: new Types.ObjectId(userId) }).sort({ year: -1, leaveType: 1 }).lean(); return rows.map((row) => ({ id: row._id.toString(), year: row.year, leaveType: row.leaveType, opening: row.openingBalanceDays, granted: row.grantedDays, adjustment: row.adjustmentDays, used: row.usedDays, available: row.openingBalanceDays + row.grantedDays + row.adjustmentDays - row.usedDays })); }

export interface WorkReportListParams { userId?: string; status?: string; employeeProfileId?: string; department?: string; search?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }
export async function listWorkReportsPage(params: WorkReportListParams = {}) {
  await connectDB(); const page = safePage(params.page); const limit = safeLimit(params.limit); const filter: Record<string, unknown> = {};
  if (params.userId && Types.ObjectId.isValid(params.userId)) filter.employeeUserId = new Types.ObjectId(params.userId);
  const employeeIds = await matchingEmployees(params); if (employeeIds) filter.employeeProfileId = { $in: employeeIds };
  if (params.status) filter.status = params.status; if (params.dateFrom || params.dateTo) filter.workDate = { ...(params.dateFrom ? { $gte: params.dateFrom } : {}), ...(params.dateTo ? { $lte: params.dateTo } : {}) };
  const [rows, total] = await Promise.all([DailyWorkReport.find(filter).sort({ workDate: -1 }).skip((page - 1) * limit).limit(limit).populate({ path: 'employeeProfileId', select: 'employeeCode department userId', populate: { path: 'userId', select: 'name email' } }).lean(), DailyWorkReport.countDocuments(filter)]);
  const items = rows.map((row) => { const employee = row.employeeProfileId as unknown as { _id: Types.ObjectId; employeeCode: string; department: string; userId?: { name?: string; email?: string } }; return { id: row._id.toString(), reportCode: row.reportCode, employeeUserId: row.employeeUserId.toString(), employeeProfileId: employee?._id?.toString() ?? '', employeeName: employee?.userId?.name || employee?.userId?.email || 'Employee', employeeCode: employee?.employeeCode || '—', department: employee?.department || '—', workDate: row.workDate, summary: row.summary, status: row.status, reportedMinutes: row.entries.reduce((sum: number, entry: { reportedMinutes: number }) => sum + entry.reportedMinutes, 0), submittedAt: row.submittedAt?.toISOString() ?? null }; });
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
export async function listWorkReports(scope: { userId?: string; status?: string } = {}) { return (await listWorkReportsPage({ ...scope, limit: 100 })).items; }
export async function getWorkReport(id: string, userId?: string) { if (!Types.ObjectId.isValid(id)) return null; await connectDB(); const filter: Record<string, unknown> = { _id: new Types.ObjectId(id) }; if (userId) filter.employeeUserId = new Types.ObjectId(userId); const row = await DailyWorkReport.findOne(filter).lean(); return row ? { id: row._id.toString(), reportCode: row.reportCode, employeeUserId: row.employeeUserId.toString(), workDate: row.workDate, summary: row.summary, blockers: row.blockers ?? null, nextDayPlan: row.nextDayPlan ?? null, status: row.status, reviewNotes: row.reviewNotes ?? null, entries: row.entries.map((entry: { projectId: Types.ObjectId; taskId?: Types.ObjectId | null; description: string; reportedMinutes: number; progressSummary?: string | null }) => ({ projectId: entry.projectId.toString(), taskId: entry.taskId?.toString() ?? null, description: entry.description, reportedMinutes: entry.reportedMinutes, progressSummary: entry.progressSummary ?? null })), reviewHistory: row.reviewHistory.map((review: { action: string; notes?: string | null; at: Date }) => ({ action: review.action, notes: review.notes ?? null, at: review.at.toISOString() })) } : null; }
