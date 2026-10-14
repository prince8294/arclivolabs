/**
 * Shared Part 9 types.
 *
 * Server Components pass these plain, serializable shapes to client
 * components. They never include a Mongoose document, and internal-only
 * fields (internal notes, admin triage notes) are kept OUT of the marketing
 * and client shapes so a page cannot leak them by accident.
 */

import type { AcceptanceMethod, DeliveryMethod, DiscountType, ProposalStatus, RejectionReason, RequestPriority, RevisionRequestStatus, DealStatus } from '@/lib/constants/proposals';

/** Which party the current viewer is acting as. Drives scoping + redaction. */
export type ProposalScope =
  | { kind: 'admin' }
  | { kind: 'marketing'; userId: string }
  | { kind: 'client'; userId: string };

/* -------------------------------------------------------------------------- */
/* Pricing shapes (minor units everywhere)                                     */
/* -------------------------------------------------------------------------- */

export interface ProposalLineItemView {
  serviceId: string | null;
  serviceName: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  discountType: DiscountType;
  discountValueMinor: number;
  discountMinor: number;
  netMinor: number;
  taxRatePercent: number | null;
  taxMinor: number;
  lineTotalMinor: number;
}

export interface PaymentMilestoneView {
  name: string;
  type: DiscountType;
  valueMinor: number;
  amountMinor: number;
  condition: string | null;
  dueDate: Date | null;
  sequence: number;
}

export interface DeliveryMilestoneView {
  name: string;
  description: string | null;
  sequence: number;
}

export interface ProposalVersionView {
  id: string;
  proposalId: string;
  version: number;
  status: ProposalStatus;
  title: string;
  description: string | null;
  overview: string | null;
  scope: {
    summary: string | null;
    includedFeatures: string[];
    excludedFeatures: string[];
    dependencies: string[];
    customerResponsibilities: string[];
  };
  deliverables: string[];
  currency: string;
  lineItems: ProposalLineItemView[];
  subtotalMinor: number;
  lineDiscountTotalMinor: number;
  proposalDiscount: {
    type: DiscountType;
    valueMinor: number;
    amountMinor: number;
  };
  lineTaxTotalMinor: number;
  proposalTax: {
    enabled: boolean;
    ratePercent: number | null;
    label: string | null;
    amountMinor: number;
  };
  taxableBaseMinor: number;
  taxMinor: number;
  grandTotalMinor: number;
  paymentMilestones: PaymentMilestoneView[];
  timeline: {
    estimatedDuration: string | null;
    expectedStartDate: Date | null;
    milestones: DeliveryMilestoneView[];
    deliveryConditions: string | null;
    revisionAllowance: string | null;
    supportPeriod: string | null;
  };
  terms: Record<string, string | null>;
  issueDate: Date | null;
  validUntil: Date | null;
  submittedForApprovalAt: Date | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  issuedAt: Date | null;
  sentAt: Date | null;
  delivery: {
    method: DeliveryMethod | null;
    recipient: string | null;
    recipientDetail: string | null;
    notes: string | null;
    deliveredAt: Date | null;
  } | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  supersededAt: Date | null;
  supersededByVersion: number | null;
  acceptance: {
    acceptedBy: string;
    acceptedAt: Date;
    method: AcceptanceMethod;
    evidence: string | null;
    notes: string | null;
    acceptedVersion: number;
  } | null;
  rejection: {
    reason: RejectionReason;
    reasonNote: string | null;
    customerFeedback: string | null;
    rejectedAt: Date;
  } | null;
  changeSummary: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Derived at read time; never stored (no background expiry job exists). */
  isExpired: boolean;
  /** True once the commercial block can no longer be edited. */
  isLocked: boolean;
}

/* -------------------------------------------------------------------------- */
/* Proposal list / detail                                                      */
/* -------------------------------------------------------------------------- */

export interface ProposalListItem {
  id: string;
  proposalCode: string;
  title: string;
  status: ProposalStatus;
  /** Marketing sees a DRAFT as "In preparation" with no amount. */
  isCommercialVisible: boolean;
  leadId: string | null;
  leadCode: string | null;
  leadName: string | null;
  leadCompany: string | null;
  clientId: string | null;
  clientCode: string | null;
  clientName: string | null;
  clientCompany: string | null;
  /** "LEAD-0001 - Rahul" style label for the table. */
  partyLabel: string;
  serviceNames: string[];
  currency: string;
  currentVersion: number;
  grandTotalMinor: number | null;
  validUntil: Date | null;
  createdByName: string | null;
  assignedMarketingName: string | null;
  createdAt: Date;
  updatedAt: Date;
  isExpired: boolean;
  /** Deal finalized from the accepted version, if any. */
  dealId: string | null;
  dealCode: string | null;
  openRevisionRequestCount: number;
}

export interface ProposalDetail {
  id: string;
  proposalCode: string;
  title: string;
  description: string | null;
  status: ProposalStatus;
  currency: string;
  currentVersion: number;
  leadId: string | null;
  leadCode: string | null;
  leadName: string | null;
  leadCompany: string | null;
  leadStatus: string | null;
  clientId: string | null;
  clientCode: string | null;
  clientName: string | null;
  clientCompany: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  serviceNames: string[];
  serviceCategoryIds: string[];
  createdByName: string | null;
  assignedMarketingName: string | null;
  assignedMarketingUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Whether the viewer may see internal-only fields. */
  canViewInternal: boolean;
  /** Full current version, including internal notes for admin. */
  currentVersionDetail: ProposalVersionView | null;
  /** Older versions, newest first. Issued snapshots are never mutated. */
  versions: ProposalVersionView[];
  revisionRequests: RevisionRequestView[];
  /** Deal finalized from an accepted version. */
  deal: { id: string; dealCode: string; status: DealStatus } | null;
  sourceRequest: {
    id: string;
    requestCode: string;
    requestedByName: string | null;
  } | null;
}

export interface ProposalCounts {
  total: number;
  byStatus: Record<ProposalStatus, number>;
  /**
   * Sum of grand totals grouped by currency, over OPEN statuses only.
   * Never adds currencies together: there is no conversion rate here.
   */
  pipelineValueByCurrency: Array<{ currency: string; totalMinor: number; count: number }>;
}

/** One row of the version comparison table. */
export interface VersionComparisonRow {
  version: number;
  status: ProposalStatus;
  grandTotalMinor: number | null;
  currency: string;
  issuedAt: Date | null;
  validUntil: Date | null;
  createdByName: string | null;
  approvedByName: string | null;
  changeSummary: string | null;
  /** Structured highlights against the PREVIOUS version. */
  changes: {
    amountFromMinor: number | null;
    amountToMinor: number | null;
    deliverablesChanged: boolean;
    timelineChanged: boolean;
    paymentTermsChanged: boolean;
    scopeChanged: boolean;
  };
}

/* -------------------------------------------------------------------------- */
/* Deals                                                                       */
/* -------------------------------------------------------------------------- */

export interface DealListItem {
  id: string;
  dealCode: string;
  title: string;
  status: DealStatus;
  proposalId: string;
  proposalCode: string;
  acceptedVersion: number;
  leadId: string | null;
  leadCode: string | null;
  clientId: string | null;
  clientCode: string | null;
  clientName: string | null;
  clientCompany: string | null;
  partyLabel: string;
  agreedAmountMinor: number;
  currency: string;
  finalizedAt: Date;
}

export interface DealDetail {
  id: string;
  dealCode: string;
  title: string;
  status: DealStatus;
  proposalId: string;
  proposalCode: string;
  acceptedProposalVersionId: string;
  acceptedVersion: number;
  leadId: string | null;
  leadCode: string | null;
  leadName: string | null;
  leadStatus: string | null;
  clientId: string | null;
  clientCode: string | null;
  clientName: string | null;
  clientCompany: string | null;
  clientEmail: string | null;
  agreedAmountMinor: number;
  currency: string;
  paymentPlan: PaymentMilestoneView[];
  commercialSnapshot: {
    proposalCode: string;
    overview: string | null;
    deliverables: string[];
    includedFeatures: string[];
    excludedFeatures: string[];
    estimatedDuration: string | null;
    expectedStartDate: Date | null;
    deliveryMilestones: DeliveryMilestoneView[];
    validUntil: Date | null;
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    terms: Record<string, string | null>;
  };
  acceptance: {
    acceptedBy: string;
    acceptedAt: Date;
    method: AcceptanceMethod;
    evidence: string | null;
    notes: string | null;
  } | null;
  acceptedAt: Date | null;
  finalizedAt: Date;
  finalizedByName: string | null;
  agreementReference: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface DealCounts {
  total: number;
  byStatus: Record<DealStatus, number>;
  /** Grouped by currency - INR and USD are never summed together. */
  agreedValueByCurrency: Array<{ currency: string; totalMinor: number; count: number }>;
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                    */
/* -------------------------------------------------------------------------- */

export interface ProposalRequestListItem {
  id: string;
  requestCode: string;
  status: 'SUBMITTED' | 'IN_REVIEW' | 'CONVERTED' | 'DECLINED';
  partyLabel: string;
  partyCode: string | null;
  leadId: string | null;
  clientId: string | null;
  requestedServices: string[];
  requirements: string | null;
  expectedBudgetMinor: number | null;
  currency: string;
  expectedTimeline: string | null;
  customerNotes: string | null;
  priority: RequestPriority;
  requestedByName: string | null;
  requestedById: string | null;
  proposalId: string | null;
  proposalCode: string | null;
  adminNotes: string | null;
  createdAt: Date;
}

export interface RevisionRequestView {
  id: string;
  proposalId: string;
  againstVersion: number;
  requestedChanges: string | null;
  reason: string | null;
  customerFeedback: string | null;
  requestedBudgetMinor: number | null;
  currency: string;
  status: RevisionRequestStatus;
  adminResponse: string | null;
  resolvedVersion: number | null;
  requestedByName: string | null;
  createdAt: Date;
}

/* -------------------------------------------------------------------------- */
/* Select options                                                              */
/* -------------------------------------------------------------------------- */

export interface ProposalPartyOption {
  kind: 'lead' | 'client';
  id: string;
  code: string;
  name: string;
  company: string | null;
  extra: string | null;
}

export interface ServiceCatalogOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface AssignableMarketingOption {
  id: string;
  name: string;
  marketingCode: string | null;
}