import type { Metadata } from 'next';

import PageHeader from '@/components/ui/page-header';
import ClientProfileForm from '@/components/client/client-profile-form';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { USER_ROLES } from '@/types/auth';
import { requireRole } from '@/lib/auth/authorization';

export const metadata: Metadata = {
  title: 'My Profile',
  description: 'Update your profile and contact information.',
};

export default async function ClientProfilePage() {
  await requireRole('CLIENT');

  const profile = await requireClientProfile();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="My Profile"
        description="Update your contact information."
      />
      <ClientProfileForm
        initialValues={{
          name: profile.name,
          phone: profile.phone ?? '',
          alternatePhone: profile.alternatePhone ?? '',
          website: profile.website ?? '',
        }}
      />
    </div>
  );
}