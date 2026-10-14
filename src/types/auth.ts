export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MARKETING: 'MARKETING',
  EMPLOYEE: 'EMPLOYEE',
  CLIENT: 'CLIENT',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLES.ADMIN]: 'Administrator',
  [USER_ROLES.MARKETING]: 'Marketing',
  [USER_ROLES.EMPLOYEE]: 'Employee',
  [USER_ROLES.CLIENT]: 'Client',
};

/**
 * Safe, minimal authenticated-user shape that may be passed to client
 * components or stored in a session payload.
 *
 * Only public identity fields are included — never the password hash,
 * phone, status flags, or any role-specific domain data (salary,
 * commission, client financials, ...).
 *
 * `mustChangePassword` is included because portal layouts need it to
 * redirect the user to /change-password before anything else.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  mustChangePassword: boolean;
}
