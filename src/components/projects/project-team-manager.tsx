'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Trash2, UserPlus } from 'lucide-react';

import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import FormDialog from '@/components/ui/form-dialog';
import {
  PROJECT_MEMBER_ROLE_LABELS,
  PROJECT_MEMBER_ROLES,
  type ProjectMemberRole,
} from '@/lib/constants/enums';
import {
  addProjectMember,
  removeProjectMember,
  updateProjectMember,
} from '@/lib/actions/projects';
import type {
  AssignableEmployee,
  ProjectMemberItem,
} from '@/lib/queries/projects';

interface ProjectTeamManagerProps {
  projectId: string;
  members: ProjectMemberItem[];
  removedMembers: Array<{
    userId: string;
    name: string;
    role: string;
    removedAt: string | null;
    removalReason: string | null;
  }>;
  assignableEmployees: AssignableEmployee[];
}

const selectClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function ProjectTeamManager({
  projectId,
  members,
  removedMembers,
  assignableEmployees,
}: ProjectTeamManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [addOpen, setAddOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ProjectMemberRole>(PROJECT_MEMBER_ROLES.DEVELOPER);
  const [responsibility, setResponsibility] = useState('');
  const [removeTarget, setRemoveTarget] = useState<ProjectMemberItem | null>(null);
  const [removeReason, setRemoveReason] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Employees already on the project are not offered again (§21).
  const available = assignableEmployees.filter(
    (e) => !members.some((m) => m.userId === e._id)
  );

  const run = (work: () => Promise<{ success: boolean; message?: string }>) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await work();
      if (result.success) {
        setSuccess(result.message ?? 'Done.');
        router.refresh();
        return;
      }
      setError(result.message ?? 'Something went wrong.');
    });
  };

  const handleAdd = () => {
    if (!userId) {
      setError('Select an employee first.');
      return;
    }
    startTransition(async () => {
      const result = await addProjectMember(projectId, { userId, role, responsibility });
      if (result.success) {
        setAddOpen(false);
        setUserId('');
        setResponsibility('');
        setError(null);
        setSuccess(result.message ?? 'Member added.');
        router.refresh();
        return;
      }
      setError(result.message ?? 'Unable to add that member.');
    });
  };

  const handleRoleChange = (member: ProjectMemberItem, nextRole: ProjectMemberRole) => {
    void run(async () => {
      const result = await updateProjectMember(projectId, member.userId, {
        role: nextRole,
        responsibility: member.responsibility ?? '',
      });
      return { success: result.success, message: result.message };
    });
  };

  const handleRemove = () => {
    if (!removeTarget) return;
    startTransition(async () => {
      const result = await removeProjectMember(projectId, {
        userId: removeTarget.userId,
        reason: removeReason,
      });
      if (result.success) {
        setRemoveTarget(null);
        setRemoveReason('');
        setError(null);
        setSuccess(result.message ?? 'Member removed.');
        router.refresh();
        return;
      }
      setError(result.message ?? 'Unable to remove that member.');
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {members.length} active {members.length === 1 ? 'member' : 'members'}
        </p>
        <Button type="button" size="sm" onClick={() => setAddOpen(true)} disabled={isPending}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Add member
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{success}</span>
        </div>
      ) : null}

      {members.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No team assigned yet. Add employees to give them access to this project.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{member.name}</span>
                  {member.employeeCode ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {member.employeeCode}
                    </span>
                  ) : null}
                  {member.userStatus && member.userStatus !== 'ACTIVE' ? (
                    <Badge variant="warning">Account {member.userStatus.toLowerCase()}</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {member.designation || member.email}
                  {member.department ? ` - ${member.department.replace(/_/g, ' ')}` : ''}
                </p>
                {member.responsibility ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Responsibility: {member.responsibility}
                  </p>
                ) : null}
                {member.skills.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Skills: {member.skills.join(', ')}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={member.role}
                  onChange={(e) =>
                    handleRoleChange(member, e.target.value as ProjectMemberRole)
                  }
                  disabled={isPending}
                  aria-label={`Project role for ${member.name}`}
                  className={selectClasses}
                >
                  {Object.entries(PROJECT_MEMBER_ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${member.name} from project`}
                  onClick={() => {
                    setError(null);
                    setRemoveTarget(member);
                  }}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {removedMembers.length > 0 ? (
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Assignment history ({removedMembers.length} removed)
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {removedMembers.map((former) => (
              <li key={former.userId} className="text-xs text-muted-foreground">
                {former.name} -{' '}
                {PROJECT_MEMBER_ROLE_LABELS[former.role as ProjectMemberRole] ?? former.role}
                {former.removedAt
                  ? ` - removed ${new Date(former.removedAt).toLocaleDateString('en-GB')}`
                  : ''}
                {former.removalReason ? ` (${former.removalReason})` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {addOpen ? (
        <FormDialog
          title="Add team member"
          description="Only active employees can be assigned to a project."
          pending={isPending}
          error={error ?? undefined}
          onClose={() => {
            setAddOpen(false);
            setError(null);
          }}
        >
        <div className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="member-user"
              className="text-sm font-medium text-foreground"
            >
              Employee <span className="text-destructive">*</span>
            </label>
            <select
              id="member-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className={`${selectClasses} mt-1.5`}
            >
              <option value="">Select an employee</option>
              {available.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.name} ({employee.employeeCode}) - {employee.designation}
                  {employee.activeProjectCount > 0
                    ? ` - ${employee.activeProjectCount} active project(s)`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="member-role"
              className="text-sm font-medium text-foreground"
            >
              Project role
            </label>
            <select
              id="member-role"
              value={role}
              onChange={(e) => setRole(e.target.value as ProjectMemberRole)}
              className={`${selectClasses} mt-1.5`}
            >
              {Object.entries(PROJECT_MEMBER_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="member-responsibility"
              className="text-sm font-medium text-foreground"
            >
              Responsibility
            </label>
            <input
              id="member-responsibility"
              type="text"
              value={responsibility}
              onChange={(e) => setResponsibility(e.target.value)}
              placeholder="e.g. Frontend Development"
              className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAdd} disabled={isPending}>
              {isPending ? 'Adding...' : 'Add to project'}
            </Button>
          </div>
        </div>
      </FormDialog>
      ) : null}

      {removeTarget ? (
      <FormDialog
        title={`Remove ${removeTarget.name}`}
        description="They lose project access immediately. Their assignment history and past contributions are preserved."
        pending={isPending}
        error={error ?? undefined}
        onClose={() => {
          setRemoveTarget(null);
          setRemoveReason('');
          setError(null);
        }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="remove-reason"
              className="text-sm font-medium text-foreground"
            >
              Reason
            </label>
            <input
              id="remove-reason"
              type="text"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="e.g. Reassigned to another project"
              className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleRemove} disabled={isPending}>
              {isPending ? 'Removing...' : 'Remove from project'}
            </Button>
          </div>
        </div>
      </FormDialog>
      ) : null}
    </div>
  );
}
