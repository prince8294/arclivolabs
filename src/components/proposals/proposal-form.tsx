'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';

import Button from '@/components/ui/button';
import PricingSummary from '@/components/proposals/pricing-summary';
import PaymentMilestoneEditor, {
  createEmptyMilestone,
  type PaymentMilestoneRow,
} from '@/components/proposals/payment-milestone-editor';
import ProposalItemsEditor, {
  createEmptyRow,
  type ProposalItemRow,
} from '@/components/proposals/proposal-items-editor';
import {
  CURRENCIES,
} from '@/lib/constants/enums';
import {
  DISCOUNT_TYPES,
  DISCOUNT_TYPE_LABELS,
  PROPOSAL_UNITS,
  TERMS_FIELD_LABELS,
} from '@/lib/constants/proposals';
import {
  createProposal,
  updateProposalDraft,
} from '@/lib/actions/proposal-form-actions';
import { INITIAL_PROPOSAL_STATE } from '@/lib/validations/proposal';
import { computeProposalPricing } from '@/lib/proposals/pricing';
import { toMinorUnits } from '@/lib/utils/money';
import type { ServiceCatalogOption } from '@/types/proposals';

const inputClasses =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClasses = 'text-sm font-medium text-foreground';

export interface ProposalFormProps {
  mode: 'create' | 'edit';
  services: ServiceCatalogOption[];
  /** Leads + clients selectable as the proposal target. */
  partyOptions: Array<{
    kind: 'lead' | 'client';
    id: string;
    code: string;
    name: string;
    company: string | null;
    extra: string | null;
  }>;
  /** Pre-selected target (e.g. the lead the admin came from). */
  initialLeadId?: string | null;
  initialClientId?: string | null;
  /** Marketing request this proposal was opened from. */
  sourceRequestId?: string | null;
  sourceRequestCode?: string | null;
  backHref: string;
  initial?: {
    proposalId: string;
    versionId: string;
    title: string;
    description: string | null;
    overview: string | null;
    currency: string;
    scopeSummary: string | null;
    includedFeatures: string;
    excludedFeatures: string;
    dependencies: string;
    customerResponsibilities: string;
    deliverables: string;
    estimatedDuration: string | null;
    expectedStartDate: string | null;
    deliveryConditions: string | null;
    revisionAllowance: string | null;
    supportPeriod: string | null;
    estimatedDurationLabel: string;
    lines: ProposalItemRow[];
    discountType: string;
    discountValue: string;
    taxEnabled: boolean;
    taxRatePercent: string;
    taxLabel: string;
    paymentMilestones: PaymentMilestoneRow[];
    validUntil: string;
    internalNotes: string;
    changeSummary: string;
    terms: Record<string, string | null>;
  };
}

/**
 * Multi-section proposal / quotation form (ADMIN only).
 *
 * Structured as seven sections instead of one wall of inputs:
 *  1. Client / Lead information
 *  2. Project overview
 *  3. Services and pricing
 *  4. Deliverables
 *  5. Schedule and milestones
 *  6. Commercial terms
 *  7. Review and save
 *
 * The form owns the line items and the payment schedule as local state and
 * serialises them into hidden JSON inputs. It NEVER posts a total: the
 * server recalculates every amount from the submitted rows.
 */
export default function ProposalForm({
  mode,
  services,
  partyOptions,
  initialLeadId,
  initialClientId,
  sourceRequestId,
  sourceRequestCode,
  backHref,
  initial,
}: ProposalFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    mode === 'create' ? createProposal : updateProposalDraft,
    INITIAL_PROPOSAL_STATE
  );

  const [partyKind, setPartyKind] = useState<'lead' | 'client'>(
    initialClientId ? 'client' : 'lead'
  );
  const [selectedParty, setSelectedParty] = useState<string>(
    initial?.proposalId ? '' : (initialClientId ?? initialLeadId ?? '')
  );
  const [currency, setCurrency] = useState(initial?.currency ?? 'INR');
  const [rows, setRows] = useState<ProposalItemRow[]>(
    initial?.lines ?? [createEmptyRow(0)]
  );
  const [discountType, setDiscountType] = useState(
    initial?.discountType ?? DISCOUNT_TYPES.NONE
  );
  const [discountValue, setDiscountValue] = useState(
    initial?.discountValue ?? '0'
  );
  const [taxEnabled, setTaxEnabled] = useState(initial?.taxEnabled ?? false);
  const [taxRatePercent, setTaxRatePercent] = useState(
    initial?.taxRatePercent ?? '0'
  );
  const [taxLabel, setTaxLabel] = useState(initial?.taxLabel ?? '');
  const [hasPaymentPlan, setHasPaymentPlan] = useState(
    (initial?.paymentMilestones.length ?? 0) > 0
  );
  const [milestones, setMilestones] = useState<PaymentMilestoneRow[]>(
    initial?.paymentMilestones ?? []
  );
  const [deliveryMilestones, setDeliveryMilestones] = useState<
    Array<{ name: string; description: string }>
  >(
    initial
      ? (JSON.parse(initial.estimatedDurationLabel || '[]') as Array<{
          name: string;
          description: string;
        }>)
      : []
  );

  const created = useRef<string | null>(null);
  useEffect(() => {
    if (state.ok && state.id && created.current !== state.id) {
      created.current = state.id;
      router.refresh();
    }
  }, [state, router]);

  // Grand total preview, computed with the same engine the server uses.
  const grandTotalMinor = computeProposalPricing({
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
      discountType: discountType as never,
      discountValue: Number(discountValue) || 0,
    },
    proposalTax: {
      enabled: taxEnabled,
      ratePercent: Number(taxRatePercent) || 0,
      label: taxLabel || null,
    },
  }).pricing.grandTotalMinor;

  const leadOptions = partyOptions.filter((option) => option.kind === 'lead');
  const clientOptions = partyOptions.filter((option) => option.kind === 'client');

  function fieldError(name: string) {
    const message = state.fieldErrors?.[name];
    if (!message) {
      return null;
    }
    return (
      <p role="alert" className="text-xs text-destructive">
        {message}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      {initial && (
        <>
          <input type="hidden" name="proposalId" value={initial.proposalId} />
          <input type="hidden" name="versionId" value={initial.versionId} />
        </>
      )}
      {sourceRequestId && (
        <input type="hidden" name="sourceRequestId" value={sourceRequestId} />
      )}
      {/* Serialised editor state. Prices only — never totals. */}
      <input
        type="hidden"
        name="itemsJson"
        value={JSON.stringify(
          rows.map((row) => ({
            serviceId: row.serviceId,
            serviceName: row.serviceName,
            description: row.description,
            quantity: row.quantity,
            unit: row.unit,
            unitPrice: row.unitPrice,
            discountType: row.discountType,
            discountValue: row.discountValue,
            taxRatePercent: row.taxRatePercent,
          }))
        )}
      />
      <input
        type="hidden"
        name="paymentMilestonesJson"
        value={JSON.stringify(
          milestones.map((milestone) => ({
            name: milestone.name,
            type: milestone.type,
            value: milestone.value,
            condition: milestone.condition,
            dueDate: milestone.dueDate,
          }))
        )}
      />
      <input
        type="hidden"
        name="deliveryMilestonesJson"
        value={JSON.stringify(
          deliveryMilestones.filter((milestone) => milestone.name.trim().length > 0)
        )}
      />
      <input type="hidden" name="taxEnabled" value={String(taxEnabled)} />
      <input
        type="hidden"
        name="hasPaymentPlan"
        value={String(hasPaymentPlan)}
      />

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p
          role="status"
          className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {state.message}
        </p>
      )}

      {/* ------------------------------ 1. Target ----------------------------- */}
      <Section
        title="1. Client / Lead information"
        description="A proposal can be created for a lead before they become a client, or for an existing client asking for additional work."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="partyKind" className={labelClasses}>
              Proposal for
            </label>
            <select
              id="partyKind"
              disabled={mode === 'edit'}
              value={partyKind}
              onChange={(event) => {
                const kind = event.target.value as 'lead' | 'client';
                setPartyKind(kind);
                setSelectedParty('');
              }}
              className={inputClasses}
            >
              <option value="lead">Lead (pre-conversion)</option>
              <option value="client">Existing client</option>
            </select>
            {mode === 'edit' && (
              <p className="text-xs text-muted-foreground">
                The target cannot change after creation — create a new proposal
                instead.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="partyId" className={labelClasses}>
              {partyKind === 'lead' ? 'Lead' : 'Client'}
            </label>
            <select
              id="partyId"
              name={partyKind === 'lead' ? 'leadId' : 'clientId'}
              disabled={mode === 'edit'}
              value={selectedParty}
              onChange={(event) => setSelectedParty(event.target.value)}
              className={inputClasses}
            >
              <option value="">Select…</option>
              {(partyKind === 'lead' ? leadOptions : clientOptions).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.code} — {option.name}
                  {option.company ? ` (${option.company})` : ''}
                </option>
              ))}
            </select>
            {fieldError('leadId') ?? fieldError('clientId')}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="title" className={labelClasses}>
              Proposal title <span className="text-destructive">*</span>
            </label>
            <input
              id="title"
              name="title"
              required
              maxLength={200}
              defaultValue={initial?.title ?? ''}
              placeholder="e.g. Website Development & SEO — Phase 1"
              className={inputClasses}
            />
            {fieldError('title')}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="description" className={labelClasses}>
              Short description
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              maxLength={5000}
              defaultValue={initial?.description ?? ''}
              placeholder="One-line summary shown in proposal lists."
              className={inputClasses}
            />
            {fieldError('description')}
          </div>

          {sourceRequestCode && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Created from marketing request {sourceRequestCode}.
            </p>
          )}
        </div>
      </Section>

      {/* ----------------------------- 2. Overview ---------------------------- */}
      <Section
        title="2. Project overview"
        description="What the customer asked for and what this engagement covers."
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="overview" className={labelClasses}>
            Project overview
          </label>
          <textarea
            id="overview"
            name="overview"
            rows={4}
            maxLength={5000}
            defaultValue={initial?.overview ?? ''}
            placeholder="A short narrative the customer reads first on the PDF."
            className={inputClasses}
          />
          {fieldError('overview')}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="scopeSummary" className={labelClasses}>
            Scope of work summary
          </label>
          <textarea
            id="scopeSummary"
            name="scopeSummary"
            rows={4}
            maxLength={5000}
            defaultValue={initial?.scopeSummary ?? ''}
            className={inputClasses}
          />
          {fieldError('scopeSummary')}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TextAreaField
            id="includedFeatures"
            label="Included features"
            hint="One item per line."
            rows={6}
            name="includedFeatures"
            defaultValue={initial?.includedFeatures ?? ''}
            error={state.fieldErrors?.includedFeatures}
          />
          <TextAreaField
            id="excludedFeatures"
            label="Excluded features"
            hint="Be explicit about what is NOT included."
            rows={6}
            name="excludedFeatures"
            defaultValue={initial?.excludedFeatures ?? ''}
            error={state.fieldErrors?.excludedFeatures}
          />
          <TextAreaField
            id="dependencies"
            label="Dependencies"
            hint="Third-party tools, access or content the project needs."
            rows={4}
            name="dependencies"
            defaultValue={initial?.dependencies ?? ''}
            error={state.fieldErrors?.dependencies}
          />
          <TextAreaField
            id="customerResponsibilities"
            label="Customer responsibilities"
            hint="What the client must provide or approve."
            rows={4}
            name="customerResponsibilities"
            defaultValue={initial?.customerResponsibilities ?? ''}
            error={state.fieldErrors?.customerResponsibilities}
          />
        </div>
      </Section>

      {/* ----------------------------- 3. Pricing ----------------------------- */}
      <Section
        title="3. Services and pricing"
        description="Add priced rows. Custom prices on a quotation never change the service catalogue."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="currency" className={labelClasses}>
              Currency
            </label>
            <select
              id="currency"
              name="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className={inputClasses}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              One currency per quotation. There is no live conversion.
            </p>
            {fieldError('currency')}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="discountType" className={labelClasses}>
              Proposal discount
            </label>
            <div className="flex gap-2">
              <select
                id="discountType"
                name="discountType"
                value={discountType}
                onChange={(event) => setDiscountType(event.target.value)}
                className={inputClasses}
              >
                {Object.values(DISCOUNT_TYPES).map((value) => (
                  <option key={value} value={value}>
                    {DISCOUNT_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
              {discountType !== DISCOUNT_TYPES.NONE && (
                <input
                  type="number"
                  name="discountValue"
                  aria-label="Proposal discount value"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  className={`${inputClasses} w-32`}
                />
              )}
            </div>
            {fieldError('discountValue')}
          </div>
        </div>

        <ProposalItemsEditor
          rows={rows}
          services={services}
          currency={currency}
          disabled={pending}
          onChange={setRows}
        />
        {fieldError('itemsJson')}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Pricing summary
            </h3>
            <PricingSummary
              rows={rows}
              currency={currency}
              proposalDiscountType={discountType}
              proposalDiscountValue={discountValue}
              taxEnabled={taxEnabled}
              taxRatePercent={taxRatePercent}
              taxLabel={taxLabel}
            />
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              Applicable tax (optional)
            </h3>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(event) => setTaxEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Apply a tax on the discounted total
            </label>
            {taxEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="taxRatePercent" className={labelClasses}>
                    Tax rate (%)
                  </label>
                  <input
                    id="taxRatePercent"
                    type="number"
                    name="taxRatePercent"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRatePercent}
                    onChange={(event) => setTaxRatePercent(event.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="taxLabel" className={labelClasses}>
                    Tax label (optional)
                  </label>
                  <input
                    id="taxLabel"
                    name="taxLabel"
                    maxLength={80}
                    value={taxLabel}
                    onChange={(event) => setTaxLabel(event.target.value)}
                    placeholder="e.g. GST (18%)"
                    className={inputClasses}
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Tax is never applied automatically. Leave it off when
              Arclivo Labs is not charging tax on this quotation, and the PDF
              will show no tax line at all.
            </p>
            {fieldError('taxRatePercent')}
          </div>
        </div>
      </Section>

      {/* --------------------------- 4. Deliverables -------------------------- */}
      <Section
        title="4. Deliverables"
        description="What the customer receives. One item per line."
      >
        <TextAreaField
          id="deliverables"
          label="Deliverables"
          hint="e.g. Responsive website, Contact form, Basic SEO setup"
          rows={8}
          name="deliverables"
          defaultValue={initial?.deliverables ?? ''}
          error={state.fieldErrors?.deliverables}
        />
      </Section>

      {/* ------------------- 5. Schedule and milestones ---------------------- */}
      <Section
        title="5. Schedule and milestones"
        description="The proposed delivery agreement. No project or task records are created here."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="estimatedDuration" className={labelClasses}>
              Estimated duration
            </label>
            <input
              id="estimatedDuration"
              name="estimatedDuration"
              maxLength={200}
              defaultValue={initial?.estimatedDuration ?? ''}
              placeholder="e.g. 21 business days"
              className={inputClasses}
            />
            {fieldError('estimatedDuration')}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="expectedStartDate" className={labelClasses}>
              Expected start date
            </label>
            <input
              id="expectedStartDate"
              name="expectedStartDate"
              type="date"
              defaultValue={initial?.expectedStartDate ?? ''}
              className={inputClasses}
            />
            {fieldError('expectedStartDate')}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="revisionAllowance" className={labelClasses}>
              Revision allowance
            </label>
            <input
              id="revisionAllowance"
              name="revisionAllowance"
              maxLength={500}
              defaultValue={initial?.revisionAllowance ?? ''}
              placeholder="e.g. 2 revision rounds per design"
              className={inputClasses}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="supportPeriod" className={labelClasses}>
              Support period
            </label>
            <input
              id="supportPeriod"
              name="supportPeriod"
              maxLength={500}
              defaultValue={initial?.supportPeriod ?? ''}
              placeholder="e.g. 30 days after delivery"
              className={inputClasses}
            />
          </div>
        </div>

        <TextAreaField
          id="deliveryConditions"
          label="Delivery conditions"
          rows={4}
          name="deliveryConditions"
          defaultValue={initial?.deliveryConditions ?? ''}
          error={state.fieldErrors?.deliveryConditions}
        />

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            Delivery milestones
          </h3>
          <p className="text-xs text-muted-foreground">
            The stages proposed in this engagement, in order.
          </p>
          {deliveryMilestones.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No milestones added yet.
            </p>
          )}
          {deliveryMilestones.map((milestone, index) => (
            <div
              key={`dm-${index}`}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row"
            >
              <input
                type="text"
                aria-label={`Milestone ${index + 1} name`}
                maxLength={200}
                value={milestone.name}
                placeholder="e.g. UI Design"
                onChange={(event) =>
                  setDeliveryMilestones((current) =>
                    current.map((item, position) =>
                      position === index
                        ? { ...item, name: event.target.value }
                        : item
                    )
                  )
                }
                className={`${inputClasses} sm:w-1/3`}
              />
              <input
                type="text"
                aria-label={`Milestone ${index + 1} description`}
                maxLength={1000}
                value={milestone.description}
                placeholder="Short description"
                onChange={(event) =>
                  setDeliveryMilestones((current) =>
                    current.map((item, position) =>
                      position === index
                        ? { ...item, description: event.target.value }
                        : item
                    )
                  )
                }
                className={inputClasses}
              />
              <button
                type="button"
                onClick={() =>
                  setDeliveryMilestones((current) =>
                    current.filter((_, position) => position !== index)
                  )
                }
                className="inline-flex h-10 items-center justify-center gap-1 rounded-lg px-3 text-sm font-medium text-destructive transition-opacity hover:opacity-80"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setDeliveryMilestones((current) => [
                ...current,
                { name: '', description: '' },
              ])
            }
            className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add milestone
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={hasPaymentPlan}
              onChange={(event) => setHasPaymentPlan(event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Include a payment milestone plan
          </label>
          {hasPaymentPlan && (
            <PaymentMilestoneEditor
              rows={milestones}
              currency={currency}
              grandTotalMinor={grandTotalMinor}
              onChange={setMilestones}
            />
          )}
          {fieldError('paymentMilestonesJson')}
        </div>
      </Section>

      {/* ------------------------ 6. Commercial terms ------------------------ */}
      <Section
        title="6. Commercial terms"
        description="Editable clauses. Leave a field empty to omit it from the PDF entirely."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="validUntil" className={labelClasses}>
              Valid until <span className="text-destructive">*</span>
            </label>
            <input
              id="validUntil"
              name="validUntil"
              type="date"
              required
              defaultValue={initial?.validUntil ?? ''}
              className={inputClasses}
            />
            <p className="text-xs text-muted-foreground">
              After this date the quotation can no longer be accepted. Create
              an extension or a new revision instead.
            </p>
            {fieldError('validUntil')}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="changeSummary" className={labelClasses}>
              Change summary (internal)
            </label>
            <input
              id="changeSummary"
              name="changeSummary"
              maxLength={2000}
              defaultValue={initial?.changeSummary ?? ''}
              placeholder="e.g. Removed second revision round"
              className={inputClasses}
            />
            {fieldError('changeSummary')}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Object.entries(TERMS_FIELD_LABELS).map(([field, label]) => (
            <TextAreaField
              key={field}
              id={`term-${field}`}
              label={label}
              rows={4}
              name={`term_${field}`}
              defaultValue={initial?.terms?.[field] ?? ''}
            />
          ))}
        </div>

        <TextAreaField
          id="internalNotes"
          label="Internal notes"
          hint="Never appears on a customer PDF or in the client portal."
          rows={4}
          name="internalNotes"
          defaultValue={initial?.internalNotes ?? ''}
          error={state.fieldErrors?.internalNotes}
        />
      </Section>

      {/* -------------------------- 7. Review/save --------------------------- */}
      <Section title="7. Review and save" description="Nothing is issued until you approve it.">
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              name="confirmTerms"
              required
              className="h-4 w-4 rounded border-input"
            />
            I have reviewed the pricing, scope and terms of this draft.
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {mode === 'create' ? 'Create draft' : 'Save draft'}
            </Button>
            <a
              href={backHref}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              Cancel
            </a>
          </div>
        </div>
      </Section>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                            */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function TextAreaField({
  id,
  label,
  hint,
  rows = 4,
  name,
  defaultValue,
  error,
}: {
  id: string;
  label: string;
  hint?: string;
  rows?: number;
  name: string;
  defaultValue?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClasses}>
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className={inputClasses}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
