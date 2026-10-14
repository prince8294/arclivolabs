import 'server-only';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import { Notification } from '@/models/Notification';

export async function createNotification(input: { recipientUserId: string | Types.ObjectId; type: string; title: string; message: string; resourceType?: string; resourceId?: string | Types.ObjectId | null; resourceUrl?: string; idempotencyKey?: string; }): Promise<void> {
  await connectDB();
  const doc = { ...input, recipientUserId: typeof input.recipientUserId === 'string' ? new Types.ObjectId(input.recipientUserId) : input.recipientUserId, resourceId: input.resourceId ? (typeof input.resourceId === 'string' ? new Types.ObjectId(input.resourceId) : input.resourceId) : null };
  if (input.idempotencyKey) await Notification.updateOne({ recipientUserId: doc.recipientUserId, idempotencyKey: input.idempotencyKey }, { $setOnInsert: doc }, { upsert: true });
  else await Notification.create(doc);
}
