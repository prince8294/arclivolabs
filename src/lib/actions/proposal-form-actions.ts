'use server';

import {
  approveProposal as approveProposalImpl,
  createProposal as createProposalImpl,
  issueProposal as issueProposalImpl,
  submitProposalForApproval as submitProposalForApprovalImpl,
  updateProposalDraft as updateProposalDraftImpl,
} from '@/lib/actions/proposals';
import { createQuotationRequest as createQuotationRequestImpl } from '@/lib/actions/marketing-proposals';
import type { ProposalActionState } from '@/lib/validations/proposal';

export async function createProposal(previous: ProposalActionState, form: FormData) {
  return createProposalImpl(previous, form);
}

export async function updateProposalDraft(previous: ProposalActionState, form: FormData) {
  return updateProposalDraftImpl(previous, form);
}

export async function submitProposalForApproval(previous: ProposalActionState, form: FormData) {
  return submitProposalForApprovalImpl(previous, form);
}

export async function approveProposal(previous: ProposalActionState, form: FormData) {
  return approveProposalImpl(previous, form);
}

export async function issueProposal(previous: ProposalActionState, form: FormData) {
  return issueProposalImpl(previous, form);
}

export async function createQuotationRequest(previous: ProposalActionState, form: FormData) {
  return createQuotationRequestImpl(previous, form);
}
