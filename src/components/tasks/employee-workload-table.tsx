import { AlertCircle, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { EMPLOYEE_DEPARTMENT_LABELS } from '@/lib/constants/enums';

export interface EmployeeWorkloadItem {
  employeeId: string;
  userId: string;
  employeeCode: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  totalAssigned: number;
  inProgress: number;
  blocked: number;
  pendingReview: number;
  completed: number;
  overdue: number;
}

interface EmployeeWorkloadTableProps {
  workloads: EmployeeWorkloadItem[];
}

export default function EmployeeWorkloadTable({ workloads }: EmployeeWorkloadTableProps) {
  if (workloads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No active employees found to evaluate workload.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-3">Employee</th>
            <th scope="col" className="px-4 py-3">Department</th>
            <th scope="col" className="px-4 py-3 text-center">Assigned</th>
            <th scope="col" className="px-4 py-3 text-center">In Progress</th>
            <th scope="col" className="px-4 py-3 text-center">Blocked</th>
            <th scope="col" className="px-4 py-3 text-center">In Review</th>
            <th scope="col" className="px-4 py-3 text-center">Overdue</th>
            <th scope="col" className="px-4 py-3 text-center">Completed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {workloads.map((item) => (
            <tr key={item.employeeId} className="hover:bg-muted/20 transition-colors">
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {item.employeeCode} · {item.designation}
                  </span>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                {EMPLOYEE_DEPARTMENT_LABELS[item.department as keyof typeof EMPLOYEE_DEPARTMENT_LABELS] || item.department}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center font-semibold text-foreground">
                {item.totalAssigned}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center">
                <span className="inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                  {item.inProgress}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center">
                {item.blocked > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                    <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                    {item.blocked}
                  </span>
                ) : (
                  <span className="text-muted-foreground/60 text-xs">0</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center">
                {item.pendingReview > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {item.pendingReview}
                  </span>
                ) : (
                  <span className="text-muted-foreground/60 text-xs">0</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center">
                {item.overdue > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive animate-pulse">
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                    {item.overdue}
                  </span>
                ) : (
                  <span className="text-muted-foreground/60 text-xs">0</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {item.completed}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
