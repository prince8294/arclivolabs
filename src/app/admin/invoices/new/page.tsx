import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import { InvoiceForm } from '@/components/billing/invoice-form';
import { requireRole } from '@/lib/auth/authorization';
import connectDB from '@/lib/db/mongoose';
import { getBillingSettings } from '@/lib/queries/invoices';
import { Client } from '@/models/Client';
import { Deal } from '@/models/Deal';
import { Project } from '@/models/Project';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Create Invoice',
  description: 'Create a new draft or installment invoice.',
};

interface CreateInvoicePageProps {
  searchParams: Promise<{
    dealId?: string;
    projectId?: string;
    clientId?: string;
  }>;
}

export default async function AdminCreateInvoicePage({ searchParams }: CreateInvoicePageProps) {
  await requireRole(USER_ROLES.ADMIN);
  await connectDB();

  const params = await searchParams;

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
        title="Create Invoice"
        description="Draft a professional invoice, milestone billing installment, or final bill."
        action={
          <Link
            href="/admin/invoices"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </Link>
        }
      />

      <InvoiceForm
        clients={clientOptions}
        deals={dealOptions}
        projects={projectOptions}
        defaultSettings={settings}
        preselectedClientId={params.clientId}
        preselectedDealId={params.dealId}
        preselectedProjectId={params.projectId}
      />
    </div>
  );
}
