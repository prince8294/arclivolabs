import type { Metadata } from 'next';
import Link from 'next/link';

import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { PROJECT_STATUS_LABELS } from '@/lib/constants/enums';
import { listClientProjects } from '@/lib/queries/client-portal';
import { formatDate } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'My Projects' };
export default async function ClientProjectsPage() { await requireRole(USER_ROLES.CLIENT); const profile = await requireClientProfile(); const projects = await listClientProjects(profile.id); return <div className="flex flex-col gap-6"><PageHeader title="My Projects" description="Delivery progress, files and published deliverables for your projects." />{projects.length === 0 ? <EmptyState title="No projects yet" description="Projects will appear here after the commercial agreement is finalized." /> : <div className="grid gap-4 md:grid-cols-2">{projects.map((project) => <article key={project.id} className="rounded-lg border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">{project.projectCode}</p><h2 className="mt-1 font-semibold">{project.title}</h2></div><Badge>{PROJECT_STATUS_LABELS[project.status]}</Badge></div><p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{project.description ?? 'No description.'}</p><div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span>Progress</span><span>{project.progressPercentage}%</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${project.progressPercentage}%` }} /></div></div><p className="mt-3 text-xs text-muted-foreground">Target: {project.expectedEndDate ? formatDate(project.expectedEndDate) : 'Not set'}</p><div className="mt-4 flex gap-4 text-sm"><Link href={`/client/projects/${project.id}/files`} className="font-medium text-primary hover:underline">Files</Link><Link href={`/client/projects/${project.id}/deliverables`} className="font-medium text-primary hover:underline">Deliverables</Link></div></article>)}</div>}</div>; }
