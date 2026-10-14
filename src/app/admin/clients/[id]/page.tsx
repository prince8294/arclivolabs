import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { notFound } from 'next/navigation';

import PageHeader from '@/components/ui/page-header';
import StatusBadge from '@/components/admin/status-badge';
import DetailList from '@/components/admin/detail-list';
import PortalAccessSection from '@/components/admin/portal-access-section';
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
  CLIENT_STATUS_LABELS,
  CLIENT_TYPE_LABELS,
} from '@/lib/constants/enums';
import { getClientDetail } from '@/lib/queries/clients';
import { getClientBillingSummary } from '@/lib/queries/invoices';
import { formatMinor } from '@/lib/utils/money';
import { InvoiceStatusBadge, InvoicePaymentStatusBadge } from '@/components/billing/invoice-badges';
import ButtonLink from '@/components/ui/button-link';

import { ROLE_LABELS } from '@/types/auth';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Client',
  description: 'Client details, contact information and portal access.',
};

interface AdminClientDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminClientDetailPage({
  params,
  searchParams,
}: AdminClientDetailPageProps) {
  await requireRole(USER_ROLES.ADMIN);

  const { id } = await params;
  const search = await searchParams;
  const notice = typeof search.notice === 'string' ? search.notice : undefined;

  const [client, billingSummary] = await Promise.all([
    getClientDetail(id),
    getClientBillingSummary(id),
  ]);

  if (!client) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${client.clientCode} · ${client.name}`}
        description={client.companyName ?? 'Client detail'}
        action={
          <div className="flex items-center gap-3">
            <ButtonLink
              href={`/admin/invoices/new?clientId=${client.id}`}
              variant="primary"
              size="sm"
            >
              Create Invoice
            </ButtonLink>
            <StatusBadge status={client.status} />
            <Link
              href={`${ROUTES.ADMIN.CLIENTS}`}
              className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to clients
            </Link>
          </div>
        }
      />

      {notice === 'created' && (
        <div className="flex items-start gap-x-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <p>Client created successfully with code <span className="font-mono">{client.clientCode}</span>.</p>
        </div>
      )}

      {notice === 'converted' && (
        <div className="flex items-start gap-x-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <p>Lead converted to client <span className="font-mono">{client.clientCode}</span>.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Client code, type, source and ownership.</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: 'Client code', value: <span className="font-mono text-xs">{client.clientCode}</span> },
                { label: 'Type', value: CLIENT_TYPE_LABELS[client.type] },
                { label: 'Source', value: CLIENT_SOURCE_LABELS[client.source] ?? client.source },
                { label: 'Status', value: <StatusBadge status={client.status} /> },
                { label: 'Assigned marketing', value: client.assignedMarketingName ?? '—' },
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

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>Used for future invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailList
            items={[
              {
                label: 'Billing address',
                value: client.billingAddress
                  ? [client.billingAddress.line1, client.billingAddress.line2, client.billingAddress.city, client.billingAddress.state, client.billingAddress.postalCode, client.billingAddress.country].filter(Boolean).join(', ') || '—'
                  : '—',
              },
              {
                label: 'Shipping address',
                value: client.shippingAddress
                  ? [client.shippingAddress.line1, client.shippingAddress.line2, client.shippingAddress.city, client.shippingAddress.state, client.shippingAddress.postalCode, client.shippingAddress.country].filter(Boolean).join(', ') || '—'
                  : '—',
              },
              { label: 'Tax ID', value: client.taxId ?? '—' },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portal access</CardTitle>
          <CardDescription>Client login account and status.</CardDescription>
        </CardHeader>
        <CardContent>
          <PortalAccessSection
            clientId={client.id}
            hasPortalAccess={client.hasPortalAccess}
            portalEmail={client.portalEmail}
            portalStatus={client.portalStatus}
          />
        </CardContent>
      </Card>

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

      {/* Billing Summary Section (§52) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Billing & Invoices</CardTitle>
            <CardDescription>Issued invoices and active receivables for this client.</CardDescription>
          </div>
          <ButtonLink
            href={`/admin/invoices/new?clientId=${client.id}`}
            variant="outline"
            size="sm"
          >
            Create Invoice
          </ButtonLink>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <span className="text-xs uppercase font-semibold text-muted-foreground block">
                Issued Invoices
              </span>
              <span className="text-xl font-bold font-mono text-foreground">
                {billingSummary?.issuedInvoicesCount ?? 0}
              </span>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <span className="text-xs uppercase font-semibold text-muted-foreground block">
                Total Invoiced (INR)
              </span>
              <span className="text-xl font-bold font-mono text-primary">
                {formatMinor(billingSummary?.totalInvoicedMinor ?? 0, 'INR')}
              </span>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <span className="text-xs uppercase font-semibold text-muted-foreground block">
                Current Outstanding
              </span>
              <span className="text-xl font-bold font-mono text-foreground">
                {formatMinor(billingSummary?.currentOutstandingMinor ?? 0, 'INR')}
              </span>
            </div>
          </div>

          {billingSummary?.invoices && billingSummary.invoices.length > 0 ? (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <th className="p-2.5">Invoice</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5 text-right">Amount</th>
                    <th className="p-2.5">Due Date</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {billingSummary.invoices.map((inv: any) => (
                    <tr key={inv._id} className="hover:bg-muted/20">
                      <td className="p-2.5 font-mono font-medium">
                        <Link href={`/admin/invoices/${inv._id}`} className="text-primary hover:underline">
                          {inv.invoiceNumber || inv.invoiceCode}
                        </Link>
                      </td>
                      <td className="p-2.5">{inv.invoiceType}</td>
                      <td className="p-2.5 text-right font-mono font-medium">
                        {formatMinor(inv.totalMinor, inv.currency)}
                      </td>
                      <td className="p-2.5 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1">
                          <InvoiceStatusBadge status={inv.status} />
                          <InvoicePaymentStatusBadge status={inv.paymentStatus} />
                        </div>
                      </td>
                      <td className="p-2.5 text-right">
                        <Link href={`/admin/invoices/${inv._id}`} className="text-primary hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No invoices generated for this client yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Internal notes only.</CardDescription>
        </CardHeader>
        <CardContent>
          {client.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{client.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes recorded.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System information</CardTitle>
          <CardDescription>Audit fields.</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailList
            items={[
              {
                label: 'Created by',
                value: client.createdBy ? `${client.createdBy.name} · ${ROLE_LABELS[client.createdBy.role]}` : '—',
              },
              { label: 'Created at', value: formatDateTime(client.createdAt) },
              {
                label: 'Updated by',
                value: client.updatedBy ? client.updatedBy.name : '—',
              },
              { label: 'Updated at', value: formatDateTime(client.updatedAt) },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}