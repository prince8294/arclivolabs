'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import Button from '@/components/ui/button';
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, type TaskPriority } from '@/lib/constants/enums';
import { createTask, updateTask } from '@/lib/actions/tasks';

export interface ProjectOption {
  _id: string;
  projectCode: string;
  title: string;
  milestones: Array<{ _id: string; milestoneCode: string; title: string }>;
  members: Array<{ userId: string; name: string; designation?: string; role: string }>;
}

export interface TaskFormInitialValues {
  _id?: string;
  title: string;
  description?: string;
  projectId: string;
  milestoneId?: string;
  assignedTo?: string;
  priority: TaskPriority;
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  labels?: string;
  parentTaskId?: string;
}

interface TaskFormProps {
  mode: 'create' | 'edit';
  projects: ProjectOption[];
  initialValues: TaskFormInitialValues;
  defaultProjectId?: string;
}

export default function TaskForm({
  mode,
  projects,
  initialValues,
  defaultProjectId,
}: TaskFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [projectId, setProjectId] = useState<string>(
    initialValues.projectId || defaultProjectId || (projects[0]?._id ?? '')
  );
  const [title, setTitle] = useState(initialValues.title || '');
  const [description, setDescription] = useState(initialValues.description || '');
  const [milestoneId, setMilestoneId] = useState(initialValues.milestoneId || '');
  const [assignedTo, setAssignedTo] = useState(initialValues.assignedTo || '');
  const [priority, setPriority] = useState<TaskPriority>(initialValues.priority || TASK_PRIORITIES.MEDIUM);
  const [startDate, setStartDate] = useState(initialValues.startDate ? initialValues.startDate.slice(0, 10) : '');
  const [dueDate, setDueDate] = useState(initialValues.dueDate ? initialValues.dueDate.slice(0, 10) : '');
  const [estimatedHours, setEstimatedHours] = useState(
    initialValues.estimatedHours ? String(initialValues.estimatedHours) : ''
  );
  const [labels, setLabels] = useState(initialValues.labels || '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedProject = projects.find((p) => p._id === projectId);
  const availableMembers = selectedProject?.members || [];
  const availableMilestones = selectedProject?.milestones || [];

  const handleProjectChange = (newProjId: string) => {
    setProjectId(newProjId);
    setMilestoneId('');
    setAssignedTo('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setFieldErrors({});

    startTransition(async () => {
      const payload = {
        title,
        description,
        projectId,
        milestoneId: milestoneId || null,
        assignedTo: assignedTo || null,
        priority,
        startDate: startDate || null,
        dueDate: dueDate || null,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : 0,
        labels: labels
          ? labels
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      };

      if (mode === 'create') {
        const res = await createTask(payload);
        if (res.success) {
          setSuccessMessage(res.message || 'Task created successfully.');
          router.push(`/admin/tasks/${res.taskId}`);
        } else {
          setErrorMessage(res.message || 'Failed to create task.');
          if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        }
      } else if (initialValues._id) {
        const res = await updateTask(initialValues._id, payload);
        if (res.success) {
          setSuccessMessage(res.message || 'Task updated successfully.');
          router.push(`/admin/tasks/${initialValues._id}`);
        } else {
          setErrorMessage(res.message || 'Failed to update task.');
          if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 rounded-lg border border-border bg-card p-6 shadow-xs sm:grid-cols-2">
        {/* Project Selection */}
        <div className="sm:col-span-2">
          <label htmlFor="projectId" className="block text-sm font-medium text-foreground">
            Project <span className="text-destructive">*</span>
          </label>
          <select
            id="projectId"
            value={projectId}
            disabled={mode === 'edit' || projects.length === 0}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
            required
          >
            {projects.length === 0 && <option value="">No active projects found</option>}
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                [{p.projectCode}] {p.title}
              </option>
            ))}
          </select>
          {fieldErrors.projectId && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.projectId}</p>
          )}
        </div>

        {/* Task Title */}
        <div className="sm:col-span-2">
          <label htmlFor="title" className="block text-sm font-medium text-foreground">
            Task Title <span className="text-destructive">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Build responsive hero section and navigation"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
          {fieldErrors.title && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.title}</p>
          )}
        </div>

        {/* Milestone */}
        <div>
          <label htmlFor="milestoneId" className="block text-sm font-medium text-foreground">
            Milestone (Optional)
          </label>
          <select
            id="milestoneId"
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">No milestone (Independent task)</option>
            {availableMilestones.map((ms) => (
              <option key={ms._id} value={ms._id}>
                [{ms.milestoneCode}] {ms.title}
              </option>
            ))}
          </select>
          {fieldErrors.milestoneId && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.milestoneId}</p>
          )}
        </div>

        {/* Assigned Employee */}
        <div>
          <label htmlFor="assignedTo" className="block text-sm font-medium text-foreground">
            Assign Employee
          </label>
          <select
            id="assignedTo"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Unassigned (Planning)</option>
            {availableMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name} {m.designation ? `(${m.designation})` : `(${m.role})`}
              </option>
            ))}
          </select>
          {availableMembers.length === 0 && projectId && (
            <p className="mt-1 text-xs text-muted-foreground">
              No active team members assigned to this project yet.
            </p>
          )}
          {fieldErrors.assignedTo && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.assignedTo}</p>
          )}
        </div>

        {/* Priority */}
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-foreground">
            Priority <span className="text-destructive">*</span>
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Object.entries(TASK_PRIORITY_LABELS).map(([val, lbl]) => (
              <option key={val} value={val}>
                {lbl}
              </option>
            ))}
          </select>
          {fieldErrors.priority && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.priority}</p>
          )}
        </div>

        {/* Estimated Hours */}
        <div>
          <label htmlFor="estimatedHours" className="block text-sm font-medium text-foreground">
            Estimated Hours
          </label>
          <input
            id="estimatedHours"
            type="number"
            step="0.5"
            min="0"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            placeholder="e.g. 6.5"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {fieldErrors.estimatedHours && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.estimatedHours}</p>
          )}
        </div>

        {/* Start Date */}
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-foreground">
            Start Date
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {fieldErrors.startDate && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.startDate}</p>
          )}
        </div>

        {/* Due Date */}
        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-foreground">
            Due Date
          </label>
          <input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {fieldErrors.dueDate && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.dueDate}</p>
          )}
        </div>

        {/* Labels */}
        <div className="sm:col-span-2">
          <label htmlFor="labels" className="block text-sm font-medium text-foreground">
            Labels (comma separated)
          </label>
          <input
            id="labels"
            type="text"
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
            placeholder="e.g. frontend, react, bug, high-priority"
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label htmlFor="description" className="block text-sm font-medium text-foreground">
            Task Description & Requirements
          </label>
          <textarea
            id="description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide clear instructions, technical constraints, and acceptance criteria..."
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-sans"
          />
          {fieldErrors.description && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || projects.length === 0}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : mode === 'create' ? (
            'Create Task'
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
}
