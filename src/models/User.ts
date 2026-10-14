import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import { USER_STATUS, UserStatus, enumValues } from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';
import { isEmail, isPhone } from '@/lib/validations/common';
import { USER_ROLES, UserRole } from '@/types/auth';

/**
 * Shared account identity for every role in the system (ADMIN, MARKETING,
 * EMPLOYEE, CLIENT). Role-specific data lives in separate models:
 * Employee, MarketingProfile and Client.
 */
export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string | null;
  passwordHash?: string | null;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string | null;
  emailVerified: boolean;
  /**
   * True when the password was assigned by an admin (account creation or
   * reset) and the user must choose their own password on next sign-in.
   * Cleared by the /change-password flow.
   */
  mustChangePassword: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A user document with the sensitive password hash removed. */
export type SafeUser = Omit<IUser, 'passwordHash'>;

export type UserDocument = HydratedDocument<IUser>;
export type UserModel = Model<IUser>;

/**
 * Defense in depth: `passwordHash` is already excluded from default queries
 * via `select: false`; the transform additionally guarantees it is removed
 * from every plain-object/JSON output.
 */
const userOutputTransform = (_doc: unknown, ret: Record<string, unknown>) => {
  delete ret.passwordHash;
  return stripVersionKey(_doc, ret);
};

export const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      validate: {
        validator: (value: string) => isEmail(value),
        message: 'email must be a valid email address',
      },
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => isPhone(value),
        message:
          'phone must be a valid phone number (international formats allowed)',
      },
    },
    // Excluded from default queries. Only authentication flows should ever
    // select it explicitly (`select('+passwordHash')`).
    passwordHash: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: enumValues(USER_ROLES),
    },
    status: {
      type: String,
      enum: enumValues(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    // Set by admin-driven account creation / password reset; cleared once
    // the user completes the /change-password flow.
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'users',
    toJSON: {
      virtuals: false,
      transform: userOutputTransform,
    },
    toObject: {
      virtuals: false,
      transform: userOutputTransform,
    },
  }
);

// Uniqueness is enforced at the database level (sparse-free unique index),
// not only by Mongoose validation.
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, status: 1 });

export const User = (models.User as Model<IUser>) || model<IUser>('User', UserSchema);
