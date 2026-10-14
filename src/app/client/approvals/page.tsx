import type { Metadata } from 'next';
import Link from 'next/link';

import ApprovalDecisionForm from '@/components/client/approval-decision-form';
import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { CLIENT_APPROVAL_STATUSES, CLIENT_APPROVAL_STATUS_LABELS } from '@/lib/constants/enums';
import { listClientApprovals } from '@/lib/queries/client-portal';
import { formatDateTime } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Approvals' };
export default async function ClientApprovalsPage() { await requireRole(USER_ROLES.CLIENT); const profile = await requireClientProfile(); const approvals = await listClientApprovals(profile.id); return <div className="flex flex-col gap-6"><PageHeader title="Approvals" description="Review exact file versions shared for your decision." />{approvals.length === 0 ? <EmptyState title="No approval requests" description="Items published for approval will appear here." /> : <div className="space-y-4">{approvals.map((item) => <article key={item.id} className="rounded-lg border border-border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">{item.approvalCode} · {item.projectCode}</p><h2 className="mt-1 font-semibold">{item.title}</h2></div><Badge>{CLIENT_APPROVAL_STATUS_LABELS[item.status]}</Badge></div>{item.description && <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>}<div className="mt-4 flex flex-wrap gap-4 text-sm"><Link href={`/api/files/${item.fileAssetId}/versions/${item.fileVersionNumber}/download`} className="font-medium text-primary hover:underline">Download version {item.fileVersionNumber}</Link><span className="text-muted-foreground">Requested {formatDateTime(item.createdAt)}</span></div>{item.feedbackNotes && <p className="mt-3 rounded-md bg-muted p-3 text-sm"><strong>Your feedback:</strong> {item.feedbackNotes}</p>}{item.status === CLIENT_APPROVAL_STATUSES.PENDING && <ApprovalDecisionForm approvalId={item.id} />}</article>)}</div>}</div>; }
