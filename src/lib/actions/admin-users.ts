'use server';

import { redirect } from 'next/navigation';
import { Types } from 'mongoose';
import type { z } from 'zod';

import { requireRole } from '@/lib/auth/authorization';
import { hashPassword } from '@/lib/auth/password';
import {
  COMMISSION_TYPES,
  EMPLOYEE_STATUS,
  MARKETING_STATUS,
  USER_STATUS,
} from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { areTransactionsSupported as isTransactionCapable } from '@/lib/db/transaction';
import { generateSequentialCode } from '@/lib/db/generate-code';
import {
  employeeCreateSchema,
  employeeUpdateSchema,
  marketingCreateSchema,
  marketingUpdateSchema,
  passwordResetSchema,
  userStatusSchema,
  type AdminUserActionState,
} from '@/lib/validations/admin-users';
import { zodFieldErrors } from '@/lib/validations/common';
import { Employee } from '@/models/Employee';
import { MarketingProfile } from '@/models/MarketingProfile';
import { User } from '@/models/User';
import { USER_ROLES, type UserRole } from '@/types/auth';

/**
 * Admin management of internal users (EMPLOYEE + MARKETING).
 *
 * Security model:
 * - Every action starts with `requireRole(ADMIN)` — UI hiding is never
 *   a security boundary. A non-admin invoking an action is redirected
 *   to their own dashboard; nothing is read or mutated for them.
 * - Inputs are re-validated with zod before any database work.
 * - Email is the globally unique login identifier; a taken email yields
 *   one fixed message ("An account with this email already exists.").
 * - New accounts and admin password resets set `mustChangePassword`,
 *   forcing the user through /change-password on first sign-in.
 * - No hard delete paths exist: lifecycle is ACTIVE ↔ SUSPENDED, plus
 *   INACTIVE for ended employment/contracts. Historical records stay.
 */

const EMAIL_TAKEN = 'An account with this email already exists.';
const GENERIC_ERROR = 'Unable to complete the request. Please try again.';

/** Error carrying a user-safe message and (optionally) its form field. */
class AdminActionError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'AdminActionError';
    this.field = field;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as { code?: unknown; errors?: Record<string, { code?: unknown }> };
  if (err.code === 11000 || err.code === 11001) {
    return true;
  }
  return (
    typeof err.errors === 'object' &&
    err.errors !== null &&
    Object.values(err.errors).some((e) => e?.code === 11000)
  );
}

function toState(error: unknown): AdminUserActionState {
  if (error instanceof AdminActionError) {
    return error.field
      ? { fieldErrors: { [error.field]: error.message } }
      : { error: error.message };
  }
  console.error('admin-users action failed', error);
  return { error: GENERIC_ERROR };
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function fields(
  error: z.ZodError,
  names: readonly string[]
): Record<string, string> {
  return zodFieldErrors(error, names);
}

/** Only the two internal roles this phase manages. */
function isInternalRole(role: UserRole): boolean {
  return role === USER_ROLES.EMPLOYEE || role === USER_ROLES.MARKETING;
}

const EMPLOYEE_FIELDS = [
  'name',
  'email',
  'phone',
  'password',
  'confirmPassword',
  'department',
  'designation',
  'employmentType',
  'joiningDate',
  'paymentType',
  'baseAmount',
  'currency',
  'skills',
  'address',
  'emergencyContact',
  'notes',
];

const MARKETING_FIELDS = [
  'name',
  'email',
  'phone',
  'password',
  'confirmPassword',
  'designation',
  'joiningDate',
  'commissionType',
  'commissionValue',
  'target',
  'notes',
];

/* ------------------------------------------------------------------ */
/* Transaction support                                                */
/* ------------------------------------------------------------------ */

/**
 * Account + profile creation writes two related documents. On
 * deployments where MongoDB transactions are available (replica set /
 * Atlas) both writes run in one transaction, so a failure can never
 * leave an orphaned User without profile (or vice versa).
 *
 * On standalone MongoDB (no transaction support) we fall back to manual
 * compensation: create the User, then the profile; if the profile write
 * fails, the just-created User is deleted. This fallback cannot guard
 * against a truly concurrent duplicate-email race (the check-then-insert
 * window), but the unique index on User.email still makes duplicates
 * impossible and the collision surfaces as the standard email-taken
 * message.
 */
async function areTransactionsSupported(): Promise<boolean> {
  return isTransactionCapable();
}

/**
 * Create a User account and its role profile atomically.
 *
 * @returns the new User's id
 * @throws AdminActionError when the email is already taken
 */
async function createInternalUser(
  userDoc: Record<string, unknown>,
  profileFn: (userId: Types.ObjectId, code: string) => Promise<unknown>,
  counterKey: string,
  codePrefix: string
): Promise<string> {
  const email = userDoc.email as string;

  if (await areTransactionsSupported()) {
    const db = await connectDB();
    const session = await db.startSession();
    try {
      const userId = await session.withTransaction(async () => {
        const existing = await User.exists({ email }).session(session);
        if (existing) {
          throw new AdminActionError(EMAIL_TAKEN, 'email');
        }
        const [user] = await User.create([userDoc], { session });
        const code = await generateSequentialCode(counterKey, codePrefix, session);
        await profileFn(user._id, code);
        return user._id.toString();
      });
      return userId;
    } finally {
      await session.endSession();
    }
  }

  // No-transaction fallback: manual compensation (see doc comment).
  const existing = await User.exists({ email });
  if (existing) {
    throw new AdminActionError(EMAIL_TAKEN, 'email');
  }

  let user;
  try {
    [user] = await User.create([userDoc]);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AdminActionError(EMAIL_TAKEN, 'email');
    }
    throw error;
  }

  try {
    const code = await generateSequentialCode(counterKey, codePrefix);
    await profileFn(user._id, code);
    return user._id.toString();
  } catch (error) {
    // Roll back the orphaned account so the database stays consistent.
    console.error('createInternalUser: profile write failed', error);
    await User.deleteOne({ _id: user._id }).catch((rollbackError) => {
      console.error(
        'createInternalUser: profile write failed and rollback of the user failed',
        rollbackError
      );
    });
    throw new AdminActionError(GENERIC_ERROR);
  }
}

/* ------------------------------------------------------------------ */
/* Employee                                                           */
/* ------------------------------------------------------------------ */

/**
 * Create an EMPLOYEE account + Employee profile in one workflow.
 * On success the admin is redirected to the new employee's detail page
 * with a "created" notice. The temporary password is never echoed back.
 */
export async function createEmployee(
  _prev: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const parsed = employeeCreateSchema.safeParse({
    name: readString(formData, 'name'),
    email: readString(formData, 'email'),
    phone: readString(formData, 'phone'),
    password: readString(formData, 'password'),
    confirmPassword: readString(formData, 'confirmPassword'),
    department: readString(formData, 'department'),
    designation: readString(formData, 'designation'),
    employmentType: readString(formData, 'employmentType'),
    joiningDate: readString(formData, 'joiningDate'),
    paymentType: readString(formData, 'paymentType'),
    baseAmount: readString(formData, 'baseAmount'),
    currency: readString(formData, 'currency'),
    skills: readString(formData, 'skills'),
    address: readString(formData, 'address'),
    emergencyContact: readString(formData, 'emergencyContact'),
    notes: readString(formData, 'notes'),
  });

  if (!parsed.success) {
    return { fieldErrors: fields(parsed.error, EMPLOYEE_FIELDS) };
  }

  const input = parsed.data;

  try {
    const userId = await createInternalUser(
      {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
        role: USER_ROLES.EMPLOYEE,
        status: USER_STATUS.ACTIVE,
        emailVerified: false,
        mustChangePassword: true,
      },
      (uid, code) =>
        Employee.create({
          userId: uid,
          employeeCode: code,
          department: input.department,
          designation: input.designation,
          employmentType: input.employmentType,
          skills: input.skills,
          joiningDate: input.joiningDate,
          paymentType: input.paymentType,
          baseAmount: input.baseAmount ?? null,
          currency: input.currency,
          status: EMPLOYEE_STATUS.ACTIVE,
          address: input.address,
          emergencyContact: input.emergencyContact,
          notes: input.notes,
        }),
      'employee',
      'EMP'
    );
    redirect(`/admin/employees/${userId}?notice=created`);
  } catch (error) {
    return toState(error);
  }
}

async function loadEmployeeForAdmin(userId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }
  const user = await User.findById(userId);
  if (!user || user.role !== USER_ROLES.EMPLOYEE) {
    return null;
  }
  const profile = await Employee.findOne({ userId: user._id });
  if (!profile) {
    return null;
  }
  return { user, profile };
}

/**
 * Update an employee's account details + Employee profile. Email is
 * normalized and checked for global uniqueness (excluding self). The
 * user's role is never part of the payload, so it cannot change here.
 */
export async function updateEmployee(
  _prev: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const userId = readString(formData, 'id');
  const parsed = employeeUpdateSchema.safeParse({
    name: readString(formData, 'name'),
    email: readString(formData, 'email'),
    phone: readString(formData, 'phone'),
    department: readString(formData, 'department'),
    designation: readString(formData, 'designation'),
    employmentType: readString(formData, 'employmentType'),
    joiningDate: readString(formData, 'joiningDate'),
    paymentType: readString(formData, 'paymentType'),
    baseAmount: readString(formData, 'baseAmount'),
    currency: readString(formData, 'currency'),
    skills: readString(formData, 'skills'),
    address: readString(formData, 'address'),
    emergencyContact: readString(formData, 'emergencyContact'),
    notes: readString(formData, 'notes'),
  });

  if (!parsed.success) {
    return { fieldErrors: fields(parsed.error, EMPLOYEE_FIELDS) };
  }

  const input = parsed.data;
  const loaded = await loadEmployeeForAdmin(userId);
  if (!loaded) {
    return { error: 'Employee not found.' };
  }

  try {
    if (input.email !== loaded.user.email) {
      const clash = await User.findOne({
        email: input.email,
        _id: { $ne: loaded.user._id },
      });
      if (clash) {
        return { fieldErrors: { email: EMAIL_TAKEN } };
      }
    }

    await User.updateOne(
      { _id: loaded.user._id },
      { $set: { name: input.name, email: input.email, phone: input.phone } }
    );
    await Employee.updateOne(
      { _id: loaded.profile._id },
      {
        $set: {
          department: input.department,
          designation: input.designation,
          employmentType: input.employmentType,
          skills: input.skills,
          joiningDate: input.joiningDate,
          paymentType: input.paymentType,
          baseAmount: input.baseAmount ?? null,
          currency: input.currency,
          address: input.address,
          emergencyContact: input.emergencyContact,
          notes: input.notes,
        },
      }
    );
    redirect(`/admin/employees/${loaded.user._id}`);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { fieldErrors: { email: EMAIL_TAKEN } };
    }
    return toState(error);
  }
}

/* ------------------------------------------------------------------ */
/* Marketing                                                          */
/* ------------------------------------------------------------------ */

/** Create a MARKETING account + MarketingProfile in one workflow. */
export async function createMarketing(
  _prev: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const parsed = marketingCreateSchema.safeParse({
    name: readString(formData, 'name'),
    email: readString(formData, 'email'),
    phone: readString(formData, 'phone'),
    password: readString(formData, 'password'),
    confirmPassword: readString(formData, 'confirmPassword'),
    designation: readString(formData, 'designation'),
    joiningDate: readString(formData, 'joiningDate'),
    commissionType: readString(formData, 'commissionType'),
    commissionValue: readString(formData, 'commissionValue'),
    target: readString(formData, 'target'),
    notes: readString(formData, 'notes'),
  });

  if (!parsed.success) {
    return { fieldErrors: fields(parsed.error, MARKETING_FIELDS) };
  }

  const input = parsed.data;
  // NONE means "no commission": store 0 so downstream math is simple.
  const commissionValue =
    input.commissionType === COMMISSION_TYPES.NONE ? 0 : input.commissionValue;

  try {
    const userId = await createInternalUser(
      {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
        role: USER_ROLES.MARKETING,
        status: USER_STATUS.ACTIVE,
        emailVerified: false,
        mustChangePassword: true,
      },
      (uid, code) =>
        MarketingProfile.create({
          userId: uid,
          marketingCode: code,
          designation: input.designation,
          joiningDate: input.joiningDate,
          commissionType: input.commissionType,
          commissionValue,
          target: input.target ?? null,
          status: MARKETING_STATUS.ACTIVE,
          notes: input.notes,
        }),
      'marketing',
      'MKT'
    );
    redirect(`/admin/marketing/${userId}?notice=created`);
  } catch (error) {
    return toState(error);
  }
}

async function loadMarketingForAdmin(userId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }
  const user = await User.findById(userId);
  if (!user || user.role !== USER_ROLES.MARKETING) {
    return null;
  }
  const profile = await MarketingProfile.findOne({ userId: user._id });
  if (!profile) {
    return null;
  }
  return { user, profile };
}

/** Update a marketing user's account + MarketingProfile. */
export async function updateMarketing(
  _prev: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const userId = readString(formData, 'id');
  const parsed = marketingUpdateSchema.safeParse({
    name: readString(formData, 'name'),
    email: readString(formData, 'email'),
    phone: readString(formData, 'phone'),
    designation: readString(formData, 'designation'),
    joiningDate: readString(formData, 'joiningDate'),
    commissionType: readString(formData, 'commissionType'),
    commissionValue: readString(formData, 'commissionValue'),
    target: readString(formData, 'target'),
    notes: readString(formData, 'notes'),
  });

  if (!parsed.success) {
    return { fieldErrors: fields(parsed.error, MARKETING_FIELDS) };
  }

  const input = parsed.data;
  const loaded = await loadMarketingForAdmin(userId);
  if (!loaded) {
    return { error: 'Marketing user not found.' };
  }

  try {
    if (input.email !== loaded.user.email) {
      const clash = await User.findOne({
        email: input.email,
        _id: { $ne: loaded.user._id },
      });
      if (clash) {
        return { fieldErrors: { email: EMAIL_TAKEN } };
      }
    }

    const commissionValue =
      input.commissionType === COMMISSION_TYPES.NONE ? 0 : input.commissionValue;

    await User.updateOne(
      { _id: loaded.user._id },
      { $set: { name: input.name, email: input.email, phone: input.phone } }
    );
    await MarketingProfile.updateOne(
      { _id: loaded.profile._id },
      {
        $set: {
          designation: input.designation,
          joiningDate: input.joiningDate,
          commissionType: input.commissionType,
          commissionValue,
          target: input.target ?? null,
          notes: input.notes,
        },
      }
    );
    redirect(`/admin/marketing/${loaded.user._id}`);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { fieldErrors: { email: EMAIL_TAKEN } };
    }
    return toState(error);
  }
}

/* ------------------------------------------------------------------ */
/* Status + password (shared by employee and marketing screens)       */
/* ------------------------------------------------------------------ */

/**
 * Change an internal user's account status: SUSPEND / ACTIVATE /
 * MARK INACTIVE.
 *
 * - SUSPENDED blocks login immediately (account status is re-read on
 *   every request by `getCurrentUser`); profile records are kept.
 * - INACTIVE means the engagement has ended (left the company, contract
 *   over). The matching profile record is moved to its terminal state
 *   (TERMINATED / INACTIVE) so historical data stays coherent.
 * - ADMIN and CLIENT accounts are never touchable through this action.
 */
export async function updateInternalUserStatus(
  _prev: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const parsed = userStatusSchema.safeParse({
    id: readString(formData, 'id'),
    status: readString(formData, 'status'),
  });

  if (!parsed.success) {
    return { error: 'Invalid request.' };
  }

  try {
    await connectDB();
    const user = await User.findById(parsed.data.id);
    if (!user || !isInternalRole(user.role)) {
      return { error: 'Account not found.' };
    }

    const nextStatus = parsed.data.status;
    if (nextStatus === user.status) {
      return { ok: true, message: 'No changes needed.' };
    }

    await User.updateOne({ _id: user._id }, { $set: { status: nextStatus } });

    if (nextStatus === USER_STATUS.INACTIVE) {
      if (user.role === USER_ROLES.EMPLOYEE) {
        await Employee.updateOne(
          { userId: user._id },
          { $set: { status: EMPLOYEE_STATUS.TERMINATED } }
        );
      } else {
        await MarketingProfile.updateOne(
          { userId: user._id },
          { $set: { status: MARKETING_STATUS.INACTIVE } }
        );
      }
    }

    const messages: Record<string, string> = {
      [USER_STATUS.SUSPENDED]:
        'Account suspended. The user can no longer sign in.',
      [USER_STATUS.ACTIVE]: 'Account reactivated. The user can sign in again.',
      [USER_STATUS.INACTIVE]: 'Account marked inactive.',
    };
    return { ok: true, message: messages[nextStatus] ?? 'Status updated.' };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Admin sets a new password for an internal user.
 *
 * - Only EMPLOYEE / MARKETING accounts can be targeted (an admin cannot
 *   reset another admin's — or their own — password through this path).
 * - The new password goes through the shared hashing utility; the old
 *   hash is never read, displayed, or returned.
 * - `mustChangePassword` is set, so the user must choose their own
 *   password on next sign-in.
 */
export async function resetInternalUserPassword(
  _prev: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  await requireRole(USER_ROLES.ADMIN);

  const parsed = passwordResetSchema.safeParse({
    id: readString(formData, 'id'),
    password: readString(formData, 'password'),
    confirmPassword: readString(formData, 'confirmPassword'),
  });

  if (!parsed.success) {
    return { fieldErrors: fields(parsed.error, ['id', 'password', 'confirmPassword']) };
  }

  try {
    await connectDB();
    const user = await User.findById(parsed.data.id);
    if (!user || !isInternalRole(user.role)) {
      return { error: 'Account not found.' };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const result = await User.updateOne(
      { _id: user._id },
      { $set: { passwordHash, mustChangePassword: true } }
    );

    if (result.matchedCount === 0) {
      return { error: 'Could not update the password. Please try again.' };
    }

    return {
      ok: true,
      message:
        'Password updated. The user will be asked to set their own password on next sign-in.',
    };
  } catch (error) {
    return toState(error);
  }
}
