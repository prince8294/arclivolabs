import type { Metadata } from 'next';
import { Briefcase, Mail, Phone, User } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import RoleBadge from '@/components/shared/role-badge';
import StatCard from '@/components/dashboard/stat-card';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';
import { requireClientProfile } from '@/lib/auth/client-profile';

export const metadata: Metadata = {
  title: 'Client Dashboard',
  description: 'Overview of your account, profile and activity.',
};

export default async function ClientDashboardPage() {
  await requireRole(USER_ROLES.CLIENT);

  let profile;
  try {
    profile = await requireClientProfile();
  } catch {
    profile = null;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={profile ? `Welcome, ${profile.name}` : 'Dashboard'}
        description={
          profile
            ? `${profile.clientCode}${profile.companyName ? ` · ${profile.companyName}` : ''}`
            : 'Overview of your account, profile and activity.'
        }
        action={<RoleBadge role={USER_ROLES.CLIENT} />}
      />

      {profile && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Client Code"
            value={profile.clientCode}
            description="Your unique client ID"
            icon={Briefcase}
          />
          <StatCard
            title="Contact Email"
            value={profile.email}
            description="Primary email on file"
            icon={Mail}
          />
          <StatCard
            title="Phone"
            value={profile.phone ?? '—'}
            description="Primary phone"
            icon={Phone}
          />
          <StatCard
            title="Account Status"
            value={profile.status}
            description="Active"
            icon={User}
          />
        </div>
      )}

      {!profile && (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          No active client profile is linked to your account. Please contact support if you believe this is an error.
        </div>
      )}
    </div>
  );
}
