'use client';

import { useMemo } from 'react';

import { DISCOUNT_TYPES, DISCOUNT_TYPE_LABELS } from '@/lib/constants/proposals';
import { formatMinor } from '@/lib/utils/money';

export interface PaymentMilestoneRow {
  key: string;
  name: string;
  type: string;
  value: string;
  condition: string;
  dueDate: string;
}

export function createEmptyMilestone(index = 0): PaymentMilestoneRow {
  return {
    key: `ms-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    type: DISCOUNT_TYPES.PERCENTAGE,
    value: '',
    condition: '',
    dueDate: '',
  };
}

export interface PaymentMilestoneEditorProps {
  rows: PaymentMilestoneRow[];
  currency: string;
  /** Server-computed grand total the schedule must reconcile with. */
  grandTotalMinor: number;
  onChange: (rows: PaymentMilestoneRow[]) => void;
}

const inputClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Payment milestone editor.
 *
 * These are PLANNED payments only. This component has no notion of "paid",
 * no receipt and no payment record: a finalized deal and a milestone are
 * both commercial intent, never money received.
 */
export default function PaymentMilestoneEditor({
  rows,
  currency,
  grandTotalMinor,
  onChange,
}: PaymentMilestoneEditorProps) {
  const schedule = useMemo(() => {
    const allPercent =
      rows.length > 0 && rows.every((row) => row.type === DISCOUNT_TYPES.PERCENTAGE);

    const amounts = rows.map((row, index) => {
      const value = Number(row.value) || 0;
      if (row.type === DISCOUNT_TYPES.PERCENTAGE) {
        const previouslyAssigned = rows.slice(0, index).reduce((sum, previous) => {
          if (previous.type !== DISCOUNT_TYPES.PERCENTAGE) return sum;
          const previousValue = Number(previous.value) || 0;
          return sum + Math.round((grandTotalMinor * Math.min(previousValue, 100)) / 100);
        }, 0);
        const amount =
          index === rows.length - 1
            ? grandTotalMinor - previouslyAssigned
            : Math.round((grandTotalMinor * Math.min(value, 100)) / 100);
        return amount;
      }
      return Math.round(value * 100);
    });

    const percentTotal = rows.reduce(
      (sum, row) => (row.type === DISCOUNT_TYPES.PERCENTAGE ? sum + (Number(row.value) || 0) : sum),
      0
    );
    const amountTotal = allPercent
      ? grandTotalMinor
      : amounts.reduce((sum, amount) => sum + amount, 0);

    return { amounts, percentTotal, amountTotal, allPercent };
  }, [rows, grandTotalMinor]);

  const mismatch = schedule.allPercent
    ? Math.abs(schedule.percentTotal - 100) > 0.0001
    : schedule.amounts.length > 0 && schedule.amountTotal !== grandTotalMinor;

  function update(key: string, patch: Partial<PaymentMilestoneRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Planned payment milestones. This schedule is part of the commercial
        offer only — no payment is recorded or received here.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-3">#</th>
              <th scope="col" className="px-3 py-3">Milestone</th>
              <th scope="col" className="px-3 py-3">Type</th>
              <th scope="col" className="px-3 py-3">Value</th>
              <th scope="col" className="px-3 py-3">Amount</th>
              <th scope="col" className="px-3 py-3">Payment condition</th>
              <th scope="col" className="px-3 py-3">Planned due date</th>
              <th scope="col" className="w-20 px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No milestones yet. Add the advance, progress and final
                  payment conditions the customer will follow.
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td className="px-3 py-3 text-muted-foreground">{index + 1}</td>
                <td className="px-3 py-3">
                  <input
                    type="text"
                    aria-label="Milestone name"
                    maxLength={150}
                    value={row.name}
                    onChange={(event) => update(row.key, { name: event.target.value })}
                    placeholder="e.g. Advance on signing"
                    className={`${inputClasses} min-w-44`}
                  />
                </td>
                <td className="px-3 py-3">
                  <select
                    aria-label="Milestone type"
                    value={row.type}
                    onChange={(event) => update(row.key, { type: event.target.value })}
                    className={`${inputClasses} w-36`}
                  >
                    <option value={DISCOUNT_TYPES.PERCENTAGE}>Percentage</option>
                    <option value={DISCOUNT_TYPES.FIXED}>Fixed Amount</option>
                  </select>
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    aria-label="Milestone value"
                    min="0"
                    step={row.type === DISCOUNT_TYPES.PERCENTAGE ? '0.01' : '0.01'}
                    value={row.value}
                    onChange={(event) => update(row.key, { value: event.target.value })}
                    className={`${inputClasses} w-28`}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-sm font-medium">
                  {formatMinor(schedule.amounts[index] ?? 0, currency)}
                </td>
                <td className="px-3 py-3">
                  <input
                    type="text"
                    aria-label="Payment condition"
                    maxLength={1000}
                    value={row.condition}
                    onChange={(event) => update(row.key, { condition: event.target.value })}
                    placeholder="e.g. On project kickoff"
                    className={`${inputClasses} min-w-48`}
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="date"
                    aria-label="Planned due date"
                    value={row.dueDate}
                    onChange={(event) => update(row.key, { dueDate: event.target.value })}
                    className={`${inputClasses} w-40`}
                  />
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
                    className="text-xs font-medium text-destructive transition-opacity hover:opacity-80"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => onChange([...rows, createEmptyMilestone(rows.length)])}
          className="inline-flex h-10 items-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
        >
          Add milestone
        </button>
        {rows.length > 0 && (
          <p
            className={`text-sm ${mismatch ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            Schedule {formatMinor(schedule.amountTotal, currency)} of{' '}
            {formatMinor(grandTotalMinor, currency)}
            {mismatch
              ? schedule.allPercent
                ? ` — percentages must total 100% (currently ${schedule.percentTotal}%).`
                : ' — milestone amounts must add up to the quotation total.'
              : ' — matches the quotation total.'}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {DISCOUNT_TYPE_LABELS[DISCOUNT_TYPES.FIXED]} milestones are converted to
        the agreed total server-side; any rounding remainder is assigned to the
        final milestone so the schedule always reconciles.
      </p>
    </div>
  );
}
