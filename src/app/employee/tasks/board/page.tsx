import type { Metadata } from 'next';
import Link from 'next/link';
import { ListTodo } from 'lucide-react';

import ButtonLink from '@/components/ui/button-link';
import PageHeader from '@/components/ui/page-header';
import TaskBoard from '@/components/tasks/task-board';
import { requireRole } from '@/lib/auth/authorization';
import { getTaskBoard } from '@/lib/queries/tasks';
import { USER_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'My Task Board',
  description: 'Kanban view of your assigned tasks across work stages.',
};

export default async function EmployeeTaskBoardPage() {
  const user = await requireRole(USER_ROLES.EMPLOYEE);

  const board = await getTaskBoard({
    assignedTo: user.id,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="My Task Board"
          description="Visual status board of your assigned project tasks."
        />
        <ButtonLink href="/employee/tasks" variant="outline" size="sm">
          <ListTodo className="h-4 w-4" aria-hidden="true" />
          List View
        </ButtonLink>
      </div>

      <TaskBoard board={board} portal="employee" />
    </div>
  );
}
