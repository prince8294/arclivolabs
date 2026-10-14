import Badge from '@/components/ui/badge';
import {
  BILLING_MILESTONE_STATUS_LABELS,
  BILLING_MILESTONE_STATUSES,
  INVOICE_PAYMENT_STATUS_LABELS,
  INVOICE_PAYMENT_STATUSES,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUSES,
  INVOICE_TYPE_LABELS,
  INVOICE_TYPES,
  type BillingMilestoneStatus,
  type InvoicePaymentStatus,
  type InvoiceStatus,
  type InvoiceType,
} from '@/lib/constants/enums';

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  switch (status) {
    case INVOICE_STATUSES.ISSUED:
      return (
        <Badge variant="success" className="font-medium">
          {INVOICE_STATUS_LABELS[status]}
        </Badge>
      );
    case INVOICE_STATUSES.DRAFT:
      return (
        <Badge variant="outline" className="text-muted-foreground border-dashed">
          {INVOICE_STATUS_LABELS[status]}
        </Badge>
      );
    case INVOICE_STATUSES.VOID:
      return (
        <Badge variant="destructive" className="font-medium">
          {INVOICE_STATUS_LABELS[status]}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function InvoicePaymentStatusBadge({
  status,
  isOverdue,
}: {
  status: InvoicePaymentStatus;
  isOverdue?: boolean;
}) {
  if (isOverdue) {
    return (
      <Badge variant="destructive" className="font-medium">
        Overdue
      </Badge>
    );
  }

  switch (status) {
    case INVOICE_PAYMENT_STATUSES.PAID:
      return (
        <Badge variant="success" className="font-medium">
          {INVOICE_PAYMENT_STATUS_LABELS[status]}
        </Badge>
      );
    case INVOICE_PAYMENT_STATUSES.PARTIALLY_PAID:
      return (
        <Badge variant="warning" className="font-medium">
          {INVOICE_PAYMENT_STATUS_LABELS[status]}
        </Badge>
      );
    case INVOICE_PAYMENT_STATUSES.UNPAID:
      return (
        <Badge variant="secondary" className="font-medium">
          {INVOICE_PAYMENT_STATUS_LABELS[status]}
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function InvoiceTypeBadge({ type }: { type: InvoiceType }) {
  switch (type) {
    case INVOICE_TYPES.MILESTONE:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          {INVOICE_TYPE_LABELS[type]}
        </span>
      );
    case INVOICE_TYPES.FINAL:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          {INVOICE_TYPE_LABELS[type]}
        </span>
      );
    case INVOICE_TYPES.STANDARD:
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
          {INVOICE_TYPE_LABELS[type] || type}
        </span>
      );
  }
}

export function BillingMilestoneStatusBadge({ status }: { status: BillingMilestoneStatus }) {
  switch (status) {
    case BILLING_MILESTONE_STATUSES.BILLED:
      return (
        <Badge variant="success" className="font-medium">
          {BILLING_MILESTONE_STATUS_LABELS[status]}
        </Badge>
      );
    case BILLING_MILESTONE_STATUSES.NOT_BILLED:
      return (
        <Badge variant="secondary" className="font-medium">
          {BILLING_MILESTONE_STATUS_LABELS[status]}
        </Badge>
      );
    case BILLING_MILESTONE_STATUSES.CANCELLED:
      return (
        <Badge variant="destructive" className="font-medium">
          {BILLING_MILESTONE_STATUS_LABELS[status]}
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
