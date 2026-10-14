'use client';

import { useActionState } from 'react';

import Button from '@/components/ui/button';
import { approveProposal, issueProposal, submitProposalForApproval } from '@/lib/actions/proposal-form-actions';
import { PROPOSAL_STATUSES, type ProposalStatus } from '@/lib/constants/proposals';
import { INITIAL_PROPOSAL_STATE, type ProposalActionState } from '@/lib/validations/proposal';

type ProposalAction = (previous: ProposalActionState, form: FormData) => Promise<ProposalActionState>;

function ActionForm({ action, proposalId, versionId, label, issueNow }: { action: ProposalAction; proposalId: string; versionId: string; label: string; issueNow?: boolean }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_PROPOSAL_STATE);
  return <form action={formAction} className="flex flex-wrap items-center gap-2"><input type="hidden" name="proposalId" value={proposalId} /><input type="hidden" name="versionId" value={versionId} />{issueNow && <input type="hidden" name="issueNow" value="true" />}<Button size="sm" type="submit" disabled={pending}>{pending ? 'Working…' : label}</Button>{state.error && <span className="text-xs text-destructive">{state.error}</span>}{state.ok && <span className="text-xs text-success">{state.message}</span>}</form>;
}

export default function ProposalLifecycleActions({ proposalId, versionId, status }: { proposalId: string; versionId: string; status: ProposalStatus }) {
  if (status === PROPOSAL_STATUSES.DRAFT) return <ActionForm action={submitProposalForApproval} proposalId={proposalId} versionId={versionId} label="Submit for approval" />;
  if (status === PROPOSAL_STATUSES.PENDING_APPROVAL) return <div className="flex flex-wrap gap-3"><ActionForm action={approveProposal} proposalId={proposalId} versionId={versionId} label="Approve" /><ActionForm action={approveProposal} proposalId={proposalId} versionId={versionId} label="Approve & issue" issueNow /></div>;
  if (status === PROPOSAL_STATUSES.APPROVED) return <ActionForm action={issueProposal} proposalId={proposalId} versionId={versionId} label="Issue quotation" />;
  return null;
}
