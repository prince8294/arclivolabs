import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, AlertCircle } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import { InvoiceForm } from '@/components/billing/invoice-form';
import { requireRole } from '@/lib/auth/authorization';
import { INVOICE_STATUSES } from '@/lib/constants/enums';
import connectDB from '@/lib/db/mongoose';
import { getBillingSettings, getInvoiceById } from '@/lib/queries/invoices';
import { Client } from '@/models/Client';
import { Deal } from '@/models/Deal';
import { Project } from '@/models/Project';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Edit Draft Invoice',
  description: 'Modify draft invoice line items and terms.',
};

interface EditInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditInvoicePage({ params }: EditInvoicePageProps) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await params;

  const invoice = await getInvoiceById(id);
  if (!invoice) {
    notFound();
  }

  // Immutable rule: issued invoices cannot be edited
  if (invoice.status !== INVOICE_STATUSES.DRAFT) {
    redirect(`/admin/invoices/${id}`);
  }

  await connectDB();

  const [clients, deals, projects, settings] = await Promise.all([
    Client.find({ status: 'ACTIVE' })
      .select('name companyName clientCode')
      .sort({ name: 1 })
      .lean()
      .exec(),
    Deal.find()
      .select('dealCode title clientId agreedAmountMinor currency paymentPlanSnapshot')
      .sort({ createdAt: -1 })
      .lean()
      .exec(),
    Project.find()
      .select('projectCode title clientId dealId')
      .sort({ createdAt: -1 })
      .lean()
      .exec(),
    getBillingSettings(),
  ]);

  const clientOptions = clients.map((c: any) => ({
    id: c._id.toString(),
    name: c.name,
    companyName: c.companyName || null,
    clientCode: c.clientCode,
  }));

  const dealOptions = deals.map((d: any) => ({
    id: d._id.toString(),
    dealCode: d.dealCode,
    title: d.title,
    clientId: d.clientId ? d.clientId.toString() : null,
    agreedAmountMinor: d.agreedAmountMinor,
    currency: d.currency,
    paymentPlanSnapshot: (d.paymentPlanSnapshot || []).map((m: any) => ({
      name: m.name,
      amountMinor: m.amountMinor,
      condition: m.condition || null,
      dueDate: m.dueDate ? m.dueDate.toISOString() : null,
      sequence: m.sequence,
    })),
  }));

  const projectOptions = projects.map((p: any) => ({
    id: p._id.toString(),
    projectCode: p.projectCode,
    title: p.title,
    clientId: p.clientId.toString(),
    dealId: p.dealId ? p.dealId.toString() : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit Draft ${invoice.invoiceCode}`}
        description="Adjust quantities, line items, and terms before issuance."
        action={
          <Link
            href={`/admin/invoices/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoice
          </Link>
        }
      />

      <InvoiceForm
        initialData={invoice}
        isEdit={true}
        clients={clientOptions}
        deals={dealOptions}
        projects={projectOptions}
        defaultSettings={settings}
      />
    </div>
  );
}
