'use client';

import {
  useActionState,
  useMemo,
  useState,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Upload,
} from 'lucide-react';

import { downloadCsv } from '@/lib/import/csv-writer';
import { autoMapColumns, parseCsvText } from '@/lib/import/csv';
import {
  LEAD_DISTRIBUTION_MODE_LABELS,
  LEAD_DISTRIBUTION_MODES,
  LEAD_DUPLICATE_POLICIES,
  LEAD_IMPORT_ACCEPTED_EXTENSIONS,
  LEAD_IMPORT_EXAMPLE_ROW,
  LEAD_IMPORT_FIELD_LABELS,
  LEAD_IMPORT_FIELD_ORDER,
  LEAD_IMPORT_FIELDS,
  LEAD_IMPORT_MAX_FILE_BYTES,
  LEAD_IMPORT_MAX_ROWS,
  LEAD_IMPORT_PREVIEW_ROW_LIMIT,
  LEAD_IMPORT_ROW_STATUS_LABELS,
  LEAD_IMPORT_TEMPLATE_HEADERS,
  LEAD_BULK_ACTIVITY_LIMIT,
  type LeadDistributionMode,
  type LeadDuplicatePolicy,
  type LeadImportField,
  type LeadImportRowStatus,
} from '@/lib/constants/lead-import';
import {
  summariseRoundRobin,
  summariseSingleUser,
  type RoundRobinAllocation,
} from '@/lib/distribution/lead-distribution';
import {
  commitLeadImport,
  previewLeadImport,
  type LeadImportCommitState,
} from '@/lib/actions/lead-import';
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from '@/lib/constants/enums';
import type { AssignableMarketingUser } from '@/lib/constants/leads';
import type {
  ColumnMapping,
  LeadImportPreviewResult,
} from '@/types/lead-import';
import { cn } from '@/lib/utils/cn';
import Button from '@/components/ui/button';

/**
 * Six-step CSV import wizard (admin only).
 *
 *   1 Upload → 2 Map columns → 3 Validate & preview →
 *   4 Assignment → 5 Import settings → 6 Review & import
 *
 * The file text is read into memory once and held in component
 * state; both the preview and the commit send the raw text to
 * the server, which re-parses and re-validates it authoritatively.
 * The client never sends pre-validated rows.
 *
 * The `requestId` is generated once per file and sent with the
 * commit, so a double-click or a retried submission cannot
 * import the same file twice (the server redirects a replay to
 * the stored batch).
 *
 * The commit runs as a server action via `useActionState`:
 * `commitLeadImport` redirects to the new batch detail page on
 * success, and returns `{ error }` for validation failures so
 * they render inline on the review step.
 */

const EMPTY_MAPPING = {} as ColumnMapping;

const selectClasses =
  'h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const stepClasses = (active: boolean, done: boolean) =>
  cn(
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
    active
      ? 'border-primary bg-primary text-primary-foreground'
      : done
        ? 'border-success/40 bg-success/10 text-success'
        : 'border-border bg-muted/40 text-muted-foreground'
  );

export interface LeadImportWizardProps {
  marketingUsers: AssignableMarketingUser[];
}

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS: Array<{ title: string; description: string }> = [
  { title: 'Upload', description: 'Choose a CSV file' },
  { title: 'Map columns', description: 'Match CSV columns to lead fields' },
  { title: 'Validate', description: 'Review rows, duplicates and issues' },
  { title: 'Assignment', description: 'Choose who owns the leads' },
  { title: 'Settings', description: 'Default status and duplicate handling' },
  { title: 'Review & import', description: 'Confirm and run the import' },
];

export default function LeadImportWizard({
  marketingUsers,
}: LeadImportWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 — file
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [csvText, setCsvText] = useState('');
  const [rowCount, setRowCount] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [requestId, setRequestId] = useState('');
  const [fileError, setFileError] = useState('');

  // Step 2 — mapping
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);

  // Step 3 — preview (server result)
  const [preview, setPreview] = useState<LeadImportPreviewResult | null>(
    null
  );
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // Step 4 — assignment
  const [mode, setMode] = useState<LeadDistributionMode>(
    LEAD_DISTRIBUTION_MODES.UNASSIGNED
  );
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Step 5 — settings
  const [defaultStatus, setDefaultStatus] = useState<string>(
    LEAD_STATUSES.NEW
  );
  const [duplicatePolicy, setDuplicatePolicy] =
    useState<LeadDuplicatePolicy>(LEAD_DUPLICATE_POLICIES.SKIP);

  // Step 6 — submit (server action). On success the action
  // redirects to the batch detail page; on failure it returns
  // { error } which we show inline.
  const [commitError, commitAction, commitPending] = useActionState(
    async (
      _previousState: LeadImportCommitState,
      formData: FormData
    ): Promise<LeadImportCommitState> => commitLeadImport(formData),
    {}
  );

  /* ---------------- derived ---------------- */

  const mappingValid = useMemo(() => {
    if (!mapping[LEAD_IMPORT_FIELDS.NAME]) {
      return false;
    }
    return Boolean(
      mapping[LEAD_IMPORT_FIELDS.EMAIL] || mapping[LEAD_IMPORT_FIELDS.PHONE]
    );
  }, [mapping]);

  const summary = preview?.summary ?? null;
  const willImport = summary?.willImport ?? 0;

  const allocation: RoundRobinAllocation[] = useMemo(() => {
    if (mode === LEAD_DISTRIBUTION_MODES.SINGLE_USER && assignedToUserId) {
      return summariseSingleUser(willImport, assignedToUserId);
    }
    if (
      mode === LEAD_DISTRIBUTION_MODES.ROUND_ROBIN &&
      selectedUserIds.length > 0
    ) {
      return summariseRoundRobin(willImport, selectedUserIds);
    }
    return [];
  }, [mode, assignedToUserId, selectedUserIds, willImport]);

  const userById = useMemo(
    () => new Map(marketingUsers.map((user) => [user.id, user])),
    [marketingUsers]
  );

  /* ---------------- step 1: upload ---------------- */

  async function handleFile(file: File | undefined) {
    setFileError('');
    setPreview(null);
    if (!file) {
      return;
    }

    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
    if (!LEAD_IMPORT_ACCEPTED_EXTENSIONS.includes(extension as '.csv')) {
      setFileError('Only .csv files are accepted.');
      return;
    }
    if (file.size > LEAD_IMPORT_MAX_FILE_BYTES) {
      setFileError(
        'The file is too large. Maximum allowed size is 5 MB.'
      );
      return;
    }

    const text = await file.text();
    const parsed = parseCsvText(text);

    if (parsed.rowCount === 0) {
      setFileError('The CSV file contains no data rows.');
      return;
    }
    if (parsed.rowCount > LEAD_IMPORT_MAX_ROWS) {
      setFileError(
        `The file contains ${parsed.rowCount.toLocaleString()} rows. The maximum per import is ${LEAD_IMPORT_MAX_ROWS.toLocaleString()} rows. Please split the file into smaller batches.`
      );
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    setCsvText(text);
    setRowCount(parsed.rowCount);
    setHeaders(parsed.headers);
    // Auto-map on every new upload; the admin can refine in step 2.
    setMapping(autoMapColumns(parsed.headers));
    setRequestId(crypto.randomUUID());
    setStep(2);
  }

  /* ---------------- step 2: mapping ---------------- */

  function setFieldMapping(field: LeadImportField, header: string) {
    setMapping((previous) => ({
      ...previous,
      [field]: header === '' ? null : header,
    }));
  }

  /* ---------------- step 3: preview ---------------- */

  async function runPreview() {
    setPreviewing(true);
    setPreviewError('');
    try {
      const formData = new FormData();
      formData.set('csvText', csvText);
      formData.set('mapping', JSON.stringify(mapping));
      formData.set('fileName', fileName);
      formData.set('duplicatePolicy', duplicatePolicy);
      const result = await previewLeadImport(formData);
      setPreview(result);
      if (!result.ok) {
        setPreviewError(result.error ?? 'Unable to validate the file.');
      }
    } catch {
      setPreviewError('Unable to validate the file. Please try again.');
    } finally {
      setPreviewing(false);
    }
  }

  /* ---------------- invalid-row export ---------------- */

  /**
   * Build the invalid-row download as objects keyed by the
   * (sanitised) CSV headers, plus an extra `importIssues`
   * column. `downloadCsv` applies formula-injection escaping
   * and RFC 4180 quoting.
   */
  const invalidRowsCsv = useMemo(() => {
    if (!preview?.ok || !preview.rowIssues) {
      return null;
    }
    const issueRows = preview.rowIssues;
    if (Object.keys(issueRows).length === 0) {
      return null;
    }
    const parsed = parseCsvText(csvText);
    const exportHeaders = [...parsed.headers, 'importIssues'];
    const rows = parsed.rows
      .map((cells, index) => ({
        rowNumber: index + 1,
        cells,
      }))
      .filter((row) => issueRows[row.rowNumber])
      .map((row) => {
        const record: Record<string, unknown> = {};
        for (let index = 0; index < parsed.headers.length; index += 1) {
          record[parsed.headers[index]] = row.cells[index] ?? '';
        }
        record.importIssues = issueRows[row.rowNumber].join('; ');
        return record;
      });
    return { rows, headers: exportHeaders };
  }, [preview, csvText]);

  function downloadInvalidRows() {
    if (!invalidRowsCsv) {
      return;
    }
    downloadCsv(
      invalidRowsCsv.rows,
      invalidRowsCsv.headers,
      `import-errors-${fileName || 'leads'}.csv`
    );
  }

  function downloadTemplate() {
    const templateHeaders = LEAD_IMPORT_FIELD_ORDER.map(
      (field) => LEAD_IMPORT_TEMPLATE_HEADERS[field]
    );
    downloadCsv([], templateHeaders, 'lead-import-template.csv');
  }

  /* ---------------- step 4: assignment ---------------- */

  function toggleUser(id: string) {
    setSelectedUserIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  }

  /* ---------------- navigation ---------------- */

  function next() {
    setStep((current) => Math.min(current + 1, 6) as WizardStep);
  }
  function back() {
    setStep((current) => Math.max(current - 1, 1) as WizardStep);
  }

  const canContinue = useMemo(() => {
    switch (step) {
      case 1:
        return Boolean(csvText);
      case 2:
        return mappingValid;
      case 3:
        return preview?.ok === true && willImport > 0;
      case 4:
        if (mode === LEAD_DISTRIBUTION_MODES.UNASSIGNED) {
          return true;
        }
        if (mode === LEAD_DISTRIBUTION_MODES.SINGLE_USER) {
          return Boolean(assignedToUserId);
        }
        return selectedUserIds.length > 0;
      case 5:
        return Boolean(defaultStatus);
      case 6:
        return true;
      default:
        return false;
    }
  }, [step, csvText, mappingValid, preview, willImport, mode, assignedToUserId, selectedUserIds, defaultStatus]);

  /* ---------------- render helpers ---------------- */

  function renderStepIndicator() {
    return (
      <ol className="flex items-center gap-2">
        {STEPS.map((item, index) => {
          const stepNumber = (index + 1) as WizardStep;
          const active = step === stepNumber;
          const done = step > stepNumber;
          return (
            <li key={item.title} className="flex items-center gap-2">
              <span className={stepClasses(active, done)}>
                {done ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  stepNumber
                )}
              </span>
              <span
                className={cn(
                  'hidden text-sm sm:block',
                  active
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {item.title}
              </span>
              {index < STEPS.length - 1 && (
                <span
                  className="h-px w-6 bg-border"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  function renderUpload() {
    return (
      <div className="flex flex-col gap-4">
        <label
          htmlFor="csv-file"
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-12 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">
            Drop your CSV here, or browse
          </span>
          <span className="text-xs text-muted-foreground">
            .csv only · up to 5 MB · up to {LEAD_IMPORT_MAX_ROWS.toLocaleString()} rows
          </span>
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>

        {fileError && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {fileError}
          </p>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              CSV template
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Download the official header row. Column order does not
              matter — you will map columns in the next step.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download template
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Example row
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reference only — the example is never part of the
            downloadable template.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  {LEAD_IMPORT_FIELD_ORDER.map((field) => (
                    <th key={field} scope="col" className="px-2 py-1.5 font-medium">
                      {LEAD_IMPORT_FIELD_LABELS[field]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="divide-x divide-border text-foreground">
                  {LEAD_IMPORT_EXAMPLE_ROW.map((cell, index) => (
                    <td key={index} className="px-2 py-1.5 whitespace-nowrap">
                      {cell || <span className="text-muted-foreground">—</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderMapping() {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {fileName}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {rowCount.toLocaleString()} data rows ·{' '}
              {(fileSize / 1024).toFixed(1)} KB · {headers.length} columns
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMapping(autoMapColumns(headers))}
          >
            Re-auto-map
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3">Lead field</th>
                <th scope="col" className="px-4 py-3">CSV column</th>
                <th scope="col" className="px-4 py-3">Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {LEAD_IMPORT_FIELD_ORDER.map((field) => {
                const isRequired =
                  field === LEAD_IMPORT_FIELDS.NAME ||
                  field === LEAD_IMPORT_FIELDS.EMAIL ||
                  field === LEAD_IMPORT_FIELDS.PHONE;
                const current = mapping[field] ?? null;
                return (
                  <tr key={field}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {LEAD_IMPORT_FIELD_LABELS[field]}
                      {(field === LEAD_IMPORT_FIELDS.EMAIL ||
                        field === LEAD_IMPORT_FIELDS.PHONE) && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          (at least one)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={current ?? ''}
                        onChange={(event) =>
                          setFieldMapping(field, event.target.value)
                        }
                        className={selectClasses}
                        aria-label={`CSV column for ${LEAD_IMPORT_FIELD_LABELS[field]}`}
                      >
                        <option value="">Ignore this field</option>
                        {headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {field === LEAD_IMPORT_FIELDS.NAME
                        ? 'Required'
                        : isRequired
                          ? 'One of email / phone'
                          : 'Optional'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!mappingValid && (
          <p role="alert" className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            Map the contact name, plus at least one of email or phone,
            before continuing.
          </p>
        )}
      </div>
    );
  }

  function renderPreview() {
    if (previewing) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          Validating rows…
        </div>
      );
    }

    if (previewError) {
      return (
        <div className="flex flex-col gap-3">
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {previewError}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={runPreview}>
            Try again
          </Button>
        </div>
      );
    }

    if (!preview?.ok) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Review the column mapping, then validate the file.
          </p>
          <Button type="button" size="sm" onClick={runPreview}>
            Validate file
          </Button>
        </div>
      );
    }

    const rows = preview.previewRows ?? [];
    const issues = preview.rowIssues ?? {};
    const duplicates = preview.duplicateRows ?? {};
    const issueCount = Object.keys(issues).length;

    return (
      <div className="flex flex-col gap-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Total rows" value={summary?.totalRows ?? 0} />
          <SummaryCard label="Valid" value={summary?.validRows ?? 0} tone="success" />
          <SummaryCard label="Warnings" value={summary?.warningRows ?? 0} tone="warning" />
          <SummaryCard label="Invalid" value={summary?.invalidRows ?? 0} tone="danger" />
          <SummaryCard label="Duplicates" value={summary?.duplicateRows ?? 0} tone="warning" />
          <SummaryCard label="Will import" value={willImport} tone="primary" />
        </div>

        {willImport === 0 && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            No rows can be imported. Fix the invalid rows (or change the
            duplicate policy) before continuing.
          </p>
        )}

        {issueCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {issueCount} invalid row{issueCount === 1 ? '' : 's'}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Download a CSV of the failing rows with the reason each
                one was rejected.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={downloadInvalidRows}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download invalid rows
            </Button>
          </div>
        )}

        {/* Preview grid (first N rows) */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="px-3 py-2">#</th>
                <th scope="col" className="px-3 py-2">Name</th>
                <th scope="col" className="px-3 py-2">Email</th>
                <th scope="col" className="px-3 py-2">Phone</th>
                <th scope="col" className="px-3 py-2">Budget</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2">Issues</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const rowIssues = issues[row.rowNumber] ?? [];
                const dup = duplicates[row.rowNumber];
                return (
                  <tr key={row.rowNumber} className="align-top">
                    <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{row.name || '—'}</td>
                    <td className="px-3 py-2">{row.email || '—'}</td>
                    <td className="px-3 py-2">{row.phone || '—'}</td>
                    <td className="px-3 py-2">
                      {row.estimatedBudget !== null
                        ? `${row.estimatedBudget} ${row.currency}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          row.status === 'VALID' && 'bg-success/10 text-success',
                          row.status === 'WARNING' && 'bg-warning/10 text-warning',
                          row.status === 'INVALID' && 'bg-destructive/10 text-destructive'
                        )}
                      >
                        {LEAD_IMPORT_ROW_STATUS_LABELS[row.status as LeadImportRowStatus]}
                      </span>
                      {dup && (
                        <span className="ml-1 inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                          {dup.level === 'EXISTING_LEAD'
                            ? 'Existing lead'
                            : 'In-file duplicate'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {rowIssues.length > 0 ? (
                        <ul className="list-disc pl-3 text-destructive">
                          {rowIssues.map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      ) : row.warnings.length > 0 ? (
                        <ul className="list-disc pl-3 text-warning">
                          {row.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {rows.length} of {(summary?.totalRows ?? 0).toLocaleString()} rows
          (first {LEAD_IMPORT_PREVIEW_ROW_LIMIT}).
        </p>
      </div>
    );
  }

  function renderAssignment() {
    return (
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">
            Who should own the imported leads?
          </legend>
          <div className="grid gap-2">
            {Object.values(LEAD_DISTRIBUTION_MODES).map((value) => (
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
                    {value === LEAD_DISTRIBUTION_MODES.UNASSIGNED &&
                      'Leads stay in the shared pool until an admin assigns them.'}
                    {value === LEAD_DISTRIBUTION_MODES.SINGLE_USER &&
                      'Every imported lead goes to one marketing user.'}
                    {value === LEAD_DISTRIBUTION_MODES.ROUND_ROBIN &&
                      'Leads are split evenly across the selected marketing users.'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === LEAD_DISTRIBUTION_MODES.SINGLE_USER && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              Marketing user
            </span>
            <select
              value={assignedToUserId}
              onChange={(event) => setAssignedToUserId(event.target.value)}
              className={selectClasses}
            >
              <option value="">Select a marketing user</option>
              {marketingUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                  {user.marketingCode ? ` — ${user.marketingCode}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        {mode === LEAD_DISTRIBUTION_MODES.ROUND_ROBIN && (
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
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {allocation.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Allocation preview
            </h3>
            <div className="mt-2 divide-y divide-border">
              {allocation.map((entry) => {
                const user = userById.get(entry.userId);
                return (
                  <div
                    key={entry.userId}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="text-foreground">
                      {user?.name ?? 'Marketing user'}
                      {user?.marketingCode ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {user.marketingCode}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-medium text-foreground">
                      {entry.count} lead{entry.count === 1 ? '' : 's'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            Default lead status
          </span>
          <select
            value={defaultStatus}
            onChange={(event) => setDefaultStatus(event.target.value)}
            className={selectClasses}
          >
            {Object.values(LEAD_STATUSES).map((value) => (
              <option key={value} value={value}>
                {LEAD_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Every imported lead starts at this pipeline stage.
          </span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">
            Duplicate handling
          </legend>
          {Object.values(LEAD_DUPLICATE_POLICIES).map((value) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                duplicatePolicy === value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/30'
              )}
            >
              <input
                type="radio"
                name="duplicatePolicy"
                value={value}
                checked={duplicatePolicy === value}
                onChange={() => setDuplicatePolicy(value)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {value === LEAD_DUPLICATE_POLICIES.SKIP
                    ? 'Skip duplicates'
                    : 'Import duplicates'}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {value === LEAD_DUPLICATE_POLICIES.SKIP
                    ? 'Rows whose email or phone matches an existing lead (or another row in this file) are skipped. They are counted but not imported.'
                    : 'Rows matching an existing lead are still imported. Use this when the same person may legitimately enquire more than once.'}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Duplicate detection is advisory — leads are never merged or
          blocked automatically. Email and phone are intentionally not
          unique in the CRM.
        </p>
      </div>
    );
  }

  function renderReview() {
    const assignedLabel =
      mode === LEAD_DISTRIBUTION_MODES.UNASSIGNED
        ? 'Unassigned pool'
        : mode === LEAD_DISTRIBUTION_MODES.SINGLE_USER
          ? (userById.get(assignedToUserId)?.name ?? 'One user')
          : `${selectedUserIds.length} users (round robin)`;

    return (
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto rounded-lg border border-border">
          <dl className="divide-y divide-border text-sm">
            <ReviewRow label="File" value={`${fileName} (${rowCount.toLocaleString()} rows)`} />
            <ReviewRow label="Rows to import" value={String(willImport)} />
            <ReviewRow
              label="Skipped"
              value={`${summary?.invalidRows ?? 0} invalid · ${summary?.skippedDuplicateRows ?? 0} duplicate(s)`}
            />
            <ReviewRow label="Assignment" value={`${LEAD_DISTRIBUTION_MODE_LABELS[mode]} — ${assignedLabel}`} />
            <ReviewRow label="Default status" value={LEAD_STATUS_LABELS[defaultStatus as keyof typeof LEAD_STATUS_LABELS] ?? defaultStatus} />
            <ReviewRow
              label="Duplicates"
              value={duplicatePolicy === LEAD_DUPLICATE_POLICIES.SKIP ? 'Skipped' : 'Imported'}
            />
          </dl>
        </div>

        {commitError.error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {commitError.error}
          </p>
        )}

        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          The server re-parses and re-validates the file on import, so
          the result always matches this preview. Lead codes are reserved
          atomically and cannot collide with manual entry. Timeline
          entries are written for imports of up to {LEAD_BULK_ACTIVITY_LIMIT} leads;
          larger batches are covered by the import batch record.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {renderStepIndicator()}

      <div className="rounded-xl border border-border bg-card p-6">
        {step === 1 && renderUpload()}
        {step === 2 && renderMapping()}
        {step === 3 && renderPreview()}
        {step === 4 && renderAssignment()}
        {step === 5 && renderSettings()}
        {step === 6 && renderReview()}
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={back}
          disabled={step === 1 || commitPending}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>

        {step < 6 ? (
          <Button
            type="button"
            onClick={() => {
              if (step === 3) {
                // Re-validate whenever the mapping or policy changes
                // before moving on, so the preview is always current.
                void runPreview();
              }
              next();
            }}
            disabled={!canContinue || commitPending}
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <form action={commitAction} className="inline-flex">
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="fileName" value={fileName} />
            <input type="hidden" name="csvText" value={csvText} />
            <input
              type="hidden"
              name="mapping"
              value={JSON.stringify(mapping)}
            />
            <input
              type="hidden"
              name="distributionMode"
              value={mode}
            />
            <input
              type="hidden"
              name="assignedToUserId"
              value={assignedToUserId}
            />
            <input
              type="hidden"
              name="userIds"
              value={JSON.stringify(selectedUserIds)}
            />
            <input type="hidden" name="defaultStatus" value={defaultStatus} />
            <input type="hidden" name="duplicatePolicy" value={duplicatePolicy} />
            <Button type="submit" disabled={!canContinue || commitPending}>
              {commitPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileUp className="h-4 w-4" aria-hidden="true" />
              )}
              {commitPending
                ? 'Importing…'
                : `Import ${willImport.toLocaleString()} lead${willImport === 1 ? '' : 's'}`}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'danger' | 'primary';
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-destructive',
          (tone === 'primary' || !tone) && 'text-foreground'
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
