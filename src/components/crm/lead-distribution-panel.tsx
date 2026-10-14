'use client';

import {
  useActionState,
  useMemo,
  useState,
} from 'react';
import {
  CheckCircle2,
  Filter,
  Loader2,
  RotateCcw,
  Send,
  Users,
} from 'lucide-react';

import {
  previewLeadDistribution,
  runLeadDistribution,
  type DistributionPreviewState,
  type RunDistributionState,
} from '@/lib/actions/lead-distribution';
import {
  LEAD_DISTRIBUTION_MODE_LABELS,
  LEAD_DISTRIBUTION_MODES,
  LEAD_DISTRIBUTION_STATUS_LABELS,
  LEAD_DISTRIBUTION_STATUSES,
  DISTRIBUTION_FILTER_INACTIVE_OWNER,
  type LeadDistributionMode,
} from '@/lib/constants/lead-import';
import {
  ASSIGNMENT_FILTER_ASSIGNED,
  ASSIGNMENT_FILTER_UNASSIGNED,
} from '@/lib/constants/leads';
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
} from '@/lib/constants/enums';
import type {
  LeadDistributionHistoryItem,
} from '@/lib/queries/lead-distribution';
import type { ImportBatchOption } from '@/lib/queries/leads';
import type { ServiceOption } from '@/lib/constants/leads';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';
import Button from '@/components/ui/button';

/**
 * Lead distribution workspace (admin only).
 *
 *   1. Define the pool with the same whitelisted filters as
 *      the lead list (search, status, source, service,
 *      import batch, assignment pool, date range).
 *   2. Choose how to assign it: all to one marketing user,
 *      or round-robin across several.
 *   3. Preview — the server counts the matching leads and
 *      shows the exact split.
 *   4. Run — the server recomputes the pool (never the
 *      preview), assigns oldest-first `i % n`, and writes a
 *      `LeadDistribution` audit record.
 *
 * The pool filters are component state (not URL state): this
 * is a workspace, not a shareable list view. Every count and
 * every write is recomputed server-side from the filters, so
 * a tampered preview can never widen the pool.
 */

export interface DistributionUser {
  id: string;
  name: string;
  email: string;
  marketingCode: string | null;
  assignedLeadCount: number;
}

export interface LeadDistributionPanelProps {
  marketingUsers: DistributionUser[];
  services: ServiceOption[];
  importBatches: ImportBatchOption[];
  history: LeadDistributionHistoryItem[];
  /** Leads currently owned by a suspended/inactive marketing user. */
  inactiveOwnerLeadCount: number;
}

/** Pool definition — mirrors the whitelisted lead-list params. */
interface PoolFilters {
  search: string;
  status: string;
  source: string;
  service: string;
  importBatch: string;
  assignedTo: string;
  createdFrom: string;
  createdTo: string;
}

const EMPTY_FILTERS: PoolFilters = {
  search: '',
  status: '',
  source: '',
  service: '',
  importBatch: '',
  assignedTo: '',
  createdFrom: '',
  createdTo: '',
};

const selectClasses =
  'h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const DISTRIBUTION_MODES: readonly LeadDistributionMode[] = [
  LEAD_DISTRIBUTION_MODES.SINGLE_USER,
  LEAD_DISTRIBUTION_MODES.ROUND_ROBIN,
];

export default function LeadDistributionPanel({
  marketingUsers,
  services,
  importBatches,
  history,
  inactiveOwnerLeadCount,
}: LeadDistributionPanelProps) {
  const [filters, setFilters] = useState<PoolFilters>(EMPTY_FILTERS);

  const [mode, setMode] = useState<LeadDistributionMode>(
    LEAD_DISTRIBUTION_MODES.ROUND_ROBIN
  );
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Preview (direct call, like the import wizard).
  const [preview, setPreview] =
    useState<DistributionPreviewState | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // Run (server action via useActionState).
  const [runResult, runDistribution, running] = useActionState(
    async (
      _previousState: RunDistributionState,
      formData: FormData
    ): Promise<RunDistributionState> => runLeadDistribution(formData),
    { ok: false }
  );

  const userById = useMemo(
    () => new Map(marketingUsers.map((user) => [user.id, user])),
    [marketingUsers]
  );

  const hasPoolFilters = useMemo(
    () =>
      Boolean(
        filters.search ||
          filters.status ||
          filters.source ||
          filters.service ||
          filters.importBatch ||
          filters.assignedTo ||
          filters.createdFrom ||
          filters.createdTo
      ),
    [filters]
  );

  const canRun = useMemo(() => {
    if (mode === LEAD_DISTRIBUTION_MODES.SINGLE_USER) {
      return Boolean(assignedToUserId);
    }
    return selectedUserIds.length > 0;
  }, [mode, assignedToUserId, selectedUserIds]);

  /* ---------------- form plumbing ---------------- */

  /**
   * Build the FormData the preview/run actions expect. The
   * assignee list is sent as a JSON array of user ids under
   * `userIds` — a single-user distribution sends a one-element
   * array.
   */
  function buildFormData(): FormData {
    const formData = new FormData();
    formData.set('search', filters.search);
    formData.set('status', filters.status);
    formData.set('source', filters.source);
    formData.set('service', filters.service);
    formData.set('importBatch', filters.importBatch);
    formData.set('assignedTo', filters.assignedTo);
    formData.set('createdFrom', filters.createdFrom);
    formData.set('createdTo', filters.createdTo);
    formData.set('mode', mode);
    const userIds =
      mode === LEAD_DISTRIBUTION_MODES.SINGLE_USER
        ? assignedToUserId
          ? [assignedToUserId]
          : []
        : selectedUserIds;
    formData.set('userIds', JSON.stringify(userIds));
    return formData;
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreviewError('');
    try {
      const result = await previewLeadDistribution(buildFormData());
      setPreview(result);
      if (!result.ok) {
        setPreviewError(result.error ?? 'Unable to preview the pool.');
      }
    } catch {
      setPreviewError('Unable to preview the pool. Please try again.');
    } finally {
      setPreviewing(false);
    }
  }

  function resetPool() {
    setFilters(EMPTY_FILTERS);
    setPreview(null);
    setPreviewError('');
  }

  function toggleUser(id: string) {
    setSelectedUserIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  }

  /* ---------------- render ---------------- */

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Pool definition */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Define the pool
            </h2>
            {hasPoolFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetPool}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Search">
              <input
                type="search"
                value={filters.search}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    search: event.target.value,
                  }))
                }
                placeholder="Name, code, email, phone…"
                className={cn(selectClasses, 'h-10 w-full')}
              />
            </Field>

            <Field label="Status">
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    status: event.target.value,
                  }))
                }
                className={selectClasses}
              >
                <option value="">All statuses</option>
                {Object.values(LEAD_STATUSES).map((value) => (
                  <option key={value} value={value}>
                    {LEAD_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Source">
              <select
                value={filters.source}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    source: event.target.value,
                  }))
                }
                className={selectClasses}
              >
                <option value="">All sources</option>
                {Object.values(LEAD_SOURCES).map((value) => (
                  <option key={value} value={value}>
                    {LEAD_SOURCE_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Service interest">
              <select
                value={filters.service}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    service: event.target.value,
                  }))
                }
                className={selectClasses}
              >
                <option value="">All services</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Import batch">
              <select
                value={filters.importBatch}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    importBatch: event.target.value,
                  }))
                }
                className={selectClasses}
              >
                <option value="">All import batches</option>
                {importBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.importCode} — {batch.fileName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Assignment pool">
              <select
                value={filters.assignedTo}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    assignedTo: event.target.value,
                  }))
                }
                className={selectClasses}
              >
                <option value="">All leads</option>
                <option value={ASSIGNMENT_FILTER_UNASSIGNED}>
                  Unassigned leads
                </option>
                <option value={ASSIGNMENT_FILTER_ASSIGNED}>
                  Assigned leads
                </option>
                <option value={DISTRIBUTION_FILTER_INACTIVE_OWNER}>
                  Suspended / inactive owner
                  {inactiveOwnerLeadCount > 0
                    ? ` (${inactiveOwnerLeadCount})`
                    : ''}
                </option>
                {marketingUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    Owned by {user.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Created from">
              <input
                type="date"
                value={filters.createdFrom}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    createdFrom: event.target.value,
                  }))
                }
                className={cn(selectClasses, 'h-10 w-full')}
              />
            </Field>

            <Field label="Created to">
              <input
                type="date"
                value={filters.createdTo}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    createdTo: event.target.value,
                  }))
                }
                className={cn(selectClasses, 'h-10 w-full')}
              />
            </Field>
          </div>
        </section>

        {/* Distribution configuration */}
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Assign to
          </h2>

          <div className="grid gap-2">
            {DISTRIBUTION_MODES.map((value) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                  mode === value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/30'
                )}
              >
                <input
                  type="radio"
                  name="distributionMode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    {LEAD_DISTRIBUTION_MODE_LABELS[value]}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {value === LEAD_DISTRIBUTION_MODES.SINGLE_USER
                      ? 'Every matching lead goes to one marketing user.'
                      : 'Matching leads are ordered oldest-first and split evenly across the selected users.'}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {mode === LEAD_DISTRIBUTION_MODES.SINGLE_USER ? (
            <Field label="Marketing user">
              <select
                value={assignedToUserId}
                onChange={(event) => setAssignedToUserId(event.target.value)}
                className={selectClasses}
              >
                <option value="">Select a marketing user</option>
                {marketingUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                    {user.marketingCode ? ` — ${user.marketingCode}` : ''}{' '}
                    ({user.assignedLeadCount} lead
                    {user.assignedLeadCount === 1 ? '' : 's'})
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                Marketing users
              </span>
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                {marketingUsers.map((user) => {
                  const checked = selectedUserIds.includes(user.id);
                  return (
                    <label
                      key={user.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                        checked ? 'bg-primary/10' : 'hover:bg-accent'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(user.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-foreground">{user.name}</span>
                      {user.marketingCode && (
                        <span className="text-xs text-muted-foreground">
                          {user.marketingCode}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {user.assignedLeadCount} lead
                        {user.assignedLeadCount === 1 ? '' : 's'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              disabled={previewing || running || !canRun}
            >
              {previewing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Filter className="h-4 w-4" aria-hidden="true" />
              )}
              Preview pool
            </Button>
            <Button
              type="button"
              onClick={() => runDistribution(buildFormData())}
              disabled={previewing || running || !canRun}
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {running ? 'Distributing…' : 'Run distribution'}
            </Button>
          </div>

          {previewError && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {previewError}
            </p>
          )}

          {runResult && !runResult.ok && runResult.error && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {runResult.error}
            </p>
          )}

          {preview?.ok && preview.preview && (
            <AllocationCard
              title="Pool preview"
              totalLeads={preview.preview.totalLeads}
              allocation={preview.preview.allocation}
              userById={userById}
            />
          )}

          {runResult?.ok && runResult.result && (
            <AllocationCard
              title={`Distribution ${runResult.result.distributionCode} complete`}
              totalLeads={runResult.result.totalLeads}
              allocation={runResult.result.allocation}
              userById={userById}
              success
            />
          )}
        </section>
      </div>

      {/* History */}
      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            Recent distributions
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every run is audited with the filters it used and the
            split it produced.
          </p>
        </div>

        {history.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No distributions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-5 py-3">Code</th>
                  <th scope="col" className="px-5 py-3">Mode</th>
                  <th scope="col" className="px-5 py-3">Leads</th>
                  <th scope="col" className="px-5 py-3">Split</th>
                  <th scope="col" className="px-5 py-3">Filters</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="hidden px-5 py-3 md:table-cell">Run by</th>
                  <th scope="col" className="hidden px-5 py-3 md:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs">
                      {item.distributionCode}
                    </td>
                    <td className="px-5 py-3">
                      {LEAD_DISTRIBUTION_MODE_LABELS[item.mode]}
                    </td>
                    <td className="px-5 py-3">{item.leadCount}</td>
                    <td className="px-5 py-3">
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {item.userAllocation.map((entry) => (
                          <li key={entry.userId}>
                            <span className="text-foreground">{entry.name}</span>
                            {' — '}
                            {entry.count}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="max-w-56 px-5 py-3">
                      {item.filtersSnapshot.length === 0 ? (
                        <span className="text-xs text-muted-foreground">All leads</span>
                      ) : (
                        <ul className="list-disc pl-4 text-xs text-muted-foreground">
                          {item.filtersSnapshot.map((filter) => (
                            <li key={`${filter.label}-${filter.value}`}>
                              {filter.label}: {filter.value}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          item.status === LEAD_DISTRIBUTION_STATUSES.COMPLETED &&
                            'bg-success/10 text-success',
                          item.status === LEAD_DISTRIBUTION_STATUSES.PARTIAL &&
                            'bg-warning/10 text-warning',
                          item.status === LEAD_DISTRIBUTION_STATUSES.FAILED &&
                            'bg-destructive/10 text-destructive'
                        )}
                      >
                        {LEAD_DISTRIBUTION_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3 text-muted-foreground md:table-cell">
                      {item.createdBy}
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3 text-muted-foreground md:table-cell">
                      {formatDate(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Label + control wrapper. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Allocation breakdown card (preview or run result). */
function AllocationCard({
  title,
  totalLeads,
  allocation,
  userById,
  success,
}: {
  title: string;
  totalLeads: number;
  allocation: Array<{
    userId: string;
    name: string;
    marketingCode: string | null;
    count: number;
  }>;
  userById: Map<string, DistributionUser>;
  success?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        success
          ? 'border-success/40 bg-success/10'
          : 'border-border bg-muted/30'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {success && (
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
          )}
          {title}
        </h3>
        <span className="text-sm font-medium text-foreground">
          {totalLeads} lead{totalLeads === 1 ? '' : 's'}
        </span>
      </div>
      {allocation.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No leads match the selected filters.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-border">
          {allocation.map((entry) => {
            const user = userById.get(entry.userId);
            return (
              <div
                key={entry.userId}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-foreground">
                  {entry.name || user?.name || 'Marketing user'}
                  {(entry.marketingCode ?? user?.marketingCode) && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {entry.marketingCode ?? user?.marketingCode}
                    </span>
                  )}
                </span>
                <span className="font-medium text-foreground">
                  {entry.count} lead{entry.count === 1 ? '' : 's'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
