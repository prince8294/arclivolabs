'use client';

import { useMemo, useState } from 'react';

import {
  DISCOUNT_TYPES,
  DISCOUNT_TYPE_LABELS,
  PROPOSAL_UNITS,
} from '@/lib/constants/proposals';
import { fromMinorUnits } from '@/lib/utils/money';
import type { ServiceCatalogOption } from '@/types/proposals';

/**
 * One editable pricing row.
 *
 * This is the raw input only. The parent component owns the array and sends
 * it to the server as JSON; NO total computed here is ever submitted, and
 * the values below are typed major units for editing while the live preview
 * converts through the shared money helpers.
 */
export interface ProposalItemRow {
  /** Stable key for React rendering; never sent to the server. */
  key: string;
  serviceId: string;
  serviceName: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountType: string;
  discountValue: string;
  taxRatePercent: string;
}

export function createEmptyRow(index = 0): ProposalItemRow {
  return {
    key: `row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    serviceId: '',
    serviceName: '',
    description: '',
    quantity: '1',
    unit: 'Project',
    unitPrice: '',
    discountType: DISCOUNT_TYPES.NONE,
    discountValue: '0',
    taxRatePercent: '',
  };
}

export interface ProposalItemsEditorProps {
  rows: ProposalItemRow[];
  services: ServiceCatalogOption[];
  currency: string;
  disabled?: boolean;
  onChange: (rows: ProposalItemRow[]) => void;
}

const inputClasses =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClasses = 'text-xs font-medium text-muted-foreground';

/**
 * Dynamic line-item editor: add, remove, reorder and edit every priced row.
 *
 * Picking a catalogue service fills in the NAME only. It never copies a
 * catalogue price: a quotation may quote any negotiated rate, and changing
 * one must not rewrite the Service catalogue for everyone else.
 */
export default function ProposalItemsEditor({
  rows,
  services,
  currency,
  disabled = false,
  onChange,
}: ProposalItemsEditorProps) {
  const [reordering, setReordering] = useState(false);

  const preview = useMemo(
    () =>
      rows.map((row) => {
        const quantity = Number(row.quantity) || 0;
        const unitPrice = Number(row.unitPrice) || 0;
        const gross = unitPrice * quantity;
        const discountValue = Number(row.discountValue) || 0;
        const discount =
          row.discountType === DISCOUNT_TYPES.FIXED
            ? Math.min(Math.max(discountValue, 0), gross)
            : row.discountType === DISCOUNT_TYPES.PERCENTAGE
              ? Math.min(Math.max((gross * Math.min(discountValue, 100)) / 100, 0), gross)
              : 0;
        const net = gross - discount;
        const taxRate = row.taxRatePercent === '' ? null : Number(row.taxRatePercent);
        const tax = taxRate === null || Number.isNaN(taxRate) ? 0 : (net * Math.min(taxRate, 100)) / 100;
        return { gross, discount, net, tax, total: net + tax };
      }),
    [rows]
  );

  function updateRow(key: string, patch: Partial<ProposalItemRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) {
      return;
    }
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="w-8 px-3 py-3">
                <span className="sr-only">Reorder</span>
              </th>
              <th scope="col" className="px-3 py-3">Service</th>
              <th scope="col" className="px-3 py-3">Description</th>
              <th scope="col" className="px-3 py-3">Qty</th>
              <th scope="col" className="px-3 py-3">Unit</th>
              <th scope="col" className="px-3 py-3">Unit price</th>
              <th scope="col" className="px-3 py-3">Discount</th>
              <th scope="col" className="px-3 py-3">Tax %</th>
              <th scope="col" className="px-3 py-3 text-right">Line total</th>
              <th scope="col" className="w-20 px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, index) => (
              <tr key={row.key} className="align-top">
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={disabled || index === 0}
                      onClick={() => moveRow(index, -1)}
                      aria-label="Move row up"
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={disabled || index === rows.length - 1}
                      onClick={() => moveRow(index, 1)}
                      aria-label="Move row down"
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex min-w-52 flex-col gap-2">
                    {services.length > 0 && (
                      <select
                        aria-label="Catalogue service"
                        disabled={disabled}
                        value={row.serviceId}
                        onChange={(event) => {
                          const serviceId = event.target.value;
                          const service = services.find((item) => item.id === serviceId);
                          updateRow(row.key, {
                            serviceId,
                            // Only the name is copied. Price is always typed
                            // by the admin for this specific quotation.
                            serviceName: service ? service.name : row.serviceName,
                          });
                        }}
                        className={inputClasses}
                      >
                        <option value="">Custom service</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      aria-label="Service name"
                      disabled={disabled}
                      maxLength={150}
                      value={row.serviceName}
                      onChange={(event) =>
                        updateRow(row.key, { serviceName: event.target.value })
                      }
                      placeholder="e.g. Website Development"
                      className={inputClasses}
                    />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <textarea
                    aria-label="Line description"
                    disabled={disabled}
                    maxLength={500}
                    rows={2}
                    value={row.description}
                    onChange={(event) =>
                      updateRow(row.key, { description: event.target.value })
                    }
                    className="w-full min-w-40 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    aria-label="Quantity"
                    disabled={disabled}
                    min="0.01"
                    step="0.01"
                    value={row.quantity}
                    onChange={(event) =>
                      updateRow(row.key, { quantity: event.target.value })
                    }
                    className={`${inputClasses} w-24`}
                  />
                </td>
                <td className="px-3 py-3">
                  <select
                    aria-label="Unit"
                    disabled={disabled}
                    value={row.unit}
                    onChange={(event) =>
                      updateRow(row.key, { unit: event.target.value })
                    }
                    className={`${inputClasses} w-28`}
                  >
                    {PROPOSAL_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    aria-label="Unit price"
                    disabled={disabled}
                    min="0"
                    step="0.01"
                    value={row.unitPrice}
                    onChange={(event) =>
                      updateRow(row.key, { unitPrice: event.target.value })
                    }
                    className={`${inputClasses} w-32`}
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex min-w-32 flex-col gap-1">
                    <select
                      aria-label="Line discount type"
                      disabled={disabled}
                      value={row.discountType}
                      onChange={(event) =>
                        updateRow(row.key, { discountType: event.target.value })
                      }
                      className={inputClasses}
                    >
                      {Object.values(DISCOUNT_TYPES).map((value) => (
                        <option key={value} value={value}>
                          {DISCOUNT_TYPE_LABELS[value]}
                        </option>
                      ))}
                    </select>
                    {row.discountType !== DISCOUNT_TYPES.NONE && (
                      <input
                        type="number"
                        aria-label="Line discount value"
                        disabled={disabled}
                        min="0"
                        step="0.01"
                        value={row.discountValue}
                        onChange={(event) =>
                          updateRow(row.key, { discountValue: event.target.value })
                        }
                        className={inputClasses}
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    aria-label="Line tax rate percent"
                    disabled={disabled}
                    min="0"
                    max="100"
                    step="0.01"
                    value={row.taxRatePercent}
                    onChange={(event) =>
                      updateRow(row.key, { taxRatePercent: event.target.value })
                    }
                    placeholder="—"
                    className={`${inputClasses} w-24`}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-medium">
                  {preview[index].total > 0
                    ? `${currency} ${fromMinorUnits(
                        Math.round(preview[index].total * 100),
                        currency
                      ).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                    : '—'}
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    disabled={disabled || rows.length === 1}
                    onClick={() =>
                      onChange(rows.filter((item) => item.key !== row.key))
                    }
                    className="text-xs font-medium text-destructive transition-opacity hover:opacity-80 disabled:opacity-30"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...rows, createEmptyRow(rows.length)])}
          className="inline-flex h-10 items-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          Add line item
        </button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={reordering}
            onChange={(event) => setReordering(event.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Show reorder arrows
        </label>
        {!reordering && (
          <p className="text-xs text-muted-foreground">
            Use the arrows in the first column to reorder rows.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Totals shown here are a live preview only. The server recalculates every
        amount from the rows you submit.
      </p>
    </div>
  );
}