import 'server-only';

import { Types } from 'mongoose';

import {
  COMMISSION_TYPES,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYMENT_TYPES,
  USER_STATUS,
  type CommissionType,
  type EmployeeDepartment,
  type EmploymentType,
  type PaymentType,
  type UserStatus,
} from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { Employee } from '@/models/Employee';
import { Lead } from '@/models/Lead';
import { MarketingProfile } from '@/models/MarketingProfile';
import { User, type IUser } from '@/models/User';
import { USER_ROLES } from '@/types/auth';
import { toMongoRegex } from '@/lib/utils/regex';

/**
 * Server-side data access for the admin management screens
 * (employees + marketing users). Everything here is read-only and
 * returns plain, serializable objects — never Mongoose documents — so
 * pages can pass them to client components without leaking internals.
 *
 * Search, filtering and pagination all happen in the database; no page
 * ever fetches the whole collection.
 */

export const LIST_PAGE_SIZE_DEFAULT = 20;
export const LIST_PAGE_SIZE_MAX = 100;

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Narrow a URL param to one of the `as const` enum values (or leave it
 * undefined-ish, handled by the caller). Keeps filters type-safe.
 */
function isOneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[]
): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

export interface EmployeeListParams {
  search: string;
  status: UserStatus | '';
  department: EmployeeDepartment | '';
  employmentType: EmploymentType | '';
  page: number;
  limit: number;
}

export function parseEmployeeListParams(
  raw: RawSearchParams
): EmployeeListParams {
  const page = Math.max(1, parseInt(firstValue(raw.page) ?? '1', 10) || 1);
  const limit = Math.min(
    LIST_PAGE_SIZE_MAX,
    Math.max(1, parseInt(firstValue(raw.limit) ?? String(LIST_PAGE_SIZE_DEFAULT), 10) || LIST_PAGE_SIZE_DEFAULT)
  );
  const status = firstValue(raw.status);
  const department = firstValue(raw.department);
  const employmentType = firstValue(raw.employmentType);

  return {
    search: (firstValue(raw.search) ?? '').trim().slice(0, 100),
    status: isOneOf(status, Object.values(USER_STATUS)) ? status : '',
    department: isOneOf(
      department,
      Object.values(EMPLOYEE_DEPARTMENTS)
    )
      ? department
      : '',
    employmentType: isOneOf(
      employmentType,
      Object.values(EMPLOYMENT_TYPES)
    )
      ? employmentType
      : '',
    page,
    limit,
  };
}

export interface MarketingListParams {
  search: string;
  status: UserStatus | '';
  commissionType: CommissionType | '';
  page: number;
  limit: number;
}

export function parseMarketingListParams(
  raw: RawSearchParams
): MarketingListParams {
  const page = Math.max(1, parseInt(firstValue(raw.page) ?? '1', 10) || 1);
  const limit = Math.min(
    LIST_PAGE_SIZE_MAX,
    Math.max(1, parseInt(firstValue(raw.limit) ?? String(LIST_PAGE_SIZE_DEFAULT), 10) || LIST_PAGE_SIZE_DEFAULT)
  );
  const status = firstValue(raw.status);
  const commissionType = firstValue(raw.commissionType);

  return {
    search: (firstValue(raw.search) ?? '').trim().slice(0, 100),
    status: isOneOf(status, Object.values(USER_STATUS)) ? status : '',
    commissionType: isOneOf(
      commissionType,
      Object.values(COMMISSION_TYPES)
    )
      ? commissionType
      : '',
    page,
    limit,
  };
}

export interface EmployeeListItem {
  profileId: string;
  userId: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string | null;
  department: EmployeeDepartment;
  designation: string;
  employmentType: EmploymentType;
  status: UserStatus;
  joiningDate: Date;
}

export interface MarketingListItem {
  profileId: string;
  userId: string;
  marketingCode: string;
  name: string;
  email: string;
  phone: string | null;
  designation: string;
  commissionType: CommissionType;
  target: number | null;
  status: UserStatus;
  joiningDate: Date;
}

/**
 * ObjectId that matches nothing. Used when the user-side filter matches
 * zero users so the profile query returns an empty page instead of
 * falling back to "no filter".
 */
const NO_MATCH_ID = new Types.ObjectId('000000000000000000000000');

/**
 * Employees list with server-side search + filters + pagination.
 *
 * Search matches Name, Email, Phone (User fields) OR Employee Code,
 * Designation (profile fields). Status filters the User document,
 * because account status lives on the User.
 */
export async function listEmployees(
  params: EmployeeListParams
): Promise<{ items: EmployeeListItem[]; total: number }> {
  await connectDB();

  const roleFilter = {
    role: USER_ROLES.EMPLOYEE,
    ...(params.status ? { status: params.status } : {}),
  };

  let candidateIds: Types.ObjectId[];

  if (params.search) {
    const rx = toMongoRegex(params.search);
    const [userMatches, codeMatches, roleUsers] = await Promise.all([
      User.find({
        ...roleFilter,
        $or: [{ name: rx }, { email: rx }, { phone: rx }],
      }).select('_id'),
      Employee.find({
        $or: [{ employeeCode: rx }, { designation: rx }],
      }).select('userId'),
      User.find(roleFilter).select('_id'),
    ]);

    const allowed = new Set(roleUsers.map((u) => u._id.toString()));
    const seen = new Set<string>();
    candidateIds = [
      ...userMatches.map((u) => u._id),
      ...codeMatches.map((e) => e.userId),
    ].filter((id) => {
      const key = id.toString();
      if (seen.has(key) || !allowed.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  } else {
    const users = await User.find(roleFilter).select('_id');
    candidateIds = users.map((u) => u._id);
  }

  const profileFilter = {
    userId: { $in: candidateIds.length > 0 ? candidateIds : [NO_MATCH_ID] },
    ...(params.department ? { department: params.department } : {}),
    ...(params.employmentType
      ? { employmentType: params.employmentType }
      : {}),
  };

  const [profiles, total] = await Promise.all([
    Employee.find(profileFilter)
      .populate({
        path: 'userId',
        select: 'name email phone status',
      })
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit),
    Employee.countDocuments(profileFilter),
  ]);

  const items: EmployeeListItem[] = [];
  for (const profile of profiles) {
    const user = profile.userId as unknown as
      | Pick<IUser, '_id' | 'name' | 'email' | 'phone' | 'status'>
      | null;
    if (!user) {
      continue;
    }
    items.push({
      profileId: profile._id.toString(),
      userId: user._id.toString(),
      employeeCode: profile.employeeCode,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      department: profile.department,
      designation: profile.designation,
      employmentType: profile.employmentType,
      status: user.status,
      joiningDate: profile.joiningDate,
    });
  }

  return { items, total };
}

/**
 * Marketing list with server-side search + filters + pagination.
 * Search matches Name, Email, Phone (User fields) OR Marketing Code,
 * Designation (profile fields).
 */
export async function listMarketing(
  params: MarketingListParams
): Promise<{ items: MarketingListItem[]; total: number }> {
  await connectDB();

  const roleFilter = {
    role: USER_ROLES.MARKETING,
    ...(params.status ? { status: params.status } : {}),
  };

  let candidateIds: Types.ObjectId[];

  if (params.search) {
    const rx = toMongoRegex(params.search);
    const [userMatches, codeMatches, roleUsers] = await Promise.all([
      User.find({
        ...roleFilter,
        $or: [{ name: rx }, { email: rx }, { phone: rx }],
      }).select('_id'),
      MarketingProfile.find({
        $or: [{ marketingCode: rx }, { designation: rx }],
      }).select('userId'),
      User.find(roleFilter).select('_id'),
    ]);

    const allowed = new Set(roleUsers.map((u) => u._id.toString()));
    const seen = new Set<string>();
    candidateIds = [
      ...userMatches.map((u) => u._id),
      ...codeMatches.map((p) => p.userId),
    ].filter((id) => {
      const key = id.toString();
      if (seen.has(key) || !allowed.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  } else {
    const users = await User.find(roleFilter).select('_id');
    candidateIds = users.map((u) => u._id);
  }

  const profileFilter = {
    userId: { $in: candidateIds.length > 0 ? candidateIds : [NO_MATCH_ID] },
    ...(params.commissionType
      ? { commissionType: params.commissionType }
      : {}),
  };

  const [profiles, total] = await Promise.all([
    MarketingProfile.find(profileFilter)
      .populate({
        path: 'userId',
        select: 'name email phone status',
      })
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit),
    MarketingProfile.countDocuments(profileFilter),
  ]);

  const items: MarketingListItem[] = [];
  for (const profile of profiles) {
    const user = profile.userId as unknown as
      | Pick<IUser, '_id' | 'name' | 'email' | 'phone' | 'status'>
      | null;
    if (!user) {
      continue;
    }
    items.push({
      profileId: profile._id.toString(),
      userId: user._id.toString(),
      marketingCode: profile.marketingCode,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      designation: profile.designation,
      commissionType: profile.commissionType,
      target: profile.target ?? null,
      status: user.status,
      joiningDate: profile.joiningDate,
    });
  }

  return { items, total };
}


/* ------------------------------------------------------------------ */
/* Detail views (admin only)                                          */
/* ------------------------------------------------------------------ */

export interface EmployeeDetail {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'EMPLOYEE';
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  employeeCode: string;
  department: EmployeeDepartment;
  designation: string;
  employmentType: EmploymentType;
  skills: string[];
  joiningDate: Date;
  paymentType: PaymentType;
  baseAmount: number | null;
  currency: string;
  manager: { employeeCode: string; designation: string } | null;
  address: string | null;
  emergencyContact: string | null;
  notes: string | null;
}

type PopulatedUser = Pick<
  IUser,
  | '_id'
  | 'name'
  | 'email'
  | 'phone'
  | 'status'
  | 'role'
  | 'lastLoginAt'
  | 'createdAt'
  | 'mustChangePassword'
>;

/**
 * Employee detail for the admin screen, keyed by the USER id (the same
 * id the admin actions use), including the confidential `baseAmount`
 * (selected explicitly — it is `select: false` by default).
 * Returns null when the record does not exist or does not belong to a
 * user with the EMPLOYEE role.
 */
export async function getEmployeeDetail(
  userId: string
): Promise<EmployeeDetail | null> {
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }
  await connectDB();

  const profile = await Employee.findOne({ userId }).select('+baseAmount');
  if (!profile) {
    return null;
  }

  const populated = await profile.populate([
    {
      path: 'userId',
      select:
        'name email phone status role lastLoginAt createdAt mustChangePassword',
    },
    { path: 'managerId', select: 'employeeCode designation' },
  ]);

  const user = populated.userId as unknown as PopulatedUser | null;
  if (!user || user.role !== USER_ROLES.EMPLOYEE) {
    return null;
  }

  const manager = populated.managerId as unknown as
    | { employeeCode: string; designation: string }
    | null;

  return {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: 'EMPLOYEE',
    status: user.status,
    mustChangePassword: user.mustChangePassword ?? false,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    employeeCode: populated.employeeCode,
    department: populated.department,
    designation: populated.designation,
    employmentType: populated.employmentType,
    skills: [...populated.skills],
    joiningDate: populated.joiningDate,
    paymentType: populated.paymentType,
    baseAmount: populated.baseAmount ?? null,
    currency: populated.currency,
    manager: manager
      ? {
          employeeCode: manager.employeeCode,
          designation: manager.designation,
        }
      : null,
    address: populated.address ?? null,
    emergencyContact: populated.emergencyContact ?? null,
    notes: populated.notes ?? null,
  };
}

export interface MarketingDetail {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'MARKETING';
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  marketingCode: string;
  designation: string;
  joiningDate: Date;
  commissionType: CommissionType;
  commissionValue: number;
  target: number | null;
  notes: string | null;
  /** Leads currently assigned to this marketing user. */
  assignedLeadCount: number;
}

/**
 * Marketing detail for the admin screen, keyed by the USER id.
 * Commission information is admin-only until the marketing portal is
 * built (later phase) — no fake CRM statistics are shown here.
 */
export async function getMarketingDetail(
  userId: string
): Promise<MarketingDetail | null> {
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }
  await connectDB();

  const profile = await MarketingProfile.findOne({ userId });
  if (!profile) {
    return null;
  }

  const populated = await profile.populate({
    path: 'userId',
    select:
      'name email phone status role lastLoginAt createdAt mustChangePassword',
  });

  const user = populated.userId as unknown as PopulatedUser | null;
  if (!user || user.role !== USER_ROLES.MARKETING) {
    return null;
  }

  return {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: 'MARKETING',
    status: user.status,
    mustChangePassword: user.mustChangePassword ?? false,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    marketingCode: populated.marketingCode,
    designation: populated.designation,
    joiningDate: populated.joiningDate,
    commissionType: populated.commissionType,
    commissionValue: populated.commissionValue,
    target: populated.target ?? null,
    notes: populated.notes ?? null,
    assignedLeadCount: await Lead.countDocuments({
      assignedTo: new Types.ObjectId(userId),
    }),
  };
}

