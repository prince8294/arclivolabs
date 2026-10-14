import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getFileById } from '@/lib/queries/files';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(req: NextRequest, props: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await props.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const result = await getFileById(id, user);
    if (!result) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[File Detail API Error]:', err);
    return NextResponse.json({ error: 'Failed to fetch file details' }, { status: 500 });
  }
}
