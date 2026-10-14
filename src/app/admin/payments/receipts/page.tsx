import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';
import ReceiptListPage from '@/components/payments/receipt-list-page';

export default async function AdminReceiptsPage(props: PageProps<'/admin/payments/receipts'>) {
  await requireRole(USER_ROLES.ADMIN);
  return <ReceiptListPage search={await props.searchParams} basePath="/admin/payments/receipts" />;
}
