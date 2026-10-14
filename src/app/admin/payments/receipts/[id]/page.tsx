import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';
import { getReceiptDetail } from '@/lib/queries/payments';
import ReceiptDetail from '@/components/payments/receipt-detail';

export default async function AdminReceiptDetailPage(props: PageProps<'/admin/payments/receipts/[id]'>) {
  await requireRole(USER_ROLES.ADMIN);
  const { id } = await props.params;
  const receipt = await getReceiptDetail(id);
  if (!receipt) notFound();
  return <ReceiptDetail receipt={receipt} backHref="/admin/payments/receipts" />;
}
