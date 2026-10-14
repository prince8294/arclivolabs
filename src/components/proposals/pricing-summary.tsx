'use client';

import { useMemo } from 'react';

import {
  DISCOUNT_TYPES,
  DISCOUNT_TYPE_LABELS,
} from '@/lib/constants/proposals';
import { computeProposalPricing } from '@/lib/proposals/pricing';
import { formatMinor } from '@/lib/utils/money';
import type { ProposalItemRow } from './proposal-items-editor';

export interface PricingSummaryProps {
  rows: ProposalItemRow[];
  currency: string;
  proposalDiscountType: string;
  proposalDiscountValue: string;
  taxEnabled: boolean;
  taxRatePercent: string;
  taxLabel: string;
}

/**
 * Live pricing panel.
 *
 * It reuses the exact server pricing engine, so the admin sees exactly what
 * will be stored - and because the engine is pure, the preview and the
 * saved document can never disagree. Nothing computed here is submitted.
 */
export default function PricingSummary({
  rows,
  currency,
  proposalDiscountType,
  proposalDiscountValue,
  taxEnabled,
  taxRatePercent,
  taxLabel,
}: PricingSummaryProps) {
  const result = useMemo(
    () =>
      computeProposalPricing({
        currency,
        lines: rows.map((row) => ({
          serviceId: row.serviceId || null,
          serviceName: row.serviceName,
          description: row.description || null,
          quantity: Number(row.quantity) || 0,
          unit: row.unit,
          unitPrice: Number(row.unitPrice) || 0,
          discountType: row.discountType as never,
          discountValue: Number(row.discountValue) || 0,
          taxRatePercent:
            row.taxRatePercent === '' ? null : Number(row.taxRatePercent),
        })),
        proposalDiscount: {
          discountType: proposalDiscountType as never,
          discountValue: Number(proposalDiscountValue) || 0,
        },
        proposalTax: {
          enabled: taxEnabled,
          ratePercent: Number(taxRatePercent) || 0,
          label: taxLabel || null,
        },
      }),
    [
      rows,
      currency,
      proposalDiscountType,
      proposalDiscountValue,
      taxEnabled,
      taxRatePercent,
      taxLabel,
    ]
  );

  const { pricing, issues } = result;

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-1 text-sm">
        <Row
          label="Subtotal"
          value={formatMinor(pricing.subtotalMinor, currency)}
        />
        {pricing.lineDiscountTotalMinor > 0 && (
          <Row
            label="Line discounts"
            value={`- ${formatMinor(pricing.lineDiscountTotalMinor, currency)}`}
          />
        )}
        {pricing.proposalDiscountMinor > 0 && (
          <Row
            label={
              pricing.proposalDiscountType === DISCOUNT_TYPES.PERCENTAGE
                ? `Discount (${pricing.proposalDiscountValueMinor}%)`
                : DISCOUNT_TYPE_LABELS[pricing.proposalDiscountType] ?? 'Discount'
            }
            value={`- ${formatMinor(pricing.proposalDiscountMinor, currency)}`}
          />
        )}
        {pricing.lineTaxTotalMinor > 0 && (
          <Row
            label="Tax on line items"
            value={formatMinor(pricing.lineTaxTotalMinor, currency)}
          />
        )}
        {pricing.proposalTaxMinor > 0 && (
          <Row
            label={pricing.proposalTaxLabel ?? 'Tax'}
            value={formatMinor(pricing.proposalTaxMinor, currency)}
          />
        )}
        <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
          <dt className="font-semibold text-foreground">Grand Total</dt>
          <dd className="text-lg font-semibold text-foreground">
            {formatMinor(pricing.grandTotalMinor, currency)}
          </dd>
        </div>
      </dl>

      {issues.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {issues.map((issue, index) => (
            <li key={`${issue.lineIndex}-${index}`}>
              {issue.lineIndex >= 0
                ? `Row ${issue.lineIndex + 1}: ${issue.message}`
                : issue.message}
            </li>
          ))}
        </ul>
      )}

      {!taxEnabled && pricing.lineTaxTotalMinor === 0 && (
        <p className="text-xs text-muted-foreground">
          No tax is configured for this quotation, so none is charged or shown
          on the PDF.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}