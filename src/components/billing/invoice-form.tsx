'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

import Button from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  INVOICE_TYPES,
  TAX_TREATMENTS,
  type InvoiceType,
  type TaxTreatment,
} from '@/lib/constants/enums';
import { calculateInvoicePricing, type RawLineItemInput } from '@/lib/billing/pricing';
import { createInvoiceDraftAction, issueInvoiceAction, updateInvoiceDraftAction } from '@/lib/actions/invoices';
import { formatMinor } from '@/lib/utils/money';

export interface ClientOption {
  id: string;
  name: string;
  companyName?: string | null;
  clientCode: string;
}

export interface DealOption {
  id: string;
  dealCode: string;
  title: string;
  clientId?: string | null;
  agreedAmountMinor: number;
  currency: string;
  paymentPlanSnapshot?: Array<{
    name: string;
    amountMinor: number;
    condition?: string | null;
    dueDate?: string | null;
    sequence: number;
  }>;
}

export interface ProjectOption {
  id: string;
  projectCode: string;
  title: string;
  clientId: string;
  dealId?: string | null;
}

export interface MilestoneOption {
  id: string;
  code: string;
  title: string;
  amountMinor: number;
  status: string;
}

interface InvoiceFormProps {
  initialData?: any;
  isEdit?: boolean;
  clients: ClientOption[];
  deals: DealOption[];
  projects: ProjectOption[];
  defaultSettings?: any;
  preselectedClientId?: string;
  preselectedDealId?: string;
  preselectedProjectId?: string;
}

interface FormLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number; // in major units for human input
  discountType: 'PERCENTAGE' | 'FIXED' | 'NONE';
  discountValue: number;
  taxRate: number;
}

export function InvoiceForm({
  initialData,
  isEdit = false,
  clients,
  deals,
  projects,
  defaultSettings,
  preselectedClientId,
  preselectedDealId,
  preselectedProjectId,
}: InvoiceFormProps) {
  const router = useRouter();
  const idPrefix = useId();

  const [clientId, setClientId] = useState(
    initialData?.clientId?._id?.toString() || initialData?.clientId || preselectedClientId || ''
  );
  const [dealId, setDealId] = useState(
    initialData?.dealId?._id?.toString() || initialData?.dealId || preselectedDealId || ''
  );
  const [projectId, setProjectId] = useState(
    initialData?.projectId?._id?.toString() || initialData?.projectId || preselectedProjectId || ''
  );
  const [billingMilestoneId, setBillingMilestoneId] = useState(
    initialData?.billingMilestoneId?.toString() || ''
  );

  const [invoiceType, setInvoiceType] = useState<InvoiceType>(
    initialData?.invoiceType || INVOICE_TYPES.STANDARD
  );
  const [currency, setCurrency] = useState(initialData?.currency || 'INR');

  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 15);

  const [issueDate, setIssueDate] = useState<string>(
    initialData?.issueDate
      ? new Date(initialData.issueDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState<string>(
    initialData?.dueDate
      ? new Date(initialData.dueDate).toISOString().split('T')[0]
      : defaultDue.toISOString().split('T')[0]
  );

  const [description, setDescription] = useState(initialData?.description || '');
  const [terms, setTerms] = useState(
    initialData?.terms ?? (defaultSettings?.defaultPaymentTerms || 'Payment due within 15 days.')
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [billingInstructions, setBillingInstructions] = useState(
    initialData?.billingInstructions ||
      (defaultSettings?.upiPaymentInstructions || defaultSettings?.bankAccountDetails || '')
  );

  // Tax Configuration
  const [taxEnabled, setTaxEnabled] = useState<boolean>(
    initialData?.taxDetails?.taxEnabled ?? (defaultSettings?.taxEnabled || false)
  );
  const [taxTreatment, setTaxTreatment] = useState<TaxTreatment>(
    initialData?.taxDetails?.taxTreatment ?? (defaultSettings?.defaultTaxTreatment || TAX_TREATMENTS.NONE)
  );
  const [taxRate, setTaxRate] = useState<number>(
    initialData?.taxDetails?.taxRate ?? (defaultSettings?.defaultTaxRate || 0)
  );
  const [taxLabel, setTaxLabel] = useState<string>(
    initialData?.taxDetails?.taxLabel || defaultSettings?.taxLabel || 'GSTIN'
  );
  const [sellerState, setSellerState] = useState<string>(
    initialData?.taxDetails?.sellerState || defaultSettings?.sellerState || ''
  );
  const [placeOfSupply, setPlaceOfSupply] = useState<string>(
    initialData?.taxDetails?.placeOfSupply || ''
  );

  // Line items state
  const initialItems: FormLineItem[] = initialData?.lineItems?.length
    ? initialData.lineItems.map((li: any, idx: number) => ({
        id: `item-${idx}`,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit || 'unit',
        unitPrice: li.unitPriceMinor / 100,
        discountType: li.discountType || 'NONE',
        discountValue: li.discountValue || 0,
        taxRate: li.taxRate || 0,
      }))
    : [
        {
          id: 'item-0',
          description: '',
          quantity: 1,
          unit: 'unit',
          unitPrice: 0,
          discountType: 'NONE',
          discountValue: 0,
          taxRate: 0,
        },
      ];

  const [lineItems, setLineItems] = useState<FormLineItem[]>(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter deals and projects matching selected client
  const availableDeals = deals.filter((d) => !clientId || d.clientId === clientId);
  const availableProjects = projects.filter((p) => !clientId || p.clientId === clientId);

  const selectedDeal = deals.find((d) => d.id === dealId);

  // Handle deal selection changes
  function handleDealChange(newDealId: string) {
    setDealId(newDealId);
    if (!newDealId) return;

    const d = deals.find((item) => item.id === newDealId);
    if (d) {
      if (d.clientId && (!clientId || clientId !== d.clientId)) {
        setClientId(d.clientId);
      }
      setCurrency(d.currency || 'INR');

      // Auto-populate description if empty
      if (!description) {
        setDescription(`Billing for agreement ${d.dealCode}: ${d.title}`);
      }

      // Find matching project
      const matchedProj = projects.find((p) => p.dealId === d.id);
      if (matchedProj && !projectId) {
        setProjectId(matchedProj.id);
      }
    }
  }

  // Pre-fill from selected milestone
  function handleMilestoneSelect(seqIdxStr: string) {
    if (!seqIdxStr || !selectedDeal?.paymentPlanSnapshot) return;
    const idx = parseInt(seqIdxStr, 10);
    const ms = selectedDeal.paymentPlanSnapshot[idx];
    if (!ms) return;

    setBillingMilestoneId(seqIdxStr);
    setInvoiceType(idx === selectedDeal.paymentPlanSnapshot.length - 1 ? INVOICE_TYPES.FINAL : INVOICE_TYPES.MILESTONE);

    // Populate line item
    setLineItems([
      {
        id: 'item-0',
        description: `${ms.name}${ms.condition ? ` (${ms.condition})` : ''}`,
        quantity: 1,
        unit: 'installment',
        unitPrice: ms.amountMinor / 100,
        discountType: 'NONE',
        discountValue: 0,
        taxRate: 0,
      },
    ]);
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length}`,
        description: '',
        quantity: 1,
        unit: 'unit',
        unitPrice: 0,
        discountType: 'NONE',
        discountValue: 0,
        taxRate: 0,
      },
    ]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof FormLineItem, value: any) {
    setLineItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  // Calculate live preview totals
  const rawItemsForCalc: RawLineItemInput[] = lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceMinor: Math.round(item.unitPrice * 100),
    discountType: item.discountType === 'NONE' ? null : item.discountType,
    discountValue: item.discountType === 'FIXED' ? Math.round(item.discountValue * 100) : item.discountValue,
    taxRate: item.taxRate,
  }));

  const pricingPreview = calculateInvoicePricing(rawItemsForCalc, {
    taxEnabled,
    taxTreatment,
    taxLabel,
    taxRate,
    sellerState,
    placeOfSupply,
  });

  async function handleSubmit(shouldIssue = false) {
    setError(null);

    if (!clientId) {
      setError('Please select a Client.');
      return;
    }

    if (lineItems.length === 0 || !lineItems.some((i) => i.description.trim())) {
      setError('Please add at least one line item with a description.');
      return;
    }

    setIsLoading(true);

    const payload = {
      clientId,
      dealId: dealId || null,
      projectId: projectId || null,
      billingMilestoneId: billingMilestoneId || null,
      invoiceType,
      currency,
      lineItems: rawItemsForCalc,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      description: description.trim() || null,
      terms: terms.trim() || null,
      notes: notes.trim() || null,
      billingInstructions: billingInstructions.trim() || null,
      taxEnabled,
      taxTreatment,
      taxRate: Number(taxRate) || 0,
      taxLabel: taxLabel.trim() || null,
      sellerState: sellerState.trim() || null,
      placeOfSupply: placeOfSupply.trim() || null,
    };

    try {
      if (isEdit && initialData?._id) {
        const res = await updateInvoiceDraftAction(initialData._id.toString(), payload as any);
        if (!res.success) {
          setError(res.error || 'Failed to update invoice draft.');
          setIsLoading(false);
          return;
        }

        if (shouldIssue) {
          const issueRes = await issueInvoiceAction(initialData._id.toString());
          if (!issueRes.success) {
            setError(issueRes.error || 'Saved draft, but failed to issue invoice.');
            setIsLoading(false);
            return;
          }
        }

        router.push(`/admin/invoices/${initialData._id.toString()}`);
      } else {
        const res = await createInvoiceDraftAction(payload as any);
        if (!res.success) {
          setError(res.error || 'Failed to create invoice draft.');
          setIsLoading(false);
          return;
        }

        const newId = res.invoiceId!;
        if (shouldIssue) {
          const issueRes = await issueInvoiceAction(newId);
          if (!issueRes.success) {
            setError(issueRes.error || 'Saved draft, but failed to issue invoice.');
            setIsLoading(false);
            router.push(`/admin/invoices/${newId}`);
            return;
          }
        }

        router.push(`/admin/invoices/${newId}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error occurred.');
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Action could not be completed</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* 1. Client & Commercial Details */}
      <Card>
        <CardHeader>
          <CardTitle>1. Commercial Information</CardTitle>
          <CardDescription>Select the client and optional linked deal, project, or billing milestone.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor={`${idPrefix}-client`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Client <span className="text-destructive">*</span>
            </label>
            <select
              id={`${idPrefix}-client`}
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="">Select Client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.companyName ? `(${c.companyName})` : ''} · {c.clientCode}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${idPrefix}-deal`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Linked Deal (Optional)
            </label>
            <select
              id={`${idPrefix}-deal`}
              value={dealId}
              onChange={(e) => handleDealChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="">No Deal (Manual Invoice)</option>
              {availableDeals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dealCode}: {d.title} ({formatMinor(d.agreedAmountMinor, d.currency)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${idPrefix}-project`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Linked Project (Optional)
            </label>
            <select
              id={`${idPrefix}-project`}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="">No Project Linked</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode}: {p.title}
                </option>
              ))}
            </select>
          </div>

          {selectedDeal?.paymentPlanSnapshot && selectedDeal.paymentPlanSnapshot.length > 0 && (
            <div>
              <label htmlFor={`${idPrefix}-milestone`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Installment Milestone
              </label>
              <select
                id={`${idPrefix}-milestone`}
                value={billingMilestoneId}
                onChange={(e) => handleMilestoneSelect(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary font-medium"
              >
                <option value="">Select Milestone to Bill...</option>
                {selectedDeal.paymentPlanSnapshot.map((ms, idx) => (
                  <option key={idx} value={String(idx)}>
                    #{ms.sequence}: {ms.name} — {formatMinor(ms.amountMinor, selectedDeal.currency)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Invoice Details */}
      <Card>
        <CardHeader>
          <CardTitle>2. Invoice Metadata</CardTitle>
          <CardDescription>Dates, invoice type, currency, and general description.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor={`${idPrefix}-issueDate`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Issue Date <span className="text-destructive">*</span>
            </label>
            <input
              id={`${idPrefix}-issueDate`}
              type="date"
              required
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-dueDate`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Due Date <span className="text-destructive">*</span>
            </label>
            <input
              id={`${idPrefix}-dueDate`}
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-type`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Invoice Type
            </label>
            <select
              id={`${idPrefix}-type`}
              value={invoiceType}
              onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value={INVOICE_TYPES.STANDARD}>Standard Invoice</option>
              <option value={INVOICE_TYPES.MILESTONE}>Milestone Installment</option>
              <option value={INVOICE_TYPES.FINAL}>Final Installment</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${idPrefix}-currency`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Currency
            </label>
            <input
              id={`${idPrefix}-currency`}
              type="text"
              required
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-primary uppercase"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-4">
            <label htmlFor={`${idPrefix}-desc`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Invoice Description / Subject
            </label>
            <input
              id={`${idPrefix}-desc`}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Website Development — Milestone 1 (Advance Payment)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Line Items Editor */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>3. Invoice Line Items</CardTitle>
            <CardDescription>Add, remove, and adjust billing line items.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="p-2 min-w-[240px]">Description</th>
                  <th className="p-2 w-20 text-center">Qty</th>
                  <th className="p-2 w-24">Unit</th>
                  <th className="p-2 w-32 text-right">Rate ({currency})</th>
                  <th className="p-2 w-32">Discount</th>
                  <th className="p-2 w-28 text-right">Total</th>
                  <th className="p-2 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lineItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="p-2">
                      <input
                        type="text"
                        required
                        placeholder="Service or deliverable description..."
                        value={item.description}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                        className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                        className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-center"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateLineItem(idx, 'unit', e.target.value)}
                        placeholder="unit"
                        className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unitPrice || ''}
                        onChange={(e) => updateLineItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-right"
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <select
                          value={item.discountType}
                          onChange={(e) => updateLineItem(idx, 'discountType', e.target.value)}
                          className="rounded border border-input bg-background px-1 py-1 text-xs"
                        >
                          <option value="NONE">None</option>
                          <option value="PERCENTAGE">%</option>
                          <option value="FIXED">Fix</option>
                        </select>
                        {item.discountType !== 'NONE' && (
                          <input
                            type="number"
                            min="0"
                            value={item.discountValue || ''}
                            onChange={(e) => updateLineItem(idx, 'discountValue', parseFloat(e.target.value) || 0)}
                            className="w-16 rounded border border-input bg-background px-1 py-1 text-xs text-right"
                          />
                        )}
                      </div>
                    </td>
                    <td className="p-2 text-right font-medium">
                      {formatMinor(
                        pricingPreview.lineItems[idx]?.lineTotalMinor ?? 0,
                        currency
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        disabled={lineItems.length <= 1}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 4. Tax Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>4. Tax Configuration</CardTitle>
          <CardDescription>
            Configure tax treatments (GST, IGST, CGST/SGST) accurately. Tax is not assumed by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              id={`${idPrefix}-taxEnabled`}
              type="checkbox"
              checked={taxEnabled}
              onChange={(e) => setTaxEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
            />
            <label htmlFor={`${idPrefix}-taxEnabled`} className="text-sm font-medium">
              Enable Tax on this Invoice
            </label>
          </div>

          {taxEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div>
                <label htmlFor={`${idPrefix}-taxTreatment`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Tax Treatment
                </label>
                <select
                  id={`${idPrefix}-taxTreatment`}
                  value={taxTreatment}
                  onChange={(e) => setTaxTreatment(e.target.value as TaxTreatment)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
                >
                  <option value={TAX_TREATMENTS.NONE}>None / Tax Exempt</option>
                  <option value={TAX_TREATMENTS.IGST}>IGST (Integrated GST / Inter-State)</option>
                  <option value={TAX_TREATMENTS.CGST_SGST}>CGST + SGST (Intra-State GST)</option>
                  <option value={TAX_TREATMENTS.EXPORT_NON_TAXABLE}>Export / Zero-Rated</option>
                </select>
              </div>

              <div>
                <label htmlFor={`${idPrefix}-taxRate`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Tax Rate (%)
                </label>
                <input
                  id={`${idPrefix}-taxRate`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 18"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor={`${idPrefix}-taxLabel`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Tax Label
                </label>
                <input
                  id={`${idPrefix}-taxLabel`}
                  type="text"
                  value={taxLabel}
                  onChange={(e) => setTaxLabel(e.target.value)}
                  placeholder="e.g. GSTIN"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor={`${idPrefix}-sellerState`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Seller State
                </label>
                <input
                  id={`${idPrefix}-sellerState`}
                  type="text"
                  value={sellerState}
                  onChange={(e) => setSellerState(e.target.value)}
                  placeholder="e.g. Maharashtra"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Terms & Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>5. Terms & Payment Instructions</CardTitle>
          <CardDescription>Payment deadlines, bank details, UPI ID, or custom contract notes.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${idPrefix}-terms`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Payment Terms
            </label>
            <textarea
              id={`${idPrefix}-terms`}
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="e.g. Due within 15 days of issue date."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-instructions`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Bank / UPI Payment Instructions
            </label>
            <textarea
              id={`${idPrefix}-instructions`}
              rows={3}
              value={billingInstructions}
              onChange={(e) => setBillingInstructions(e.target.value)}
              placeholder="e.g. Transfer to HDFC Bank A/C ... or UPI ID ..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor={`${idPrefix}-notes`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Client Notes (Printed on Invoice)
            </label>
            <input
              id={`${idPrefix}-notes`}
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Thank you for your partnership!"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* 6. Pricing Summary and Actions */}
      <Card className="border-primary/20 bg-muted/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="w-full md:w-auto space-y-1.5 text-sm">
              <div className="flex justify-between md:justify-start gap-8 text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-mono font-medium text-foreground">
                  {formatMinor(pricingPreview.subtotalMinor, currency)}
                </span>
              </div>
              {pricingPreview.discountMinor > 0 && (
                <div className="flex justify-between md:justify-start gap-8 text-muted-foreground">
                  <span>Discount:</span>
                  <span className="font-mono font-medium text-destructive">
                    -{formatMinor(pricingPreview.discountMinor, currency)}
                  </span>
                </div>
              )}
              {pricingPreview.taxMinor > 0 && (
                <div className="flex justify-between md:justify-start gap-8 text-muted-foreground">
                  <span>
                    Tax ({taxTreatment === TAX_TREATMENTS.CGST_SGST ? 'CGST + SGST' : 'IGST'} {taxRate}%):
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    +{formatMinor(pricingPreview.taxMinor, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between md:justify-start gap-8 pt-2 border-t border-border text-base font-bold text-foreground">
                <span>Grand Total:</span>
                <span className="font-mono text-primary text-lg">
                  {formatMinor(pricingPreview.totalMinor, currency)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={() => router.back()}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="secondary"
                disabled={isLoading}
                onClick={() => handleSubmit(false)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save as Draft'
                )}
              </Button>

              <Button
                type="button"
                variant="primary"
                disabled={isLoading}
                onClick={() => handleSubmit(true)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Save & Issue Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
