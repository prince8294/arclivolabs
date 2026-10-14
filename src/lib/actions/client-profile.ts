'use server';

import { redirect } from 'next/navigation';
import { Types } from 'mongoose';
import type { z } from 'zod';

import { requireClientProfile } from '@/lib/auth/client-profile';
import { clientUpdateSchema, type ClientUpdateInput } from '@/lib/validations/client';
import { Client } from '@/models/Client';
import connectDB from '@/lib/db/mongoose';

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function fields(error: z.ZodError, names: readonly string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path[0];
    if (typeof path === 'string' && names.includes(path) && !result[path]) {
      result[path] = issue.message;
    }
  }
  return result;
}

const CLIENT_FIELDS = ['name', 'phone', 'alternatePhone', 'website'];

export async function updateClientProfile(
  _prev: { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> },
  formData: FormData
): Promise<{ ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> }> {
  const profile = await requireClientProfile();

  const parsed = clientUpdateSchema.safeParse({
    type: profile.type,
    name: readString(formData, 'name'),
    companyName: '',
    email: profile.email,
    phone: readString(formData, 'phone'),
    alternatePhone: readString(formData, 'alternatePhone'),
    website: readString(formData, 'website'),
    billingAddress: {},
    shippingAddress: {},
    taxId: '',
    assignedMarketingUserId: '',
    notes: '',
    status: profile.status,
  });

  if (!parsed.success) {
    return { fieldErrors: fields(parsed.error, CLIENT_FIELDS) };
  }

  const input = parsed.data;

  try {
    await connectDB();

    if (!Types.ObjectId.isValid(profile.id)) {
      return { error: 'Invalid client record.' };
    }

    await Client.updateOne(
      { _id: new Types.ObjectId(profile.id) },
      {
        $set: {
          name: input.name,
          phone: input.phone ?? null,
          alternatePhone: input.alternatePhone ?? null,
          website: input.website ?? null,
        },
      }
    );

    return { ok: true, message: 'Profile updated successfully.' };
  } catch (error) {
    console.error('updateClientProfile failed', error);
    return { error: 'Unable to update profile. Please try again.' };
  }
}