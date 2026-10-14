import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

import PageHeader from '@/components/ui/page-header';
import EmployeeForm, {
  type EmployeeFormValues,
} from '@/components/admin/employee-form';
import { getEmployeeDetail } from '@/lib/queries/admin-users';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Edit Employee',
  description: 'Update an employee account and profile.',
};

/**
 * /admin/employees/[id]/edit
 *
 * Pre-fills from the existing records. The email is the login
 * identifier: changes are normalized and re-checked for global
 * uniqueness server-side. Role cannot be changed from this screen.
 */
export default async function EditEmployeePage(
  props: PageProps<'/admin/employees/[id]/edit'>
) {
  await requireRole(USER_ROLES.ADMIN);

  const { id } = await props.params;
  const detail = await getEmployeeDetail(id);

  if (!detail) {
    notFound();
  }

  const initialValues: EmployeeFormValues = {
    name: detail.name,
    email: detail.email,
    phone: detail.phone ?? '',
    department: detail.department,
    designation: detail.designation,
    employmentType: detail.employmentType,
    joiningDate: detail.joiningDate.toISOString().slice(0, 10),
    paymentType: detail.paymentType,
    baseAmount: detail.baseAmount !== null ? String(detail.baseAmount) : '',
    currency: detail.currency,
    skills: detail.skills.join(', '),
    address: detail.address ?? '',
    emergencyContact: detail.emergencyContact ?? '',
    notes: detail.notes ?? '',
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Edit Employee"
        description={`Changes apply immediately. ${detail.employeeCode} · ${detail.name}`}
        action={
          <Link
            href={`/admin/employees/${detail.userId}`}
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to details
          </Link>
        }
      />
      <EmployeeForm
        mode="edit"
        userId={detail.userId}
        initialValues={initialValues}
      />
    </div>
  );
}
