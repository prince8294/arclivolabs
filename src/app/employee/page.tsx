import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Calendar,
  CalendarCheck,
  FolderKanban,
  SquareCheck,
  AlertCircle,
  Clock,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

import PageHeader from '@/components/ui/page-header';
import RoleBadge from '@/components/shared/role-badge';
import StatCard from '@/components/dashboard/stat-card';
import TaskPriorityBadge from '@/components/tasks/task-priority-badge';
import TaskStatusBadge from '@/components/tasks/task-status-badge';
import ButtonLink from '@/components/ui/button-link';
import { requireRole } from '@/lib/auth/authorization';
import { getEmployeeDashboardStats } from '@/lib/queries/tasks';
import { formatDate } from '@/lib/utils/format';
import { USER_ROLES } from '@/types/auth';
import { getTodayAttendance, listLeaveBalances, listLeavesPage, listWorkReportsPage } from '@/lib/queries/workforce';

export const metadata: Metadata = {
  title: 'Employee Dashboard',
  description: 'Overview of your active tasks, deadlines and work progress.',
};

export default async function EmployeeDashboardPage() {
  const user = await requireRole(USER_ROLES.EMPLOYEE);

  const [stats, attendance, pendingLeaves, reports, balances] = await Promise.all([
    getEmployeeDashboardStats(user.id),
    getTodayAttendance(user.id),
    listLeavesPage({ userId: user.id, status: 'PENDING', limit: 1 }),
    listWorkReportsPage({ userId: user.id, limit: 1 }),
    listLeaveBalances(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employee Dashboard"
        description="Live overview of your daily workload, nearest deadlines and task progress."
        action={<RoleBadge role={USER_ROLES.EMPLOYEE} />}
      />

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today & HR</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Attendance" value={attendance.openSession ? 'Checked in' : attendance.attendance?.status ?? 'Not recorded'} description={`${attendance.attendance?.totalWorkedMinutes ?? 0} minutes recorded`} icon={Clock} />
          <StatCard title="Pending Leave" value={pendingLeaves.total} description="Requests awaiting Admin review" icon={Calendar} />
          <StatCard title="Latest Report" value={reports.items[0]?.status ?? 'Not submitted'} description={reports.items[0]?.workDate ?? 'No report yet'} icon={SquareCheck} />
          <StatCard title="Leave Available" value={balances.reduce((sum, row) => sum + row.available, 0)} description={balances.length ? `Across ${balances.length} configured balance(s)` : 'Balance not configured'} icon={CalendarCheck} />
        </div>
      </div>

      {/* Real Task Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Tasks"
          value={stats.activeTasks}
          description="In Progress & To Do"
          icon={SquareCheck}
        />
        <StatCard
          title="Due Today"
          value={stats.dueToday}
          description="Requires completion today"
          icon={Calendar}
        />
        <StatCard
          title="Awaiting Review"
          value={stats.pendingReview}
          description="Submitted deliverables"
          icon={Clock}
        />
        <StatCard
          title="Overdue Tasks"
          value={stats.overdue}
          description={stats.overdue > 0 ? 'Requires immediate action' : 'All tasks on schedule'}
          icon={AlertCircle}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title="Blocked Tasks"
          value={stats.blocked}
          description="Work halted due to blockers"
          icon={ShieldAlert}
        />
        <StatCard
          title="Completed Recently"
          value={stats.completedRecently}
          description="Approved in past 7 days"
          icon={CheckCircle2}
        />
      </div>

      {/* Nearest Deadlines & Urgent Tasks */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Nearest Deadlines & Deliverables
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your next upcoming milestones sorted by due date.
            </p>
          </div>
          <ButtonLink href="/employee/tasks" variant="outline" size="sm">
            View All Tasks
            <ArrowRight className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
          </ButtonLink>
        </div>

        {stats.nearestDeadlines.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No upcoming task deadlines scheduled.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {stats.nearestDeadlines.map((task) => (
              <div
                key={task._id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 hover:bg-muted/10 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">
                      {task.taskCode}
                    </span>
                    <TaskPriorityBadge priority={task.priority} />
                    <TaskStatusBadge status={task.status} />
                  </div>
                  <Link
                    href={`/employee/tasks/${task._id}`}
                    className="font-medium text-sm text-foreground hover:underline block"
                  >
                    {task.title}
                  </Link>
                  <span className="text-xs text-muted-foreground block">
                    📁 {task.projectTitle}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-semibold text-foreground block">
                      {task.dueDate ? formatDate(task.dueDate) : 'No date'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Deadline</span>
                  </div>
                  <ButtonLink href={`/employee/tasks/${task._id}`} size="sm" variant="outline">
                    Work On Task
                  </ButtonLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
