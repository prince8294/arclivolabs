'use server';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

import { requireClientProfile } from '@/lib/auth/client-profile';
import { requireRole } from '@/lib/auth/authorization';
import { CLIENT_APPROVAL_STATUSES, CLIENT_REQUIREMENT_STATUSES } from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { generateSequentialCode } from '@/lib/db/generate-code';
import { ClientApproval } from '@/models/ClientApproval';
import { ClientRequirement } from '@/models/ClientRequirement';
import { Project } from '@/models/Project';
import { USER_ROLES } from '@/types/auth';

export interface ClientPortalActionState { ok: boolean; message?: string; error?: string }
const fail = (error: string): ClientPortalActionState => ({ ok: false, error });
const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

export async function createClientRequirement(_previous: ClientPortalActionState, form: FormData): Promise<ClientPortalActionState> {
  const user = await requireRole(USER_ROLES.CLIENT); const profile = await requireClientProfile();
  const projectId = text(form, 'projectId'); const title = text(form, 'title'); const description = text(form, 'description');
  if (!Types.ObjectId.isValid(projectId) || title.length < 3 || title.length > 200 || description.length < 10 || description.length > 5000) return fail('Select a project and enter a clear title and description.');
  await connectDB(); const project = await Project.exists({ _id: projectId, clientId: profile.id }); if (!project) return fail('Project not found.');
  try { const requirementCode = await generateSequentialCode('client-requirement', 'REQ'); await ClientRequirement.create({ requirementCode, projectId: new Types.ObjectId(projectId), clientId: new Types.ObjectId(profile.id), title, description, fileAssetIds: [], status: CLIENT_REQUIREMENT_STATUSES.SUBMITTED, submittedBy: new Types.ObjectId(user.id) }); revalidatePath('/client/requirements'); return { ok: true, message: `${requirementCode} submitted.` }; } catch { return fail('Unable to submit the requirement.'); }
}

export async function decideClientApproval(_previous: ClientPortalActionState, form: FormData): Promise<ClientPortalActionState> {
  const user = await requireRole(USER_ROLES.CLIENT); const profile = await requireClientProfile(); const approvalId = text(form, 'approvalId'); const decision = text(form, 'decision'); const feedbackNotes = text(form, 'feedbackNotes');
  const allowed = [CLIENT_APPROVAL_STATUSES.APPROVED, CLIENT_APPROVAL_STATUSES.REJECTED, CLIENT_APPROVAL_STATUSES.REVISION_REQUESTED];
  if (!Types.ObjectId.isValid(approvalId) || !allowed.includes(decision as never) || feedbackNotes.length > 2000 || (decision !== CLIENT_APPROVAL_STATUSES.APPROVED && feedbackNotes.length < 3)) return fail('Choose a valid decision and add feedback when requesting changes or rejecting.');
  await connectDB(); const result = await ClientApproval.updateOne({ _id: approvalId, clientId: profile.id, status: CLIENT_APPROVAL_STATUSES.PENDING }, { $set: { status: decision, decidedBy: new Types.ObjectId(user.id), decidedAt: new Date(), feedbackNotes: feedbackNotes || null } });
  if (!result.modifiedCount) return fail('This approval is unavailable or was already decided.'); revalidatePath('/client/approvals'); return { ok: true, message: 'Decision recorded.' };
}
