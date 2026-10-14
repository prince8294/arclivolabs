import { z } from 'zod';

import {
  CLIENT_SOURCES,
  CLIENT_STATUS,
  CLIENT_TYPES,
} from '@/lib/constants/enums';
import { isPhone } from './common';

/**
 * Validation schemas for the admin management of clients.
 */

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Enter the full name.')
  .max(100, 'Name is too long (max 100 characters).');

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required.')
  .max(254, 'Email is too long.')
  .email('Enter a valid email address.');

const optionalPhoneSchema = z
  .string()
  .trim()
  .max(20, 'Phone is too long.')
  .refine((value) => value === '' || isPhone(value), {
    message: 'Enter a valid phone number (international formats allowed).',
  })
  .transform((value) => (value === '' ? null : value));

const optionalStringSchema = (max: number, message: string) => z
  .string()
  .trim()
  .max(max, message)
  .transform((value) => (value === '' ? null : value));

const addressSchema = z.object({
  line1: optionalStringSchema(200, 'Line 1 is too long.'),
  line2: optionalStringSchema(200, 'Line 2 is too long.'),
  city: optionalStringSchema(100, 'City is too long.'),
  state: optionalStringSchema(100, 'State is too long.'),
  postalCode: optionalStringSchema(20, 'Postal code is too long.'),
  country: optionalStringSchema(100, 'Country is too long.'),
}).partial();

function enumField<T extends Record<string, string>>(
  values: T,
  message: string
): z.ZodType<T[keyof T]> {
  const allowed = Object.values(values) as string[];
  return z
    .string()
    .refine((value) => allowed.includes(value), { message }) as unknown as z.ZodType<
    T[keyof T]
  >;
}

export const clientProfileSchema = z.object({
  type: enumField(CLIENT_TYPES, 'Select a client type.'),
  name: nameSchema,
  companyName: optionalStringSchema(200, 'Company name is too long.'),
  email: emailSchema,
  phone: optionalPhoneSchema,
  alternatePhone: optionalPhoneSchema,
  website: z
    .string()
    .trim()
    .max(200, 'Website is too long.')
    .transform((value) => (value === '' ? null : value))
    .refine(
      (value) =>
        value === null ||
        value === '' ||
        /^https?:\/\//.test(value) ||
        /^[a-z0-9-]+\.[a-z]{2,}/.test(value),
      { message: 'Enter a valid website URL (e.g. example.com or https://example.com).' }
    ),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  taxId: optionalStringSchema(50, 'Tax ID is too long.'),
  assignedMarketingUserId: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^[a-f\d]{24}$/i.test(value),
      { message: 'Invalid marketing user ID.' }
    )
    .transform((value) => (value === '' || value === undefined ? null : value)),
  notes: optionalStringSchema(2000, 'Notes are limited to 2000 characters.'),
});

export type ClientProfileInput = z.infer<typeof clientProfileSchema>;

export const clientCreateSchema = clientProfileSchema.extend({
  source: enumField(CLIENT_SOURCES, 'Select a source.'),
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

export const clientUpdateSchema = clientProfileSchema.extend({
  status: enumField(CLIENT_STATUS, 'Select a status.'),
});

export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

export const clientStatusSchema = z.object({
  id: z.string().min(24, 'Invalid record id.'),
  status: enumField(CLIENT_STATUS, 'Select a status.'),
});

export type ClientStatusInput = z.infer<typeof clientStatusSchema>;

export const portalCreateSchema = z.object({
  clientId: z.string().min(24, 'Invalid client id.'),
  loginName: z
    .string()
    .trim()
    .min(2, 'Enter the full name.')
    .max(100, 'Name is too long.'),
  loginEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Login email is required.')
    .max(254, 'Email is too long.')
    .email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be at most 72 characters.'),
  confirmPassword: z.string().min(1, 'Confirm the password.'),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: 'custom',
      path: ['confirmPassword'],
      message: 'Passwords do not match.',
    });
  }
});

export type PortalCreateInput = z.infer<typeof portalCreateSchema>;

export const portalResetSchema = z.object({
  clientId: z.string().min(24, 'Invalid client id.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be at most 72 characters.'),
  confirmPassword: z.string().min(1, 'Confirm the password.'),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: 'custom',
      path: ['confirmPassword'],
      message: 'Passwords do not match.',
    });
  }
});

export type PortalResetInput = z.infer<typeof portalResetSchema>;

export const clientConversionSchema = z.object({
  leadId: z.string().min(24, 'Invalid lead id.'),
  type: enumField(CLIENT_TYPES, 'Select a client type.'),
  name: nameSchema,
  companyName: optionalStringSchema(200, 'Company name is too long.'),
  email: emailSchema,
  phone: optionalPhoneSchema,
  alternatePhone: optionalPhoneSchema,
  website: z
    .string()
    .trim()
    .max(200, 'Website is too long.')
    .transform((value) => (value === '' ? null : value))
    .refine(
      (value) =>
        value === null ||
        value === '' ||
        /^https?:\/\//.test(value) ||
        /^[a-z0-9-]+\.[a-z]{2,}/.test(value),
      { message: 'Enter a valid website URL.' }
    ),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  taxId: optionalStringSchema(50, 'Tax ID is too long.'),
  assignedMarketingUserId: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^[a-f\d]{24}$/i.test(value),
      { message: 'Invalid marketing user ID.' }
    )
    .transform((value) => (value === '' || value === undefined ? null : value)),
  notes: optionalStringSchema(2000, 'Notes are limited to 2000 characters.'),
}).superRefine((data, ctx) => {
  if (data.type === CLIENT_TYPES.COMPANY && (!data.companyName || data.companyName.trim() === '')) {
    ctx.addIssue({
      code: 'custom',
      path: ['companyName'],
      message: 'Company name is required for business clients.',
    });
  }
});

export type ClientConversionInput = z.infer<typeof clientConversionSchema>;

export interface ClientActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  clientId?: string;
}

export const INITIAL_CLIENT_STATE: ClientActionState = {};
