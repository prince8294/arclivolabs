import {
  TAX_TREATMENTS,
  type TaxTreatment,
} from '@/lib/constants/enums';
import { applyPercentage } from '@/lib/utils/money';

export interface RawLineItemInput {
  description: string;
  serviceId?: string | null;
  quantity: number;
  unit?: string | null;
  unitPriceMinor: number;
  discountType?: 'PERCENTAGE' | 'FIXED' | null;
  discountValue?: number | null;
  taxRate?: number | null;
}

export interface ComputedLineItem {
  description: string;
  serviceId?: string | null;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  discountType: 'PERCENTAGE' | 'FIXED' | null;
  discountValue: number;
  discountMinor: number;
  taxRate: number;
  taxMinor: number;
  lineTotalMinor: number;
}

export interface ComputedInvoicePricing {
  lineItems: ComputedLineItem[];
  subtotalMinor: number; // Gross items subtotal before line discounts
  discountMinor: number; // Total discounts applied
  netSubtotalMinor: number; // Subtotal after discount, before tax
  taxMinor: number; // Total tax amount
  totalMinor: number; // Final payable grand total
  taxDetails: {
    taxEnabled: boolean;
    taxTreatment: TaxTreatment;
    taxLabel?: string | null;
    taxRate?: number;
    cgstMinor: number;
    sgstMinor: number;
    igstMinor: number;
    sellerState?: string | null;
    placeOfSupply?: string | null;
  };
}

/**
 * Server-side pricing recalculation.
 * Never trust arithmetic from the client browser.
 * Ensures non-negative numbers and strict integer minor-unit math.
 */
export function calculateInvoicePricing(
  items: RawLineItemInput[],
  taxConfig: {
    taxEnabled: boolean;
    taxTreatment?: TaxTreatment;
    taxLabel?: string | null;
    taxRate?: number | null;
    sellerState?: string | null;
    placeOfSupply?: string | null;
  }
): ComputedInvoicePricing {
  let grossSubtotalMinor = 0;
  let totalDiscountMinor = 0;
  let totalTaxMinor = 0;

  const effectiveTaxTreatment = taxConfig.taxEnabled
    ? (taxConfig.taxTreatment ?? TAX_TREATMENTS.NONE)
    : TAX_TREATMENTS.NONE;

  const invoiceLevelTaxRate = Math.max(0, Math.min(100, Number(taxConfig.taxRate ?? 0)));

  const computedItems: ComputedLineItem[] = items.map((raw) => {
    const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 1));
    const unitPriceMinor = Math.max(0, Math.round(Number(raw.unitPriceMinor) || 0));
    const itemGrossMinor = quantity * unitPriceMinor;

    let discountMinor = 0;
    const discountType = raw.discountType ?? null;
    const discountVal = Math.max(0, Number(raw.discountValue) || 0);

    if (discountType === 'PERCENTAGE') {
      const pct = Math.min(100, discountVal);
      discountMinor = applyPercentage(itemGrossMinor, pct);
    } else if (discountType === 'FIXED') {
      discountMinor = Math.min(itemGrossMinor, Math.round(discountVal));
    }

    const itemNetMinor = Math.max(0, itemGrossMinor - discountMinor);

    // If item explicitly has a tax rate, use that; otherwise if invoice tax is enabled, inherit invoiceLevelTaxRate
    const effectiveItemTaxRate =
      effectiveTaxTreatment !== TAX_TREATMENTS.NONE
        ? raw.taxRate !== undefined && raw.taxRate !== null && raw.taxRate >= 0
          ? Math.min(100, Number(raw.taxRate))
          : invoiceLevelTaxRate
        : 0;

    const itemTaxMinor =
      effectiveItemTaxRate > 0
        ? applyPercentage(itemNetMinor, effectiveItemTaxRate)
        : 0;

    const lineTotalMinor = itemNetMinor + itemTaxMinor;

    grossSubtotalMinor += itemGrossMinor;
    totalDiscountMinor += discountMinor;
    totalTaxMinor += itemTaxMinor;

    return {
      description: (raw.description || '').trim(),
      serviceId: raw.serviceId || null,
      quantity,
      unit: (raw.unit || 'unit').trim(),
      unitPriceMinor,
      discountType,
      discountValue: discountVal,
      discountMinor,
      taxRate: effectiveItemTaxRate,
      taxMinor: itemTaxMinor,
      lineTotalMinor,
    };
  });

  const netSubtotalMinor = Math.max(0, grossSubtotalMinor - totalDiscountMinor);
  const totalMinor = netSubtotalMinor + totalTaxMinor;

  let cgstMinor = 0;
  let sgstMinor = 0;
  let igstMinor = 0;

  if (effectiveTaxTreatment === TAX_TREATMENTS.CGST_SGST) {
    cgstMinor = Math.round(totalTaxMinor / 2);
    sgstMinor = totalTaxMinor - cgstMinor;
  } else if (effectiveTaxTreatment === TAX_TREATMENTS.IGST) {
    igstMinor = totalTaxMinor;
  }

  return {
    lineItems: computedItems,
    subtotalMinor: grossSubtotalMinor,
    discountMinor: totalDiscountMinor,
    netSubtotalMinor,
    taxMinor: totalTaxMinor,
    totalMinor,
    taxDetails: {
      taxEnabled: taxConfig.taxEnabled && effectiveTaxTreatment !== TAX_TREATMENTS.NONE,
      taxTreatment: effectiveTaxTreatment,
      taxLabel: taxConfig.taxLabel ?? (effectiveTaxTreatment === TAX_TREATMENTS.NONE ? null : 'GST'),
      taxRate: invoiceLevelTaxRate,
      cgstMinor,
      sgstMinor,
      igstMinor,
      sellerState: taxConfig.sellerState ?? null,
      placeOfSupply: taxConfig.placeOfSupply ?? null,
    },
  };
}
