'use client';

import { useActionState } from 'react';

import Button from '@/components/ui/button';
import { decideClientApproval, type ClientPortalActionState } from '@/lib/actions/client-portal';
import { CLIENT_APPROVAL_STATUSES } from '@/lib/constants/enums';

const initial: ClientPortalActionState = { ok: false };
export default function ApprovalDecisionForm({ approvalId }: { approvalId: string }) {
  const [state, action, pending] = useActionState(decideClientApproval, initial);
  return <form action={action} className="mt-4 space-y-3 border-t border-border pt-4"><input type="hidden" name="approvalId" value={approvalId} />{state.error && <p className="text-xs text-destructive">{state.error}</p>}{state.ok && <p className="text-xs text-success">{state.message}</p>}<textarea name="feedbackNotes" maxLength={2000} rows={2} placeholder="Feedback (required for reject or revision request)" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><div className="flex flex-wrap gap-2"><Button name="decision" value={CLIENT_APPROVAL_STATUSES.APPROVED} size="sm" disabled={pending}>Approve</Button><Button name="decision" value={CLIENT_APPROVAL_STATUSES.REVISION_REQUESTED} variant="outline" size="sm" disabled={pending}>Request revision</Button><Button name="decision" value={CLIENT_APPROVAL_STATUSES.REJECTED} variant="danger" size="sm" disabled={pending}>Reject</Button></div></form>;
}
