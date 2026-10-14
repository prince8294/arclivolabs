'use server';

import { redirect } from 'next/navigation';

import {
  createSession,
  destroySession,
} from '@/lib/auth/session-store';
import { getCurrentUser } from '@/lib/auth/current-user';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from '@/lib/auth/password';
import {
  LOGIN_ROUTE,
  getDashboardRouteForRole,
} from '@/lib/auth/redirects';
import { USER_STATUS } from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { User } from '@/models/User';
import type { UserRole } from '@/types/auth';
import {
  changePasswordSchema,
  loginFieldErrors,
  loginSchema,
  type ChangePasswordState,
  type LoginState,
} from '@/lib/validations/auth';

/**
 * Authentication server actions.
 *
 * Security notes:
 * - Credentials are validated server-side via zod before any DB work.
 * - Unknown email and wrong password return the identical message, so
 *   the endpoint cannot be used for account enumeration.
 * - Users without a stored passwordHash fail the same way (safe, no
 *   crash, no auto-generated password).
 * - Only ACTIVE accounts get a session; SUSPENDED/INACTIVE never do.
 * - Rate limiting is intentionally not implemented yet (see planning
 *   notes); this action is the single entry point where it should be
 *   added later.
 */

const INVALID_CREDENTIALS = 'Invalid email or password.';
const ACCOUNT_UNAVAILABLE =
  'Your account is currently unavailable. Please contact Arclivo Labs administration.';
const GENERIC_ERROR = 'Unable to sign in right now. Please try again.';

type CredentialCheck =
  | { kind: 'invalid' }
  | { kind: 'unavailable' }
  | { kind: 'ok'; userId: string; role: UserRole };

async function checkCredentials(
  email: string,
  password: string
): Promise<CredentialCheck> {
  await connectDB();
  // passwordHash is `select: false`; authentication must request it
  // explicitly.
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user || !user.passwordHash) {
    // Run one compare against a decoy hash so the response timing does
    // not reveal whether the account exists.
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return { kind: 'invalid' };
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    return { kind: 'invalid' };
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    return { kind: 'unavailable' };
  }

  return { kind: 'ok', userId: user._id.toString(), role: user.role };
}

/**
 * Login action used with React's `useActionState`.
 * On success it sets the session cookie and redirects to the caller's
 * role dashboard; on failure it returns a state with a safe, generic
 * message.
 */
export async function login(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const emailRaw = formData.get('email');
  const passwordRaw = formData.get('password');

  const parsed = loginSchema.safeParse({
    email: typeof emailRaw === 'string' ? emailRaw : '',
    password: typeof passwordRaw === 'string' ? passwordRaw : '',
  });

  if (!parsed.success) {
    return { fieldErrors: loginFieldErrors(parsed.error) };
  }

  const { email, password } = parsed.data;

  let result: CredentialCheck;
  try {
    result = await checkCredentials(email, password);
  } catch (error) {
    // Never surface MongoDB/infra errors to the browser.
    console.error('login: credential check failed', error);
    return { message: GENERIC_ERROR };
  }

  if (result.kind === 'invalid') {
    return { message: INVALID_CREDENTIALS };
  }
  if (result.kind === 'unavailable') {
    return { message: ACCOUNT_UNAVAILABLE };
  }

  try {
    await createSession(result.userId, result.role);
  } catch (error) {
    console.error('login: session creation failed', error);
    return { message: GENERIC_ERROR };
  }

  // Informational only: a transient failure here must not block sign-in.
  void User.updateOne(
    { _id: result.userId },
    { $set: { lastLoginAt: new Date() } }
  ).catch((error) => {
    console.error('login: failed to update lastLoginAt', error);
  });

  // redirect() throws — keep it outside every try/catch above.
  redirect(getDashboardRouteForRole(result.role));
}

/** Destroy the session (cookie expired + deleted) and go to /login. */
export async function logout(): Promise<void> {
  await destroySession();
  redirect(LOGIN_ROUTE);
}

const CHANGE_PASSWORD_GENERIC_ERROR =
  'Unable to change the password right now. Please try again.';

/**
 * First-login / forced password change.
 *
 * The caller is already authenticated (they signed in with the
 * admin-assigned temporary credential), and `mustChangePassword` is
 * true — `requireRole` keeps such users out of every portal page until
 * this succeeds. We still verify the current password as possession
 * proof: whoever is changing the password must know the credential the
 * admin handed over.
 *
 * On success: new hash stored, `mustChangePassword` cleared, role
 * preserved, redirect to the user's own dashboard.
 */
export async function changeOwnPassword(
  _previous: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(LOGIN_ROUTE);
  }

  // No longer pending a change (already set, or flag cleared): back to
  // the portal. No mutation happens on this path.
  if (!user.mustChangePassword) {
    redirect(getDashboardRouteForRole(user.role));
  }

  const currentRaw = formData.get('currentPassword');
  const passwordRaw = formData.get('password');
  const confirmRaw = formData.get('confirmPassword');

  const parsed = changePasswordSchema.safeParse({
    currentPassword: typeof currentRaw === 'string' ? currentRaw : '',
    password: typeof passwordRaw === 'string' ? passwordRaw : '',
    confirmPassword: typeof confirmRaw === 'string' ? confirmRaw : '',
  });

  if (!parsed.success) {
    const firstFor = (field: 'currentPassword' | 'password' | 'confirmPassword') =>
      parsed.error.issues.find((issue) => issue.path[0] === field)?.message;
    return {
      fieldErrors: {
        currentPassword: firstFor('currentPassword'),
        password: firstFor('password'),
        confirmPassword: firstFor('confirmPassword'),
      },
    };
  }

  try {
    await connectDB();
    const doc = await User.findById(user.id).select('+passwordHash');
    if (
      !doc ||
      !doc.passwordHash ||
      !(await verifyPassword(parsed.data.currentPassword, doc.passwordHash))
    ) {
      return {
        fieldErrors: {
          currentPassword: 'Current password is incorrect.',
        },
      };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await User.updateOne(
      { _id: doc._id },
      { $set: { passwordHash, mustChangePassword: false } }
    );
  } catch (error) {
    // Never surface MongoDB/infra errors to the browser.
    console.error('changeOwnPassword: failed', error);
    return { message: CHANGE_PASSWORD_GENERIC_ERROR };
  }

  // redirect() throws — keep it outside every try/catch above.
  redirect(getDashboardRouteForRole(user.role));
}
