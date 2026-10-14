import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import ClientForm from '@/components/admin/client-form';
import { requireRole } from '@/lib/auth/authorization';
import {
  listAssignableMarketingUsers,
} from '@/lib/queries/clients';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'New Client',
  description: 'Create a new client record.',
};

const EMPTY_CLIENT: Parameters<typeof ClientForm>[0]['initialValues'] = {
  type: '',
  name: '',
  companyName: '',
  email: '',
  phone: '',
  alternatePhone: '',
  website: '',
  billingLine1: '',
  billingLine2: '',
  billingCity: '',
  billingState: '',
  billingPostalCode: '',
  billingCountry: '',
  shippingLine1: '',
  shippingLine2: '',
  shippingCity: '',
  shippingState: '',
  shippingPostalCode: '',
  shippingCountry: '',
  taxId: '',
  assignedMarketingUserId: '',
  notes: '',
  status: '',
  source: '',
};

/**
 * /admin/clients/new
 *
 * Creates a client business record. Portal access is NOT created here;
 * the admin enables it later from the client detail page.
 */
export default async function AdminClientNewPage() {
  await requireRole(USER_ROLES.ADMIN);

  const marketingUsers = await listAssignableMarketingUsers();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="New Client"
        description="Create a new client record."
        action={
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to clients
          </Link>
        }
      />
      <ClientForm mode="create" initialValues={EMPTY_CLIENT} marketingUsers={marketingUsers} />
    </div>
  );
}