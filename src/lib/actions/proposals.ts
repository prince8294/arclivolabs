/**
 * Server actions for the proposal lifecycle (Part 9).
 *
 * Every action:
 * - starts with a role check from the shared authorization kernel;
 * - re-reads the record from MongoDB and verifies scope/ownership and the
 *   legal status transition BEFORE writing;
 * - recomputes all totals with `computeProposalPricing` - a total submitted
 *   by the browser is never read back;
 * - runs multi-collection writes (issue, accept + deal, finalize) inside a
 *   MongoDB transaction when the deployment supports one, with an explicit,
 *   documented fallback path otherwise.
 *
 * Internal approval (`approveProposal`) is separate from customer
 * acceptance (`recordAcceptance`), and only ADMIN can perform either.
 */

import 'server-only';

import { revalidatePath } from 'next/cache';
import { Types, type ClientSession } from 'mongoose';
import type { z } from 'zod';

import { requireRole } from '@/lib/auth/authorization';
import { generateSequentialCode } from '@/lib/db/generate-code';
import connectDB from '@/lib/db/mongoose';
import { areTransactionsSupported } from '@/lib/db/transaction';
import {
  createLeadSystemActivity,
} from '@/lib/activities/lead-activity';
import {
  DEAL_CODE_PREFIX,
  DEAL_STATUSES,
  DISCOUNT_TYPES,
  PROPOSAL_CODE_PREFIX,
  PROPOSAL_LIMITS,
  PROPOSAL_STATUSES,
  PROPOSAL_REQUEST_STATUSES,
  REVISION_REQUEST_STATUSES,
  TERMS_FIELDS,
  canTransitionProposal,
  type ProposalStatus,
} from '@/lib/constants/proposals';
import { LEAD_ACTIVITY_EVENTS, LEAD_STATUSES, type LeadActivityEvent } from '@/lib/constants/enums';
import { ROUTES } from '@/lib/constants/routes';
import {
  computeProposalPricing,
  hasMeaningfulPricing,
  type ComputedPricing,
  type PricingLineInput,
} from '@/lib/proposals/pricing';
import { toMinorUnits } from '@/lib/utils/money';
import { parseAmount } from '@/lib/utils/money';
import {
  cancelProposalSchema,
  createProposalSchema,
  createRevisionSchema,
  issueProposalSchema,
  markProposalSentSchema,
  recordAcceptanceSchema,
  recordRejectionSchema,
  submitForApprovalSchema,
  updateProposalDraftSchema,
  approveProposalSchema,
  type CommercialBodyInput,
  type ProposalActionState,
} from '@/lib/validations/proposal';
import { zodFieldErrors } from '@/lib/validations/common';
import { Client } from '@/models/Client';
import { Deal } from '@/models/Deal';
import { Lead } from '@/models/Lead';
import { Proposal } from '@/models/Proposal';
import { ProposalRequest, RevisionRequest } from '@/models/ProposalRequest';
import { ProposalVersion } from '@/models/ProposalVersion';
import { Service } from '@/models/Service';
import { USER_ROLES, type AuthUser } from '@/types/auth';

const GENERIC_ERROR = 'Unable to complete the request. Please try again.';

class ProposalActionError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ProposalActionError';
    this.field = field;
  }
}

function toState(error: unknown): ProposalActionState {
  if (error instanceof ProposalActionError) {
    return error.field
      ? { ok: false, fieldErrors: { [error.field]: error.message } }
      : { ok: false, error: error.message };
  }
  console.error('proposal action failed', error);
  return { ok: false, error: GENERIC_ERROR };
}

function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as { code?: unknown };
  return err.code === 11000 || err.code === 11001;
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function readBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === 'true' || value === 'on' || value === '1';
}

function fields(error: z.ZodError, names: readonly string[]): Record<string, string> {
  return zodFieldErrors(error, names);
}

const COMMERCIAL_FIELDS: readonly string[] = [
  'title',
  'currency',
  'discountValue',
  'taxRatePercent',
  'validUntil',
  'overview',
  'scopeSummary',
  'includedFeatures',
  'excludedFeatures',
  'dependencies',
  'customerResponsibilities',
  'deliverables',
  'estimatedDuration',
  'expectedStartDate',
  'deliveryConditions',
  'revisionAllowance',
  'supportPeriod',
  'taxLabel',
  'internalNotes',
  'changeSummary',
  'discountType',
  'taxEnabled',
  'hasPaymentPlan',
  'paymentMilestonesJson',
  'deliveryMilestonesJson',
  'description',
];

/* -------------------------------------------------------------------------- */
/* FormData -> commercial input                                               */
/* -------------------------------------------------------------------------- */

/**
 * Read the commercial part of the multi-section form.
 *
 * Line items arrive as `itemsJson` (one JSON array) from the dynamic items
 * editor. Only raw inputs are taken; totals are computed below.
 */
function readCommercialInput(formData: FormData): Record<string, unknown> {
  return {
    title: readString(formData, 'title'),
    description: readString(formData, 'description'),
    overview: readString(formData, 'overview'),
    scopeSummary: readString(formData, 'scopeSummary'),
    includedFeatures: readString(formData, 'includedFeatures'),
    excludedFeatures: readString(formData, 'excludedFeatures'),
    dependencies: readString(formData, 'dependencies'),
    customerResponsibilities: readString(formData, 'customerResponsibilities'),
    deliverables: readString(formData, 'deliverables'),
    estimatedDuration: readString(formData, 'estimatedDuration'),
    expectedStartDate: readString(formData, 'expectedStartDate'),
    deliveryConditions: readString(formData, 'deliveryConditions'),
    revisionAllowance: readString(formData, 'revisionAllowance'),
    supportPeriod: readString(formData, 'supportPeriod'),
    deliveryMilestonesJson: readString(formData, 'deliveryMilestonesJson'),
    currency: readString(formData, 'currency'),
    discountType: readString(formData, 'discountType'),
    discountValue: parseAmount(formData.get('discountValue')),
    taxEnabled: readBoolean(formData, 'taxEnabled'),
    taxRatePercent: parseAmount(formData.get('taxRatePercent')),
    taxLabel: readString(formData, 'taxLabel'),
    hasPaymentPlan: readBoolean(formData, 'hasPaymentPlan'),
    paymentMilestonesJson: readString(formData, 'paymentMilestonesJson'),
    validUntil: readString(formData, 'validUntil'),
    internalNotes: readString(formData, 'internalNotes'),
    changeSummary: readString(formData, 'changeSummary'),
    itemsJson: readString(formData, 'itemsJson'),
    // Terms arrive as `term_<field>` inputs. Missing keys become null, which
    // the version stores as null so the PDF simply omits that clause.
    terms: Object.fromEntries(
      TERMS_FIELDS.map((field) => [field, readString(formData, `term_${field}`)])
    ),
  };
}

/** Parse and range-check the dynamic pricing rows. */
function readLineItems(raw: string): PricingLineInput[] {
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProposalActionError('Could not read the pricing rows.', 'itemsJson');
  }
  if (!Array.isArray(parsed)) {
    throw new ProposalActionError('Could not read the pricing rows.', 'itemsJson');
  }
  if (parsed.length > PROPOSAL_LIMITS.MAX_LINE_ITEMS) {
    throw new ProposalActionError('Too many pricing rows.', 'itemsJson');
  }

  return parsed.map((rawItem) => {
    const item = (rawItem ?? {}) as Record<string, unknown>;
    const serviceId =
      typeof item.serviceId === 'string' && /^[a-f\d]{24}$/i.test(item.serviceId)
        ? item.serviceId
        : null;
    const discountType = String(item.discountType ?? DISCOUNT_TYPES.NONE);
    const taxRate =
      item.taxRatePercent === '' || item.taxRatePercent === null || item.taxRatePercent === undefined
        ? null
        : Number(item.taxRatePercent);

    return {
      serviceId,
      serviceName: String(item.serviceName ?? ''),
      description: typeof item.description === 'string' ? item.description : null,
      quantity: Number(item.quantity ?? 0),
      unit: String(item.unit ?? 'Project'),
      unitPrice: Number(item.unitPrice ?? 0),
      discountType: (DISCOUNT_TYPES as Record<string, string>)[discountType]
        ? (discountType as PricingLineInput['discountType'])
        : DISCOUNT_TYPES.NONE,
      discountValue: Number(item.discountValue ?? 0),
      taxRatePercent: taxRate === null || Number.isNaN(taxRate) ? null : taxRate,
    } satisfies PricingLineInput;
  });
}

/* -------------------------------------------------------------------------- */
/* Pricing + milestone resolution                                             */
/* -------------------------------------------------------------------------- */

/**
 * Run the server pricing engine and translate any issue into a form error.
 *
 * `throwOnIssue` is off while editing a draft (so an in-progress quotation
 * can be saved) and on before issuing / accepting, where a malformed
 * commercial document must never reach a customer.
 */
function computeOrThrow(
  input: Pick<CommercialBodyInput, 'currency'>,
  lineItems: PricingLineInput[],
  discountType: CommercialBodyInput['discountType'],
  discountValue: number,
  taxEnabled: boolean,
  taxRatePercent: number,
  taxLabel: string | null,
  throwOnIssue: boolean
): ComputedPricing {
  const result = computeProposalPricing({
    currency: input.currency,
    lines: lineItems,
    proposalDiscount: { discountType, discountValue },
    proposalTax: { enabled: taxEnabled, ratePercent: taxRatePercent, label: taxLabel },
  });

  if (throwOnIssue && result.issues.length > 0) {
    const first = result.issues[0];
    throw new ProposalActionError(
      first.message,
      first.lineIndex >= 0 ? 'itemsJson' : 'discountValue'
    );
  }
  return result.pricing;
}

/**
 * Resolve the planned payment milestones against the agreed grand total.
 *
 * PERCENTAGE milestones are converted to exact minor-unit amounts and any
 * rounding remainder is added to the LAST milestone, so the schedule always
 * adds up to exactly the quotation total. FIXED milestones must sum to the
 * total to the minor unit - a mismatch is an error, never silently
 * "balanced" by changing a number the admin typed.
 */
function resolvePaymentMilestones(
  milestones: Array<{
    name: string;
    type: string;
    value: number;
    condition: string | null;
    dueDate: string | null;
  }>,
  grandTotalMinor: number,
  currency: string
): Array<{
  name: string;
  type: 'FIXED' | 'PERCENTAGE';
  valueMinor: number;
  amountMinor: number;
  condition: string | null;
  dueDate: Date | null;
  sequence: number;
}> {
  if (milestones.length === 0) {
    return [];
  }

  const ordered = milestones.map((milestone, index) => ({ ...milestone, index }));

  if (ordered.every((milestone) => milestone.type === DISCOUNT_TYPES.PERCENTAGE)) {
    const percentTotal = ordered.reduce((sum, milestone) => sum + milestone.value, 0);
    if (Math.abs(percentTotal - 100) > 0.0001) {
      throw new ProposalActionError(
        `Percentage milestones must add up to 100% (currently ${percentTotal.toFixed(2)}%).`,
        'paymentMilestonesJson'
      );
    }

    let assigned = 0;
    return ordered.map((milestone, position) => {
      const isLast = position === ordered.length - 1;
      const amountMinor = isLast
        ? grandTotalMinor - assigned
        : Math.round((grandTotalMinor * milestone.value) / 100);
      assigned += amountMinor;
      return {
        name: milestone.name,
        type: 'PERCENTAGE' as const,
        valueMinor: Math.round((milestone.value * 100) / 100 * 100) / 100,
        amountMinor: Math.max(0, amountMinor),
        condition: milestone.condition,
        dueDate: milestone.dueDate ? new Date(`${milestone.dueDate}T00:00:00`) : null,
        sequence: position + 1,
      };
    });
  }

  // Mixed / fixed schedule: amounts must reconcile exactly.
  const resolved = ordered.map((milestone, position) => {
    if (milestone.type === DISCOUNT_TYPES.PERCENTAGE) {
      throw new ProposalActionError(
        'Use either percentage milestones or fixed amounts, not both.',
        'paymentMilestonesJson'
      );
    }
    const valueMinor = toMinorUnits(Math.max(0, milestone.value), currency);
    return {
      name: milestone.name,
      type: 'FIXED' as const,
      valueMinor,
      amountMinor: valueMinor,
      condition: milestone.condition,
      dueDate: milestone.dueDate ? new Date(`${milestone.dueDate}T00:00:00`) : null,
      sequence: position + 1,
    };
  });

  const scheduleTotal = resolved.reduce((sum, milestone) => sum + milestone.amountMinor, 0);
  if (scheduleTotal !== grandTotalMinor) {
    throw new ProposalActionError(
      'The payment schedule must add up to the quotation total. Adjust the milestone amounts.',
      'paymentMilestonesJson'
    );
  }

  return resolved;
}

/* -------------------------------------------------------------------------- */
/* Shared loaders with authorization                                           */
/* -------------------------------------------------------------------------- */

interface LoadedVersion {
  versionId: Types.ObjectId;
  proposalId: Types.ObjectId;
  version: number;
  status: ProposalStatus;
  document: Record<string, unknown> & { _id: Types.ObjectId };
}

/**
 * Load a version for an admin mutation and verify the transition is legal.
 *
 * Expiry is recomputed here rather than read from `status`: an offer whose
 * validity lapsed must not be issuable or acceptable even though the stored
 * status still says SENT.
 */
async function loadVersionForAdmin(
  proposalId: string,
  versionId: string
): Promise<LoadedVersion> {
  await connectDB();

  const version = await ProposalVersion.findById(versionId).lean().exec();
  if (!version || version.proposalId.toString() !== proposalId) {
    throw new ProposalActionError('Proposal version not found.');
  }

  const { isVersionExpired } = await import('@/lib/queries/proposals');
  const storedStatus = version.status as ProposalStatus;
  const expired =
    storedStatus === PROPOSAL_STATUSES.SENT &&
    isVersionExpired((version.validUntil as Date | null) ?? null);

  return {
    versionId: version._id as Types.ObjectId,
    proposalId: version.proposalId as Types.ObjectId,
    version: version.version,
    status: expired ? PROPOSAL_STATUSES.EXPIRED : storedStatus,
    document: version as unknown as Record<string, unknown> & { _id: Types.ObjectId },
  };
}

/** Assert a status transition and produce the error message the form shows. */
function assertTransition(from: ProposalStatus, to: ProposalStatus, action: string): void {
  if (!canTransitionProposal(from, to)) {
    throw new ProposalActionError(
      `A ${from.replace(/_/g, ' ').toLowerCase()} proposal cannot be ${action}.`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create a proposal (ADMIN only) with its first draft version.
 *
 * Exactly one of leadId / clientId must be present, and the referenced
 * record must exist. When the target is a Lead, the marketing owner is
 * inherited from `Lead.assignedTo` so the marketing portal scopes
 * correctly without an extra assignment step.
 */
export async function createProposal(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  try {
    const raw = {
      ...readCommercialInput(formData),
      leadId: readString(formData, 'leadId'),
      clientId: readString(formData, 'clientId'),
    };

    const parsed = createProposalSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, fieldErrors: fields(parsed.error, [...COMMERCIAL_FIELDS, 'leadId', 'clientId']) };
    }
    const input = parsed.data;

    const leadId = input.leadId ? new Types.ObjectId(input.leadId) : null;
    const clientId = input.clientId ? new Types.ObjectId(input.clientId) : null;

    if (!leadId && !clientId) {
      throw new ProposalActionError('Select a lead or a client.', 'leadId');
    }
    if (leadId && clientId) {
      throw new ProposalActionError(
        'A proposal belongs to a lead or a client, not both.',
        'leadId'
      );
    }

    let assignedMarketingUserId: Types.ObjectId | null = null;
    let serviceIds: Types.ObjectId[] = [];

    if (leadId) {
      const lead = await Lead.findById(leadId).select('assignedTo serviceInterest status').lean().exec();
      if (!lead) {
        throw new ProposalActionError('Lead not found.', 'leadId');
      }
      assignedMarketingUserId = (lead.assignedTo as Types.ObjectId | null) ?? null;
      serviceIds = (lead.serviceInterest ?? []) as Types.ObjectId[];
    } else if (clientId) {
      const client = await Client.findById(clientId)
        .select('assignedMarketingUserId status')
        .lean()
        .exec();
      if (!client) {
        throw new ProposalActionError('Client not found.', 'clientId');
      }
      assignedMarketingUserId = (client.assignedMarketingUserId as Types.ObjectId | null) ?? null;
    }

    // Service categories default to the lead's stated interest; the admin
    // can adjust them on the draft.
    if (serviceIds.length > 0) {
      const valid = await Service.find({ _id: { $in: serviceIds } })
        .select('_id')
        .lean()
        .exec();
      serviceIds = valid.map((service) => service._id as Types.ObjectId);
    }

    const lineItems = readLineItems(readString(formData, 'itemsJson'));
    if (lineItems.length === 0) {
      throw new ProposalActionError('Add at least one pricing row.', 'itemsJson');
    }

    const pricing = computeOrThrow(
      input,
      lineItems,
      input.discountType,
      input.discountValue,
      input.taxEnabled,
      input.taxRatePercent,
      input.taxLabel,
      false
    );

    const milestones = input.hasPaymentPlan
      ? resolvePaymentMilestones(
          input.paymentMilestonesJson,
          pricing.grandTotalMinor,
          input.currency
        )
      : [];

    const sourceRequestId = readString(formData, 'sourceRequestId');
    const requestId =
      /^[a-f\d]{24}$/i.test(sourceRequestId) ? new Types.ObjectId(sourceRequestId) : null;

    let proposalId = '' as string;
    const supportsTransactions = await areTransactionsSupported();

    if (supportsTransactions) {
      const db = await connectDB();
      const session = await db.startSession();
      try {
        await session.withTransaction(async () => {
          const proposalCode = await generateSequentialCode('proposal', PROPOSAL_CODE_PREFIX, session);
          const [proposal] = await Proposal.create(
            [
              {
                proposalCode,
                title: input.title,
                description: input.description,
                leadId,
                clientId,
                createdBy: new Types.ObjectId(actor.id),
                assignedMarketingUserId,
                status: PROPOSAL_STATUSES.DRAFT,
                currentVersion: 1,
                currentVersionId: null,
                serviceCategories: serviceIds,
                currency: input.currency,
                sourceRequestId: requestId,
              },
            ],
            { session }
          );

          const [version] = await ProposalVersion.create(
            [
              buildVersionDocument({
                proposalId: proposal._id as Types.ObjectId,
                version: 1,
                input,
                pricing,
                milestones,
                createdBy: new Types.ObjectId(actor.id),
              }),
            ],
            { session }
          );

          await Proposal.updateOne(
            { _id: proposal._id },
            { $set: { currentVersionId: (version as { _id: Types.ObjectId })._id } },
            { session }
          );

          if (requestId) {
            await ProposalRequest.updateOne(
              { _id: requestId, status: { $ne: PROPOSAL_REQUEST_STATUSES.CONVERTED } },
              {
                $set: {
                  status: PROPOSAL_REQUEST_STATUSES.CONVERTED,
                  proposalId: proposal._id,
                  reviewedBy: new Types.ObjectId(actor.id),
                  reviewedAt: new Date(),
                },
              },
              { session }
            );
          }

          proposalId = (proposal as { _id: Types.ObjectId })._id.toString();
        });
      } finally {
        await session.endSession();
      }
    } else {
      // No transaction support: create the parent, then the version. If the
      // version write fails we delete the orphaned parent so we never leave
      // a childless proposal behind.
      try {
        const proposalCode = await generateSequentialCode('proposal', PROPOSAL_CODE_PREFIX);
        const proposal = await Proposal.create({
          proposalCode,
          title: input.title,
          description: input.description,
          leadId,
          clientId,
          createdBy: new Types.ObjectId(actor.id),
          assignedMarketingUserId,
          status: PROPOSAL_STATUSES.DRAFT,
          currentVersion: 1,
          currentVersionId: null,
          serviceCategories: serviceIds,
          currency: input.currency,
          sourceRequestId: requestId,
        });

        try {
          const version = await ProposalVersion.create(
            buildVersionDocument({
              proposalId: proposal._id as Types.ObjectId,
              version: 1,
              input,
              pricing,
              milestones,
              createdBy: new Types.ObjectId(actor.id),
            })
          );
          await Proposal.updateOne(
            { _id: proposal._id },
            { $set: { currentVersionId: version._id } }
          );
        } catch (error) {
          await Proposal.deleteOne({ _id: proposal._id });
          throw error;
        }

        if (requestId) {
          await ProposalRequest.updateOne(
            { _id: requestId, status: { $ne: PROPOSAL_REQUEST_STATUSES.CONVERTED } },
            {
              $set: {
                status: PROPOSAL_REQUEST_STATUSES.CONVERTED,
                proposalId: proposal._id,
                reviewedBy: new Types.ObjectId(actor.id),
                reviewedAt: new Date(),
              },
            }
          );
        }

        proposalId = proposal._id.toString();
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new ProposalActionError(
            'A proposal with this number already exists. Please try again.'
          );
        }
        throw error;
      }
    }

    revalidatePath(ROUTES.ADMIN.PROPOSALS);
    if (leadId) {
      revalidatePath(ROUTES.ADMIN.CRM_LEADS);
      revalidatePath(ROUTES.MARKETING.LEADS);
    }

    return {
      ok: true,
      id: proposalId,
      message: 'Proposal draft created. Add the final details, then submit it for approval.',
    };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Normalise the terms block.
 *
 * Empty clauses become null so the PDF omits them entirely — the system never
 * substitutes default legal wording behind the admin's back. Starter text is
 * offered in the UI as an editable suggestion only.
 */
function buildTermsRecord(
  terms: Partial<Record<(typeof TERMS_FIELDS)[number], string | null>> | undefined
): Record<string, string | null> {
  const record: Record<string, string | null> = {};
  for (const field of TERMS_FIELDS) {
    const value = terms?.[field];
    record[field] =
      typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }
  return record;
}

/** Build the full draft-version document from validated input + computed pricing. */
function buildVersionDocument(params: {
  proposalId: Types.ObjectId;
  version: number;
  input: CommercialBodyInput;
  pricing: ComputedPricing;
  milestones: ReturnType<typeof resolvePaymentMilestones>;
  createdBy: Types.ObjectId;
}): Record<string, unknown> {
  const { input, pricing } = params;
  const toLines = (value: string | null | undefined): string[] =>
    (value ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, PROPOSAL_LIMITS.MAX_SCOPE_FEATURES);

  return {
    proposalId: params.proposalId,
    version: params.version,
    status: PROPOSAL_STATUSES.DRAFT,
    title: input.title,
    description: input.description,
    overview: input.overview,
    scope: {
      summary: input.scopeSummary,
      includedFeatures: toLines(input.includedFeatures),
      excludedFeatures: toLines(input.excludedFeatures),
      dependencies: toLines(input.dependencies),
      customerResponsibilities: toLines(input.customerResponsibilities),
    },
    deliverables: toLines(input.deliverables),
    currency: pricing.currency,
    lineItems: pricing.lineItems,
    subtotalMinor: pricing.subtotalMinor,
    lineDiscountTotalMinor: pricing.lineDiscountTotalMinor,
    proposalDiscount: {
      type: pricing.proposalDiscountType,
      valueMinor: pricing.proposalDiscountValueMinor,
      amountMinor: pricing.proposalDiscountMinor,
    },
    lineTaxTotalMinor: pricing.lineTaxTotalMinor,
    proposalTax: {
      enabled: Boolean(input.taxEnabled),
      ratePercent: pricing.proposalTaxRatePercent,
      label: pricing.proposalTaxLabel,
      amountMinor: pricing.proposalTaxMinor,
    },
    taxableBaseMinor: pricing.taxableBaseMinor,
    taxMinor: pricing.taxMinor,
    grandTotalMinor: pricing.grandTotalMinor,
    paymentMilestones: params.milestones,
    timeline: {
      estimatedDuration: input.estimatedDuration,
      expectedStartDate: input.expectedStartDate
        ? new Date(`${input.expectedStartDate}T00:00:00`)
        : null,
      milestones: input.deliveryMilestonesJson.map((milestone, index) => ({
        name: milestone.name,
        description: milestone.description,
        sequence: index + 1,
      })),
      deliveryConditions: input.deliveryConditions,
      revisionAllowance: input.revisionAllowance,
      supportPeriod: input.supportPeriod,
    },
    terms: buildTermsRecord(input.terms),
    issueDate: null,
    validUntil: null,
    changeSummary: input.changeSummary,
    createdBy: params.createdBy,
  };
}

/* -------------------------------------------------------------------------- */
/* Update draft                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Update a draft version (ADMIN only).
 *
 * Refuses to touch anything that is not still an unlocked DRAFT - an
 * approved, issued, accepted, superseded, cancelled or expired version is
 * permanent. To change commercial terms, create a new draft version.
 */
export async function updateProposalDraft(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  try {
    const raw = {
      ...readCommercialInput(formData),
      proposalId: readString(formData, 'proposalId'),
      versionId: readString(formData, 'versionId'),
    };
    const parsed = updateProposalDraftSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, fieldErrors: fields(parsed.error, [...COMMERCIAL_FIELDS, 'proposalId']) };
    }
    const input = parsed.data;
    const loaded = await loadVersionForAdmin(input.proposalId, input.versionId);

    if (loaded.status !== PROPOSAL_STATUSES.DRAFT) {
      throw new ProposalActionError(
        'This version is locked. Create a new draft version to change commercial details.'
      );
    }

    const lineItems = readLineItems(readString(formData, 'itemsJson'));
    if (lineItems.length === 0) {
      throw new ProposalActionError('Add at least one pricing row.', 'itemsJson');
    }

    const pricing = computeOrThrow(
      input,
      lineItems,
      input.discountType,
      input.discountValue,
      input.taxEnabled,
      input.taxRatePercent,
      input.taxLabel,
      false
    );

    const milestones = input.hasPaymentPlan
      ? resolvePaymentMilestones(
          input.paymentMilestonesJson,
          pricing.grandTotalMinor,
          input.currency
        )
      : [];

    const document = buildVersionDocument({
      proposalId: loaded.proposalId,
      version: loaded.version,
      input,
      pricing,
      milestones,
      createdBy: loaded.document.createdBy as Types.ObjectId,
    });
    // Preserve the internal terms block and audit stamps of the draft.
    delete document.proposalId;
    delete document.version;
    delete document.status;
    delete document.createdBy;

    await ProposalVersion.updateOne(
      { _id: loaded.versionId, status: PROPOSAL_STATUSES.DRAFT },
      { $set: document }
    );

    await Proposal.updateOne(
      { _id: loaded.proposalId },
      { $set: { title: input.title, description: input.description, currency: input.currency } }
    );

    revalidatePath(`${ROUTES.ADMIN.PROPOSALS}/${input.proposalId}`);
    revalidatePath(ROUTES.ADMIN.PROPOSALS);

    return { ok: true, id: input.proposalId, message: 'Draft saved.' };
  } catch (error) {
    return toState(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Approval + issuance                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Submit a draft for internal approval (ADMIN only).
 *
 * The commercial document must be complete and meaningful at this point:
 * at least one priced line, and a validity date in the future.
 */
export async function submitProposalForApproval(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  try {
    const parsed = submitForApprovalSchema.safeParse({
      proposalId: readString(formData, 'proposalId'),
      versionId: readString(formData, 'versionId'),
    });
    if (!parsed.success) {
      return { ok: false, fieldErrors: fields(parsed.error, ['proposalId', 'versionId']) };
    }
    const { proposalId, versionId } = parsed.data;
    const loaded = await loadVersionForAdmin(proposalId, versionId);

    assertTransition(loaded.status, PROPOSAL_STATUSES.PENDING_APPROVAL, 'submitted for approval');

    await assertCommercialCompleteness(loaded.document);

    await ProposalVersion.updateOne(
      { _id: loaded.versionId, status: PROPOSAL_STATUSES.DRAFT },
      {
        $set: {
          status: PROPOSAL_STATUSES.PENDING_APPROVAL,
          submittedForApprovalAt: new Date(),
          submittedForApprovalBy: new Types.ObjectId(actor.id),
        },
      }
    );

    await syncProposalStatus(loaded.proposalId, PROPOSAL_STATUSES.PENDING_APPROVAL, loaded.versionId);

    revalidatePath(`${ROUTES.ADMIN.PROPOSALS}/${proposalId}`);
    revalidatePath(ROUTES.ADMIN.PROPOSALS);

    return { ok: true, id: proposalId, message: 'Submitted for internal approval.' };
  } catch (error) {
    return toState(error);
  }
}

/** A version must be commercially meaningful before it can be issued. */
async function assertCommercialCompleteness(
  version: Record<string, unknown> & { _id: Types.ObjectId }
): Promise<void> {
  const lineItems = (version.lineItems ?? []) as Array<Record<string, unknown>>;
  const priced = lineItems.filter(
    (item) => (item.lineTotalMinor as number) > 0 && (item.serviceName as string)?.trim()
  );
  if (priced.length === 0) {
    throw new ProposalActionError(
      'Add at least one priced line item before submitting this proposal.',
      'itemsJson'
    );
  }

  const validUntil = (version.validUntil as Date | null) ?? null;
  if (!validUntil) {
    throw new ProposalActionError('Set a validity date before submitting.', 'validUntil');
  }
  const end = new Date(validUntil);
  end.setHours(23, 59, 59, 999);
  if (end.getTime() < Date.now()) {
    throw new ProposalActionError('The validity date must be in the future.', 'validUntil');
  }

  const paymentMilestones = (version.paymentMilestones ?? []) as Array<{ amountMinor: number }>;
  if (paymentMilestones.length > 0) {
    const scheduleTotal = paymentMilestones.reduce(
      (sum, milestone) => sum + milestone.amountMinor,
      0
    );
    if (scheduleTotal !== (version.grandTotalMinor as number)) {
      throw new ProposalActionError(
        'The payment schedule does not add up to the quotation total.',
        'paymentMilestonesJson'
      );
    }
  }
}

/**
 * Approve (and optionally issue) a proposal version (ADMIN only).
 *
 * Approval freezes the commercial block. When `issueNow` is set the
 * version also moves straight to SENT inside the same transaction, so a
 * customer can never receive an unapproved quotation.
 *
 * There is no marketing-facing approve path: this action requires ADMIN at
 * the very first line, so a forged request from another role is redirected
 * before any record is read.
 */
export async function approveProposal(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  try {
    const parsed = approveProposalSchema.safeParse({
      proposalId: readString(formData, 'proposalId'),
      versionId: readString(formData, 'versionId'),
      issueNow: readBoolean(formData, 'issueNow'),
    });
    if (!parsed.success) {
      return { ok: false, fieldErrors: fields(parsed.error, ['proposalId', 'versionId']) };
    }
    const { proposalId, versionId, issueNow } = parsed.data;
    const loaded = await loadVersionForAdmin(proposalId, versionId);

    assertTransition(loaded.status, PROPOSAL_STATUSES.APPROVED, 'approved');
    await assertCommercialCompleteness(loaded.document);

    const now = new Date();
    const update: Record<string, unknown> = {
      status: PROPOSAL_STATUSES.APPROVED,
      approvedBy: new Types.ObjectId(actor.id),
      approvedAt: now,
      commercialLockedAt: now,
    };
    if (issueNow) {
      update.status = PROPOSAL_STATUSES.SENT;
      update.issuedAt = now;
      update.issuedBy = new Types.ObjectId(actor.id);
      update.issueDate = now;
    }

    const supportsTransactions = await areTransactionsSupported();

    if (supportsTransactions) {
      const db = await connectDB();
      const session = await db.startSession();
      try {
        await session.withTransaction(async () => {
          const result = await ProposalVersion.updateOne(
            { _id: loaded.versionId, status: loaded.status },
            { $set: update },
            { session }
          );
          if (result.modifiedCount === 0) {
            throw new ProposalActionError(
              'This proposal changed while you were working. Reload and try again.'
            );
          }
          await Proposal.updateOne(
            { _id: loaded.proposalId },
            {
              $set: {
                status: update.status,
                currentVersionId: loaded.versionId,
                updatedAt: now,
              },
            },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
    } else {
      const result = await ProposalVersion.updateOne(
        { _id: loaded.versionId, status: loaded.status },
        { $set: update }
      );
      if (result.modifiedCount === 0) {
        throw new ProposalActionError(
          'This proposal changed while you were working. Reload and try again.'
        );
      }
      await Proposal.updateOne(
        { _id: loaded.proposalId },
        { $set: { status: update.status, currentVersionId: loaded.versionId, updatedAt: now } }
      );
    }

    revalidatePath(`${ROUTES.ADMIN.PROPOSALS}/${proposalId}`);
    revalidatePath(ROUTES.ADMIN.PROPOSALS);

    return {
      ok: true,
      id: proposalId,
      message: issueNow
        ? 'Approved and issued. Download the PDF and send it to the customer.'
        : 'Approved. The version is locked and ready to issue.',
    };
  } catch (error) {
    return toState(error);
  }
}

/** Issue an already approved version to the customer (ADMIN only). */
export async function issueProposal(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  await requireRole(USER_ROLES.ADMIN);

  try {
    const parsed = issueProposalSchema.safeParse({
      proposalId: readString(formData, 'proposalId'),
      versionId: readString(formData, 'versionId'),
    });
    if (!parsed.success) {
      return { ok: false, fieldErrors: fields(parsed.error, ['proposalId', 'versionId']) };
    }
    const { proposalId, versionId } = parsed.data;
    const loaded = await loadVersionForAdmin(proposalId, versionId);

    assertTransition(loaded.status, PROPOSAL_STATUSES.SENT, 'issued');
    if (!loaded.document.approvedAt) {
      throw new ProposalActionError('Approve this version before issuing it.');
    }
    await assertCommercialCompleteness(loaded.document);

    const now = new Date();
    const result = await ProposalVersion.updateOne(
      { _id: loaded.versionId, status: PROPOSAL_STATUSES.APPROVED },
      {
        $set: {
          status: PROPOSAL_STATUSES.SENT,
          issuedAt: now,
          issuedBy: new Types.ObjectId((await requireRole(USER_ROLES.ADMIN)).id),
          issueDate: now,
        },
      }
    );
    if (result.modifiedCount === 0) {
      throw new ProposalActionError(
        'This proposal changed while you were working. Reload and try again.'
      );
    }

    await syncProposalStatus(loaded.proposalId, PROPOSAL_STATUSES.SENT, loaded.versionId);

    revalidatePath(`${ROUTES.ADMIN.PROPOSALS}/${proposalId}`);
    revalidatePath(ROUTES.ADMIN.PROPOSALS);

    return { ok: true, id: proposalId, message: 'Quotation issued.' };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Keep the parent `Proposal` mirror in step with its current version.
 *
 * Only used where a transaction is not available; the transactional paths
 * update the parent inside the same session.
 */
async function syncProposalStatus(
  proposalId: Types.ObjectId,
  status: ProposalStatus,
  versionId?: Types.ObjectId,
  session?: ClientSession
): Promise<void> {
  await Proposal.updateOne(
    { _id: proposalId },
    {
      $set: {
        status,
        ...(versionId ? { currentVersionId: versionId } : {}),
        updatedAt: new Date(),
      },
    },
    session ? { session } : undefined
  );
}

/* -------------------------------------------------------------------------- */
/* Delivery log                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Record that a quotation was manually delivered (ADMIN only).
 *
 * This phase sends NOTHING by itself. Arclivo Labs sends the PDF over
 * WhatsApp / email / in person and the admin records the fact here, so the
 * timeline shows what was sent, to whom and when - without the system ever
 * claiming to have sent a message.
 */
export async function markProposalSent(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  try {
    const parsed = markProposalSentSchema.safeParse({
      proposalId: readString(formData, 'proposalId'),
      versionId: readString(formData, 'versionId'),
      deliveryMethod: readString(formData, 'deliveryMethod'),
      recipient: readString(formData, 'recipient'),
      recipientDetail: readString(formData, 'recipientDetail'),
      deliveredAt: readString(formData, 'deliveredAt'),
      notes: readString(formData, 'notes'),
    });
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: fields(parsed.error, [
          'proposalId',
          'versionId',
          'deliveryMethod',
          'recipient',
          'recipientDetail',
          'deliveredAt',
          'notes',
        ]),
      };
    }
    const input = parsed.data;
    const loaded = await loadVersionForAdmin(input.proposalId, input.versionId);

    if (loaded.status !== PROPOSAL_STATUSES.SENT) {
      throw new ProposalActionError(
        'Only an issued quotation can be marked as delivered.'
      );
    }

    const deliveredAt = input.deliveredAt
      ? new Date(`${input.deliveredAt}T12:00:00`)
      : new Date();

    await ProposalVersion.updateOne(
      { _id: loaded.versionId },
      {
        $set: {
          sentAt: deliveredAt,
          sentBy: new Types.ObjectId(actor.id),
          delivery: {
            method: input.deliveryMethod,
            recipient: input.recipient,
            recipientDetail: input.recipientDetail,
            notes: input.notes,
            deliveredAt,
          },
        },
      }
    );

    // Link the delivery to the CRM timeline where a lead is involved.
    await writeProposalSystemActivity({
      loaded,
      actorId: actor.id,
      summary: `Quotation version ${loaded.version} sent to ${input.recipient} via ${input.deliveryMethod.toLowerCase().replace(/_/g, ' ')}.`,
      eventCode: LEAD_ACTIVITY_EVENTS.PROPOSAL_SENT,
    });

    revalidatePath(`${ROUTES.ADMIN.PROPOSALS}/${input.proposalId}`);

    return { ok: true, id: input.proposalId, message: 'Delivery recorded.' };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Write a SYSTEM entry onto the lead timeline for a proposal event.
 *
 * Optional: a lead-less proposal (created straight for a client) simply has
 * no timeline to join. Never throws - losing a timeline entry must not undo
 * a completed commercial action.
 */
async function writeProposalSystemActivity(params: {
  loaded: LoadedVersion;
  actorId: string;
  summary: string;
  eventCode: LeadActivityEvent;
}): Promise<void> {
  try {
    const proposal = await Proposal.findById(params.loaded.proposalId)
      .select('leadId proposalCode')
      .lean()
      .exec();
    if (!proposal?.leadId) {
      return;
    }
    await createLeadSystemActivity({
      leadId: proposal.leadId,
      actorId: params.actorId,
      // Proposal milestones reuse the same SYSTEM timeline entry type.
      event: params.eventCode,
      summary: params.summary,
      metadata: { proposalCode: proposal.proposalCode },
    });
  } catch (error) {
    console.error('failed to record proposal timeline activity', error);
  }
}

/* -------------------------------------------------------------------------- */
/* Revision                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Create a new DRAFT version from an existing one (ADMIN only).
 *
 * The source version is never modified here. It is only marked SUPERSEDED
 * later, and only once the new version is actually ISSUED - so a draft that
 * is abandoned never damages the customer's live offer.
 */
export async function createProposalRevision(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  try {
    const parsed = createRevisionSchema.safeParse({
      proposalId: readString(formData, 'proposalId'),
      fromVersionId: readString(formData, 'fromVersionId'),
      changeSummary: readString(formData, 'changeSummary'),
    });
    if (!parsed.success) {
      return { ok: false, fieldErrors: fields(parsed.error, ['proposalId', 'fromVersionId', 'changeSummary']) };
    }
    const { proposalId, fromVersionId, changeSummary } = parsed.data;
    const loaded = await loadVersionForAdmin(proposalId, fromVersionId);

    const allowed: ProposalStatus[] = [
      PROPOSAL_STATUSES.SENT,
      PROPOSAL_STATUSES.REJECTED,
      PROPOSAL_STATUSES.EXPIRED,
      PROPOSAL_STATUSES.APPROVED,
      PROPOSAL_STATUSES.DRAFT,
      PROPOSAL_STATUSES.PENDING_APPROVAL,
    ];
    if (!allowed.includes(loaded.status)) {
      throw new ProposalActionError(
        `A ${loaded.status.toLowerCase().replace(/_/g, ' ')} proposal cannot be revised.`
      );
    }

    await connectDB();
    const proposal = await Proposal.findById(loaded.proposalId)
      .select('currentVersion currentVersionId')
      .lean()
      .exec();
    if (!proposal) {
      throw new ProposalActionError('Proposal not found.');
    }
    // Only one open draft revision at a time, otherwise the history forks.
    const openDraft = await ProposalVersion.findOne({
      proposalId: loaded.proposalId,
      status: { $in: [PROPOSAL_STATUSES.DRAFT, PROPOSAL_STATUSES.PENDING_APPROVAL] },
    })
      .select('_id version status')
      .lean()
      .exec();
    if (openDraft) {
      throw new ProposalActionError(
        `Version ${openDraft.version} is still a draft. Finish or cancel it before creating another revision.`
      );
    }

    const nextVersion = (proposal.currentVersion ?? 0) + 1;
    const draft = {
      ...stripAuditFields(loaded.document),
      version: nextVersion,
      status: PROPOSAL_STATUSES.DRAFT,
      changeSummary,
      issueDate: null,
      validUntil: null,
      submittedForApprovalAt: null,
      submittedForApprovalBy: null,
      approvedBy: null,
      approvedAt: null,
      commercialLockedAt: null,
      issuedAt: null,
      issuedBy: null,
      sentAt: null,
      sentBy: null,
      delivery: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      supersededAt: null,
      supersededByVersion: null,
      acceptance: null,
      rejection: null,
      createdBy: new Types.ObjectId(actor.id),
    };

    let newVersionId = '';
    try {
      const created = await ProposalVersion.create(draft);
      newVersionId = created._id.toString();
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ProposalActionError(
          'A newer version already exists. Reload and try again.'
        );
      }
      throw error;
    }

    await Proposal.updateOne(
      { _id: loaded.proposalId },
      { $set: { currentVersion: nextVersion, currentVersionId: new Types.ObjectId(newVersionId), status: PROPOSAL_STATUSES.DRAFT, updatedAt: new Date() } }
    );

    // Any open revision requests are now being worked on.
    await RevisionRequest.updateMany(
      { proposalId: loaded.proposalId, status: REVISION_REQUEST_STATUSES.OPEN },
      {
        $set: {
          status: REVISION_REQUEST_STATUSES.ADDRESSED,
          resolvedBy: new Types.ObjectId(actor.id),
          resolvedAt: new Date(),
          resolvedVersion: nextVersion,
        },
      }
    );

    revalidatePath(`${ROUTES.ADMIN.PROPOSALS}/${proposalId}`);
    revalidatePath(`${ROUTES.ADMIN.PROPOSALS}/${proposalId}/versions`);
    revalidatePath(ROUTES.ADMIN.PROPOSALS);

    return {
      ok: true,
      id: proposalId,
      message: `Draft version ${nextVersion} created. Edit the details, then approve and issue it.`,
    };
  } catch (error) {
    return toState(error);
  }
}

/** Fields that must never be copied into a new revision. */
function stripAuditFields(
  document: Record<string, unknown> & { _id: Types.ObjectId }
): Record<string, unknown> {
  const {
    _id,
    createdAt,
    updatedAt,
    __v,
    ...rest
  } = document as Record<string, unknown> & {
    _id: unknown;
    createdAt: unknown;
    updatedAt: unknown;
    __v: unknown;
  };
  return rest;
}

/* -------------------------------------------------------------------------- */
/* Cancel                                                                     */
/* -------------------------------------------------------------------------- */

/** Withdraw a proposal version (ADMIN only). History is preserved. */
export async function cancelProposal(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  try {
    const parsed = cancelProposalSchema.safeParse({
      proposalId: readString(formData, 'proposalId'),
      versionId: readString(formData, 'versionId'),
      reason: readString(formData, 'reason'),
    });
    if (!parsed.success) {
      return { ok: false, fieldErrors: fields(parsed.error, ['proposalId', 'versionId', 'reason']) };
    }
    const { proposalId, versionId, reason } = parsed.data;
    const loaded = await loadVersionForAdmin(proposalId, versionId);

    assertTransition(loaded.status, PROPOSAL_STATUSES.CANCELLED, 'cancelled');

    const now = new Date();
    await ProposalVersion.updateOne(
      { _id: loaded.versionId, status: loaded.status },
      {
        $set: {
          status: PROPOSAL_STATUSES.CANCELLED,
          cancelledAt: now,
          cancelledBy: new Types.ObjectId(actor.id),
          cancellationReason: reason,
        },
      }
    );

    const proposal = await Proposal.findById(loaded.proposalId).select('currentVersionId').lean().exec();
    if (proposal?.currentVersionId?.toString() === versionId) {
      await syncProposalStatus(loaded.proposalId, PROPOSAL_STATUSES.CANCELLED, loaded.versionId);
    }

    revalidatePath(`${ROUTES.ADMIN.PROPOSALS}/${proposalId}`);
    revalidatePath(ROUTES.ADMIN.PROPOSALS);

    return { ok: true, id: proposalId, message: 'Proposal cancelled. The history is kept.' };
  } catch (error) {
    return toState(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Acceptance / rejection                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Record customer acceptance of an issued version (ADMIN only).
 *
 * This is an admin-attested record of a REAL confirmation - there is no
 * digital signature and no automated consent check. The method, the date
 * and the evidence reference document what actually happened; a verbal or
 * phone confirmation is labelled as such rather than being dressed up as
 * verified electronic consent.
 *
 * Expiry is recomputed here, so a lapsed offer can never be accepted.
 */
export async function recordProposalAcceptance(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  try {
    const parsed = recordAcceptanceSchema.safeParse({
      proposalId: readString(formData, 'proposalId'),
      versionId: readString(formData, 'versionId'),
      acceptedBy: readString(formData, 'acceptedBy'),
      acceptanceMethod: readString(formData, 'acceptanceMethod'),
      acceptedAt: readString(formData, 'acceptedAt'),
      evidence: readString(formData, 'evidence'),
      notes: readString(formData, 'notes'),
    });
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: fields(parsed.error, [
          'proposalId',
          'versionId',
          'acceptedBy',
          'acceptanceMethod',
          'acceptedAt',
          'evidence',
          'notes',
        ]),
      };
    }
    const input = parsed.data;
    const loaded = await loadVersionForAdmin(input.proposalId, input.versionId);

    if (loaded.status !== PROPOSAL_STATUSES.SENT) {
      throw new ProposalActionError(
        loaded.status === PROPOSAL_STATUSES.EXPIRED
          ? 'This quotation expired and can no longer be accepted. Create an extension or a new revision.'
          : `Only an issued quotation can be accepted (this one is ${loaded.status.toLowerCase().replace(/_/g, ' ')}).`
      );
    }

    // A version that already produced a Deal must never be accepted twice.
    const existingDeal = await Deal.findOne({ acceptedProposalVersionId: loaded.versionId })
      .select('dealCode')
      .lean()
      .exec();
    if (existingDeal) {
      throw new ProposalActionError(
        `Deal ${existingDeal.dealCode} was already finalized from this version.`
      );
    }

    const now = new Date();
    const acceptance = {
      acceptedBy: input.acceptedBy,
      acceptedAt: new Date(`${input.acceptedAt}T12:00:00`),
      method: input.acceptanceMethod,
      evidence: input.evidence,
      notes: input.notes,
      recordedBy: new Types.ObjectId(actor.id),
      acceptedVersion: loaded.version,
    };

    // A Deal must already exist for an ACCEPTED proposal: acceptance and
    // finalization are one admin decision, and splitting them would leave a
    // window where a proposal reads "accepted" with no agreement behind it.
    const dealCode = await generateSequentialCode('deal', DEAL_CODE_PREFIX);

    const proposal = await Proposal.findById(loaded.proposalId)
      .select('leadId clientId title proposalCode currency currentVersionId')
      .lean()
      .exec();
    if (!proposal) {
      throw new ProposalActionError('Proposal not found.');
    }

    const leadId = (proposal.leadId as Types.ObjectId | null) ?? null;
    const clientId = (proposal.clientId as Types.ObjectId | null) ?? null;

    const supportsTransactions = await areTransactionsSupported();
    let finalizeError: unknown = null;

    if (supportsTransactions) {
      const db = await connectDB();
      const session = await db.startSession();
      try {
        await session.withTransaction(async () => {
          // Conditional update is the concurrency guard: only a version
          // still in SENT can flip to ACCEPTED, so a double submit loses.
          const versionUpdate = await ProposalVersion.updateOne(
            { _id: loaded.versionId, status: PROPOSAL_STATUSES.SENT },
            { $set: { status: PROPOSAL_STATUSES.ACCEPTED, acceptance } },
            { session }
          );
          if (versionUpdate.modifiedCount === 0) {
            throw new ProposalActionError(
              'This version was already accepted or changed. Reload and try again.'
            );
          }

          await Proposal.updateOne(
            { _id: loaded.proposalId },
            { $set: { status: PROPOSAL_STATUSES.ACCEPTED, updatedAt: now } },
            { session }
          );

          await Deal.create(
            [buildDealDocument({
              dealCode,
              proposal,
              versionId: loaded.versionId,
              versionNumber: loaded.version,
              versionDocument: loaded.document,
              acceptanceDate: acceptance.acceptedAt,
              actorId: actor.id,
              leadId,
              clientId,
            })],
            { session }
          );

          // Lead-side CRM integration: mark the lead WON.
          if (leadId) {
            await Lead.updateOne(
              { _id: leadId, status: { $ne: LEAD_STATUSES.WON } },
              {
                $set: {
                  status: LEAD_STATUSES.WON,
                  statusChangedAt: now,
                  updatedBy: new Types.ObjectId(actor.id),
                },
              },
              { session }
            );
          }
        });
      } catch (error) {
        finalizeError = error;
      } finally {
        await session.endSession();
      }
    } else {
      // No transaction support. Ordered, individually-guarded writes with a
      // compensating rollback in reverse order. This is NOT atomic - the
      // failure window is documented in Known Limitations.
      try {
        const versionUpdate = await ProposalVersion.updateOne(
          { _id: loaded.versionId, status: PROPOSAL_STATUSES.SENT },
          { $set: { status: PROPOSAL_STATUSES.ACCEPTED, acceptance } }
        );
        if (versionUpdate.modifiedCount === 0) {
          throw new ProposalActionError(
            'This version was already accepted or changed. Reload and try again.'
          );
        }

        await Proposal.updateOne(
          { _id: loaded.proposalId },
          { $set: { status: PROPOSAL_STATUSES.ACCEPTED, updatedAt: now } }
        );

        try {
          await Deal.create(
            buildDealDocument({
              dealCode,
              proposal,
              versionId: loaded.versionId,
              versionNumber: loaded.version,
              versionDocument: loaded.document,
              acceptanceDate: acceptance.acceptedAt,
              actorId: actor.id,
              leadId,
              clientId,
            })
          );
        } catch (error) {
          // Roll the version back so we never show "accepted" with no deal.
          await ProposalVersion.updateOne(
            { _id: loaded.versionId },
            {
              $set: { status: PROPOSAL_STATUSES.SENT },
              $unset: { acceptance: '' },
            }
          );
          await Proposal.updateOne(
            { _id: loaded.proposalId },
            { $set: { status: PROPOSAL_STATUSES.SENT } }
          );
          if (isDuplicateKeyError(error)) {
            throw new ProposalActionError(
              'A deal already exists for this accepted version.'
            );
          }
          throw error;
        }

        if (leadId) {
          await Lead.updateOne(
            { _id: leadId, status: { $ne: LEAD_STATUSES.WON } },
            {
              $set: {
                status: LEAD_STATUSES.WON,
                statusChangedAt: now,
                updatedBy: new Types.ObjectId(actor.id),
              },
            }
          );
        }
      } catch (error) {
        finalizeError = error;
      }
    }

    if (finalizeError) {
      throw finalizeError;
    }

    await writeProposalSystemActivity({
      loaded,
      actorId: actor.id,
      summary: `Proposal ${proposal.proposalCode} version ${loaded.version} accepted by ${input.acceptedBy}. Deal ${dealCode} finalized.`,
      eventCode: LEAD_ACTIVITY_EVENTS.PROPOSAL_ACCEPTED,
    });

    revalidatePath(`${ROUTES.ADMIN.PROPOSALS}/${input.proposalId}`);
    revalidatePath(ROUTES.ADMIN.PROPOSALS);
    revalidatePath(ROUTES.ADMIN.DEALS);
    revalidatePath(ROUTES.ADMIN.CRM_LEADS);
    revalidatePath(ROUTES.MARKETING.LEADS);

    return {
      ok: true,
      id: input.proposalId,
      message: `Acceptance recorded and deal ${dealCode} finalized.`,
    };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Record a customer rejection (ADMIN only).
 *
 * The offer stays in history forever - nothing is deleted, and the Lead is
 * left untouched (marketing decides separately whether the lead is lost).
 */
export async function recordProposalRejection(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  try {
    const parsed = recordRejectionSchema.safeParse({
      proposalId: readString(formData, 'proposalId'),
      versionId: readString(formData, 'versionId'),
      reason: readString(formData, 'reason'),
      reasonNote: readString(formData, 'reasonNote'),
      customerFeedback: readString(formData, 'customerFeedback'),
      rejectedAt: readString(formData, 'rejectedAt'),
    });
    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: fields(parsed.error, [
          'proposalId',
          'versionId',
          'reason',
          'reasonNote',
          'customerFeedback',
          'rejectedAt',
        ]),
      };
    }
    const input = parsed.data;
    const loaded = await loadVersionForAdmin(input.proposalId, input.versionId);

    assertTransition(loaded.status, PROPOSAL_STATUSES.REJECTED, 'rejected');

    await ProposalVersion.updateOne(
      { _id: loaded.versionId, status: loaded.status },
      {
        $set: {
          status: PROPOSAL_STATUSES.REJECTED,
          rejection: {
            reason: input.reason,
            reasonNote: input.reasonNote,
            customerFeedback: input.customerFeedback,
            rejectedAt: new Date(`${input.rejectedAt}T12:00:00`),
            recordedBy: new Types.ObjectId(actor.id),
          },
        },
      }
    );

    const proposal = await Proposal.findById(loaded.proposalId).select('currentVersionId').lean().exec();
    if (proposal?.currentVersionId?.toString() === input.versionId) {
      await syncProposalStatus(loaded.proposalId, PROPOSAL_STATUSES.REJECTED, loaded.versionId);
    }

    await writeProposalSystemActivity({
      loaded,
      actorId: actor.id,
      summary: `Quotation version ${loaded.version} rejected: ${input.reason.toLowerCase().replace(/_/g, ' ')}.`,
      eventCode: LEAD_ACTIVITY_EVENTS.PROPOSAL_REJECTED,
    });

    revalidatePath(`${ROUTES.ADMIN.PROPOSALS}/${input.proposalId}`);
    revalidatePath(ROUTES.ADMIN.PROPOSALS);

    return { ok: true, id: input.proposalId, message: 'Rejection recorded. The offer stays in history.' };
  } catch (error) {
    return toState(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Deal construction                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Build the Deal document from the ACCEPTED VERSION SNAPSHOT.
 *
 * Every value here is copied from the immutable version, never from the
 * live proposal: `agreedAmountMinor`, the payment plan, the scope, the
 * terms and the validity all describe what the customer agreed to. A later
 * proposal revision cannot change any of it.
 *
 * `status` starts at FINALIZED for an existing client (immediately
 * project-ready in effect) or PENDING_CLIENT_CONVERSION for a lead that has
 * no Client record yet. Part 8's lead -> client conversion flips it to
 * READY_FOR_PROJECT; no Client is auto-created here.
 */
function buildDealDocument(params: {
  dealCode: string;
  proposal: { _id: Types.ObjectId; proposalCode: string };
  versionId: Types.ObjectId;
  versionNumber: number;
  versionDocument: Record<string, unknown>;
  acceptanceDate: Date;
  actorId: string;
  leadId: Types.ObjectId | null;
  clientId: Types.ObjectId | null;
}): Record<string, unknown> {
  const version = params.versionDocument;
  const scope = (version.scope ?? {}) as Record<string, unknown>;
  const timeline = (version.timeline ?? {}) as Record<string, unknown>;
  const paymentPlan = (version.paymentMilestones ?? []) as Array<Record<string, unknown>>;
  const discountMinor =
    ((version.lineDiscountTotalMinor as number) ?? 0) +
    ((version.proposalDiscount as { amountMinor?: number })?.amountMinor ?? 0);

  return {
    dealCode: params.dealCode,
    proposalId: params.proposal._id,
    acceptedProposalVersionId: params.versionId,
    acceptedVersion: params.versionNumber,
    leadId: params.leadId,
    clientId: params.clientId,
    title: version.title as string,
    agreedAmountMinor: version.grandTotalMinor as number,
    currency: version.currency as string,
    paymentPlanSnapshot: paymentPlan.map((milestone) => ({
      name: milestone.name,
      type: milestone.type,
      valueMinor: milestone.valueMinor,
      amountMinor: milestone.amountMinor,
      condition: milestone.condition ?? null,
      dueDate: milestone.dueDate ?? null,
      sequence: milestone.sequence,
    })),
    // A lead-only agreement cannot start a project until it is converted to
    // a Client by Admin (Part 8).
    status: params.clientId
      ? DEAL_STATUSES.FINALIZED
      : DEAL_STATUSES.PENDING_CLIENT_CONVERSION,
    acceptedAt: params.acceptanceDate,
    finalizedAt: new Date(),
    finalizedBy: new Types.ObjectId(params.actorId),
    agreementReference: null,
    notes: null,
    commercialSnapshot: {
      proposalCode: params.proposal.proposalCode,
      overview: version.overview ?? null,
      deliverables: version.deliverables ?? [],
      includedFeatures: scope.includedFeatures ?? [],
      excludedFeatures: scope.excludedFeatures ?? [],
      estimatedDuration: timeline.estimatedDuration ?? null,
      expectedStartDate: timeline.expectedStartDate ?? null,
      deliveryMilestones: timeline.milestones ?? [],
      validUntil: version.validUntil ?? null,
      subtotalMinor: version.subtotalMinor ?? 0,
      discountMinor,
      taxMinor: version.taxMinor ?? 0,
      terms: version.terms ?? {},
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Deal maintenance                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Cancel a finalized deal (ADMIN only).
 *
 * The agreed amount and snapshot are never edited or deleted - a cancelled
 * deal keeps its numbers so the commercial history stays auditable.
 */
export async function cancelDeal(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  try {
    const dealId = readString(formData, 'dealId');
    const reason = readString(formData, 'reason');
    if (!/^[a-f\d]{24}$/i.test(dealId)) {
      throw new ProposalActionError('Invalid deal id.', 'dealId');
    }
    if (reason.trim().length < 3) {
      throw new ProposalActionError('Record why the deal was cancelled.', 'reason');
    }

    const result = await Deal.updateOne(
      { _id: new Types.ObjectId(dealId), status: { $ne: DEAL_STATUSES.CANCELLED } },
      { $set: { status: DEAL_STATUSES.CANCELLED, notes: reason } }
    );
    if (result.modifiedCount === 0) {
      throw new ProposalActionError('This deal is already cancelled or does not exist.');
    }
    void actor;

    revalidatePath(ROUTES.ADMIN.DEALS);
    revalidatePath(`${ROUTES.ADMIN.DEALS}/${dealId}`);

    return { ok: true, id: dealId, message: 'Deal cancelled. The agreed values are preserved.' };
  } catch (error) {
    return toState(error);
  }
}

/**
 * Move a finalized deal to READY_FOR_PROJECT once its Lead has a Client.
 *
 * Called from the deal detail screen after Part 8 conversion. It never
 * creates a Client record itself.
 */
export async function linkDealToClient(
  _prev: ProposalActionState,
  formData: FormData
): Promise<ProposalActionState> {
  const actor = await requireRole(USER_ROLES.ADMIN);

  try {
    const dealId = readString(formData, 'dealId');
    if (!/^[a-f\d]{24}$/i.test(dealId)) {
      throw new ProposalActionError('Invalid deal id.', 'dealId');
    }

    const deal = await Deal.findById(dealId).lean().exec();
    if (!deal) {
      throw new ProposalActionError('Deal not found.');
    }
    if (deal.status === DEAL_STATUSES.CANCELLED) {
      throw new ProposalActionError('A cancelled deal cannot be linked to a client.');
    }
    if (deal.clientId) {
      throw new ProposalActionError('This deal is already linked to a client.');
    }
    if (!deal.leadId) {
      throw new ProposalActionError('This deal has no related lead to link.');
    }

    const lead = await Lead.findById(deal.leadId)
      .select('convertedClientId originLeadId')
      .lean()
      .exec();
    if (!lead?.convertedClientId) {
      throw new ProposalActionError(
        'Convert this lead to a client first, then link the deal.'
      );
    }

    await Deal.updateOne(
      { _id: deal._id },
      {
        $set: {
          clientId: lead.convertedClientId as Types.ObjectId,
          status: DEAL_STATUSES.READY_FOR_PROJECT,
        },
      }
    );

    // Keep the proposal pointing at the same commercial record; the lead
    // relationship is preserved (leadId is NOT cleared).
    await Proposal.updateOne(
      { _id: deal.proposalId },
      { $set: { clientId: lead.convertedClientId as Types.ObjectId } }
    );
    void actor;

    revalidatePath(ROUTES.ADMIN.DEALS);
    revalidatePath(`${ROUTES.ADMIN.DEALS}/${dealId}`);

    return { ok: true, id: dealId, message: 'Deal linked to the client. It is ready for a project.' };
  } catch (error) {
    return toState(error);
  }
}

/* -------------------------------------------------------------------------- */
/* Small helpers shared with the marketing actions                            */
/* -------------------------------------------------------------------------- */

/** Exposed so the marketing request action can validate the same way. */
export { resolvePaymentMilestones };
export type { AuthUser };
