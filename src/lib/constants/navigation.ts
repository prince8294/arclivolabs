import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Calendar,
  CalendarCheck,
  CalendarX,
  ChartColumn,
  CircleCheck,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  FolderKanban,
  Handshake,
  FolderOpen,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  Receipt,
  Settings,
  SquareCheck,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { USER_ROLES, type UserRole } from '@/types/auth';
import { ROUTES } from './routes';

export interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  children?: Array<{ title: string; href: string }>;
}

export const ADMIN_NAVIGATION: NavigationItem[] = [
  { title: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD, icon: LayoutDashboard },
  { title: 'CRM', href: ROUTES.ADMIN.CRM, icon: Users },
  { title: 'Clients', href: ROUTES.ADMIN.CLIENTS, icon: Briefcase },
  { title: 'Employees', href: ROUTES.ADMIN.EMPLOYEES, icon: UserCheck },
  { title: 'Attendance', href: ROUTES.ADMIN.ATTENDANCE, icon: CalendarCheck },
  { title: 'Leave Requests', href: ROUTES.ADMIN.LEAVES, icon: CalendarX },
  { title: 'Work Reports', href: ROUTES.ADMIN.WORK_REPORTS, icon: ClipboardList },
  { title: 'Employee Payments', href: ROUTES.ADMIN.EMPLOYEE_PAYMENTS, icon: Wallet },
  { title: 'Marketing Team', href: ROUTES.ADMIN.MARKETING, icon: Megaphone },
  { title: 'Projects', href: ROUTES.ADMIN.PROJECTS, icon: FolderKanban },
  {
    title: 'Tasks',
    href: ROUTES.ADMIN.TASKS,
    icon: SquareCheck,
    children: [
      { title: 'All Tasks', href: ROUTES.ADMIN.TASKS },
      { title: 'Task Board', href: ROUTES.ADMIN.TASKS_BOARD },
      { title: 'Overdue', href: ROUTES.ADMIN.TASKS_OVERDUE },
      { title: 'Pending Review', href: ROUTES.ADMIN.TASKS_REVIEW },
      { title: 'Completed', href: ROUTES.ADMIN.TASKS_COMPLETED },
    ],
  },
  { title: 'Proposals', href: ROUTES.ADMIN.PROPOSALS, icon: FileText },
  { title: 'Deals', href: ROUTES.ADMIN.DEALS, icon: Handshake },
  {
    title: 'Billing & Invoices',
    href: ROUTES.ADMIN.BILLING,
    icon: Receipt,
    children: [
      { title: 'Billing Overview', href: ROUTES.ADMIN.BILLING },
      { title: 'All Invoices', href: ROUTES.ADMIN.INVOICES },
      { title: 'Create Invoice', href: ROUTES.ADMIN.INVOICES_NEW },
      { title: 'Draft Invoices', href: `${ROUTES.ADMIN.INVOICES}?status=DRAFT` },
      { title: 'Issued Invoices', href: `${ROUTES.ADMIN.INVOICES}?status=ISSUED` },
      { title: 'Overdue Invoices', href: `${ROUTES.ADMIN.INVOICES}?overdue=true` },
      { title: 'Billing Schedules', href: ROUTES.ADMIN.BILLING_SCHEDULES },
      { title: 'Billing Settings', href: ROUTES.ADMIN.BILLING_SETTINGS },
    ],
  },
  { title: 'Communication', href: ROUTES.ADMIN.COMMUNICATION, icon: MessageSquare },
  { title: 'Files', href: ROUTES.ADMIN.FILES, icon: FolderOpen },
  { title: 'Commissions', href: ROUTES.ADMIN.COMMISSIONS, icon: DollarSign },
  { title: 'Support', href: ROUTES.ADMIN.SUPPORT, icon: LifeBuoy },
  { title: 'Audit Logs', href: ROUTES.ADMIN.AUDIT_LOGS, icon: ClipboardList },
  { title: 'Analytics', href: ROUTES.ADMIN.ANALYTICS, icon: TrendingUp },
  { title: 'Reports', href: ROUTES.ADMIN.REPORTS, icon: ChartColumn },
  { title: 'Settings', href: ROUTES.ADMIN.SETTINGS, icon: Settings },
];

export const MARKETING_NAVIGATION: NavigationItem[] = [
  { title: 'Dashboard', href: ROUTES.MARKETING.DASHBOARD, icon: LayoutDashboard },
  { title: 'Leads', href: ROUTES.MARKETING.LEADS, icon: UserPlus },
  { title: 'Follow-ups', href: ROUTES.MARKETING.FOLLOWUPS, icon: Clock },
  { title: 'Meetings', href: ROUTES.MARKETING.MEETINGS, icon: Calendar },
  { title: 'Clients', href: ROUTES.MARKETING.CLIENTS, icon: Briefcase },
  { title: 'Proposals', href: ROUTES.MARKETING.PROPOSALS, icon: FileText },
  { title: 'Communication', href: ROUTES.MARKETING.COMMUNICATION, icon: MessageSquare },
  { title: 'Commission', href: ROUTES.MARKETING.COMMISSION, icon: DollarSign },
  { title: 'Performance', href: ROUTES.MARKETING.PERFORMANCE, icon: TrendingUp },
  { title: 'Notifications', href: ROUTES.MARKETING.NOTIFICATIONS, icon: MessageSquare },
  { title: 'Support', href: ROUTES.MARKETING.SUPPORT, icon: LifeBuoy },
];

export const EMPLOYEE_NAVIGATION: NavigationItem[] = [
  { title: 'Dashboard', href: ROUTES.EMPLOYEE.DASHBOARD, icon: LayoutDashboard },
  { title: 'My Projects', href: ROUTES.EMPLOYEE.PROJECTS, icon: FolderKanban },
  { title: 'My Tasks', href: ROUTES.EMPLOYEE.TASKS, icon: SquareCheck },
  { title: 'Work Reports', href: ROUTES.EMPLOYEE.REPORTS, icon: FileText },
  { title: 'Files', href: ROUTES.EMPLOYEE.FILES, icon: FolderOpen },
  { title: 'Attendance', href: ROUTES.EMPLOYEE.ATTENDANCE, icon: CalendarCheck },
  { title: 'Leave', href: ROUTES.EMPLOYEE.LEAVE, icon: CalendarX },
  { title: 'Payments', href: ROUTES.EMPLOYEE.PAYMENTS, icon: Wallet },
  { title: 'Notifications', href: ROUTES.EMPLOYEE.NOTIFICATIONS, icon: MessageSquare },
  { title: 'Support', href: ROUTES.EMPLOYEE.SUPPORT, icon: LifeBuoy },
  { title: 'Profile', href: ROUTES.EMPLOYEE.PROFILE, icon: User },
];

export const CLIENT_NAVIGATION: NavigationItem[] = [
  { title: 'Dashboard', href: ROUTES.CLIENT.DASHBOARD, icon: LayoutDashboard },
  { title: 'My Projects', href: ROUTES.CLIENT.PROJECTS, icon: FolderKanban },
  { title: 'Quotations', href: ROUTES.CLIENT.QUOTATIONS, icon: FileText },
  { title: 'Requirements', href: ROUTES.CLIENT.REQUIREMENTS, icon: ClipboardList },
  { title: 'Approvals', href: ROUTES.CLIENT.APPROVALS, icon: CircleCheck },
  { title: 'Files', href: ROUTES.CLIENT.FILES, icon: FolderOpen },
  { title: 'Invoices', href: ROUTES.CLIENT.INVOICES, icon: Receipt },
  { title: 'Payments', href: ROUTES.CLIENT.PAYMENTS, icon: CreditCard },
  { title: 'Receipts', href: ROUTES.CLIENT.RECEIPTS, icon: Receipt },
  { title: 'Communication', href: ROUTES.CLIENT.COMMUNICATION, icon: MessageSquare },
  { title: 'Support', href: ROUTES.CLIENT.SUPPORT, icon: LifeBuoy },
  { title: 'Notifications', href: ROUTES.CLIENT.NOTIFICATIONS, icon: MessageSquare },
  { title: 'Profile', href: ROUTES.CLIENT.PROFILE, icon: User },
];

export function getNavigationByRole(role: UserRole): NavigationItem[] {
  switch (role) {
    case USER_ROLES.ADMIN:
      return ADMIN_NAVIGATION;
    case USER_ROLES.MARKETING:
      return MARKETING_NAVIGATION;
    case USER_ROLES.EMPLOYEE:
      return EMPLOYEE_NAVIGATION;
    case USER_ROLES.CLIENT:
      return CLIENT_NAVIGATION;
  }
}
