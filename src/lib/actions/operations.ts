'use server';

import { revalidatePath } from 'next/cache';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '@/lib/auth/authorization';
import { USER_ROLES } from '@/types/auth';
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUSES, type SupportCategory, type SupportPriority } from '@/lib/constants/enums';
import { generateSequentialCode } from '@/lib/db/generate-code';
import { Notification } from '@/models/Notification';
import { SupportTicket } from '@/models/SupportTicket';
import { SupportMessage } from '@/models/SupportMessage';
import { CompanySettings } from '@/models/CompanySettings';
import { User } from '@/models/User';
import { writeAudit } from '@/lib/audit/log';
import { createNotification } from '@/lib/notifications/create';

export interface OperationActionState { ok: boolean; error?: string; message?: string; id?: string }
const fail = (error: string): OperationActionState => ({ ok: false, error });
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const portalForRole = (role?: string) => [USER_ROLES.CLIENT, USER_ROLES.EMPLOYEE, USER_ROLES.MARKETING].includes(role as never) ? role!.toLowerCase() : 'client';

async function notifyAdmins(input: { type: string; title: string; message: string; ticketId: Types.ObjectId; key: string }) {
  const admins = await User.find({ role: USER_ROLES.ADMIN, status: 'ACTIVE' }).select('_id').lean();
  await Promise.all(admins.map((admin) => createNotification({ recipientUserId: admin._id, type: input.type, title: input.title, message: input.message, resourceType: 'SupportTicket', resourceId: input.ticketId, resourceUrl: `/admin/support/${input.ticketId}`, idempotencyKey: `${input.key}:${admin._id}` })));
}

export async function markNotificationRead(_previous: OperationActionState, form: FormData): Promise<OperationActionState> { const user = await requireAuth(); const id = text(form, 'notificationId'); if (!Types.ObjectId.isValid(id)) return fail('Invalid notification.'); const result = await Notification.updateOne({ _id: id, recipientUserId: new Types.ObjectId(user.id) }, { $set: { isRead: true, readAt: new Date() } }); if (!result.matchedCount) return fail('Notification not found.'); revalidatePath(`/${user.role.toLowerCase()}/notifications`); return { ok: true, message: 'Marked as read.' }; }
export async function markAllNotificationsRead(_previous?: OperationActionState, _form?: FormData): Promise<OperationActionState> { const user = await requireAuth(); await Notification.updateMany({ recipientUserId: new Types.ObjectId(user.id), isRead: false }, { $set: { isRead: true, readAt: new Date() } }); revalidatePath(`/${user.role.toLowerCase()}/notifications`); return { ok: true, message: 'All notifications marked as read.' }; }

export async function createSupportTicket(_previous: OperationActionState, form: FormData): Promise<OperationActionState> {
  const user = await requireAuth(); const title = text(form, 'title'); const description = text(form, 'description'); const category = text(form, 'category'); const priority = text(form, 'priority') || SUPPORT_PRIORITIES.MEDIUM;
  if (title.length < 3 || description.length < 5 || !Object.values(SUPPORT_CATEGORIES).includes(category as never) || !Object.values(SUPPORT_PRIORITIES).includes(priority as never)) return fail('Complete all ticket fields.');
  const ticketCode = await generateSequentialCode('support-ticket', 'TKT'); const now = new Date();
  const ticket = await SupportTicket.create({ ticketCode, title, description, category: category as SupportCategory, priority: priority as SupportPriority, status: SUPPORT_STATUSES.OPEN, createdBy: new Types.ObjectId(user.id), lastMessageAt: now, statusHistory: [{ fromStatus: null, toStatus: SUPPORT_STATUSES.OPEN, changedBy: new Types.ObjectId(user.id), at: now }] });
  await SupportMessage.create({ ticketId: ticket._id, authorUserId: new Types.ObjectId(user.id), body: description, isInternal: false });
  await writeAudit({ actorUserId: user.id, action: 'SUPPORT_TICKET_CREATED', resourceType: 'SupportTicket', resourceId: ticket._id, afterSummary: { ticketCode, category, priority } });
  if (user.role !== USER_ROLES.ADMIN) await notifyAdmins({ type: 'SUPPORT_TICKET_CREATED', title: 'New support ticket', message: `${ticketCode}: ${title}`, ticketId: ticket._id, key: `ticket-created:${ticket._id}` });
  revalidatePath(`/${user.role.toLowerCase()}/support`); revalidatePath('/admin/support'); return { ok: true, id: ticket._id.toString(), message: 'Support ticket created.' };
}

export async function replyToSupportTicket(_previous: OperationActionState, form: FormData): Promise<OperationActionState> {
  const user = await requireAuth(); const id = text(form, 'ticketId'); const body = text(form, 'body'); const isInternal = text(form, 'isInternal') === 'true';
  if (!Types.ObjectId.isValid(id) || body.length < 1) return fail('Enter a reply.'); const ticket = user.role === USER_ROLES.ADMIN ? await SupportTicket.findById(id) : await SupportTicket.findOne({ _id: id, createdBy: new Types.ObjectId(user.id) }); if (!ticket) return fail('Ticket not found or access denied.'); if (isInternal && user.role !== USER_ROLES.ADMIN) return fail('Only Admin can add internal notes.'); if (ticket.status === SUPPORT_STATUSES.CLOSED) return fail('Closed tickets cannot receive replies.');
  await SupportMessage.create({ ticketId: ticket._id, authorUserId: new Types.ObjectId(user.id), body, isInternal }); ticket.lastMessageAt = new Date();
  if (!isInternal) { const nextStatus = user.role === USER_ROLES.ADMIN ? SUPPORT_STATUSES.WAITING_FOR_USER : SUPPORT_STATUSES.IN_PROGRESS; if (ticket.status !== nextStatus) ticket.statusHistory.push({ fromStatus: ticket.status, toStatus: nextStatus, changedBy: new Types.ObjectId(user.id), reason: 'Status updated by conversation reply', at: new Date() }); ticket.status = nextStatus; }
  await ticket.save();
  if (user.role === USER_ROLES.ADMIN && !isInternal) { const creator = await User.findById(ticket.createdBy).select('role').lean(); await createNotification({ recipientUserId: ticket.createdBy, type: 'SUPPORT_TICKET_UPDATED', title: 'Support ticket updated', message: `${ticket.ticketCode} has a new reply.`, resourceType: 'SupportTicket', resourceId: ticket._id, resourceUrl: `/${portalForRole(creator?.role)}/support/${ticket._id}`, idempotencyKey: `ticket-reply:${ticket._id}:${ticket.lastMessageAt.getTime()}` }); }
  if (user.role !== USER_ROLES.ADMIN) await notifyAdmins({ type: 'SUPPORT_TICKET_REPLY', title: 'Support reply received', message: `${ticket.ticketCode} has a new reply.`, ticketId: ticket._id, key: `ticket-user-reply:${ticket._id}:${ticket.lastMessageAt.getTime()}` });
  revalidatePath('/admin/support'); revalidatePath(`/${user.role.toLowerCase()}/support/${id}`); return { ok: true, message: 'Reply added.' };
}

export async function updateSupportTicket(_previous: OperationActionState, form: FormData): Promise<OperationActionState> {
  const user = await requireRole(USER_ROLES.ADMIN); const id = text(form, 'ticketId'); const status = text(form, 'status'); const priority = text(form, 'priority');
  if (!Types.ObjectId.isValid(id) || !Object.values(SUPPORT_STATUSES).includes(status as never) || !Object.values(SUPPORT_PRIORITIES).includes(priority as never)) return fail('Invalid ticket update.'); const ticket = await SupportTicket.findById(id); if (!ticket) return fail('Ticket not found.'); const oldStatus = ticket.status; ticket.status = status as typeof ticket.status; ticket.priority = priority as typeof ticket.priority; ticket.assignedTo = text(form, 'assignedTo') && Types.ObjectId.isValid(text(form, 'assignedTo')) ? new Types.ObjectId(text(form, 'assignedTo')) : null; ticket.closedAt = status === SUPPORT_STATUSES.CLOSED ? new Date() : null; if (oldStatus !== status) ticket.statusHistory.push({ fromStatus: oldStatus, toStatus: status as typeof oldStatus, changedBy: new Types.ObjectId(user.id), reason: text(form, 'reason') || null, at: new Date() }); await ticket.save();
  await writeAudit({ actorUserId: user.id, action: 'SUPPORT_TICKET_UPDATED', resourceType: 'SupportTicket', resourceId: ticket._id, beforeSummary: { status: oldStatus }, afterSummary: { status, priority } }); const creator = await User.findById(ticket.createdBy).select('role').lean(); await createNotification({ recipientUserId: ticket.createdBy, type: 'SUPPORT_TICKET_UPDATED', title: 'Support ticket status updated', message: `${ticket.ticketCode} is now ${status}.`, resourceType: 'SupportTicket', resourceId: ticket._id, resourceUrl: `/${portalForRole(creator?.role)}/support/${ticket._id}`, idempotencyKey: `ticket-status:${ticket._id}:${ticket.updatedAt.getTime()}` }); revalidatePath('/admin/support'); return { ok: true, message: 'Ticket updated.' };
}

export async function reopenSupportTicket(_previous: OperationActionState, form: FormData): Promise<OperationActionState> {
  const user = await requireAuth(); const id = text(form, 'ticketId'); const reason = text(form, 'reason'); if (!Types.ObjectId.isValid(id) || reason.length < 3) return fail('Provide a reopening reason.'); const ticket = await SupportTicket.findOne({ _id: id, createdBy: new Types.ObjectId(user.id), status: SUPPORT_STATUSES.RESOLVED }); if (!ticket) return fail('Only your resolved ticket can be reopened. Closed tickets require Admin action.'); ticket.statusHistory.push({ fromStatus: ticket.status, toStatus: SUPPORT_STATUSES.OPEN, changedBy: new Types.ObjectId(user.id), reason, at: new Date() }); ticket.status = SUPPORT_STATUSES.OPEN; ticket.closedAt = null; ticket.lastMessageAt = new Date(); await ticket.save(); await SupportMessage.create({ ticketId: ticket._id, authorUserId: new Types.ObjectId(user.id), body: `Reopened: ${reason}`, isInternal: false }); await writeAudit({ actorUserId: user.id, action: 'SUPPORT_TICKET_REOPENED', resourceType: 'SupportTicket', resourceId: ticket._id, afterSummary: { reason } }); await notifyAdmins({ type: 'SUPPORT_TICKET_REOPENED', title: 'Support ticket reopened', message: `${ticket.ticketCode} was reopened.`, ticketId: ticket._id, key: `ticket-reopened:${ticket._id}:${ticket.updatedAt.getTime()}` }); revalidatePath(`/${user.role.toLowerCase()}/support/${id}`); revalidatePath('/admin/support'); return { ok: true, message: 'Ticket reopened.' };
}

export async function updateCompanySettings(_previous: OperationActionState, form: FormData): Promise<OperationActionState> {
  const user = await requireRole(USER_ROLES.ADMIN); const timezone = text(form, 'timezone'); const defaultCurrency = text(form, 'defaultCurrency').toUpperCase(); const workingDays = form.getAll('workingDays').map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6); const holidays = text(form, 'holidays').split(/[\s,]+/).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)); const employmentTypes = form.getAll('attendanceRequiredEmploymentTypes').map(String).filter((value) => ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].includes(value)); const attendanceGraceMinutes = Number(text(form, 'attendanceGraceMinutes') || '0');
  if (!timezone || !/^[A-Z]{3}$/.test(defaultCurrency) || workingDays.length === 0 || !Number.isInteger(attendanceGraceMinutes) || attendanceGraceMinutes < 0 || attendanceGraceMinutes > 240) return fail('Timezone, currency, working days and a valid grace period are required.'); try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { return fail('Enter a valid IANA timezone.'); }
  const logoUrl = text(form, 'logoUrl'); if (logoUrl && !/^https:\/\//i.test(logoUrl)) return fail('Logo URL must use HTTPS.'); const before = await CompanySettings.findOne({ key: 'primary' }).lean();
  const settings = await CompanySettings.findOneAndUpdate({ key: 'primary' }, { $set: { companyName: text(form, 'companyName') || 'Arclivo Labs', legalBusinessName: text(form, 'legalBusinessName') || text(form, 'companyName') || 'Arclivo Labs', logoUrl: logoUrl || null, businessEmail: text(form, 'businessEmail') || null, businessPhone: text(form, 'businessPhone') || null, website: text(form, 'website') || null, businessAddress: text(form, 'businessAddress') || null, documentFooter: text(form, 'documentFooter') || null, timezone, defaultCurrency, workingDays: [...new Set(workingDays)].sort(), workdayStart: text(form, 'workdayStart') || '09:00', workdayEnd: text(form, 'workdayEnd') || '18:00', holidays: [...new Set(holidays)].sort(), attendanceRequiredEmploymentTypes: [...new Set(employmentTypes)].sort(), attendanceGraceMinutes, leavePolicyNotes: text(form, 'leavePolicyNotes') || null, updatedBy: new Types.ObjectId(user.id) } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  await writeAudit({ actorUserId: user.id, action: 'SETTINGS_UPDATED', resourceType: 'CompanySettings', resourceId: settings._id, beforeSummary: before ? { timezone: before.timezone, defaultCurrency: before.defaultCurrency, workingDays: before.workingDays, attendanceGraceMinutes: before.attendanceGraceMinutes } : null, afterSummary: { timezone, defaultCurrency, workingDays: settings.workingDays, attendanceGraceMinutes, attendanceRequiredEmploymentTypes: employmentTypes } }); revalidatePath('/admin/settings'); return { ok: true, message: 'Company settings updated.' };
}
