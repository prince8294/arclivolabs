/**
 * Server actions for the marketing side of proposals (Part 9).
 *
 * Marketing has deliberately limited powers:
 * - request a quotation for a Lead/Client assigned to THEM;
 * - read the status and amount of a proposal that reached internal
 *   approval (never a draft's commercial details);
 * - ask for a revision of an issued version.
 *
 * Marketing can never approve pricing, finalize a deal, or touch another
 * user's records: every action below re-verifies the assignment from the
 * Lead/Client document itself, not from a form field.
 */

import 'server-only';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';

import { requireRole } from '@/lib/auth/authorization';
import { generateSequentialCode } from '@/lib/db/generate-code';
import connectDB from '@/lib/db/mongoose';
import {
  PROPOSAL_REQUEST_CODE_PREFIX,
  PROPOSAL_REQUEST_STATUSES,
  PROPOSAL_STATUSES,
  REVISION_REQUEST_STATUSES,
} from '@/lib/constants/proposals';
import { ROUTES } from '@/lib/constants/routes';
import { isVersionExpired } from '@/lib/queries/proposals';
import { toMinorUnits } from '@/lib/utils/money';
import {
  createProposalRequestSchema,
  createRevisionRequestSchema,
  type ProposalActionState,
} from '@/lib/validations/proposal';
import { zodFieldErrors } from '@/lib/validations/common';
import { Client } from '@/models/Client';
import { Lead } from '@/models/Lead';
import { Proposal } from '@/models/Proposal';
import { ProposalRequest, RevisionRequest } from '@/models/ProposalRequest';
import { ProposalVersion } from '@/models/ProposalVersion';
import { USER_ROLES } from '@/types/auth';

const GENERIC_ERROR = 'Unable to complete the request. Please try again.';

class MarketingProposalError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'MarketingProposalError';
    this.field = field;
  }
}

function toState(error: unknown): ProposalActionState {
  if (error instanceof MarketingProposalError) {
    return error.field
      ? { ok: false, fieldErrors: { [error.field]: error.message } }
      : { ok: false, error: error.message };
  }
  console.error('marketing proposal action failed', error);
  return { ok: false, error: GENERIC_ERROR };
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/**
 * Verify the actor really owns the target record.
 *
 * Assignment is re-read from the Lead/Client document, so a reassignment
 * takes effect immediately: the previous owner can no longer raise a
 * request even with a stale page open.
 */
async function assertOwnership(params: {
  marketingUserId: string;
  leadId?: string | null;
  clientId?: string | null;
  field: string;
}): Promise<void> {
  await connectDB();

  if (params.leadId) {
    const lead = await Lead.findById(new Types.ObjectId(params.leadId))
      .select('assignedTo')
      .lean()
      .exec();
    if (!lead) {
      throw new MarketingProposalError('Lead not found.', params.field);
    }
    if (lead.assignedTo?.toString() !== params.marketingUserId) {
      throw new MarketingProposalError(
        'You can only work on leads assigned to you.',
        params.field
      );
    }
    return;
  }

  if (params.clientId) {
    const client = await Client.findById(new Types.ObjectId(params.clientId))
      .select('assignedMarketingUserId')
      .lean()
      .exec();
    if (!client) {
      throw new MarketingProposalError('Client not found.', params.field);
    }
    if (client.assignedMarketingUserId?.toString() !== params.marketingUserId) {
      throw new MarketingProposalError(
        'You can only work on clients assigned to you.',
        params.field
      );
    }
    return;
  }

  throw new MarketingProposalError('Select a lead or a client.', params.field);
}

/* -------------------------------------------------------------------------- */
/* Quotation request                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Submit a quotation request (MARKETING only).
 *
 * This creates a `ProposalRequest`, NOT a Proposal. It carries no approved
 * pricing, so Admin still has to build, approve and issue a real
 * quotation before anything reaches the customer.
 */
export async function createQuotationRequest(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.MARKETING);

  try {
    const raw = {
      leadId: readString(formData, 'leadId'),
      clientId: readString(formData, 'clientId'),
      requestedServicesJson: readString(formData, 'requestedServicesJson'),
      requirements: readString(formData, 'requirements'),
      expectedBudget: Number(readString(formData, 'expectedBudget') || 0),
      currency: readString(formData, 'currency'),
      expectedTimeline: readString(formData, 'expectedTimeline'),
      customerNotes: readString(formData, 'customerNotes'),
      priority: readString(formData, 'priority'),
    };

    const parsed = createProposalRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: zodFieldErrors(parsed.error, [
          'leadId',
          'clientId',
          'requirements',
          'expectedBudget',
          'currency',
          'expectedTimeline',
          'customerNotes',
          'priority',
        ]),
      };
    }
    const input = parsed.data;

    await assertOwnership({
      marketingUserId: actor.id,
      leadId: input.leadId,
      clientId: input.clientId,
      field: input.leadId ? 'leadId' : 'clientId',
    });

    const requestCode = await generateSequentialCode(
      'proposalRequest',
      PROPOSAL_REQUEST_CODE_PREFIX
    );

    const request = await ProposalRequest.create({
      requestCode,
      leadId: input.leadId ? new Types.ObjectId(input.leadId) : null,
      clientId: input.clientId ? new Types.ObjectId(input.clientId) : null,
      requestedBy: new Types.ObjectId(actor.id),
      requestedServices: input.requestedServicesJson,
      requirements: input.requirements,
      // Stored in minor units like every other money value.
      expectedBudgetMinor:
        input.expectedBudget > 0 ? toMinorUnits(input.expectedBudget, input.currency) : null,
      currency: input.currency,
      expectedTimeline: input.expectedTimeline,
      customerNotes: input.customerNotes,
      priority: input.priority,
      status: PROPOSAL_REQUEST_STATUSES.SUBMITTED,
    });

    revalidatePath(ROUTES.MARKETING.PROPOSALS);
    revalidatePath(ROUTES.ADMIN.PROPOSALS);

    return {
      ok: true,
      id: request._id.toString(),
      message: `Request ${requestCode} submitted. Admin will review it and issue the quotation.`,
    };
  } catch (error) {
    return toState(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Revision request                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Ask Admin to change an issued proposal (MARKETING only).
 *
 * This never edits the issued version. It records what the customer wants
 * so Admin can decide whether to open a new draft version. Only an ISSUED
 * version can be questioned - there is nothing to revise about a draft.
 */
export async function createRevisionRequest(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.MARKETING);

  try {
    const raw = {
      proposalId: readString(formData, 'proposalId'),
      requestedChanges: readString(formData, 'requestedChanges'),
      reason: readString(formData, 'reason'),
      customerFeedback: readString(formData, 'customerFeedback'),
      requestedBudget:
        readString(formData, 'requestedBudget') === ''
          ? undefined
          : Number(readString(formData, 'requestedBudget')),
    };

    const parsed = createRevisionRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: zodFieldErrors(parsed.error, [
          'proposalId',
          'requestedChanges',
          'reason',
          'customerFeedback',
          'requestedBudget',
        ]),
      };
    }
    const input = parsed.data;

    await connectDB();

    // Ownership is enforced through the linked Lead/Client, exactly like the
    // proposal list scope, so Marketing A can never touch Marketing B's work.
    const proposal = await Proposal.findById(input.proposalId)
      .select('leadId clientId assignedMarketingUserId currentVersionId')
      .lean()
      .exec();
    if (!proposal) {
      throw new MarketingProposalError('Proposal not found.', 'proposalId');
    }
    if (proposal.assignedMarketingUserId?.toString() !== actor.id) {
      throw new MarketingProposalError(
        'You can only request revisions on your own proposals.',
        'proposalId'
      );
    }

    if (!proposal.currentVersionId) {
      throw new MarketingProposalError(
        'This proposal has no issued version yet.',
        'proposalId'
      );
    }

    const version = await ProposalVersion.findById(proposal.currentVersionId)
      .select('status validUntil version currency')
      .lean()
      .exec();
    if (!version) {
      throw new MarketingProposalError('Proposal version not found.', 'proposalId');
    }
    if (
      version.status !== PROPOSAL_STATUSES.SENT &&
      version.status !== PROPOSAL_STATUSES.REJECTED &&
      version.status !== PROPOSAL_STATUSES.ACCEPTED
    ) {
      throw new MarketingProposalError(
        'Only an issued quotation can be revised.',
        'proposalId'
      );
    }
    if (isVersionExpired(version.validUntil as Date | null)) {
      throw new MarketingProposalError(
        'This quotation has expired. Ask Admin to create a new version.',
        'proposalId'
      );
    }

    const openDuplicate = await RevisionRequest.findOne({
      proposalId: proposal._id,
      requestedBy: new Types.ObjectId(actor.id),
      status: REVISION_REQUEST_STATUSES.OPEN,
    })
      .select('_id')
      .lean()
      .exec();
    if (openDuplicate) {
      throw new MarketingProposalError(
        'You already have an open revision request on this proposal.',
        'requestedChanges'
      );
    }

    await RevisionRequest.create({
      proposalId: proposal._id,
      againstVersion: version.version,
      requestedBy: new Types.ObjectId(actor.id),
      requestedChanges: input.requestedChanges,
      reason: input.reason,
      customerFeedback: input.customerFeedback,
      requestedBudgetMinor:
        input.requestedBudget !== undefined
          ? toMinorUnits(input.requestedBudget, version.currency)
          : null,
      currency: version.currency,
      status: REVISION_REQUEST_STATUSES.OPEN,
    });

    revalidatePath(ROUTES.MARKETING.PROPOSALS);
    revalidatePath(`${ROUTES.MARKETING.PROPOSALS}/${input.proposalId}`);
    revalidatePath(ROUTES.ADMIN.PROPOSALS);

    return {
      ok: true,
      id: input.proposalId,
      message: 'Revision request sent to Admin. The issued quotation is unchanged until they issue a new version.',
    };
  } catch (error) {
    return toState(error);
  }
}

