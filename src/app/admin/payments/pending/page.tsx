import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';
import PaymentListPage from '@/components/payments/payment-list-page';
export default async function PendingPaymentsPage(props: PageProps<'/admin/payments/pending'>) { await requireRole(USER_ROLES.ADMIN); return <PaymentListPage title="Pending Payments" description="Submitted and under-review claims awaiting bank-side confirmation." search={await props.searchParams} fixedStatus="PENDING_QUEUE" />; }
