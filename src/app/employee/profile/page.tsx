import type { Metadata } from 'next';

import DetailList from '@/components/admin/detail-list';
import Badge from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/ui/page-header';
import { requireRole } from '@/lib/auth/authorization';
import connectDB from '@/lib/db/mongoose';
import { Employee } from '@/models/Employee';
import { formatDate } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = { title: 'My Profile' };
export default async function EmployeeProfilePage() { const user = await requireRole(USER_ROLES.EMPLOYEE); await connectDB(); const employee = await Employee.findOne({ userId: user.id }).populate('managerId', 'employeeCode designation').lean().exec(); return <div className="mx-auto flex w-full max-w-4xl flex-col gap-6"><PageHeader title="My Profile" description="Employment details linked to your account." />{!employee ? <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No employee profile is linked to this account. Contact Admin.</div> : <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>{employee.employeeCode}</CardTitle><Badge>{employee.status}</Badge></div></CardHeader><CardContent><DetailList items={[{ label: 'Name', value: user.name }, { label: 'Email', value: user.email }, { label: 'Department', value: employee.department }, { label: 'Designation', value: employee.designation }, { label: 'Employment type', value: employee.employmentType }, { label: 'Joining date', value: formatDate(employee.joiningDate) }, { label: 'Skills', value: employee.skills.join(', ') || '—' }, { label: 'Address', value: employee.address ?? '—' }, { label: 'Emergency contact', value: employee.emergencyContact ?? '—' }]} /></CardContent></Card>}</div>; }
