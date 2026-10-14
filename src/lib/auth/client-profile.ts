import 'server-only';

import { cache } from 'react';
import { Types } from 'mongoose';
import { redirect } from 'next/navigation';

import { CLIENT_STATUS } from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { Client } from '@/models/Client';
import { getCurrentUser } from './current-user';

export interface ClientProfile {
  id: string;
  clientCode: string;
  name: string;
  email: string;
  phone: string | null;
  alternatePhone: string | null;
  website: string | null;
  status: string;
  type: string;
  companyName: string | null;
}

/**
 * Require an authenticated CLIENT user and return their Client profile.
 *
 * Redirects when the session is missing/wrong-role or the linked Client
 * record is missing/inactive. This remains safe when layouts and pages
 * render in parallel because every caller produces the same denial path.
 */
export async function requireClientProfile(): Promise<ClientProfile> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'CLIENT') {
    redirect('/login');
  }

  const client = await getClientProfileForUser(user.id);
  if (!client) redirect('/login?error=client_inactive');
  return client;
}

export const getClientProfileForUser = cache(
  async (userId: string): Promise<ClientProfile | null> => {
    try {
      await connectDB();
      const client = await Client.findOne({ userId: new Types.ObjectId(userId) })
        .select('clientCode name email phone alternatePhone website status type companyName')
        .lean()
        .exec();

      if (!client || client.status !== CLIENT_STATUS.ACTIVE) {
        return null;
      }

      return {
        id: client._id.toString(),
        clientCode: client.clientCode,
        name: client.name,
        email: client.email,
        phone: client.phone ?? null,
        alternatePhone: client.alternatePhone ?? null,
        website: client.website ?? null,
        status: client.status,
        type: client.type,
        companyName: client.companyName ?? null,
      };
    } catch {
      return null;
    }
  }
);
