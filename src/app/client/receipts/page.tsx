import { requireRole } from '@/lib/auth/authorization';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { USER_ROLES } from '@/types/auth';
import ReceiptListPage from '@/components/payments/receipt-list-page';

export default async function ClientReceiptsPage(props: PageProps<'/client/receipts'>) {
  await requireRole(USER_ROLES.CLIENT);
  const client = await requireClientProfile();
  return <ReceiptListPage search={await props.searchParams} clientId={client.id} basePath="/client/receipts" />;
}
