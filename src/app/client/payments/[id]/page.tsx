import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/authorization';
import { requireClientProfile } from '@/lib/auth/client-profile';
import { USER_ROLES } from '@/types/auth';
import { getPaymentDetail } from '@/lib/queries/payments';
import PageHeader from '@/components/ui/page-header';
import Card, { CardContent } from '@/components/ui/card';
import { formatMinor } from '@/lib/utils/money';

export default async function ClientPaymentDetail(props: PageProps<'/client/payments/[id]'>) {
  await requireRole(USER_ROLES.CLIENT);
  const client = await requireClientProfile();
  const { id } = await props.params;
  const payment = await getPaymentDetail(id, client.id);
  if (!payment) notFound();
  return <div className="space-y-6"><PageHeader title={payment.paymentCode} description="Payment submission and verification status." /><Card><CardContent className="space-y-2 pt-6 text-sm"><p><b>Amount:</b> {formatMinor(payment.amountMinor, payment.currency)}</p><p><b>Reference:</b> {payment.reference}</p><p><b>Status:</b> {payment.status}</p><p><b>Submitted:</b> {payment.submittedAt}</p>{payment.rejectionReason && <p><b>Rejection reason:</b> {payment.rejectionReason}</p>}{payment.receipt && <a className="text-primary underline" href={`/api/receipts/${payment.receipt.id}/pdf`}>Download {payment.receipt.receiptCode}</a>}</CardContent></Card></div>;
}
