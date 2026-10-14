import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/authorization';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { USER_ROLES } from '@/types/auth';
import { getReceiptDetail } from '@/lib/queries/payments';
import ReceiptDetail from '@/components/payments/receipt-detail';

export default async function ClientReceiptDetailPage(props: PageProps<'/client/receipts/[id]'>) {
  await requireRole(USER_ROLES.CLIENT);
  const client = await requireClientProfile();
  const { id } = await props.params;
  const receipt = await getReceiptDetail(id, client.id);
  if (!receipt) notFound();
  return <ReceiptDetail receipt={receipt} backHref="/client/receipts" />;
}
