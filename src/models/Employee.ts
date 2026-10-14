import { HydratedDocument, Model, Schema, Types, model, models } from 'mongoose';

import {
  DEFAULT_CURRENCY,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_STATUS,
  EMPLOYMENT_TYPES,
  PAYMENT_TYPES,
  EmployeeDepartment,
  EmployeeStatus,
  EmploymentType,
  PaymentType,
  enumValues,
} from '@/lib/constants/enums';
import { stripVersionKey } from '@/lib/db/schema-utils';
import { isPhone } from '@/lib/validations/common';

/** Readable employee code format, e.g. `EMP-0001`. */
export const EMPLOYEE_CODE_PATTERN = /^EMP-\d{4,}$/;

/**
 * Internal delivery staff. 1:1 with a User account (see `userId`).
 * Role-specific to the EMPLOYEE role.
 */
export interface IEmployee {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  employeeCode: string;
  department: EmployeeDepartment;
  designation: string;
  employmentType: EmploymentType;
  skills: string[];
  joiningDate: Date;
  paymentType: PaymentType;
  baseAmount?: number | null;
  currency: string;
  status: EmployeeStatus;
  managerId?: Types.ObjectId | null;
  address?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** An employee document with sensitive payroll fields removed. */
export type SafeEmployee = Omit<IEmployee, 'baseAmount'>;

export type EmployeeDocument = HydratedDocument<IEmployee>;
export type EmployeeModel = Model<IEmployee>;

/** Removes payroll data and the version key from plain output objects. */
const employeeOutputTransform = (_doc: unknown, ret: Record<string, unknown>) => {
  delete ret.baseAmount;
  return stripVersionKey(_doc, ret);
};

export const EmployeeSchema = new Schema<IEmployee>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    employeeCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) =>
          EMPLOYEE_CODE_PATTERN.test(value.toUpperCase()),
        message: 'employeeCode must follow the EMP-0000 format (e.g. EMP-0001)',
      },
    },
    department: {
      type: String,
      required: true,
      enum: enumValues(EMPLOYEE_DEPARTMENTS),
    },
    designation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    employmentType: {
      type: String,
      required: true,
      enum: enumValues(EMPLOYMENT_TYPES),
    },
    skills: {
      type: [String],
      default: [],
      trim: true,
    },
    joiningDate: {
      type: Date,
      required: true,
    },
    paymentType: {
      type: String,
      required: true,
      enum: enumValues(PAYMENT_TYPES),
    },
    // Payroll details are confidential and excluded from default queries.
    // Select explicitly (`select('+baseAmount')`) where the UI is
    // authorized to show them.
    baseAmount: {
      type: Number,
      min: 0,
      select: false,
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 3,
      default: DEFAULT_CURRENCY,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(EMPLOYEE_STATUS),
      default: EMPLOYEE_STATUS.ACTIVE,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
    },
    address: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    emergencyContact: {
      type: String,
      trim: true,
      maxlength: 20,
      validate: {
        validator: (value: string) => isPhone(value),
        message:
          'emergencyContact must be a valid phone number (international formats allowed)',
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    collection: 'employees',
    toJSON: {
      virtuals: false,
      transform: employeeOutputTransform,
    },
    toObject: {
      virtuals: false,
      transform: employeeOutputTransform,
    },
  }
);

EmployeeSchema.index({ employeeCode: 1 }, { unique: true });
EmployeeSchema.index({ userId: 1 }, { unique: true });
EmployeeSchema.index({ department: 1, status: 1 });

export const Employee = (models.Employee as Model<IEmployee>) || model<IEmployee>('Employee', EmployeeSchema);
