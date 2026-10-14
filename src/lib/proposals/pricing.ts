/**
 * Server-authoritative pricing engine for proposals (Part 9).
 *
 * This module is the ONLY place that decides what a quotation costs.
 * The browser may render a live preview with the same helpers for UX, but
 * every server action re-runs `computeProposalPricing` on the stored
 * inputs and stores the returned integers. A total posted by a client is
 * never read back.
 *
 * Calculation order (explicit, to avoid ambiguous double-discounting):
 *
 *   1. line gross      = quantity x unitPrice
 *   2. line discount   = fixed | percent of the line gross
 *      line net        = line gross - line discount        (floored at 0)
 *   3. subtotal        = sum of all line nets
 *   4. proposal discount = fixed | percent of the subtotal (floored at 0)
 *   5. taxable base    = subtotal - proposal discount
 *   6. tax             = sum over lines of line net x line tax rate,
 *                        PLUS the optional proposal-level tax applied to
 *                        the taxable base. Tax is never auto-applied: a
 *                        quotation with no tax configured has no tax line.
 *   7. grand total     = taxable base + tax
 *
 * Everything is integer minor units (`@/lib/utils/money`), so there is no
 * floating point drift between the preview, the stored document, the PDF
 * and the finalized Deal.
 *
 * Pure module: no Mongoose, no `server-only`.
 */

import {
  DISCOUNT_TYPES,
  PROPOSAL_LIMITS,
  type DiscountType,
} from '@/lib/constants/proposals';
import { applyPercentage, fromMinorUnits, toMinorUnits } from '@/lib/utils/money';

/** Raw, untrusted line item exactly as it arrives from a form. */
export interface PricingLineInput {
  /** Catalogue service id, or null for a custom service. */
  serviceId?: string | null;
  /** Free-text service name (used when serviceId is absent). */
  serviceName: string;
  description?: string | null;
  /** Major-unit decimal as typed by the user. */
  quantity: number;
  unit: string;
  /** Major-unit decimal as typed by the user. */
  unitPrice: number;
  discountType?: DiscountType;
  /** Major-unit decimal (FIXED) or percent (PERCENTAGE). */
  discountValue?: number;
  /** Percent, e.g. 18. Empty / null means "not taxable". */
  taxRatePercent?: number | null;
}

/** Optional proposal-level discount. */
export interface ProposalDiscountInput {
  discountType?: DiscountType;
  /** Major-unit decimal (FIXED) or percent (PERCENTAGE). */
  discountValue?: number;
}

/** Optional proposal-level tax applied to the post-discount base. */
export interface ProposalTaxInput {
  enabled: boolean;
  /** Percent, e.g. 18. */
  ratePercent: number;
  /** Optional label printed on the PDF, e.g. "GST (18%)". */
  label?: string | null;
}

/** A computed, persistable line item. */
export interface ComputedLineItem {
  serviceId: string | null;
  serviceName: string;
  description: string | null;
  /** Quantity as entered (major units). */
  quantity: number;
  unit: string;
  /** Minor units. */
  grossMinor: number;
  discountType: DiscountType;
  discountValueMinor: number;
  discountMinor: number;
  /** grossMinor - discountMinor, in minor units. */
  netMinor: number;
  taxRatePercent: number | null;
  taxMinor: number;
  /** netMinor + taxMinor, in minor units. */
  lineTotalMinor: number;
}

export interface ComputedPricing {
  currency: string;
  lineItems: ComputedLineItem[];
  /** Sum of line nets. */
  subtotalMinor: number;
  /** Total of all line discounts. */
  lineDiscountTotalMinor: number;
  proposalDiscountType: DiscountType;
  proposalDiscountValueMinor: number;
  proposalDiscountMinor: number;
  /** Sum of line tax amounts. */
  lineTaxTotalMinor: number;
  /** Proposal-level tax applied to the taxable base. */
  proposalTaxRatePercent: number | null;
  proposalTaxLabel: string | null;
  proposalTaxMinor: number;
  taxMinor: number;
  /** subtotal - proposalDiscount. */
  taxableBaseMinor: number;
  grandTotalMinor: number;
  /** True when any tax is configured anywhere. Drives the PDF tax rows. */
  hasTax: boolean;
}

/** Validation problem found while computing, returned instead of thrown. */
export interface PricingIssue {
  /** Index of the offending line item, or -1 for proposal-level. */
  lineIndex: number;
  message: string;
}

export interface ComputeResult {
  pricing: ComputedPricing;
  issues: PricingIssue[];
}

/**
 * Resolve a discount to minor units for a given base.
 *
 * - NONE -> 0
 * - FIXED -> the entered amount (clamped to the base, never negative)
 * - PERCENTAGE -> percent of the base, clamped to the base
 *
 * Clamping (rather than rejecting) is used internally so a rounded
 * percentage can never produce a negative net; the *submitted* discount is
 * still range-checked by the Zod schema before we get here.
 */
export function resolveDiscountMinor(
  baseMinor: number,
  type: DiscountType | undefined,
  valueMinor: number
): number {
  switch (type) {
    case DISCOUNT_TYPES.FIXED:
      return clamp(valueMinor, 0, baseMinor);
    case DISCOUNT_TYPES.PERCENTAGE:
      return clamp(applyPercentage(baseMinor, Math.max(0, Number(valueMinor) || 0)), 0, baseMinor);
    case DISCOUNT_TYPES.NONE:
    default:
      return 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

/** Percent of a base expressed in minor units, for a percentage-typed value. */
function percentToMinor(baseMinor: number, percent: number): number {
  return clamp(applyPercentage(baseMinor, percent), 0, Number.MAX_SAFE_INTEGER);
}

/**
 * Compute the whole quotation from untrusted line inputs.
 *
 * Pure: same input always yields the same integer totals. Returns the
 * computed pricing plus a list of human-readable issues (invalid
 * quantity, missing name, over-large amount, ...) that the caller must
 * surface instead of persisting a malformed quote.
 */
export function computeProposalPricing(params: {
  currency: string;
  lines: readonly PricingLineInput[];
  proposalDiscount?: ProposalDiscountInput;
  proposalTax?: ProposalTaxInput;
}): ComputeResult {
  const { currency } = params;
  const issues: PricingIssue[] = [];

  const lineItems: ComputedLineItem[] = params.lines.map((line, lineIndex) => {
    const serviceName = (line.serviceName ?? '').trim();
    if (!serviceName) {
      issues.push({ lineIndex, message: 'Every line item needs a service name.' });
    }

    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      issues.push({ lineIndex, message: 'Quantity must be greater than zero.' });
    }
    if (quantity > 1_000_000) {
      issues.push({ lineIndex, message: 'Quantity is unrealistically large.' });
    }

    const unitPrice = Number(line.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      issues.push({ lineIndex, message: 'Unit price must be zero or greater.' });
    }
    if (Math.abs(unitPrice) > PROPOSAL_LIMITS.MAX_AMOUNT) {
      issues.push({ lineIndex, message: 'Unit price is too large.' });
    }

    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    const safeUnitPrice = Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;

    // Multiply in minor units to keep the gross exact.
    const grossMinor = Math.round(toMinorUnits(safeUnitPrice, currency) * safeQuantity);

    const discountType: DiscountType = line.discountType ?? DISCOUNT_TYPES.NONE;
    const rawDiscountValue = Number(line.discountValue ?? 0);
    if (
      !Number.isFinite(rawDiscountValue) ||
      rawDiscountValue < 0 ||
      (discountType === DISCOUNT_TYPES.PERCENTAGE && rawDiscountValue > 100)
    ) {
      issues.push({
        lineIndex,
        message: 'Line discount must be a valid amount or a percentage up to 100.',
      });
    }

    const discountValueMinor =
      discountType === DISCOUNT_TYPES.PERCENTAGE
        ? clamp(rawDiscountValue, 0, 100)
        : toMinorUnits(Math.max(0, rawDiscountValue || 0), currency);

    // An entered line discount may never exceed the line gross.
    if (discountValueMinor > grossMinor) {
      issues.push({
        lineIndex,
        message: 'Line discount cannot exceed the line amount.',
      });
    }

    const discountMinor = resolveDiscountMinor(grossMinor, discountType, discountValueMinor);
    const netMinor = grossMinor - discountMinor;

    const taxRatePercent =
      line.taxRatePercent === null || line.taxRatePercent === undefined
        ? null
        : Number(line.taxRatePercent);
    if (taxRatePercent !== null && (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100)) {
      issues.push({ lineIndex, message: 'Tax rate must be between 0 and 100.' });
    }
    const effectiveTaxRate =
      taxRatePercent !== null && Number.isFinite(taxRatePercent) && taxRatePercent >= 0
        ? Math.min(taxRatePercent, 100)
        : null;
    const taxMinor = effectiveTaxRate === null ? 0 : percentToMinor(netMinor, effectiveTaxRate);

    return {
      serviceId: line.serviceId ?? null,
      serviceName,
      description: (line.description ?? '').trim() || null,
      quantity: safeQuantity,
      unit: (line.unit ?? '').trim() || 'Project',
      grossMinor,
      discountType,
      discountValueMinor,
      discountMinor,
      netMinor,
      taxRatePercent: effectiveTaxRate,
      taxMinor,
      lineTotalMinor: netMinor + taxMinor,
    };
  });

  const subtotalMinor = lineItems.reduce((sum, item) => sum + item.netMinor, 0);
  const lineDiscountTotalMinor = lineItems.reduce(
    (sum, item) => sum + item.discountMinor,
    0
  );
  const lineTaxTotalMinor = lineItems.reduce((sum, item) => sum + item.taxMinor, 0);

  const proposalDiscountType: DiscountType =
    params.proposalDiscount?.discountType ?? DISCOUNT_TYPES.NONE;
  const rawProposalDiscount = Number(params.proposalDiscount?.discountValue ?? 0);
  if (
    !Number.isFinite(rawProposalDiscount) ||
    rawProposalDiscount < 0 ||
    (proposalDiscountType === DISCOUNT_TYPES.PERCENTAGE && rawProposalDiscount > 100)
  ) {
    issues.push({
      lineIndex: -1,
      message: 'Proposal discount must be a valid amount or a percentage up to 100.',
    });
  }

  const proposalDiscountValueMinor =
    proposalDiscountType === DISCOUNT_TYPES.PERCENTAGE
      ? clamp(rawProposalDiscount, 0, 100)
      : toMinorUnits(Math.max(0, rawProposalDiscount || 0), currency);

  if (proposalDiscountValueMinor > subtotalMinor) {
    issues.push({
      lineIndex: -1,
      message: 'Proposal discount cannot exceed the subtotal.',
    });
  }

  const proposalDiscountMinor = resolveDiscountMinor(
    subtotalMinor,
    proposalDiscountType,
    proposalDiscountValueMinor
  );
  const taxableBaseMinor = subtotalMinor - proposalDiscountMinor;

  const proposalTax = params.proposalTax;
  const proposalTaxEnabled = Boolean(proposalTax?.enabled);
  const proposalTaxRatePercent = proposalTaxEnabled ? Number(proposalTax?.ratePercent ?? 0) : null;
  if (
    proposalTaxEnabled &&
    (!Number.isFinite(proposalTaxRatePercent as number) ||
      (proposalTaxRatePercent as number) < 0 ||
      (proposalTaxRatePercent as number) > 100)
  ) {
    issues.push({ lineIndex: -1, message: 'Tax rate must be between 0 and 100.' });
  }
  const effectiveProposalTaxRate =
    proposalTaxEnabled && Number.isFinite(proposalTaxRatePercent as number)
      ? Math.min(Math.max(proposalTaxRatePercent as number, 0), 100)
      : null;
  const proposalTaxMinor =
    effectiveProposalTaxRate === null
      ? 0
      : percentToMinor(taxableBaseMinor, effectiveProposalTaxRate);

  const taxMinor = lineTaxTotalMinor + proposalTaxMinor;

  return {
    pricing: {
      currency,
      lineItems,
      subtotalMinor,
      lineDiscountTotalMinor,
      proposalDiscountType,
      proposalDiscountValueMinor,
      proposalDiscountMinor,
      lineTaxTotalMinor,
      proposalTaxRatePercent: effectiveProposalTaxRate,
      proposalTaxLabel:
        effectiveProposalTaxRate === null
          ? null
          : (proposalTax?.label?.trim() || `Tax (${effectiveProposalTaxRate}%)`),
      proposalTaxMinor,
      taxMinor,
      taxableBaseMinor,
      grandTotalMinor: taxableBaseMinor + taxMinor,
      hasTax: taxMinor > 0,
    },
    issues,
  };
}

/**
 * A quotation may only be ISSUED when it is commercially meaningful:
 * at least one priced line with a positive total. Without this check an
 * empty draft could be issued to a customer as a "quotation".
 */
export function hasMeaningfulPricing(pricing: ComputedPricing): boolean {
  return pricing.lineItems.some(
    (item) => item.serviceName.length > 0 && item.lineTotalMinor > 0
  );
}

/** Convenience wrapper used by the payment-milestone validator. */
export function major(minor: number, currency: string): number {
  return fromMinorUnits(minor, currency);
}