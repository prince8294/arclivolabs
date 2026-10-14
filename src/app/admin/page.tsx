import type { Metadata } from 'next';
import {
  CreditCard,
  FolderKanban,
  Users,
  UserPlus,
  CheckCircle2,
  CalendarClock,
  Briefcase,
  Clock,
  AlertCircle,
  ShieldAlert,
  SquareCheck,
} from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import RoleBadge from '@/components/shared/role-badge';
import StatCard from '@/components/dashboard/stat-card';
import { requireRole } from '@/lib/auth/authorization';
import { LEAD_STATUSES } from '@/lib/constants/enums';
import { getLeadCounts } from '@/lib/queries/leads';
import { getClientCounts } from '@/lib/queries/clients';
import { getAdminTaskStats } from '@/lib/queries/tasks';
import { listProjects } from '@/lib/queries/projects';
import { USER_ROLES } from '@/types/auth';
import { attendanceDashboardStats, leaveDashboardStats, listWorkReportsPage } from '@/lib/queries/workforce';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Agency-wide overview of clients, projects, tasks, payments and leads.',
};

/**
 * /admin
 *
 * Backed by real CRM, Client, Project, and Task aggregations.
 */
export default async function AdminDashboardPage() {
  await requireRole(USER_ROLES.ADMIN);

  const [leads, clients, taskStats, projectsResult, attendanceStats, leaveStats, pendingReports] = await Promise.all([
    getLeadCounts({ kind: 'admin' }),
    getClientCounts({ kind: 'admin' }),
    getAdminTaskStats(),
    listProjects({ limit: 1 }),
    attendanceDashboardStats(),
    leaveDashboardStats(),
    listWorkReportsPage({ status: 'SUBMITTED', limit: 1 }),
  ]);

  const followUpsDue = leads.followUps.overdue + leads.followUps.dueToday;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Agency-wide overview of clients, projects, tasks, payments and leads."
        action={<RoleBadge role={USER_ROLES.ADMIN} />}
      />

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workforce operations</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Checked In Now" value={attendanceStats.currentlyCheckedIn} description={`${attendanceStats.checkedOutToday} checked out today`} icon={Clock} />
          <StatCard title="Pending Leave" value={leaveStats.pending} description={`${leaveStats.upcoming} approved upcoming`} icon={CalendarClock} />
          <StatCard title="Pending Reports" value={pendingReports.total} description="Daily reports awaiting review" icon={SquareCheck} />
          <StatCard title="Incomplete Sessions" value={attendanceStats.incompleteSessions} description={`${attendanceStats.notYetRecorded} not yet recorded`} icon={AlertCircle} />
        </div>
      </div>

      {/* Task Operations Overview (Part 11) */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Task Management & Operations
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Pending Task Reviews"
            value={taskStats.pendingReviews}
            description="Submitted deliverables to verify"
            icon={Clock}
          />
          <StatCard
            title="Overdue Tasks"
            value={taskStats.overdueTasks}
            description="Missed deadline schedule"
            icon={AlertCircle}
          />
          <StatCard
            title="Blocked Tasks"
            value={taskStats.blockedTasks}
            description="Work halted by dependencies"
            icon={ShieldAlert}
          />
          <StatCard
            title="Active Tasks"
            value={taskStats.activeTasks}
            description={`${taskStats.totalTasks} total tasks logged`}
            icon={SquareCheck}
          />
        </div>
      </div>

      {/* CRM Pipeline */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Sales & Client Pipeline
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Leads"
            value={leads.total}
            description="All leads in the CRM"
            icon={Users}
          />
          <StatCard
            title="New Leads"
            value={leads.byStatus[LEAD_STATUSES.NEW]}
            description="Not contacted yet"
            icon={UserPlus}
          />
          <StatCard
            title="Won Leads"
            value={leads.byStatus[LEAD_STATUSES.WON]}
            description="Ready for client conversion"
            icon={CheckCircle2}
          />
          <StatCard
            title="Follow-ups Due"
            value={followUpsDue}
            description="Overdue plus due today"
            icon={CalendarClock}
          />
        </div>
      </div>

      {/* Projects & Accounts */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Accounts & Deliverables
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title="Total Clients"
            value={String(clients.total)}
            description={`${clients.active} active · ${clients.portalEnabled} with portal`}
            icon={Briefcase}
          />
          <StatCard
            title="Active Projects"
            value={String(projectsResult.total)}
            description="Projects currently in execution"
            icon={FolderKanban}
          />
          <StatCard
            title="Completed Deliverables"
            value={String(taskStats.completedTasks)}
            description="Approved tasks across all projects"
            icon={CheckCircle2}
          />
        </div>
      </div>
    </div>
  );
}
