import 'server-only';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import { AuditLog } from '@/models/AuditLog';

export async function writeAudit(input: { actorUserId: string | Types.ObjectId; action: string; resourceType: string; resourceId?: string | Types.ObjectId | null; beforeSummary?: Record<string, unknown> | null; afterSummary?: Record<string, unknown> | null; metadata?: Record<string, unknown> | null; }): Promise<void> {
  await connectDB();
  await AuditLog.create({ actorUserId: typeof input.actorUserId === 'string' ? new Types.ObjectId(input.actorUserId) : input.actorUserId, action: input.action, resourceType: input.resourceType, resourceId: input.resourceId ? (typeof input.resourceId === 'string' ? new Types.ObjectId(input.resourceId) : input.resourceId) : null, beforeSummary: input.beforeSummary ?? null, afterSummary: input.afterSummary ?? null, metadata: input.metadata ?? null });
}
