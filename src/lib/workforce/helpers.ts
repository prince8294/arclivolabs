import 'server-only';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import { EMPLOYEE_STATUS } from '@/lib/constants/enums';
import { Employee } from '@/models/Employee';
import type { AuthUser } from '@/types/auth';

export { DEFAULT_COMPANY_TIMEZONE, localDateKey, minutesBetween, parseIsoDate } from './calculations';

export async function requireActiveEmployeeProfile(user: AuthUser) {
  await connectDB();
  const employee = await Employee.findOne({ userId: new Types.ObjectId(user.id), status: { $ne: EMPLOYEE_STATUS.TERMINATED } }).select('_id userId employeeCode department employmentType status').lean();
  if (!employee) throw new Error('Active employee profile required.');
  return employee;
}

