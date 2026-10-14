import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';
import PaymentListPage from '@/components/payments/payment-list-page';
export default async function AdminPaymentsPage(props: PageProps<'/admin/payments'>) { await requireRole(USER_ROLES.ADMIN); return <PaymentListPage search={await props.searchParams} showSummary />; }
