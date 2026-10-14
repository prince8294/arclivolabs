import { z } from 'zod';

import { PASSWORD_POLICY } from '@/lib/auth/config';

/**
 * Authentication input validation (server-side, zod).
 *
 * Client-side checks may improve UX, but these schemas are the
 * authority: every server action re-validates raw FormData through
 * them before touching the database.
 */

export const loginSchema = z.object({
  // Normalized server-side: trimmed + lowercased before lookup.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email is required.')
    .max(254, 'Email is too long.')
    .email('Enter a valid email address.'),
  // Minimum length mirrors the account creation policy; bcrypt caps at
  // 72 bytes, so anything longer cannot be hashed correctly anyway.
  password: z
    .string()
    .min(PASSWORD_POLICY.MIN_LENGTH, 'Password must be at least 8 characters.')
    .max(PASSWORD_POLICY.MAX_LENGTH, 'Password must be at most 72 characters.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** State passed between the login form and the server action. */
export interface LoginState {
  fieldErrors?: {
    email?: string;
    password?: string;
  };
  /** Generic, user-facing error message (no internals, no enumeration). */
  message?: string;
}

export const INITIAL_LOGIN_STATE: LoginState = {};

/** Extract the first error per field from a zod failure. */
export function loginFieldErrors(
  error: z.ZodError
): LoginState['fieldErrors'] {
  const firstErrorFor = (field: 'email' | 'password'): string | undefined =>
    error.issues.find((issue) => issue.path[0] === field)?.message;
  return {
    email: firstErrorFor('email'),
    password: firstErrorFor('password'),
  };
}

/* ------------------------------------------------------------------ */
/* Forced first-login password change                                 */
/* ------------------------------------------------------------------ */

/**
 * Schema for the /change-password flow. The user is already
 * authenticated from the admin-assigned (temporary) credential, so we
 * additionally require the current password as possession proof before
 * allowing the new one to be set.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Enter your current password.'),
    password: z
      .string()
      .min(PASSWORD_POLICY.MIN_LENGTH, 'Password must be at least 8 characters.')
      .max(
        PASSWORD_POLICY.MAX_LENGTH,
        'Password must be at most 72 characters.'
      ),
    confirmPassword: z.string().min(1, 'Confirm the new password.'),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface ChangePasswordState {
  fieldErrors?: {
    currentPassword?: string;
    password?: string;
    confirmPassword?: string;
  };
  message?: string;
}

export const INITIAL_CHANGE_PASSWORD_STATE: ChangePasswordState = {};
