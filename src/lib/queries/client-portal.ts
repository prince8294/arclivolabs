import 'server-only';

import { Types } from 'mongoose';

import connectDB from '@/lib/db/mongoose';
import { Client } from '@/models/Client';
import { ClientApproval } from '@/models/ClientApproval';
import { ClientRequirement } from '@/models/ClientRequirement';
import { Project } from '@/models/Project';

export async function listClientProjects(clientId: string) {
  if (!Types.ObjectId.isValid(clientId)) return [];
  await connectDB();
  const rows = await Project.find({ clientId: new Types.ObjectId(clientId) })
    .select('projectCode title description status health progressPercentage startDate expectedEndDate currency')
    .sort({ updatedAt: -1 }).lean().exec();
  return rows.map((row) => ({ id: row._id.toString(), projectCode: row.projectCode, title: row.title, description: row.description ?? null, status: row.status, health: row.health, progressPercentage: row.progressPercentage, startDate: row.startDate ?? null, expectedEndDate: row.expectedEndDate ?? null, currency: row.currency }));
}

export async function listClientRequirements(clientId: string) {
  if (!Types.ObjectId.isValid(clientId)) return [];
  await connectDB();
  const rows = await ClientRequirement.find({ clientId: new Types.ObjectId(clientId) })
    .populate('projectId', 'projectCode title').sort({ createdAt: -1 }).lean().exec();
  return rows.map((row) => { const project = row.projectId as unknown as { _id: Types.ObjectId; projectCode?: string; title?: string }; return { id: row._id.toString(), requirementCode: row.requirementCode, projectId: project?._id?.toString() ?? row.projectId.toString(), projectCode: project?.projectCode ?? '', projectTitle: project?.title ?? 'Project', title: row.title, description: row.description, status: row.status, fileCount: row.fileAssetIds.length, reviewNotes: row.reviewNotes ?? null, createdAt: row.createdAt }; });
}

export async function listClientApprovals(clientId: string) {
  if (!Types.ObjectId.isValid(clientId)) return [];
  await connectDB();
  const rows = await ClientApproval.find({ clientId: new Types.ObjectId(clientId) })
    .populate('projectId', 'projectCode title').sort({ createdAt: -1 }).lean().exec();
  return rows.map((row) => { const project = row.projectId as unknown as { _id: Types.ObjectId; projectCode?: string; title?: string }; return { id: row._id.toString(), approvalCode: row.approvalCode, projectId: project?._id?.toString() ?? row.projectId.toString(), projectCode: project?.projectCode ?? '', projectTitle: project?.title ?? 'Project', title: row.title, description: row.description ?? null, fileAssetId: row.fileAssetId.toString(), fileVersionNumber: row.fileVersionNumber, status: row.status, feedbackNotes: row.feedbackNotes ?? null, decidedAt: row.decidedAt ?? null, createdAt: row.createdAt }; });
}

export async function getClientOriginLeadId(clientId: string): Promise<string | null> {
  if (!Types.ObjectId.isValid(clientId)) return null;
  await connectDB();
  const client = await Client.findById(clientId).select('originLeadId').lean().exec();
  return client?.originLeadId?.toString() ?? null;
}
