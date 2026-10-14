import type { Metadata } from 'next';

import RequirementForm from '@/components/client/requirement-form';
import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { CLIENT_REQUIREMENT_STATUS_LABELS } from '@/lib/constants/enums';
import { listClientProjects, listClientRequirements } from '@/lib/queries/client-portal';
import { formatDate } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'Requirements' };
export default async function ClientRequirementsPage() { await requireRole(USER_ROLES.CLIENT); const profile = await requireClientProfile(); const [requirements, projects] = await Promise.all([listClientRequirements(profile.id), listClientProjects(profile.id)]); return <div className="flex flex-col gap-6"><PageHeader title="Requirements" description="Submit project requirements and track review status." /><RequirementForm projects={projects.map(({ id, projectCode, title }) => ({ id, projectCode, title }))} />{requirements.length === 0 ? <EmptyState title="No requirements submitted" description="Use the form above to send the first project requirement." /> : <div className="space-y-3">{requirements.map((item) => <article key={item.id} className="rounded-lg border border-border bg-card p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">{item.requirementCode} · {item.projectCode}</p><h2 className="mt-1 font-semibold">{item.title}</h2></div><Badge>{CLIENT_REQUIREMENT_STATUS_LABELS[item.status]}</Badge></div><p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>{item.reviewNotes && <p className="mt-3 rounded-md bg-muted p-3 text-sm"><strong>Review notes:</strong> {item.reviewNotes}</p>}<p className="mt-3 text-xs text-muted-foreground">Submitted {formatDate(item.createdAt)} · {item.fileCount} attachment(s)</p></article>)}</div>}</div>; }
