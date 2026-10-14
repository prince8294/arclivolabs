import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ClientForm from '@/components/admin/client-form';
import { requireRole } from '@/lib/auth/authorization';
import {
  getClientDetail,
  listAssignableMarketingUsers,
} from '@/lib/queries/clients';
import { notFound } from 'next/navigation';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Edit Client',
  description: 'Edit client details.',
};

interface AdminClientEditPageProps {
  params: Promise<{ id: string }>;
}

function clientDetailToFormValues(client: {
  type: string;
  name: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  alternatePhone: string | null;
  website: string | null;
  billingAddress: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  shippingAddress: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  taxId: string | null;
  assignedMarketingUserId: string | null;
  notes: string | null;
  status: string;
}) {
  return {
    type: client.type,
    name: client.name,
    companyName: client.companyName ?? '',
    email: client.email,
    phone: client.phone ?? '',
    alternatePhone: client.alternatePhone ?? '',
    website: client.website ?? '',
    billingLine1: client.billingAddress?.line1 ?? '',
    billingLine2: client.billingAddress?.line2 ?? '',
    billingCity: client.billingAddress?.city ?? '',
    billingState: client.billingAddress?.state ?? '',
    billingPostalCode: client.billingAddress?.postalCode ?? '',
    billingCountry: client.billingAddress?.country ?? '',
    shippingLine1: client.shippingAddress?.line1 ?? '',
    shippingLine2: client.shippingAddress?.line2 ?? '',
    shippingCity: client.shippingAddress?.city ?? '',
    shippingState: client.shippingAddress?.state ?? '',
    shippingPostalCode: client.shippingAddress?.postalCode ?? '',
    shippingCountry: client.shippingAddress?.country ?? '',
    taxId: client.taxId ?? '',
    assignedMarketingUserId: client.assignedMarketingUserId ?? '',
    notes: client.notes ?? '',
    status: client.status,
    source: '',
  };
}

/**
 * /admin/clients/[id]/edit
 */
export default async function AdminClientEditPage({
  params,
}: AdminClientEditPageProps) {
  await requireRole(USER_ROLES.ADMIN);

  const { id } = await params;
  const [client, marketingUsers] = await Promise.all([
    getClientDetail(id),
    listAssignableMarketingUsers(),
  ]);

  if (!client) {
    notFound();
  }

  const initialValues = clientDetailToFormValues({
    type: client.type,
    name: client.name,
    companyName: client.companyName,
    email: client.email,
    phone: client.phone,
    alternatePhone: client.alternatePhone,
    website: client.website,
    billingAddress: client.billingAddress,
    shippingAddress: client.shippingAddress,
    taxId: client.taxId,
    assignedMarketingUserId: client.assignedMarketingUserId,
    notes: client.notes,
    status: client.status,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Edit Client"
        description={`Update ${client.clientCode} · ${client.name}`}
        action={
          <Link
            href={`/admin/clients/${id}`}
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to client
          </Link>
        }
      />
      <ClientForm
        mode="edit"
        clientId={id}
        initialValues={initialValues}
        marketingUsers={marketingUsers}
      />
    </div>
  );
}