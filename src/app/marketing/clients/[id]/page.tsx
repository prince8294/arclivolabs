import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { notFound } from 'next/navigation';

import PageHeader from '@/components/ui/page-header';
import StatusBadge from '@/components/admin/status-badge';
import DetailList from '@/components/admin/detail-list';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireRole } from '@/lib/auth/authorization';
import { ROUTES } from '@/lib/constants/routes';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import {
  CLIENT_SOURCE_LABELS,
  CLIENT_TYPE_LABELS,
} from '@/lib/constants/enums';
import { getAssignedClientDetail } from '@/lib/queries/clients';
import { USER_ROLES, type AuthUser } from '@/types/auth';
import { getCurrentUser } from '@/lib/auth/current-user';

export const metadata: Metadata = {
  title: 'Client',
  description: 'Client details.',
};

interface MarketingClientDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MarketingClientDetailPage({
  params,
  searchParams,
}: MarketingClientDetailPageProps) {
  const authUser = await requireRole(USER_ROLES.MARKETING);
  const currentUser = authUser as AuthUser;

  const { id } = await params;
  const search = await searchParams;

  const client = await getAssignedClientDetail(id, currentUser.id);

  if (!client) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${client.clientCode} · ${client.name}`}
        description={client.companyName ?? 'Client detail'}
        action={
          <Link
            href={ROUTES.MARKETING.CLIENTS}
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to clients
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Client type, source and status.</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: 'Client code', value: <span className="font-mono text-xs">{client.clientCode}</span> },
                { label: 'Type', value: CLIENT_TYPE_LABELS[client.type] },
                { label: 'Source', value: CLIENT_SOURCE_LABELS[client.source] ?? client.source },
                { label: 'Status', value: <StatusBadge status={client.status} /> },
                { label: 'Created', value: formatDate(client.createdAt) },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>Primary contact details.</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: 'Name', value: client.name },
                { label: 'Company', value: client.companyName ?? '—' },
                { label: 'Email', value: client.email },
                { label: 'Phone', value: client.phone ?? '—' },
                { label: 'Alternate phone', value: client.alternatePhone ?? '—' },
                {
                  label: 'Website',
                  value: client.website ? (
                    <a href={client.website} target="_blank" rel="noreferrer noopener" className="hover:underline">
                      {client.website}
                    </a>
                  ) : (
                    '—'
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {client.originLeadId && (
        <Card>
          <CardHeader>
            <CardTitle>Pre-sales history</CardTitle>
            <CardDescription>Lead this client was converted from.</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                {
                  label: 'Original lead',
                  value: (
                    <Link
                      href={`/admin/crm/leads/${client.originLeadId}`}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      View Lead
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  ),
                },
                { label: 'Converted date', value: formatDate(client.createdAt) },
              ]}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Communications and meetings are preserved on the original Lead record.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}