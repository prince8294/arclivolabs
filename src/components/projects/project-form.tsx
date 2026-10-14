'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import Button from '@/components/ui/button';
import {
  PROJECT_HEALTH_LABELS,
  PROJECT_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
  type ProjectHealth,
  type ProjectType,
  type TaskPriority,
} from '@/lib/constants/enums';
import { createProject, updateProject } from '@/lib/actions/projects';

export interface ProjectClientOption {
  _id: string;
  name: string;
  clientCode: string;
}

export interface ProjectDealOption {
  _id: string;
  dealCode: string;
  title: string;
  clientName: string;
}

export interface ProjectStaffOption {
  _id: string;
  name: string;
  employeeCode: string;
  designation: string;
  department: string;
}

export interface ProjectFormInitialValues {
  _id?: string;
  title: string;
  description: string;
  clientId: string;
  dealId: string;
  managerId: string;
  projectType: ProjectType | '';
  priority: TaskPriority | '';
  health: ProjectHealth | '';
  startDate: string;
  expectedEndDate: string;
  scopeSummary: string;
  includedFeatures: string;
  deliverables: string;
  dependencies: string;
  customerResponsibilities: string;
  outOfScope: string;
}

interface ProjectFormProps {
  mode: 'create' | 'edit';
  clients: ProjectClientOption[];
  staff: ProjectStaffOption[];
  /** Deal options are only supplied on create, and only for eligible deals. */
  deals?: ProjectDealOption[];
  initialValues: ProjectFormInitialValues;
  /** Locks the client/deal fields when bootstrapping from a deal. */
  lockedClientId?: string;
  onDuplicate?: (projectId: string) => void;
}

const inputClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';
const textareaClasses =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClasses = 'text-sm font-medium text-foreground';

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClasses}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export default function ProjectForm({
  mode,
  clients,
  staff,
  deals = [],
  initialValues,
  lockedClientId,
  onDuplicate,
}: ProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initialValues.title ?? '');
  const [description, setDescription] = useState(initialValues.description ?? '');
  const [clientId, setClientId] = useState(
    lockedClientId ?? initialValues.clientId ?? ''
  );
  const [dealId, setDealId] = useState(initialValues.dealId ?? '');
  const [managerId, setManagerId] = useState(initialValues.managerId ?? '');
  const [projectType, setProjectType] = useState<ProjectType | ''>(
    initialValues.projectType ?? ''
  );
  const [priority, setPriority] = useState<TaskPriority | ''>(initialValues.priority ?? '');
  const [health, setHealth] = useState<ProjectHealth | ''>(initialValues.health ?? '');
  const [startDate, setStartDate] = useState(initialValues.startDate ?? '');
  const [expectedEndDate, setExpectedEndDate] = useState(initialValues.expectedEndDate ?? '');
  const [scopeSummary, setScopeSummary] = useState(initialValues.scopeSummary ?? '');
  const [includedFeatures, setIncludedFeatures] = useState(initialValues.includedFeatures ?? '');
  const [deliverables, setDeliverables] = useState(initialValues.deliverables ?? '');
  const [dependencies, setDependencies] = useState(initialValues.dependencies ?? '');
  const [customerResponsibilities, setCustomerResponsibilities] = useState(
    initialValues.customerResponsibilities ?? ''
  );
  const [outOfScope, setOutOfScope] = useState(initialValues.outOfScope ?? '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const payload = {
      title,
      description,
      clientId,
      dealId: mode === 'create' ? dealId : undefined,
      managerId,
      projectType,
      priority,
      health,
      startDate,
      expectedEndDate,
      scopeSummary,
      includedFeatures,
      deliverables,
      dependencies,
      customerResponsibilities,
      outOfScope,
    };

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createProject(payload)
          : initialValues._id
            ? await updateProject(initialValues._id, payload)
            : null;

      if (!result) return;

      if (result.success) {
        setSuccessMessage(result.message ?? 'Project saved.');
        router.push(`/admin/projects/${result.projectId ?? initialValues._id}`);
        router.refresh();
        return;
      }

      // A duplicate deal project is not a validation failure - offer a jump to
      // the project that already exists (§10).
      if (!result.success && result.projectId && result.message?.includes('already created')) {
        onDuplicate?.(result.projectId);
      }

      setErrorMessage(result.message ?? 'Unable to save the project.');
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    });
  };

  const availableClients = lockedClientId
    ? clients.filter((c) => c._id === lockedClientId)
    : clients;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {errorMessage ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {/* Basic information */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Basic information</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Who the project is for and what it delivers.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Project name" required error={fieldErrors.title}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClasses}
                aria-invalid={Boolean(fieldErrors.title)}
                placeholder="e.g. E-commerce website redesign"
              />
            </Field>
          </div>

          <Field
            label="Client"
            required={!lockedClientId}
            error={fieldErrors.clientId}
            hint={lockedClientId ? 'Taken from the finalized deal.' : undefined}
          >
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={Boolean(lockedClientId)}
              className={inputClasses}
              aria-invalid={Boolean(fieldErrors.clientId)}
            >
              <option value="">Select a client</option>
              {availableClients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.clientCode ? `(${c.clientCode})` : ''}
                </option>
              ))}
            </select>
          </Field>

          {mode === 'create' ? (
            <Field
              label="Linked deal"
              error={fieldErrors.dealId}
              hint="Optional. Leave empty for internal or maintenance work."
            >
              <select
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                className={inputClasses}
                aria-invalid={Boolean(fieldErrors.dealId)}
              >
                <option value="">No linked deal (manual project)</option>
                {deals.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.dealCode} - {d.title} ({d.clientName})
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label="Project type" error={fieldErrors.projectType}>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              className={inputClasses}
            >
              <option value="">Select a type</option>
              {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Description" error={fieldErrors.description}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={textareaClasses}
                placeholder="Short summary of the engagement."
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Timeline</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The operational schedule. Changing it later is recorded in the project
          timeline and never alters the agreed deal terms.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Expected start date" error={fieldErrors.startDate}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClasses}
            />
          </Field>

          <Field
            label="Expected completion date"
            error={fieldErrors.expectedEndDate}
          >
            <input
              type="date"
              value={expectedEndDate}
              onChange={(e) => setExpectedEndDate(e.target.value)}
              className={inputClasses}
            />
          </Field>
        </div>
      </section>

      {/* Scope */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Scope</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          One item per line. Seeded from the accepted proposal when the project
          comes from a deal.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="Scope of work" error={fieldErrors.scopeSummary}>
            <textarea
              value={scopeSummary}
              onChange={(e) => setScopeSummary(e.target.value)}
              rows={3}
              className={textareaClasses}
              placeholder="What is included in this engagement."
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Included features" error={fieldErrors.includedFeatures}>
              <textarea
                value={includedFeatures}
                onChange={(e) => setIncludedFeatures(e.target.value)}
                rows={4}
                className={textareaClasses}
              />
            </Field>

            <Field label="Deliverables" error={fieldErrors.deliverables}>
              <textarea
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                rows={4}
                className={textareaClasses}
              />
            </Field>

            <Field label="Dependencies" error={fieldErrors.dependencies}>
              <textarea
                value={dependencies}
                onChange={(e) => setDependencies(e.target.value)}
                rows={4}
                className={textareaClasses}
              />
            </Field>

            <Field label="Out of scope" error={fieldErrors.outOfScope}>
              <textarea
                value={outOfScope}
                onChange={(e) => setOutOfScope(e.target.value)}
                rows={4}
                className={textareaClasses}
              />
            </Field>

            <Field
              label="Customer responsibilities"
              error={fieldErrors.customerResponsibilities}
              hint="e.g. Content, brand assets, access credentials."
            >
              <textarea
                value={customerResponsibilities}
                onChange={(e) => setCustomerResponsibilities(e.target.value)}
                rows={4}
                className={textareaClasses}
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">Team</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Only active employees can be assigned. Additional members are added on
          the team page after the project is created.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Project manager"
            error={fieldErrors.managerId}
            hint="A project responsibility, not an extra permission level."
          >
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className={inputClasses}
              aria-invalid={Boolean(fieldErrors.managerId)}
            >
              <option value="">No project manager yet</option>
              {staff.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} {s.employeeCode ? `(${s.employeeCode})` : ''}
                  {s.designation ? ` - ${s.designation}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority" error={fieldErrors.priority}>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={inputClasses}
            >
              <option value="">Select a priority</option>
              {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Health"
            error={fieldErrors.health}
            hint="Admin assessment. Never overwritten automatically."
          >
            <select
              value={health}
              onChange={(e) => setHealth(e.target.value as ProjectHealth)}
              className={inputClasses}
            >
              <option value="">Select health</option>
              {Object.entries(PROJECT_HEALTH_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/projects')}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? 'Saving...'
            : mode === 'create'
              ? 'Create project'
              : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
