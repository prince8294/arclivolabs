import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import EmployeeForm from '@/components/admin/employee-form';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';
import { DEFAULT_CURRENCY } from '@/lib/constants/enums';

export const metadata: Metadata = {
  title: 'Add Employee',
  description: 'Create an employee account and profile.',
};

const EMPTY_EMPLOYEE: Parameters<typeof EmployeeForm>[0]['initialValues'] = {
  name: '',
  email: '',
  phone: '',
  department: '',
  designation: '',
  employmentType: '',
  joiningDate: new Date().toISOString().slice(0, 10),
  paymentType: '',
  baseAmount: '',
  currency: DEFAULT_CURRENCY,
  skills: '',
  address: '',
  emergencyContact: '',
  notes: '',
};

/**
 * /admin/employees/new
 *
 * One workflow creates both the User account (role EMPLOYEE, active,
 * mustChangePassword) and the Employee profile, atomically. After
 * success the admin lands on the new employee's detail page.
 */
export default async function NewEmployeePage() {
  await requireRole(USER_ROLES.ADMIN);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Add Employee"
        description="Creates the login account and the employee profile together."
        action={
          <Link
            href="/admin/employees"
            className="inline-flex items-center gap-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to employees
          </Link>
        }
      />
      <EmployeeForm mode="create" initialValues={EMPTY_EMPLOYEE} />
    </div>
  );
}
