import Link from 'next/link';
import { Types } from 'mongoose';
import { Notification } from '@/models/Notification';
import PageHeader from '@/components/ui/page-header';
import Card, { CardContent } from '@/components/ui/card';
import ActionForm from '@/components/management/action-form';
import ButtonLink from '@/components/ui/button-link';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/operations';
import { formatDateTime } from '@/lib/utils/format';

const PAGE_SIZE = 25;

export default async function NotificationPage({ userId, page = 1 }: { userId: string; page?: number }) {
  const safePage = Math.max(1, Math.trunc(page));
  const filter = { recipientUserId: new Types.ObjectId(userId) };
  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((safePage - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, isRead: false }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <div className="space-y-6">
    <PageHeader title="Notifications" description={`${unread} unread · ${total} total`} action={unread > 0 ? <ActionForm action={markAllNotificationsRead} submitLabel="Mark all read" className="">{null}</ActionForm> : undefined} />
    {rows.length === 0 && <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No notifications.</p>}
    {rows.map((row) => <Card key={row._id.toString()} className={row.isRead ? 'opacity-70' : ''}><CardContent className="flex items-start justify-between gap-4 pt-6"><div><p className="font-medium">{row.title}</p><p className="text-sm text-muted-foreground">{row.message}</p><div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground"><span>{formatDateTime(row.createdAt)}</span>{row.resourceUrl && <Link href={row.resourceUrl} className="font-medium text-primary hover:underline">Open</Link>}</div></div>{!row.isRead && <ActionForm action={markNotificationRead} submitLabel="Mark read" className=""><input type="hidden" name="notificationId" value={row._id.toString()} /></ActionForm>}</CardContent></Card>)}
    {totalPages > 1 && <div className="flex items-center justify-between"><ButtonLink href={`?page=${Math.max(1, safePage - 1)}`} variant="outline" aria-disabled={safePage <= 1}>Previous</ButtonLink><span className="text-sm text-muted-foreground">Page {safePage} of {totalPages}</span><ButtonLink href={`?page=${Math.min(totalPages, safePage + 1)}`} variant="outline" aria-disabled={safePage >= totalPages}>Next</ButtonLink></div>}
  </div>;
}
